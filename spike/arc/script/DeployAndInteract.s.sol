// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {MinimalEscrow} from "../src/MinimalEscrow.sol";

interface IUSDC {
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
    function decimals() external view returns (uint8);
}

/// @title DeployAndInteract — Arc testnet escrow smoke test
/// @notice Deploys MinimalEscrow, then runs the full escrow loop against Arc
///         native USDC: approve -> lock 1 USDC for a payee -> release.
///         Requires the deployer wallet to hold testnet USDC (gas is also USDC).
///
/// Run (single command, once funded):
///   forge script script/DeployAndInteract.s.sol \
///     --rpc-url $ARC_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast --slow
///
/// Env (loaded from spike/arc/.env): ARC_RPC_URL, DEPLOYER_PRIVATE_KEY, USDC_ADDRESS.
contract DeployAndInteract is Script {
    function run() external {
        address usdc = vm.envOr("USDC_ADDRESS", address(0x3600000000000000000000000000000000000000));
        uint256 pk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(pk);

        // A second throwaway address acts as the worker/payee for the demo.
        address payee = address(0x000000000000000000000000000000000000dEaD);

        uint8 dec = IUSDC(usdc).decimals();
        uint256 oneUsdc = 10 ** dec; // 1 USDC (6 decimals on Arc)
        uint256 jobId = 1;

        console2.log("deployer:", deployer);
        console2.log("usdc:", usdc);
        console2.log("deployer USDC balance:", IUSDC(usdc).balanceOf(deployer));

        vm.startBroadcast(pk);

        MinimalEscrow escrow = new MinimalEscrow(usdc);
        console2.log("MinimalEscrow deployed:", address(escrow));

        // approve + lock 1 USDC against jobId, then release to payee.
        IUSDC(usdc).approve(address(escrow), oneUsdc);
        escrow.lock(jobId, payee, oneUsdc);
        console2.log("locked 1 USDC for jobId", jobId);

        escrow.release(jobId);
        console2.log("released 1 USDC to payee:", payee);

        vm.stopBroadcast();

        console2.log("payee USDC balance after release:", IUSDC(usdc).balanceOf(payee));
    }
}
