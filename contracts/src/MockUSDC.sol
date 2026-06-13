// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice 6-decimal ERC20 standing in for native USDC on local/test networks.
///         Anyone may mint, so demo agents and workers can fund themselves
///         without a faucet. On Arc testnet the real native USDC replaces this.
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    /// @notice USDC uses 6 decimals, not the ERC20 default of 18.
    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint `amount` (6-decimal) tokens to `to`. Open for testing only.
    /// @param to Recipient.
    /// @param amount Amount in 6-decimal base units (e.g. 1 USDC == 1_000000).
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
