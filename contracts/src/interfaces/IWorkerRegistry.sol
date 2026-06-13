// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IWorkerRegistry
/// @notice Minimal surface JobEscrow needs from the worker registry.
interface IWorkerRegistry {
    /// @notice Worker profile record.
    /// @param handle Short human handle (e.g. "mike").
    /// @param ensName Full ENS subname (e.g. "mike.ward-agent.eth").
    /// @param skills Free-form skills string.
    /// @param region Free-form region string.
    /// @param stake USDC staked by the worker (6 decimals).
    /// @param reputation Cumulative reputation, bumped on each settled job.
    /// @param registered True once the worker has registered.
    struct Worker {
        string handle;
        string ensName;
        string skills;
        string region;
        uint256 stake;
        uint256 reputation;
        bool registered;
    }

    /// @notice True iff the worker is registered AND has a non-zero stake.
    function isActiveWorker(address worker) external view returns (bool active);

    /// @notice Current reputation of a worker.
    function reputationOf(address worker) external view returns (uint256 reputation);

    /// @notice Full worker record.
    function getWorker(address worker) external view returns (Worker memory worker_);

    /// @notice Increment a worker's reputation. Authorized-caller only (the escrow).
    function bumpReputation(address worker, uint256 amount) external;
}
