// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/*//////////////////////////////////////////////////////////////////////////
                        ERC-8183 — AGENTIC COMMERCE
//////////////////////////////////////////////////////////////////////////////

Faithful transcription of the ERC-8183 (Agentic Commerce) job-escrow standard
(eips.ethereum.org/EIPS/eip-8183). A job is an escrowed agreement between a
`client` (who funds), a `provider` (who delivers), and an `evaluator` (who
attests the work and releases payment). The lifecycle is:

    Open -> Funded -> Submitted -> Completed
                        \-> Rejected (client@Open / evaluator@Funded|Submitted)
            \-> Expired  (anyone, after expiredAt, while Funded|Submitted)

Authorization & state rules (enforced by the implementation):
  - createJob   : any caller becomes the client. Status = Open.
  - setProvider : client only,            Open.
  - setBudget   : client OR provider,     Open.
  - fund        : client only,            Open -> Funded   (pull `budget`).
  - submit      : provider only,          Funded -> Submitted.
  - complete    : evaluator only,         Submitted -> Completed (release budget
                  to provider). Once Submitted, only the evaluator may complete
                  or reject, so the provider is protected after starting work.
  - reject      : client (Open) OR evaluator (Funded|Submitted) -> Rejected
                  (refund client iff the escrow held funds, i.e. Funded|Submitted).
  - claimRefund : anyone, while Funded|Submitted and block.timestamp > expiredAt
                  -> Expired (refund client).

The `optParams` blobs and the per-job `hook` are the standard's designated
extension points; WARD layers its policy there without altering any core
signature (see WardEscrow + DESIGN notes).
*/

/// @notice Canonical ERC-8183 job lifecycle states, in standard order.
enum JobStatus {
    Open,
    Funded,
    Submitted,
    Completed,
    Rejected,
    Expired
}

/// @notice Canonical ERC-8183 job record.
/// @param id Monotonic job id (starts at 1).
/// @param client The funder; set to msg.sender at createJob.
/// @param provider The party that delivers the work.
/// @param evaluator The party authorized to complete/reject a submitted job.
/// @param description Free-form job description.
/// @param budget Escrow amount (in the payment token's base units).
/// @param expiredAt Unix seconds after which a funded job may be refunded.
/// @param status Current lifecycle status.
/// @param hook Optional IACPHook contract (zero address = no hook).
struct Job {
    uint256 id;
    address client;
    address provider;
    address evaluator;
    string description;
    uint256 budget;
    uint256 expiredAt;
    JobStatus status;
    address hook;
}

/// @title IACPHook
/// @notice Optional per-job hook invoked around lifecycle actions. ERC-8183
///         leaves the semantics to the implementation; WARD wires a no-op by
///         default (zero address) and may optionally point it at a reputation
///         hook. MUST advertise ERC-165 support for this interface.
interface IACPHook is IERC165 {
    /// @notice Called before a lifecycle action mutates the job.
    /// @param jobId The job being acted on.
    /// @param selector The function selector of the action.
    /// @param data Opaque action data (e.g. the action's optParams).
    function beforeAction(uint256 jobId, bytes4 selector, bytes calldata data) external;

    /// @notice Called after a lifecycle action has mutated the job.
    /// @param jobId The job being acted on.
    /// @param selector The function selector of the action.
    /// @param data Opaque action data (e.g. the action's optParams).
    function afterAction(uint256 jobId, bytes4 selector, bytes calldata data) external;
}

/// @title IERC8183
/// @notice The Agentic Commerce job-escrow standard interface.
interface IERC8183 {
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event JobCreated(
        uint256 indexed jobId,
        address indexed client,
        address indexed provider,
        address evaluator,
        uint256 expiredAt,
        address hook
    );
    event ProviderSet(uint256 indexed jobId, address indexed provider);
    event BudgetSet(uint256 indexed jobId, uint256 amount);
    event JobFunded(uint256 indexed jobId, address indexed client, uint256 amount);
    event JobSubmitted(uint256 indexed jobId, address indexed provider, bytes32 deliverable);
    event JobCompleted(uint256 indexed jobId, address indexed evaluator, bytes32 reason);
    event JobRejected(uint256 indexed jobId, address indexed rejector, bytes32 reason);
    event JobExpired(uint256 indexed jobId);
    event PaymentReleased(uint256 indexed jobId, address indexed provider, uint256 amount);
    event Refunded(uint256 indexed jobId, address indexed client, uint256 amount);

    /*//////////////////////////////////////////////////////////////
                                FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Client (msg.sender) opens a new job. Status = Open.
    /// @return jobId The new job id.
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external returns (uint256 jobId);

    /// @notice Client sets/changes the provider while Open.
    function setProvider(uint256 jobId, address provider) external;

    /// @notice Client or provider sets the budget while Open.
    function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external;

    /// @notice Client funds the job (Open -> Funded), pulling `budget`.
    function fund(uint256 jobId, bytes calldata optParams) external;

    /// @notice Provider submits a deliverable (Funded -> Submitted).
    function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external;

    /// @notice Evaluator completes the job (Submitted -> Completed), releasing
    ///         the budget to the provider.
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external;

    /// @notice Reject a job: client while Open, or evaluator while Funded|Submitted
    ///         (refunds the client if funds are held). Status -> Rejected.
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external;

    /// @notice Anyone may expire+refund a Funded|Submitted job past expiredAt.
    function claimRefund(uint256 jobId) external;
}
