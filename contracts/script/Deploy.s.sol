// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {WardEscrow} from "../src/WardEscrow.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IWorkerRegistry} from "../src/interfaces/IWorkerRegistry.sol";

/// @notice Deploys the WARD ERC-8183 stack, wires authorizations, and writes the
///         repo-root /deployments/<chainId>.json (+ ABIs via export-abis.sh to
///         /deployments/abis/). That repo-root dir is the single canonical
///         location read by the agent (chain.py) and frontend (web/lib/config).
///
///         The escrow is keyed "JobEscrow" in the deployment JSON for frontend
///         compatibility, but the deployed contract is WardEscrow, a faithful
///         ERC-8183 (Agentic Commerce) implementation. The JSON also records
///         "ERC8183": true and an "Evaluator" placeholder (filled by the live
///         lifecycle step that generates the CRE-evaluator wallet).
///
/// Env vars (foundry script vars, all optional with sane local defaults):
///   PRIVATE_KEY               deployer key (defaults to anvil account 0)
///   USDC_ADDRESS              pre-existing USDC; if unset, deploys MockUSDC
///   EVALUATOR_ADDRESS         CRE-evaluator address recorded in the JSON
///   PER_JOB_CAP               default 200 USDC
///   DAILY_CAP                 default 1000 USDC
///   OWNER_APPROVAL_THRESHOLD  default 100 USDC
///   BLOCK_EXPLORER            explorer base URL written into the deployment JSON
contract Deploy is Script {
    uint256 internal constant USDC_UNIT = 1e6;

    function run() external {
        uint256 deployerKey = vm.envOr("PRIVATE_KEY", uint256(0));
        if (deployerKey == 0) {
            deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80; // anvil acct 0
        }
        address deployer = vm.addr(deployerKey);

        uint256 perJobCap = vm.envOr("PER_JOB_CAP", uint256(200 * USDC_UNIT));
        uint256 dailyCap = vm.envOr("DAILY_CAP", uint256(1000 * USDC_UNIT));
        uint256 ownerApprovalThreshold = vm.envOr("OWNER_APPROVAL_THRESHOLD", uint256(100 * USDC_UNIT));
        string memory blockExplorer = vm.envOr("BLOCK_EXPLORER", string("http://localhost:8545"));
        address evaluator = vm.envOr("EVALUATOR_ADDRESS", address(0));

        vm.startBroadcast(deployerKey);

        // USDC: use a pre-existing address (Arc native USDC) or deploy mock.
        address usdcAddress = vm.envOr("USDC_ADDRESS", address(0));
        if (usdcAddress == address(0)) {
            usdcAddress = address(new MockUSDC());
        }

        WorkerRegistry registry = new WorkerRegistry(IERC20(usdcAddress), deployer);

        WardEscrow escrow = new WardEscrow(
            IERC20(usdcAddress),
            IWorkerRegistry(address(registry)),
            deployer,
            perJobCap,
            dailyCap,
            ownerApprovalThreshold
        );

        registry.setJobEscrow(address(escrow));

        vm.stopBroadcast();

        console2.log("USDC:           ", usdcAddress);
        console2.log("WorkerRegistry: ", address(registry));
        console2.log("WardEscrow:     ", address(escrow));
        console2.log("Evaluator:      ", evaluator);

        _writeDeployment(usdcAddress, address(registry), address(escrow), evaluator, blockExplorer);
        console2.log("Next: export ABIs ->  ./export-abis.sh");
    }

    function _writeDeployment(
        address usdcAddress,
        address registry,
        address escrow,
        address evaluator,
        string memory blockExplorer
    ) internal {
        string memory key = "deployment";
        vm.serializeUint(key, "chainId", block.chainid);
        vm.serializeAddress(key, "MockUSDC", usdcAddress);
        vm.serializeAddress(key, "WorkerRegistry", registry);
        // Keyed "JobEscrow" for frontend/chain.py compatibility; the contract is
        // WardEscrow (ERC-8183). "ERC8183": true documents the standard.
        vm.serializeAddress(key, "JobEscrow", escrow);
        vm.serializeAddress(key, "Evaluator", evaluator);
        vm.serializeBool(key, "ERC8183", true);
        string memory json = vm.serializeString(key, "blockExplorer", blockExplorer);

        vm.createDir("../deployments", true);
        string memory path = string.concat("../deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(json, path);
        console2.log("Wrote", path);
    }
}
