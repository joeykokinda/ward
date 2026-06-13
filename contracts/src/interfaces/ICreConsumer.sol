// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/*//////////////////////////////////////////////////////////////////////////
                                CRE SEAM
//////////////////////////////////////////////////////////////////////////////

WARD settles a job only when a machine-attested physical-world fact (the device
is healthy again) is verified ON CHAIN. That verification is the technical core
of the project and the part whose mechanism is still gated on the Chainlink
booth answer (see SPIKES.md decision matrix). To keep `JobEscrow.settle()`
agnostic to *how* the attestation arrives, all verification lives behind this
single interface.

`JobEscrow` calls `ICreConsumer.verifyHealthy(...)` and trusts only the boolean
result. The escrow never inspects signatures, forwarder addresses, report
encodings, or oracle keys directly. Swapping the verification mechanism per the
SPIKES.md matrix is therefore a one-line constructor/owner change on the escrow,
with zero edits to job lifecycle logic:

  - Booth answer "CRE -> Arc directly": deploy `AuthorizedReporterVerifier`
    whose trusted reporter is the Chainlink CRE forwarder address. The forwarder
    is the authorized party that has already validated the DON report off chain;
    here it co-signs / pre-authorizes the attestation digest.

  - Booth answer "CRE -> other EVM only" or "A NO_GO + B GO" (last-resort
    authorized-oracle on Arc, per SPIKES.md): deploy the SAME
    `AuthorizedReporterVerifier` with the authorized oracle key as the reporter.
    No escrow changes.

  - Tests / local demo: deploy `MockCreVerifier`, which lets a test set the
    healthy/unhealthy result deterministically with no signatures.

The attestation is bound to (jobId, deviceId, healthy, reportTimestamp) and an
opaque `signature` blob so a single verifier implementation can carry either an
ECDSA signature over that digest (reporter pattern) or a CRE report payload,
without changing this surface.
*/

/// @notice Attestation produced off chain (by the Chainlink CRE workflow or a
///         fallback authorized oracle) stating whether a device is healthy.
/// @param jobId The job the attestation settles.
/// @param deviceId The device whose telemetry was read.
/// @param healthy True iff the device reported `online == true` and
///        `faultMode == "none"` (the CRE "fixed" condition, per INTERFACES.md).
/// @param reportTimestamp Unix seconds the report was produced (freshness).
/// @param signature Opaque proof blob. For the authorized-reporter
///        implementation this is an ECDSA signature over the attestation digest;
///        other implementations may interpret it differently.
struct HealthAttestation {
    uint256 jobId;
    bytes32 deviceId;
    bool healthy;
    uint256 reportTimestamp;
    bytes signature;
}

/// @title ICreConsumer
/// @notice The single seam between WARD's job logic and the attestation
///         verification mechanism. See the comment block above.
interface ICreConsumer {
    /// @notice Verify that `attestation` is authentic and asserts a healthy device.
    /// @dev MUST revert (not return false) when the attestation is unauthentic,
    ///      stale, or for the wrong job/device, so the escrow surfaces a precise
    ///      error. MAY return false only to signal an authentic "still unhealthy"
    ///      report; the escrow treats that as a non-settling result.
    /// @param attestation The attestation to verify.
    /// @return healthy True iff the attestation is authentic AND asserts health.
    function verifyHealthy(HealthAttestation calldata attestation) external view returns (bool healthy);
}
