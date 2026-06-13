// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {WardEscrow} from "../src/WardEscrow.sol";
import {JobStatus} from "../src/interfaces/IERC8183.sol";

/// @notice ERC20 that, on each transfer, can re-enter WardEscrow on a chosen
///         lifecycle leg to attempt a double action. Used to prove the
///         nonReentrant guards on fund() and complete() hold.
contract ReentrantToken is ERC20 {
    WardEscrow public escrow;
    uint256 public targetJobId;
    uint8 public mode; // 0 = off, 1 = re-enter complete on payout, 2 = re-enter fund on pull

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function armComplete(WardEscrow escrow_, uint256 jobId) external {
        escrow = escrow_;
        targetJobId = jobId;
        mode = 1;
    }

    function armFund(WardEscrow escrow_, uint256 jobId) external {
        escrow = escrow_;
        targetJobId = jobId;
        mode = 2;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        if (mode == 1 && from == address(escrow)) {
            // re-enter complete on the payout transfer leg
            mode = 0;
            try escrow.complete(targetJobId, bytes32("re"), "") {} catch {}
        } else if (mode == 2 && to == address(escrow)) {
            // re-enter fund on the pull-in transfer leg
            mode = 0;
            try escrow.fund(targetJobId, "") {} catch {}
        }
    }
}

contract ReentrancyTest is Test {
    ReentrantToken internal token;
    WorkerRegistry internal registry;
    WardEscrow internal escrow;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal evaluator = makeAddr("evaluator");
    address internal worker = makeAddr("worker");

    uint256 internal constant BUDGET = 75e6;
    bytes32 internal constant DEVICE = bytes32("prop-1-router");

    function setUp() public {
        token = new ReentrantToken();
        registry = new WorkerRegistry(token, owner);
        escrow = new WardEscrow(token, registry, owner, 1000e6, 1000e6, 100e6);
        vm.prank(owner);
        registry.setJobEscrow(address(escrow));

        token.mint(worker, 50e6);
        vm.startPrank(worker);
        registry.register("mike", "mike.ward-agent.eth", "wifi", "NYC");
        token.approve(address(registry), 50e6);
        registry.stakeUSDC(50e6);
        vm.stopPrank();

        token.mint(agent, BUDGET);
        vm.prank(agent);
        token.approve(address(escrow), type(uint256).max);
    }

    function _open() internal returns (uint256 jobId) {
        vm.startPrank(agent);
        jobId = escrow.createJob(worker, evaluator, block.timestamp + 1 days, "x", address(0));
        escrow.setBudget(jobId, BUDGET, "");
        vm.stopPrank();
    }

    function test_Complete_ReentrancyDoesNotDoublePay() public {
        uint256 jobId = _open();
        vm.prank(agent);
        escrow.fund(jobId, "");
        vm.prank(worker);
        escrow.submit(jobId, DEVICE, "");

        token.armComplete(escrow, jobId);
        vm.prank(evaluator);
        escrow.complete(jobId, bytes32("ok"), "");

        assertEq(token.balanceOf(worker), BUDGET, "provider paid exactly once");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow holds no extra");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Completed));
        assertEq(registry.reputationOf(worker), 1, "reputation bumped once");
    }

    function test_Fund_ReentrancyDoesNotDoubleFund() public {
        uint256 jobId = _open();
        token.armFund(escrow, jobId);
        vm.prank(agent);
        escrow.fund(jobId, "");

        // Funded exactly once; escrow holds exactly one budget.
        assertEq(token.balanceOf(address(escrow)), BUDGET, "escrow holds exactly one budget");
        assertEq(uint8(escrow.jobStatus(jobId)), uint8(JobStatus.Funded));
    }
}
