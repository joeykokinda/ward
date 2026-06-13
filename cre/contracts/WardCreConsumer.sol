// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ICreConsumer, HealthAttestation} from "@ward-contracts/interfaces/ICreConsumer.sol";

/*//////////////////////////////////////////////////////////////////////////
                    WARD CRE CONSUMER — "CRE -> ARC DIRECTLY"
//////////////////////////////////////////////////////////////////////////////

This is the CRE-native bridge for the booth answer "CRE writes to Arc directly"
(SPIKES.md row 1), which the spike CONFIRMED is supported: Arc Testnet is a
CRE-supported network with a live production Forwarder
(0x76c9cf548b4179F8901cda1f8623568b58215E62 — CRE Forwarder Directory).

There are two ways to wire the CRE seam (src/interfaces/ICreConsumer.sol).
Pick one at deploy time; JobEscrow logic is identical for both:

  (A) PULL / sign-then-verify  -> use the existing AuthorizedReporterVerifier.
      The CRE workflow signs a HealthAttestation off chain; whoever calls
      JobEscrow.settle(jobId, attestation) carries that signature; the verifier
      recovers it against the trusted CRE reporter key. No extra onchain write.

  (B) PUSH / forwarder-native  -> THIS contract (WardCreConsumer).
      The CRE workflow calls runtime.report(...).writeReport(...); the Chainlink
      Forwarder calls onReport(metadata, report) HERE, on Arc. We validate the
      caller is the Forwarder (and optionally the workflow owner/name), record
      the attested (jobId -> healthy) fact, then settle JobEscrow in the SAME
      transaction. This is the literal "a CRE workflow writes onchain to Arc"
      demonstration the Chainlink bounty rewards.

WardCreConsumer implements BOTH:
  - IReceiver-style onReport(bytes,bytes)  : the Forwarder push entrypoint.
  - ICreConsumer.verifyHealthy(...)        : so it can also serve as the escrow's
                                             `creVerifier` if you prefer the
                                             escrow to pull the recorded fact
                                             instead of having this contract push.

Security model mirrors Chainlink's ReceiverTemplate
(cre-templates .../ReceiverTemplate.sol): the forwarder address is mandatory;
expected workflow owner / name / id are optional, owner-configurable filters.
Metadata layout: abi.encodePacked(workflowId(32), workflowName(10), owner(20)).

NOTE: the report payload encoded by the workflow is abi.encode(uint256 jobId,
bool healthy) — see cre/workflow/index.ts. deviceId binding is enforced by
JobEscrow.settle (attestation.deviceId == job.deviceId), so the push path passes
deviceId through from the job record; see _settle below.
*/

interface IJobEscrowSettle {
    function settle(uint256 jobId, HealthAttestation memory attestation) external;
    function getJob(uint256 jobId) external view returns (JobView memory);
}

/// @dev Minimal mirror of JobEscrow.Job for reading deviceId during a push settle.
///      Field order MUST match JobEscrow.Job.
struct JobView {
    bytes32 propertyId;
    bytes32 deviceId;
    uint256 amount;
    uint256 deadline;
    address client;
    address worker;
    uint8 state;
}

/// @title WardCreConsumer
/// @notice CRE Forwarder receiver on Arc that records device-health attestations
///         and settles JobEscrow directly. Also usable as an ICreConsumer.
contract WardCreConsumer is ICreConsumer, Ownable {
    /// @notice Trusted Chainlink CRE Forwarder. Only it may call onReport.
    ///         Arc Testnet: 0x76c9cf548b4179F8901cda1f8623568b58215E62.
    address public forwarder;

    /// @notice Optional: only accept reports authored by this workflow owner.
    address public expectedAuthor;

    /// @notice Optional: only accept reports from this workflow name (bytes10).
    ///         Only enforced when expectedAuthor is also set.
    bytes10 public expectedWorkflowName;

    /// @notice JobEscrow this consumer settles (push mode). May be unset (0) if
    ///         this contract is used purely as the escrow's pull-verifier.
    IJobEscrowSettle public jobEscrow;

    /// @notice Recorded attested health, by jobId. Set on each accepted onReport.
    mapping(uint256 jobId => bool healthy) public attestedHealthy;

    /// @notice reportTimestamp recorded per jobId (freshness for pull mode).
    mapping(uint256 jobId => uint256 ts) public attestedAt;

    event ForwarderUpdated(address forwarder);
    event ExpectedAuthorUpdated(address author);
    event ExpectedWorkflowNameUpdated(bytes10 name);
    event JobEscrowUpdated(address escrow);
    event AttestationReceived(uint256 indexed jobId, bool healthy, uint256 reportTimestamp);
    event SettleAttempted(uint256 indexed jobId, bool success);

    error ZeroAddress();
    error InvalidSender(address sender, address expected);
    error InvalidAuthor(address received, address expected);
    error InvalidWorkflowName(bytes10 received, bytes10 expected);
    error NotAttestedHealthy(uint256 jobId);

    /// @param forwarder_ CRE Forwarder address (Arc Testnet forwarder for live).
    /// @param owner_ Owner allowed to configure filters / escrow / forwarder.
    constructor(address forwarder_, address owner_) Ownable(owner_) {
        if (forwarder_ == address(0) || owner_ == address(0)) revert ZeroAddress();
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    /*//////////////////////////////////////////////////////////////
                              OWNER CONFIG
    //////////////////////////////////////////////////////////////*/

    function setForwarder(address forwarder_) external onlyOwner {
        if (forwarder_ == address(0)) revert ZeroAddress();
        forwarder = forwarder_;
        emit ForwarderUpdated(forwarder_);
    }

    function setExpectedAuthor(address author_) external onlyOwner {
        expectedAuthor = author_;
        emit ExpectedAuthorUpdated(author_);
    }

    function setExpectedWorkflowName(bytes10 name_) external onlyOwner {
        expectedWorkflowName = name_;
        emit ExpectedWorkflowNameUpdated(name_);
    }

    function setJobEscrow(address escrow_) external onlyOwner {
        jobEscrow = IJobEscrowSettle(escrow_);
        emit JobEscrowUpdated(escrow_);
    }

    /*//////////////////////////////////////////////////////////////
                       PUSH PATH (CRE FORWARDER)
    //////////////////////////////////////////////////////////////*/

    /// @notice CRE Forwarder push entrypoint (IReceiver). Validates the caller +
    ///         optional workflow identity, records the attestation, and — if a
    ///         JobEscrow is wired — settles the job in the same transaction.
    /// @param metadata abi.encodePacked(workflowId(32), workflowName(10), owner(20)),
    ///        prefixed by the dynamic-bytes length word (Forwarder convention).
    /// @param report  abi.encode(uint256 jobId, bool healthy) from the workflow.
    function onReport(bytes calldata metadata, bytes calldata report) external {
        if (msg.sender != forwarder) revert InvalidSender(msg.sender, forwarder);

        if (expectedAuthor != address(0)) {
            (bytes10 workflowName, address workflowOwner) = _decodeMetadata(metadata);
            if (workflowOwner != expectedAuthor) revert InvalidAuthor(workflowOwner, expectedAuthor);
            if (expectedWorkflowName != bytes10(0) && workflowName != expectedWorkflowName) {
                revert InvalidWorkflowName(workflowName, expectedWorkflowName);
            }
        }

        (uint256 jobId, bool healthy) = abi.decode(report, (uint256, bool));

        attestedHealthy[jobId] = healthy;
        attestedAt[jobId] = block.timestamp;
        emit AttestationReceived(jobId, healthy, block.timestamp);

        if (healthy && address(jobEscrow) != address(0)) {
            _settle(jobId);
        }
    }

    /// @dev Build the HealthAttestation from the recorded fact + the job's
    ///      deviceId, then settle. The escrow re-checks deviceId/jobId binding.
    ///      In push mode the verifier is THIS contract, so `signature` is empty:
    ///      authenticity was already enforced by the forwarder check above.
    function _settle(uint256 jobId) internal {
        JobView memory job = jobEscrow.getJob(jobId);
        HealthAttestation memory attestation = HealthAttestation({
            jobId: jobId,
            deviceId: job.deviceId,
            healthy: true,
            reportTimestamp: attestedAt[jobId],
            signature: bytes("")
        });
        // try/catch so a settle revert (e.g. wrong job state) doesn't drop the
        // recorded attestation; the cron can re-attempt next round.
        try jobEscrow.settle(jobId, attestation) {
            emit SettleAttempted(jobId, true);
        } catch {
            emit SettleAttempted(jobId, false);
        }
    }

    /*//////////////////////////////////////////////////////////////
                       PULL PATH (ICreConsumer)
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc ICreConsumer
    /// @notice If you wire THIS contract as JobEscrow.creVerifier instead of the
    ///         AuthorizedReporterVerifier, the escrow pulls the recorded fact.
    ///         Reverts if no healthy attestation was pushed for this job.
    function verifyHealthy(HealthAttestation calldata attestation) external view returns (bool healthy) {
        if (!attestedHealthy[attestation.jobId]) revert NotAttestedHealthy(attestation.jobId);
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                                HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Decode workflowName + owner from forwarder metadata.
    ///      Layout (after the 32-byte dynamic length word):
    ///        offset 32: workflowId  (bytes32)
    ///        offset 64: workflowName(bytes10)
    ///        offset 74: workflowOwner(address, 20 bytes)
    function _decodeMetadata(bytes calldata metadata)
        internal
        pure
        returns (bytes10 workflowName, address workflowOwner)
    {
        bytes memory m = metadata;
        assembly {
            workflowName := mload(add(m, 64))
            workflowOwner := shr(mul(12, 8), mload(add(m, 74)))
        }
    }
}
