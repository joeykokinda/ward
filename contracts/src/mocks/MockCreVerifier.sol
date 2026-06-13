// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICreConsumer, HealthAttestation} from "../interfaces/ICreConsumer.sol";

/// @title MockCreVerifier
/// @notice CRE-seam test double. No signatures: a test sets the result the
///         verifier returns, so JobEscrow lifecycle tests stay focused on job
///         logic. Defaults to healthy. `setRevertMode` exercises the escrow's
///         handling of a reverting (unauthorized/stale) verifier.
contract MockCreVerifier is ICreConsumer {
    bool public healthyResult = true;
    bool public revertMode;

    error MockUnauthorized();

    /// @notice Set the boolean the verifier returns for authentic reports.
    function setHealthy(bool healthy) external {
        healthyResult = healthy;
    }

    /// @notice When true, verifyHealthy reverts (simulates a rejected/unauthorized
    ///         or stale attestation in the production verifier).
    function setRevertMode(bool shouldRevert) external {
        revertMode = shouldRevert;
    }

    /// @inheritdoc ICreConsumer
    function verifyHealthy(HealthAttestation calldata) external view returns (bool healthy) {
        if (revertMode) revert MockUnauthorized();
        return healthyResult;
    }
}
