// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWorkerRegistry} from "./interfaces/IWorkerRegistry.sol";

/// @title WorkerRegistry
/// @notice Onchain directory + reputation ledger for WARD workers. A worker
///         registers a profile (mirrored in ENS subname text records off chain),
///         stakes USDC to become "active", and accrues reputation each time a
///         job they completed settles. Reputation is bumped only by the trusted
///         JobEscrow, set once by the owner.
contract WorkerRegistry is IWorkerRegistry, Ownable {
    using SafeERC20 for IERC20;

    /// @notice USDC token used for staking (6 decimals).
    IERC20 public immutable usdc;

    /// @notice The JobEscrow authorized to bump reputation. Set once by owner.
    address public jobEscrow;

    /// @notice Worker address => profile record.
    mapping(address worker => Worker record) private workers;

    /// @notice Emitted when a worker registers their profile.
    event WorkerRegistered(address worker, string ensName);

    /// @notice Emitted when a worker adds USDC stake.
    event WorkerStaked(address indexed worker, uint256 amount, uint256 totalStake);

    /// @notice Emitted when a worker's reputation increases on job settlement.
    event ReputationBumped(address worker, uint256 newRep);

    /// @notice Emitted when the owner wires the authorized JobEscrow.
    event JobEscrowSet(address jobEscrow);

    error AlreadyRegistered();
    error NotRegistered();
    error ZeroAmount();
    error JobEscrowAlreadySet();
    error ZeroAddress();
    error NotJobEscrow();

    constructor(IERC20 usdc_, address owner_) Ownable(owner_) {
        if (address(usdc_) == address(0) || owner_ == address(0)) revert ZeroAddress();
        usdc = usdc_;
    }

    /// @notice Wire the JobEscrow allowed to bump reputation. Callable once.
    /// @param jobEscrow_ The deployed JobEscrow address.
    function setJobEscrow(address jobEscrow_) external onlyOwner {
        if (jobEscrow != address(0)) revert JobEscrowAlreadySet();
        if (jobEscrow_ == address(0)) revert ZeroAddress();
        jobEscrow = jobEscrow_;
        emit JobEscrowSet(jobEscrow_);
    }

    /// @notice Register the caller as a worker. One-time per address.
    /// @param handle Short human handle (e.g. "mike").
    /// @param ensName Full ENS subname (e.g. "mike.ward-agent.eth").
    /// @param skills Free-form skills string.
    /// @param region Free-form region string.
    function register(string calldata handle, string calldata ensName, string calldata skills, string calldata region)
        external
    {
        Worker storage worker = workers[msg.sender];
        if (worker.registered) revert AlreadyRegistered();
        worker.handle = handle;
        worker.ensName = ensName;
        worker.skills = skills;
        worker.region = region;
        worker.registered = true;
        emit WorkerRegistered(msg.sender, ensName);
    }

    /// @notice Stake USDC to become an active worker. Pulls `amount` from caller.
    /// @param amount USDC amount in 6-decimal base units.
    function stakeUSDC(uint256 amount) external {
        Worker storage worker = workers[msg.sender];
        if (!worker.registered) revert NotRegistered();
        if (amount == 0) revert ZeroAmount();
        worker.stake += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit WorkerStaked(msg.sender, amount, worker.stake);
    }

    /// @inheritdoc IWorkerRegistry
    function bumpReputation(address worker, uint256 amount) external {
        if (msg.sender != jobEscrow) revert NotJobEscrow();
        if (!workers[worker].registered) revert NotRegistered();
        uint256 newRep = workers[worker].reputation + amount;
        workers[worker].reputation = newRep;
        emit ReputationBumped(worker, newRep);
    }

    /// @inheritdoc IWorkerRegistry
    function isActiveWorker(address worker) external view returns (bool active) {
        Worker storage record = workers[worker];
        return record.registered && record.stake > 0;
    }

    /// @inheritdoc IWorkerRegistry
    function reputationOf(address worker) external view returns (uint256 reputation) {
        return workers[worker].reputation;
    }

    /// @inheritdoc IWorkerRegistry
    function getWorker(address worker) external view returns (Worker memory worker_) {
        return workers[worker];
    }
}
