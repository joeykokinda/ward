// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC165} from "@openzeppelin/contracts/utils/introspection/ERC165.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IACPHook} from "./interfaces/IERC8183.sol";

/// @title WardReputationHook
/// @notice Optional ERC-8183 IACPHook for WARD. The hook is strictly optional:
///         WardEscrow defaults every job's `hook` to the zero address (no-op).
///         When a job opts in by setting `hook` to an instance of this contract,
///         the escrow invokes beforeAction/afterAction around each lifecycle
///         mutation. This default implementation only records the last action
///         observed per job (a lightweight audit breadcrumb) and never reverts,
///         so it can never block the standard lifecycle. It advertises IACPHook
///         via ERC-165 so the escrow recognizes it.
contract WardReputationHook is IACPHook, ERC165 {
    /// @notice jobId => selector of the most recent action observed.
    mapping(uint256 jobId => bytes4 selector) public lastBefore;
    mapping(uint256 jobId => bytes4 selector) public lastAfter;

    event HookBefore(uint256 indexed jobId, bytes4 selector);
    event HookAfter(uint256 indexed jobId, bytes4 selector);

    /// @inheritdoc IACPHook
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata) external {
        lastBefore[jobId] = selector;
        emit HookBefore(jobId, selector);
    }

    /// @inheritdoc IACPHook
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata) external {
        lastAfter[jobId] = selector;
        emit HookAfter(jobId, selector);
    }

    /// @inheritdoc ERC165
    function supportsInterface(bytes4 interfaceId) public view virtual override(ERC165, IERC165) returns (bool) {
        return interfaceId == type(IACPHook).interfaceId || super.supportsInterface(interfaceId);
    }
}
