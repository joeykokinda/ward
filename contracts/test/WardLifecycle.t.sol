// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";
import {AuthorizedReporterVerifier} from "../src/AuthorizedReporterVerifier.sol";
import {MockCreVerifier} from "../src/mocks/MockCreVerifier.sol";
import {ICreConsumer, HealthAttestation} from "../src/interfaces/ICreConsumer.sol";
import {IWorkerRegistry} from "../src/interfaces/IWorkerRegistry.sol";

/// @notice Base fixture wiring USDC + registry + escrow with the mock verifier.
abstract contract WardFixture is Test {
    MockUSDC internal usdc;
    WorkerRegistry internal registry;
    JobEscrow internal escrow;
    MockCreVerifier internal verifier;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal worker = makeAddr("worker");
    address internal otherWorker = makeAddr("otherWorker");

    // INTERFACES.md: 6-decimal USDC, demo job 75 USDC, threshold 100 USDC.
    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant DEMO_AMOUNT = 75 * USDC_UNIT;
    uint256 internal constant THRESHOLD = 100 * USDC_UNIT;
    uint256 internal constant PER_JOB_CAP = 200 * USDC_UNIT;
    uint256 internal constant DAILY_CAP = 300 * USDC_UNIT;
    uint256 internal constant STAKE = 50 * USDC_UNIT;

    bytes32 internal constant PROP = bytes32("prop-1");
    bytes32 internal constant DEVICE = bytes32("prop-1-router");

    function deployStack() internal {
        usdc = new MockUSDC();
        registry = new WorkerRegistry(usdc, owner);
        verifier = new MockCreVerifier();
        escrow = new JobEscrow(usdc, registry, verifier, owner, PER_JOB_CAP, DAILY_CAP, THRESHOLD);
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

    function mockAttestation(uint256 jobId) internal pure returns (HealthAttestation memory) {
        return HealthAttestation({jobId: jobId, deviceId: DEVICE, healthy: true, reportTimestamp: 0, signature: ""});
    }
}

contract WardLifecycleTest is WardFixture {
    function setUp() public {
        deployStack();
    }

    /*//////////////////////////////////////////////////////////////
                         FULL HAPPY-PATH LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    function test_HappyPath_CreateAcceptDoneSettle() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);

        uint256 deadline = block.timestamp + 1 days;

        // create
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        assertEq(jobId, 1, "first job id");
        assertEq(usdc.balanceOf(address(escrow)), DEMO_AMOUNT, "escrow holds funds");
        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.Open));

        // accept
        vm.prank(worker);
        escrow.acceptJob(jobId);
        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.Accepted));
        assertEq(escrow.getJob(jobId).worker, worker);

        // markWorkDone
        vm.prank(worker);
        escrow.markWorkDone(jobId);
        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.WorkDone));

        // settle (mock verifier returns healthy by default)
        uint256 repBefore = registry.reputationOf(worker);
        vm.prank(agent);
        escrow.settle(jobId, mockAttestation(jobId));

        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.Settled));
        assertEq(usdc.balanceOf(worker), DEMO_AMOUNT, "worker paid");
        assertEq(usdc.balanceOf(address(escrow)), 0, "escrow emptied");
        assertEq(registry.reputationOf(worker), repBefore + escrow.REPUTATION_PER_JOB(), "reputation bumped");
    }

    function test_HappyPath_EmitsAllEvents() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;

        vm.expectEmit(false, false, false, true);
        emit JobEscrow.JobCreated(1, PROP, DEVICE, DEMO_AMOUNT);
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);

        vm.expectEmit(false, false, false, true);
        emit JobEscrow.JobAccepted(jobId, worker);
        vm.prank(worker);
        escrow.acceptJob(jobId);

        vm.expectEmit(false, false, false, true);
        emit JobEscrow.WorkMarkedDone(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        vm.expectEmit(false, false, false, true);
        emit JobEscrow.JobSettled(jobId, worker, DEMO_AMOUNT);
        vm.prank(agent);
        escrow.settle(jobId, mockAttestation(jobId));
    }

    /*//////////////////////////////////////////////////////////////
                            CAP ENFORCEMENT
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_ExceedsPerJobCap() public {
        fundAgent(PER_JOB_CAP + 1);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(JobEscrow.ExceedsPerJobCap.selector);
        escrow.createJob(PROP, DEVICE, PER_JOB_CAP + 1, deadline, true);
    }

    function test_PerJobCap_BoundaryAllowed() public {
        fundAgent(PER_JOB_CAP);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, PER_JOB_CAP, deadline, true);
        assertEq(escrow.getJob(jobId).amount, PER_JOB_CAP);
    }

    function test_RevertWhen_ExceedsDailyCap() public {
        // Two jobs at per-job cap (200) would total 400 > daily cap 300.
        fundAgent(PER_JOB_CAP * 2);
        uint256 deadline = block.timestamp + 1 days;

        vm.prank(agent);
        escrow.createJob(PROP, DEVICE, PER_JOB_CAP, deadline, true); // 200 escrowed today

        vm.prank(agent);
        vm.expectRevert(JobEscrow.ExceedsDailyCap.selector);
        escrow.createJob(PROP, DEVICE, PER_JOB_CAP, deadline, true); // +200 -> 400 > 300
    }

    function test_DailyCap_ResetsNextDay() public {
        fundAgent(PER_JOB_CAP * 2);
        uint256 deadline = block.timestamp + 3 days;

        vm.prank(agent);
        escrow.createJob(PROP, DEVICE, PER_JOB_CAP, deadline, true);

        // advance one full day -> daily counter resets
        vm.warp(block.timestamp + 1 days);
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, PER_JOB_CAP, deadline, true);
        assertEq(jobId, 2, "second job created next day");
    }

    /*//////////////////////////////////////////////////////////////
                        OWNER-APPROVAL THRESHOLD GATE
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_AboveThresholdWithoutApproval() public {
        uint256 amount = THRESHOLD + 1; // 100.000001 USDC
        fundAgent(amount);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(JobEscrow.OwnerApprovalRequired.selector);
        escrow.createJob(PROP, DEVICE, amount, deadline, false);
    }

    function test_AboveThreshold_WithApprovalSucceeds() public {
        uint256 amount = THRESHOLD + 1;
        fundAgent(amount);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, amount, deadline, true);
        assertEq(escrow.getJob(jobId).amount, amount);
    }

    function test_AtThreshold_NoApprovalNeeded() public {
        // amount == threshold is NOT "above" threshold; allowed without approval.
        fundAgent(THRESHOLD);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, THRESHOLD, deadline, false);
        assertEq(escrow.getJob(jobId).amount, THRESHOLD);
    }

    function test_DemoAmountBelowThreshold_Autonomous() public {
        // 75 USDC demo job is below 100 threshold -> fully autonomous.
        fundAgent(DEMO_AMOUNT);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        assertEq(escrow.getJob(jobId).amount, DEMO_AMOUNT);
    }

    /*//////////////////////////////////////////////////////////////
                        ONLY-STAKED-WORKER ACCEPTANCE
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_UnregisteredWorkerAccepts() public {
        fundAgent(DEMO_AMOUNT);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);

        vm.prank(worker); // never registered
        vm.expectRevert(JobEscrow.NotActiveWorker.selector);
        escrow.acceptJob(jobId);
    }

    function test_RevertWhen_RegisteredButUnstakedAccepts() public {
        fundAgent(DEMO_AMOUNT);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);

        // register without staking -> not active
        vm.prank(worker);
        registry.register("mike", "mike.ward-agent.eth", "wifi", "NYC");

        vm.prank(worker);
        vm.expectRevert(JobEscrow.NotActiveWorker.selector);
        escrow.acceptJob(jobId);
    }

    function test_StakedWorkerIsActive() public {
        registerAndStake(worker, "mike", STAKE);
        assertTrue(registry.isActiveWorker(worker));
        assertFalse(registry.isActiveWorker(otherWorker));
    }

    /*//////////////////////////////////////////////////////////////
                          REFUND AFTER DEADLINE
    //////////////////////////////////////////////////////////////*/

    function test_RefundExpired_AfterDeadline() public {
        fundAgent(DEMO_AMOUNT);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);

        uint256 agentBalBefore = usdc.balanceOf(agent);
        vm.warp(deadline + 1);

        vm.expectEmit(false, false, false, true);
        emit JobEscrow.JobRefunded(jobId);
        escrow.refundExpired(jobId);

        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.Refunded));
        assertEq(usdc.balanceOf(agent), agentBalBefore + DEMO_AMOUNT, "client refunded");
        assertEq(usdc.balanceOf(address(escrow)), 0);
    }

    function test_RefundExpired_FromAcceptedAndWorkDone() public {
        // Refund should work from Accepted and WorkDone too (worker abandoned).
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        vm.warp(deadline + 1);
        escrow.refundExpired(jobId);
        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.Refunded));
        assertEq(usdc.balanceOf(agent), DEMO_AMOUNT);
    }

    function test_RevertWhen_RefundBeforeDeadline() public {
        fundAgent(DEMO_AMOUNT);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);

        vm.expectRevert(JobEscrow.DeadlineNotPassed.selector);
        escrow.refundExpired(jobId);
    }

    function test_RevertWhen_RefundSettledJob() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);
        vm.prank(agent);
        escrow.settle(jobId, mockAttestation(jobId));

        vm.warp(deadline + 1);
        vm.expectRevert(); // WrongState
        escrow.refundExpired(jobId);
    }

    function test_RevertWhen_SettleAfterDeadline() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        vm.warp(deadline + 1);
        vm.prank(agent);
        vm.expectRevert(JobEscrow.DeadlinePassed.selector);
        escrow.settle(jobId, mockAttestation(jobId));
    }

    /*//////////////////////////////////////////////////////////////
                    SETTLE REJECTS UNHEALTHY / WRONG ATTESTATION
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_SettleUnhealthyDevice() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        verifier.setHealthy(false); // device still broken
        vm.prank(agent);
        vm.expectRevert(JobEscrow.DeviceNotHealthy.selector);
        escrow.settle(jobId, mockAttestation(jobId));

        // funds still escrowed, job still WorkDone
        assertEq(usdc.balanceOf(address(escrow)), DEMO_AMOUNT);
        assertEq(uint8(escrow.jobState(jobId)), uint8(JobEscrow.JobState.WorkDone));
    }

    function test_RevertWhen_VerifierRejects() public {
        // verifier reverts (unauthorized / stale attestation path).
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        verifier.setRevertMode(true);
        vm.prank(agent);
        vm.expectRevert(MockCreVerifier.MockUnauthorized.selector);
        escrow.settle(jobId, mockAttestation(jobId));
    }

    function test_RevertWhen_AttestationForWrongJob() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        HealthAttestation memory att = mockAttestation(jobId);
        att.jobId = jobId + 99; // mismatched
        vm.prank(agent);
        vm.expectRevert(JobEscrow.AttestationWrongJob.selector);
        escrow.settle(jobId, att);
    }

    function test_RevertWhen_AttestationWrongDevice() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);
        vm.prank(worker);
        escrow.markWorkDone(jobId);

        HealthAttestation memory att = mockAttestation(jobId);
        att.deviceId = bytes32("wrong-device");
        vm.prank(agent);
        vm.expectRevert(JobEscrow.AttestationWrongJob.selector);
        escrow.settle(jobId, att);
    }

    /*//////////////////////////////////////////////////////////////
                            STATE MACHINE GUARDS
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_SettleBeforeWorkDone() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);

        vm.prank(agent);
        vm.expectRevert();
        escrow.settle(jobId, mockAttestation(jobId));
    }

    function test_RevertWhen_MarkDoneByNonAssignedWorker() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        registerAndStake(otherWorker, "sara", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);

        vm.prank(otherWorker);
        vm.expectRevert(JobEscrow.NotAssignedWorker.selector);
        escrow.markWorkDone(jobId);
    }

    function test_RevertWhen_AcceptAlreadyAccepted() public {
        fundAgent(DEMO_AMOUNT);
        registerAndStake(worker, "mike", STAKE);
        registerAndStake(otherWorker, "sara", STAKE);
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        uint256 jobId = escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, deadline, false);
        vm.prank(worker);
        escrow.acceptJob(jobId);

        vm.prank(otherWorker);
        vm.expectRevert();
        escrow.acceptJob(jobId);
    }

    /*//////////////////////////////////////////////////////////////
                        CREATE-JOB INPUT GUARDS
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_ZeroAmount() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(agent);
        vm.expectRevert(JobEscrow.ZeroAmount.selector);
        escrow.createJob(PROP, DEVICE, 0, deadline, false);
    }

    function test_RevertWhen_DeadlineInPast() public {
        fundAgent(DEMO_AMOUNT);
        vm.prank(agent);
        vm.expectRevert(JobEscrow.DeadlineInPast.selector);
        escrow.createJob(PROP, DEVICE, DEMO_AMOUNT, block.timestamp, false);
    }
}
