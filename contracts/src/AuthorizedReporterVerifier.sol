// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {ICreConsumer, HealthAttestation} from "./interfaces/ICreConsumer.sol";

/*//////////////////////////////////////////////////////////////////////////
                        CRE SEAM — PRODUCTION IMPLEMENTATION
//////////////////////////////////////////////////////////////////////////////

This is the swappable production side of the CRE seam described in
src/interfaces/ICreConsumer.sol. It accepts an attestation iff it carries a
valid ECDSA signature from the single trusted `reporter` over the canonical
attestation digest. The `reporter` is set per the SPIKES.md decision matrix:

  - "CRE -> Arc directly": reporter = the Chainlink CRE forwarder/reporter key.
    The DON has already validated device telemetry off chain; the signature here
    binds that validated result to (jobId, deviceId, healthy, timestamp) on Arc.

  - "A NO_GO + B GO" last resort: reporter = an authorized oracle key (rex
    sign-off, per SPIKES.md/CUTS.md). Identical contract, different signer.

Swapping mechanisms never touches JobEscrow: the escrow only ever sees
`verifyHealthy(...) -> bool`. Staleness is enforced via `maxReportAge`.
*/

/// @title AuthorizedReporterVerifier
/// @notice CRE-seam verifier that trusts ECDSA attestations from one reporter.
contract AuthorizedReporterVerifier is ICreConsumer, Ownable {
    using ECDSA for bytes32;

    /// @notice The single authorized reporter (CRE forwarder or fallback oracle).
    address public reporter;

    /// @notice Max age (seconds) of an attestation's reportTimestamp.
    uint256 public maxReportAge;

    event ReporterUpdated(address reporter);
    event MaxReportAgeUpdated(uint256 maxReportAge);

    error ZeroAddress();
    error StaleReport();
    error FutureReport();
    error WrongReporter();

    /// @param reporter_ The trusted reporter address.
    /// @param owner_ Owner allowed to rotate the reporter / age window.
    /// @param maxReportAge_ Max attestation age in seconds.
    constructor(address reporter_, address owner_, uint256 maxReportAge_) Ownable(owner_) {
        if (reporter_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        reporter = reporter_;
        maxReportAge = maxReportAge_;
        emit ReporterUpdated(reporter_);
        emit MaxReportAgeUpdated(maxReportAge_);
    }

    /// @notice Rotate the trusted reporter (e.g. swap fallback oracle for the
    ///         live CRE forwarder once the booth answer lands). Owner only.
    function setReporter(address reporter_) external onlyOwner {
        if (reporter_ == address(0)) revert ZeroAddress();
        reporter = reporter_;
        emit ReporterUpdated(reporter_);
    }

    /// @notice Update the max accepted attestation age. Owner only.
    function setMaxReportAge(uint256 maxReportAge_) external onlyOwner {
        maxReportAge = maxReportAge_;
        emit MaxReportAgeUpdated(maxReportAge_);
    }

    /// @notice Canonical digest the reporter signs. Public so off-chain signers
    ///         (CRE workflow, test harness) can reproduce it exactly.
    /// @dev Domain-separated by this contract's address and chain id to prevent
    ///      cross-deployment / cross-chain replay.
    function attestationDigest(HealthAttestation calldata attestation) public view returns (bytes32 digest) {
        return keccak256(
            abi.encode(
                "WARD_HEALTH_ATTESTATION",
                block.chainid,
                address(this),
                attestation.jobId,
                attestation.deviceId,
                attestation.healthy,
                attestation.reportTimestamp
            )
        );
    }

    /// @inheritdoc ICreConsumer
    /// @dev Reverts on a bad signer, stale, or future-dated report so the escrow
    ///      surfaces a precise error. Returns false only for an authentic
    ///      "still unhealthy" attestation.
    function verifyHealthy(HealthAttestation calldata attestation) external view returns (bool healthy) {
        if (attestation.reportTimestamp > block.timestamp) revert FutureReport();
        if (block.timestamp - attestation.reportTimestamp > maxReportAge) revert StaleReport();

        bytes32 ethSignedHash = MessageHashUtils.toEthSignedMessageHash(attestationDigest(attestation));
        address recovered = ethSignedHash.recover(attestation.signature);
        if (recovered != reporter) revert WrongReporter();

        return attestation.healthy;
    }
}
