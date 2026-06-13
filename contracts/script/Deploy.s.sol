// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";
import {AuthorizedReporterVerifier} from "../src/AuthorizedReporterVerifier.sol";
import {MockCreVerifier} from "../src/mocks/MockCreVerifier.sol";
import {ICreConsumer} from "../src/interfaces/ICreConsumer.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWorkerRegistry} from "../src/interfaces/IWorkerRegistry.sol";

/// @notice Deploys the WARD contract stack, wires authorizations, and writes
///         deployments/<chainId>.json + ABIs to deployments/abis/.
///
/// Env vars (foundry script vars, all optional with sane local defaults):
///   PRIVATE_KEY            deployer key (defaults to anvil account 0)
///   USDC_ADDRESS           pre-existing USDC; if unset, deploys MockUSDC
///   CRE_REPORTER           authorized reporter / CRE forwarder address; if set,
///                          deploys AuthorizedReporterVerifier, else MockCreVerifier
///   CRE_MAX_REPORT_AGE     attestation freshness window (seconds, default 3600)
///   PER_JOB_CAP            default 200 USDC
///   DAILY_CAP              default 1000 USDC
///   OWNER_APPROVAL_THRESHOLD  default 100 USDC (per INTERFACES.md)
///   BLOCK_EXPLORER         explorer base URL written into the deployments json
///
/// DO NOT run against a live network without credentials. See README for the
/// exact Arc testnet / Base Sepolia commands to use once credentials arrive.
contract Deploy is Script {
    uint256 internal constant USDC_UNIT = 1e6;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) {
            // anvil default account 0
            deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80;
        }
        address deployer = vm.addr(deployerKey);

        uint256 perJobCap = vm.envOr("PER_JOB_CAP", uint256(200 * USDC_UNIT));
        uint256 dailyCap = vm.envOr("DAILY_CAP", uint256(1000 * USDC_UNIT));
        uint256 ownerApprovalThreshold = vm.envOr("OWNER_APPROVAL_THRESHOLD", uint256(100 * USDC_UNIT));
        uint256 maxReportAge = vm.envOr("CRE_MAX_REPORT_AGE", uint256(1 hours));
        string memory blockExplorer = vm.envOr("BLOCK_EXPLORER", string("http://localhost:8545"));

        vm.startBroadcast(deployerKey);

        // USDC: use a pre-existing address (e.g. Arc native USDC) or deploy mock.
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        MockUSDC usdc;
        if (usdcAddress == address(0)) {
            usdc = new MockUSDC();
            usdcAddress = address(usdc);
        }

        WorkerRegistry registry = new WorkerRegistry(IERC20(usdcAddress), deployer);

        // CRE seam: production AuthorizedReporterVerifier if a reporter is given,
        // else the mock for local/demo. JobEscrow is identical either way.
        address creReporter = vm.envOr("CRE_REPORTER", address(0));
        ICreConsumer verifier;
        if (creReporter != address(0)) {
            verifier = ICreConsumer(address(new AuthorizedReporterVerifier(creReporter, deployer, maxReportAge)));
        } else {
            verifier = ICreConsumer(address(new MockCreVerifier()));
        }

        JobEscrow escrow = new JobEscrow(
            IERC20(usdcAddress),
            IWorkerRegistry(address(registry)),
            verifier,
            deployer,
            perJobCap,
            dailyCap,
            ownerApprovalThreshold
        );

        registry.setJobEscrow(address(escrow));

        vm.stopBroadcast();

        console2.log("MockUSDC:       ", usdcAddress);
        console2.log("WorkerRegistry: ", address(registry));
        console2.log("CreVerifier:    ", address(verifier));
        console2.log("JobEscrow:      ", address(escrow));

        _writeDeployment(usdcAddress, address(registry), address(escrow), address(verifier), blockExplorer);
        // ABIs are exported separately (see export-abis.sh / the run-time hint
        // below) because Foundry cheatcodes cannot cleanly copy a JSON sub-tree.
        console2.log("Next: export ABIs ->  ./export-abis.sh");
    }

    function _writeDeployment(
        address usdcAddress,
        address registry,
        address escrow,
        address verifier,
        string memory blockExplorer
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "MockUSDC", usdcAddress);
        vm.serializeAddress(key, "WorkerRegistry", registry);
        vm.serializeAddress(key, "CreVerifier", verifier);
        vm.serializeAddress(key, "JobEscrow", escrow);
        string memory json = vm.serializeString(key, "blockExplorer", blockExplorer);

        vm.createDir("deployments", true);
        string memory path = string.concat("deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
