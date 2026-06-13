// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";
import {MockCreVerifier} from "../src/mocks/MockCreVerifier.sol";
import {HealthAttestation} from "../src/interfaces/ICreConsumer.sol";

/// @notice ERC20 that, on each transfer to the configured attacker, calls back
///         into JobEscrow.settle to attempt a reentrant double-payout.
contract ReentrantToken is ERC20 {
    JobEscrow public escrow;
    uint256 public targetJobId;
    bool public attacking;

    constructor() ERC20("Reentrant USDC", "rUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function arm(JobEscrow escrow_, uint256 jobId) external {
        escrow = escrow_;
        targetJobId = jobId;
        attacking = true;
    }

    function _update(address from, address to, uint256 value) internal override {
        super._update(from, to, value);
        // Re-enter only on the escrow's payout leg, once.
        if (attacking && from == address(escrow)) {
            attacking = false;
            HealthAttestation memory att = HealthAttestation({
                jobId: targetJobId, deviceId: bytes32("prop-1-router"), healthy: true, reportTimestamp: 0, signature: ""
            });
            // Expected to revert via ReentrancyGuard; swallow so the outer call
            // can complete and we can assert no double spend.
            try escrow.settle(targetJobId, att) {} catch {}
        }
    }
}

contract ReentrancyTest is Test {
    ReentrantToken internal token;
    WorkerRegistry internal registry;
    JobEscrow internal escrow;
    MockCreVerifier internal verifier;

    address internal owner = makeAddr("owner");
    address internal agent = makeAddr("agent");
    address internal worker = makeAddr("worker");

    uint256 internal constant AMOUNT = 75e6;
    bytes32 internal constant PROP = bytes32("prop-1");
    bytes32 internal constant DEVICE = bytes32("prop-1-router");

    function setUp() public {
        token = new ReentrantToken();
        registry = new WorkerRegistry(token, owner);
        verifier = new MockCreVerifier();
        escrow = new JobEscrow(token, registry, verifier, owner, 1000e6, 1000e6, 100e6);
        vm.prank(owner);
        registry.setJobEscrow(address(escrow));

        // worker registers + stakes
        token.mint(worker, 50e6);
        vm.startPrank(worker);
        registry.register("mike", "mike.ward-agent.eth", "wifi", "NYC");
        token.approve(address(registry), 50e6);
        registry.stakeUSDC(50e6);
        vm.stopPrank();

        // agent funds + creates job
        token.mint(agent, AMOUNT);
        vm.startPrank(agent);
        token.approve(address(escrow), AMOUNT);
        escrow.createJob(PROP, DEVICE, AMOUNT, block.timestamp + 1 days, false);
        vm.stopPrank();

        // accept + mark done
        vm.prank(worker);
        escrow.acceptJob(1);
        vm.prank(worker);
        escrow.markWorkDone(1);
    }

    function test_Settle_ReentrancyDoesNotDoublePay() public {
        // The reentrant payout target is the worker; arm the token to re-enter.
        token.arm(escrow, 1);

        HealthAttestation memory att =
            HealthAttestation({jobId: 1, deviceId: DEVICE, healthy: true, reportTimestamp: 0, signature: ""});
        vm.prank(agent);
        escrow.settle(1, att);

        // Worker paid exactly once; escrow drained to exactly the job amount.
        assertEq(token.balanceOf(worker), AMOUNT, "worker paid exactly once");
        assertEq(token.balanceOf(address(escrow)), 0, "escrow holds no extra");
        assertEq(uint8(escrow.jobState(1)), uint8(JobEscrow.JobState.Settled));
        assertEq(registry.reputationOf(worker), 1, "reputation bumped once");
    }
}
