// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {IWorkerRegistry} from "../src/interfaces/IWorkerRegistry.sol";

contract WorkerRegistryTest is Test {
    MockUSDC internal usdc;
    WorkerRegistry internal registry;

    address internal owner = makeAddr("owner");
    address internal worker = makeAddr("worker");
    address internal escrow = makeAddr("escrow");
    address internal stranger = makeAddr("stranger");

    uint256 internal constant STAKE = 50e6;

    function setUp() public {
        usdc = new MockUSDC();
        registry = new WorkerRegistry(usdc, owner);
        vm.prank(owner);
        registry.setJobEscrow(escrow);
    }

    function _register() internal {
        vm.prank(worker);
        registry.register("mike", "mike.ward-agent.eth", "wifi,router", "NYC");
    }

    function _stake(uint256 amount) internal {
        usdc.mint(worker, amount);
        vm.startPrank(worker);
        usdc.approve(address(registry), amount);
        registry.stakeUSDC(amount);
        vm.stopPrank();
    }

    function test_Register_StoresProfileAndEmits() public {
        vm.expectEmit(false, false, false, true);
        emit WorkerRegistry.WorkerRegistered(worker, "mike.ward-agent.eth");
        _register();

        IWorkerRegistry.Worker memory record = registry.getWorker(worker);
        assertEq(record.handle, "mike");
        assertEq(record.ensName, "mike.ward-agent.eth");
        assertEq(record.skills, "wifi,router");
        assertEq(record.region, "NYC");
        assertTrue(record.registered);
        assertEq(record.stake, 0);
        assertEq(record.reputation, 0);
    }

    function test_RevertWhen_RegisterTwice() public {
        _register();
        vm.prank(worker);
        vm.expectRevert(WorkerRegistry.AlreadyRegistered.selector);
        registry.register("mike2", "mike2.ward-agent.eth", "x", "y");
    }

    function test_Stake_PullsUsdcAndActivates() public {
        _register();
        _stake(STAKE);
        assertEq(usdc.balanceOf(address(registry)), STAKE);
        assertEq(registry.getWorker(worker).stake, STAKE);
        assertTrue(registry.isActiveWorker(worker));
    }

    function test_Stake_Accumulates() public {
        _register();
        _stake(STAKE);
        _stake(STAKE);
        assertEq(registry.getWorker(worker).stake, STAKE * 2);
    }

    function test_RevertWhen_StakeBeforeRegister() public {
        usdc.mint(worker, STAKE);
        vm.startPrank(worker);
        usdc.approve(address(registry), STAKE);
        vm.expectRevert(WorkerRegistry.NotRegistered.selector);
        registry.stakeUSDC(STAKE);
        vm.stopPrank();
    }

    function test_RevertWhen_StakeZero() public {
        _register();
        vm.prank(worker);
        vm.expectRevert(WorkerRegistry.ZeroAmount.selector);
        registry.stakeUSDC(0);
    }

    function test_NotActive_WhenRegisteredNoStake() public {
        _register();
        assertFalse(registry.isActiveWorker(worker));
    }

    /*//////////////////////////////////////////////////////////////
                        REPUTATION AUTHORIZATION
    //////////////////////////////////////////////////////////////*/

    function test_BumpReputation_OnlyEscrow() public {
        _register();
        vm.expectEmit(false, false, false, true);
        emit WorkerRegistry.ReputationBumped(worker, 1);
        vm.prank(escrow);
        registry.bumpReputation(worker, 1);
        assertEq(registry.reputationOf(worker), 1);
    }

    function test_RevertWhen_BumpReputationByStranger() public {
        _register();
        vm.prank(stranger);
        vm.expectRevert(WorkerRegistry.NotJobEscrow.selector);
        registry.bumpReputation(worker, 1);
    }

    function test_RevertWhen_BumpUnregisteredWorker() public {
        vm.prank(escrow);
        vm.expectRevert(WorkerRegistry.NotRegistered.selector);
        registry.bumpReputation(worker, 1);
    }

    /*//////////////////////////////////////////////////////////////
                            JOB-ESCROW WIRING
    //////////////////////////////////////////////////////////////*/

    function test_RevertWhen_SetJobEscrowTwice() public {
        vm.prank(owner);
        vm.expectRevert(WorkerRegistry.JobEscrowAlreadySet.selector);
        registry.setJobEscrow(makeAddr("other"));
    }

    function test_RevertWhen_SetJobEscrowByNonOwner() public {
        WorkerRegistry fresh = new WorkerRegistry(usdc, owner);
        vm.prank(stranger);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        fresh.setJobEscrow(escrow);
    }

    function test_RevertWhen_SetJobEscrowZero() public {
        WorkerRegistry fresh = new WorkerRegistry(usdc, owner);
        vm.prank(owner);
        vm.expectRevert(WorkerRegistry.ZeroAddress.selector);
        fresh.setJobEscrow(address(0));
    }
}
