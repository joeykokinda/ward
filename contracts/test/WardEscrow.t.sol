// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {WardEscrow} from "../src/WardEscrow.sol";
import {WardReputationHook} from "../src/WardReputationHook.sol";
import {IERC8183, IACPHook, Job, JobStatus} from "../src/interfaces/IERC8183.sol";

/// @notice Base fixture wiring USDC + registry + ERC-8183 escrow.
abstract contract WardFixture is Test {
    MockUSDC internal usdc;
    WorkerRegistry internal registry;
    WardEscrow internal escrow;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent"); // client
    address internal evaluator = makeAddr("evaluator"); // CRE oracle
    address internal worker = makeAddr("worker"); // provider
    address internal otherWorker = makeAddr("otherWorker");

    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant DEMO_BUDGET = 75 * USDC_UNIT;
    uint256 internal constant THRESHOLD = 100 * USDC_UNIT;
    uint256 internal constant PER_JOB_CAP = 200 * USDC_UNIT;
    uint256 internal constant DAILY_CAP = 300 * USDC_UNIT;
    uint256 internal constant STAKE = 50 * USDC_UNIT;

    bytes32 internal constant DEVICE = bytes32("prop-1-router");
    bytes32 internal constant OK = bytes32("ok");

    function deployStack() internal {
        usdc = new MockUSDC();
        registry = new WorkerRegistry(usdc, owner);
        escrow = new WardEscrow(usdc, registry, owner, PER_JOB_CAP, DAILY_CAP, THRESHOLD);
        vm.prank(owner);
        registry.setJobEscrow(address(escrow));
    }

    function fundAgent(uint256 amount) internal {
        usdc.mint(agent, amount);
        vm.prank(agent);
        usdc.approve(address(escrow), amount);
    }

    function registerAndStake(address account, string memory handle, uint256 stakeAmount) internal {
        usdc.mint(account, stakeAmount);
        vm.startPrank(account);
        registry.register(handle, string.concat(handle, ".ward-agent.eth"), "wifi,router", "NYC");
        usdc.approve(address(registry), stakeAmount);
        registry.stakeUSDC(stakeAmount);
        vm.stopPrank();
    }

    /// @dev Full create+budget+fund helper. Provider must already be active.
    function openFunded(address provider, uint256 budget) internal returns (uint256 jobId) {
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        jobId = escrow.createJob(provider, evaluator, expiredAt, "fix device", address(0));
        vm.prank(agent);
        escrow.setBudget(jobId, budget, "");
        vm.prank(agent);
        escrow.fund(jobId, "");
    }
}

contract WardEscrowLifecycleTest is WardFixture {
    function setUp() public {
        deployStack();
    }

    /*//////////////////////////////////////////////////////////////
                         FULL ERC-8183 LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_HappyPath_CreateFundSubmitComplete() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;

        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        assertEq(jobId, 1, "first job id");
        Job memory job = escrow.getJob(jobId);
        assertEq(job.client, agent);
        assertEq(job.provider, worker);
        assertEq(job.evaluator, evaluator);
        assertEq(uint8(job.status), uint8(JobStatus.Open));

        vm.prank(agent);
        escrow.setBudget(jobId, DEMO_BUDGET, "");
        assertEq(escrow.getJob(jobId).budget, DEMO_BUDGET);

        vm.prank(agent);
        escrow.fund(jobId, "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
        assertEq(usdc.balanceOf(address(escrow)), DEMO_BUDGET, "escrow holds funds");

        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Submitted));

        uint256 repBefore = registry.reputationOf(worker);
        vm.prank(evaluator);
        escrow.complete(jobId, OK, "");

        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Completed));
        assertEq(usdc.balanceOf(worker), DEMO_BUDGET, "provider paid");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow emptied");
        assertEq(registry.reputationOf(worker), repBefore + escrow.REPUTATION_PER_JOB(), "reputation bumped");
    }

    function test_HappyPath_EmitsAllStandardEvents() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;

        vm.expectEmit(true, true, true, true);
        emit IERC8183.JobCreated(1, agent, worker, evaluator, expiredAt, address(0));
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));

        vm.expectEmit(true, false, false, true);
        emit IERC8183.BudgetSet(jobId, DEMO_BUDGET);
        vm.prank(agent);
        escrow.setBudget(jobId, DEMO_BUDGET, "");

        vm.expectEmit(true, true, false, true);
        emit IERC8183.JobFunded(jobId, agent, DEMO_BUDGET);
        vm.prank(agent);
        escrow.fund(jobId, "");

        vm.expectEmit(true, true, false, true);
        emit IERC8183.JobSubmitted(jobId, worker, DEVICE);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");

        vm.expectEmit(true, true, false, true);
        emit IERC8183.JobCompleted(jobId, evaluator, OK);
        vm.expectEmit(true, true, false, true);
        emit IERC8183.PaymentReleased(jobId, worker, DEMO_BUDGET);
        vm.prank(evaluator);
        escrow.complete(jobId, OK, "");
    }

    function test_SetProvider_ByClientWhileOpen() public {
        registerAndStake(worker, "mike", STAKE);
        registerAndStake(otherWorker, "sara", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));

        vm.expectEmit(true, true, false, false);
        emit IERC8183.ProviderSet(jobId, otherWorker);
        vm.prank(agent);
        escrow.setProvider(jobId, otherWorker);
        assertEq(escrow.getJob(jobId).provider, otherWorker);
    }

    function test_SetBudget_ByProvider() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        // provider may set the budget too (ERC-8183: client OR provider).
        vm.prank(worker);
        escrow.setBudget(jobId, DEMO_BUDGET, "");
        assertEq(escrow.getJob(jobId).budget, DEMO_BUDGET);
    }

    function test_CreateJob_AllowsZeroProvider_ThenSetLater() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        // Provider may be unset at creation (ERC-8183 setProvider exists for this).
        vm.prank(agent);
        uint256 jobId = escrow.createJob(address(0), evaluator, expiredAt, "fix device", address(0));
        assertEq(escrow.getJob(jobId).provider, address(0));
        vm.prank(agent);
        escrow.setProvider(jobId, worker);
        assertEq(escrow.getJob(jobId).provider, worker);
    }

    /*//////////////////////////////////////////////////////////////
                        ROLE / STATE GUARDS
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_NonClientFunds() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        vm.prank(agent);
        escrow.setBudget(jobId, DEMO_BUDGET, "");
        vm.prank(worker); // not the client
        vm.expectRevert(WardEscrow.NotClient.selector);
        escrow.fund(jobId, "");
    }

    function test_RevertWhen_NonProviderSubmits() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        registerAndStake(otherWorker, "sara", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(otherWorker); // not the assigned provider
        vm.expectRevert(WardEscrow.NotProvider.selector);
        escrow.submit(jobId, DEVICE, "");
    }

    function test_RevertWhen_NonEvaluatorCompletes() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");

        // Client cannot complete; only the evaluator may.
        vm.prank(agent);
        vm.expectRevert(WardEscrow.NotEvaluator.selector);
        escrow.complete(jobId, OK, "");
        // Provider cannot complete either.
        vm.prank(worker);
        vm.expectRevert(WardEscrow.NotEvaluator.selector);
        escrow.complete(jobId, OK, "");
    }

    function test_RevertWhen_CompleteBeforeSubmit() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(evaluator);
        vm.expectRevert(abi.encodeWithSelector(WardEscrow.WrongStatus.selector, JobStatus.Submitted, JobStatus.Funded));
        escrow.complete(jobId, OK, "");
    }

    function test_RevertWhen_SubmitBeforeFund() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        vm.prank(worker);
        vm.expectRevert(abi.encodeWithSelector(WardEscrow.WrongStatus.selector, JobStatus.Funded, JobStatus.Open));
        escrow.submit(jobId, DEVICE, "");
    }

    function test_RevertWhen_SetProviderByNonClient() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(address(0), evaluator, expiredAt, "fix device", address(0));
        vm.prank(worker);
        vm.expectRevert(WardEscrow.NotClient.selector);
        escrow.setProvider(jobId, worker);
    }

    function test_RevertWhen_SetBudgetByStranger() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        vm.prank(otherWorker);
        vm.expectRevert(WardEscrow.NotClientOrProvider.selector);
        escrow.setBudget(jobId, DEMO_BUDGET, "");
    }

    function test_RevertWhen_FundWithoutBudget() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "fix device", address(0));
        vm.prank(agent);
        vm.expectRevert(WardEscrow.BudgetNotSet.selector);
        escrow.fund(jobId, "");
    }

    function test_RevertWhen_UnknownJob() public {
        vm.prank(agent);
        vm.expectRevert(WardEscrow.UnknownJob.selector);
        escrow.setBudget(999, DEMO_BUDGET, "");
    }

    function test_RevertWhen_CreateJobZeroEvaluator() public {
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ZeroAddress.selector);
        escrow.createJob(address(0), address(0), expiredAt, "x", address(0));
    }

    function test_RevertWhen_ExpiredAtInPast() public {
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ExpiredAtInPast.selector);
        escrow.createJob(address(0), evaluator, block.timestamp, "x", address(0));
    }

    /*//////////////////////////////////////////////////////////////
                    WARD EXTRA: ONLY-ACTIVE-PROVIDER
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_CreateJobWithInactiveProvider() public {
        // worker never registered/staked -> not active
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ProviderNotActiveWorker.selector);
        escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
    }

    function test_RevertWhen_SetProviderToInactive() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ProviderNotActiveWorker.selector);
        escrow.setProvider(jobId, otherWorker); // not active
    }

    function test_RevertWhen_RegisteredButUnstakedProvider() public {
        vm.prank(worker);
        registry.register("mike", "mike.ward-agent.eth", "wifi", "NYC"); // no stake
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ProviderNotActiveWorker.selector);
        escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
    }

    /*//////////////////////////////////////////////////////////////
                    WARD EXTRA: PER-JOB / DAILY CAPS
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_ExceedsPerJobCap() public {
        fundAgent(PER_JOB_CAP + 1);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.prank(agent);
        escrow.setBudget(jobId, PER_JOB_CAP + 1, "");
        // Approve so we exercise the cap, not the threshold.
        vm.prank(owner);
        escrow.setOwnerApproved(jobId, true);
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ExceedsPerJobCap.selector);
        escrow.fund(jobId, "");
    }

    function test_PerJobCap_BoundaryAllowed() public {
        fundAgent(PER_JOB_CAP);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.prank(agent);
        escrow.setBudget(jobId, PER_JOB_CAP, "");
        vm.prank(owner);
        escrow.setOwnerApproved(jobId, true);
        vm.prank(agent);
        escrow.fund(jobId, "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
    }

    function test_RevertWhen_ExceedsDailyCap() public {
        // Two jobs of 200 each total 400 > daily cap 300.
        fundAgent(PER_JOB_CAP * 2);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;

        vm.startPrank(agent);
        uint256 j1 = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(j1, PER_JOB_CAP, "");
        vm.stopPrank();
        vm.prank(owner);
        escrow.setOwnerApproved(j1, true);
        vm.prank(agent);
        escrow.fund(j1, ""); // 200 funded today

        vm.startPrank(agent);
        uint256 j2 = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(j2, PER_JOB_CAP, "");
        vm.stopPrank();
        vm.prank(owner);
        escrow.setOwnerApproved(j2, true);
        vm.prank(agent);
        vm.expectRevert(WardEscrow.ExceedsDailyCap.selector);
        escrow.fund(j2, ""); // +200 -> 400 > 300
    }

    function test_DailyCap_ResetsNextDay() public {
        fundAgent(PER_JOB_CAP * 2);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 3 days;

        vm.startPrank(agent);
        uint256 j1 = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(j1, PER_JOB_CAP, "");
        vm.stopPrank();
        vm.prank(owner);
        escrow.setOwnerApproved(j1, true);
        vm.prank(agent);
        escrow.fund(j1, "");

        vm.warp(block.timestamp + 1 days);

        vm.startPrank(agent);
        uint256 j2 = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(j2, PER_JOB_CAP, "");
        vm.stopPrank();
        vm.prank(owner);
        escrow.setOwnerApproved(j2, true);
        vm.prank(agent);
        escrow.fund(j2, "");
        assertEq(uint8(escrow.jobStatus(j2)), uint8(JobStatus.Funded));
    }

    /*//////////////////////////////////////////////////////////////
                WARD EXTRA: OWNER-APPROVAL THRESHOLD
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_AboveThresholdWithoutApproval() public {
        uint256 amount = THRESHOLD + 1;
        fundAgent(amount);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.startPrank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(jobId, amount, "");
        vm.expectRevert(WardEscrow.OwnerApprovalRequired.selector);
        escrow.fund(jobId, "");
        vm.stopPrank();
    }

    function test_AboveThreshold_WithStoredApproval() public {
        uint256 amount = THRESHOLD + 1;
        fundAgent(amount);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.startPrank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(jobId, amount, "");
        vm.stopPrank();
        vm.prank(owner);
        escrow.setOwnerApproved(jobId, true);
        vm.prank(agent);
        escrow.fund(jobId, "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
    }

    function test_AboveThreshold_WithInlineApprovalInOptParams() public {
        uint256 amount = THRESHOLD + 1;
        fundAgent(amount);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.startPrank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        escrow.setBudget(jobId, amount, "");
        // Inline approval: abi.encode(true) in optParams.
        escrow.fund(jobId, abi.encode(true));
        vm.stopPrank();
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
    }

    function test_AtThreshold_NoApprovalNeeded() public {
        fundAgent(THRESHOLD);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, THRESHOLD);
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
    }

    function test_RevertWhen_SetOwnerApprovedByNonOwner() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, agent));
        escrow.setOwnerApproved(jobId, true);
    }

    /*//////////////////////////////////////////////////////////////
                        REJECT PATHS
    //////////////////////////////////////////////////////////////*/

    function test_Reject_ByClientWhileOpen_NoRefund() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));

        vm.expectEmit(true, true, false, true);
        emit IERC8183.JobRejected(jobId, agent, OK);
        vm.prank(agent);
        escrow.reject(jobId, OK, "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Rejected));
    }

    function test_Reject_ByEvaluatorWhileFunded_RefundsClient() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        uint256 agentBalBefore = usdc.balanceOf(agent);

        vm.expectEmit(true, true, false, true);
        emit IERC8183.Refunded(jobId, agent, DEMO_BUDGET);
        vm.prank(evaluator);
        escrow.reject(jobId, bytes32("bad"), "");

        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Rejected));
        assertEq(usdc.balanceOf(agent), agentBalBefore + DEMO_BUDGET, "client refunded");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_Reject_ByEvaluatorWhileSubmitted_RefundsClient() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");

        vm.prank(evaluator);
        escrow.reject(jobId, bytes32("bad"), "");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Rejected));
        assertEq(usdc.balanceOf(agent), DEMO_BUDGET);
    }

    function test_RevertWhen_ClientRejectsFundedJob() public {
        // Once funded, the client cannot pull funds back; only evaluator rejects.
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(agent);
        vm.expectRevert(WardEscrow.NotEvaluator.selector);
        escrow.reject(jobId, OK, "");
    }

    function test_RevertWhen_EvaluatorRejectsOpenJob() public {
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.prank(evaluator);
        vm.expectRevert(WardEscrow.NotClient.selector);
        escrow.reject(jobId, OK, "");
    }

    function test_RevertWhen_RejectCompletedJob() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");
        vm.prank(evaluator);
        escrow.complete(jobId, OK, "");
        vm.prank(evaluator);
        vm.expectRevert();
        escrow.reject(jobId, OK, "");
    }

    /*//////////////////////////////////////////////////////////////
                    CLAIM REFUND / EXPIRY PATHS
    //////////////////////////////////////////////////////////////*/

    function test_ClaimRefund_AfterExpiry_FromFunded() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        uint256 agentBalBefore = usdc.balanceOf(agent);
        uint256 expiredAt = escrow.getJob(jobId).expiredAt;

        vm.warp(expiredAt + 1);
        vm.expectEmit(true, false, false, false);
        emit IERC8183.JobExpired(jobId);
        // anyone may claim
        vm.prank(otherWorker);
        escrow.claimRefund(jobId);

        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Expired));
        assertEq(usdc.balanceOf(agent), agentBalBefore + DEMO_BUDGET, "client refunded");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_ClaimRefund_AfterExpiry_FromSubmitted() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");
        uint256 expiredAt = escrow.getJob(jobId).expiredAt;

        vm.warp(expiredAt + 1);
        escrow.claimRefund(jobId);
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Expired));
        assertEq(usdc.balanceOf(agent), DEMO_BUDGET);
    }

    function test_RevertWhen_ClaimRefundBeforeExpiry() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.expectRevert(WardEscrow.NotExpiredYet.selector);
        escrow.claimRefund(jobId);
    }

    function test_RevertWhen_ClaimRefundOpenJob() public {
        // Open jobs hold no funds -> not claimable.
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(0));
        vm.warp(expiredAt + 1);
        vm.expectRevert();
        escrow.claimRefund(jobId);
    }

    function test_RevertWhen_ClaimRefundCompletedJob() public {
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 jobId = openFunded(worker, DEMO_BUDGET);
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");
        vm.prank(evaluator);
        escrow.complete(jobId, OK, "");
        vm.warp(escrow.getJob(jobId).expiredAt + 1);
        vm.expectRevert();
        escrow.claimRefund(jobId);
    }

    /*//////////////////////////////////////////////////////////////
                    OPTIONAL IACPHook WIRING
    //////////////////////////////////////////////////////////////*/

    function test_Hook_InvokedAroundLifecycle() public {
        WardReputationHook hook = new WardReputationHook();
        fundAgent(DEMO_BUDGET);
        registerAndStake(worker, "mike", STAKE);
        uint256 expiredAt = block.timestamp + 1 days;

        vm.prank(agent);
        uint256 jobId = escrow.createJob(worker, evaluator, expiredAt, "x", address(hook));
        vm.prank(agent);
        escrow.setBudget(jobId, DEMO_BUDGET, "");
        vm.prank(agent);
        escrow.fund(jobId, "");

        // fund() selector recorded by the hook.
        assertEq(hook.lastBefore(jobId), WardEscrow.fund.selector);
        assertEq(hook.lastAfter(jobId), WardEscrow.fund.selector);
    }

    function test_Hook_ZeroAddressIsNoop() public {
        // Default hook (address(0)) must not break anything; covered by the
        // happy path which uses address(0). Assert supportsInterface advertised.
        WardReputationHook hook = new WardReputationHook();
        assertTrue(hook.supportsInterface(type(IACPHook).interfaceId));
    }
}
