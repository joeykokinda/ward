// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title MinimalEscrow — Arc testnet smoke-test stub
/// @notice Self-contained, dependency-free USDC escrow stub used ONLY to prove
///         the Arc deploy + interact loop works end to end (deploy, fund, lock,
///         release) once the throwaway wallet is funded with testnet USDC.
///         This is NOT the production JobEscrow (see ../../contracts/JobEscrow.sol);
///         it deliberately has zero imports so the spike compiles and deploys
///         with nothing but solc. USDC has 6 decimals on Arc.
contract MinimalEscrow {
    /// @dev USDC interactions go through low-level calls (see _pull/_push) so the
    ///      stub needs no IERC20 import. Arc native USDC (0x3600..0000) is ERC-20.
    address public immutable usdc;
    address public immutable owner;

    mapping(uint256 jobId => uint256 amount) public locked;
    mapping(uint256 jobId => address payee) public payee;

    event Locked(uint256 indexed jobId, address indexed payee, uint256 amount);
    event Released(uint256 indexed jobId, address indexed payee, uint256 amount);

    error NotOwner();
    error NothingLocked();
    error TransferFailed();

    constructor(address usdc_) {
        usdc = usdc_;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @notice Pull `amount` USDC from caller and lock it against `jobId`.
    ///         Caller must `approve` this contract for `amount` first.
    function lock(uint256 jobId, address payee_, uint256 amount) external {
        _pull(msg.sender, amount);
        locked[jobId] += amount;
        payee[jobId] = payee_;
        emit Locked(jobId, payee_, amount);
    }

    /// @notice Release the locked USDC for `jobId` to its payee. Owner-gated to
    ///         stand in for the CRE-attested release condition in the real escrow.
    function release(uint256 jobId) external onlyOwner {
        uint256 amount = locked[jobId];
        if (amount == 0) revert NothingLocked();
        locked[jobId] = 0;
        address to = payee[jobId];
        _push(to, amount);
        emit Released(jobId, to, amount);
    }

    function _pull(address from, uint256 amount) internal {
        (bool ok, bytes memory data) =
            usdc.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }

    function _push(address to, uint256 amount) internal {
        (bool ok, bytes memory data) =
            usdc.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!ok || (data.length != 0 && !abi.decode(data, (bool)))) revert TransferFailed();
    }
}
