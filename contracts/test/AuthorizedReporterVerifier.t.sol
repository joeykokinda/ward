// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AuthorizedReporterVerifier} from "../src/AuthorizedReporterVerifier.sol";
import {ICreConsumer, HealthAttestation} from "../src/interfaces/ICreConsumer.sol";

/// @notice Tests the production CRE-seam verifier: ECDSA reporter signatures,
///         staleness, replay domain separation. This is what runs once the
///         Chainlink booth answer lands and the mock is swapped out.
contract AuthorizedReporterVerifierTest is Test {
    AuthorizedReporterVerifier internal verifier;

    address internal owner = makeAddr("owner");
    uint256 internal reporterKey;
    address internal reporter;
    uint256 internal wrongKey;

    uint256 internal constant MAX_AGE = 1 hours;
    bytes32 internal constant DEVICE = bytes32("prop-1-router");

    function setUp() public {
        (reporter, reporterKey) = makeAddrAndKey("reporter");
        (, wrongKey) = makeAddrAndKey("wrong");
        verifier = new AuthorizedReporterVerifier(reporter, owner, MAX_AGE);
    }

    function _attest(uint256 jobId, bool healthy, uint256 ts, uint256 signerKey)
        internal
        view
        returns (HealthAttestation memory att)
    {
        att = HealthAttestation({jobId: jobId, deviceId: DEVICE, healthy: healthy, reportTimestamp: ts, signature: ""});
        bytes32 digest = verifier.attestationDigest(att);
        bytes32 ethHash = MessageHashUtils.toEthSignedMessageHash(digest);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerKey, ethHash);
        att.signature = abi.encodePacked(r, s, v);
    }

    function test_VerifyHealthy_ValidReporterSignature() public {
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, true, block.timestamp, reporterKey);
        assertTrue(verifier.verifyHealthy(att));
    }

    function test_VerifyHealthy_ReturnsFalseForUnhealthy() public {
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, false, block.timestamp, reporterKey);
        assertFalse(verifier.verifyHealthy(att), "authentic but unhealthy -> false");
    }

    function test_RevertWhen_WrongSigner() public {
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, true, block.timestamp, wrongKey);
        vm.expectRevert(AuthorizedReporterVerifier.WrongReporter.selector);
        verifier.verifyHealthy(att);
    }

    function test_RevertWhen_StaleReport() public {
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, true, block.timestamp - MAX_AGE - 1, reporterKey);
        vm.expectRevert(AuthorizedReporterVerifier.StaleReport.selector);
        verifier.verifyHealthy(att);
    }

    function test_RevertWhen_FutureReport() public {
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, true, block.timestamp + 1, reporterKey);
        vm.expectRevert(AuthorizedReporterVerifier.FutureReport.selector);
        verifier.verifyHealthy(att);
    }

    function test_RevertWhen_TamperedHealthyFlag() public {
        // signature was over healthy=false; flipping to true breaks recovery.
        vm.warp(10_000);
        HealthAttestation memory att = _attest(1, false, block.timestamp, reporterKey);
        att.healthy = true;
        vm.expectRevert(AuthorizedReporterVerifier.WrongReporter.selector);
        verifier.verifyHealthy(att);
    }

    function test_SetReporter_RotatesSigner() public {
        vm.warp(10_000);
        (address newReporter, uint256 newKey) = makeAddrAndKey("newReporter");
        vm.prank(owner);
        verifier.setReporter(newReporter);
        assertEq(verifier.reporter(), newReporter);

        HealthAttestation memory att = _attest(1, true, block.timestamp, newKey);
        assertTrue(verifier.verifyHealthy(att));
    }

    function test_RevertWhen_SetReporterByNonOwner() public {
        vm.prank(makeAddr("stranger"));
        vm.expectRevert();
        verifier.setReporter(makeAddr("x"));
    }

    function test_DigestBindsChainAndContract() public {
        // Different verifier instance -> different address -> different digest,
        // so a signature for one deployment cannot replay on another.
        vm.warp(10_000);
        AuthorizedReporterVerifier other = new AuthorizedReporterVerifier(reporter, owner, MAX_AGE);
        HealthAttestation memory att = _attest(1, true, block.timestamp, reporterKey);
        // valid on the verifier it was signed for
        assertTrue(verifier.verifyHealthy(att));
        // but rejected on the other deployment
        vm.expectRevert(AuthorizedReporterVerifier.WrongReporter.selector);
        other.verifyHealthy(att);
    }
}
