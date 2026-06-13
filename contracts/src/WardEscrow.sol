// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IERC8183, IACPHook, Job, JobStatus} from "./interfaces/IERC8183.sol";
import {IWorkerRegistry} from "./interfaces/IWorkerRegistry.sol";

/// @title WardEscrow
/// @notice WARD's job escrow, implemented as a faithful ERC-8183 (Agentic
///         Commerce) contract. The standard's lifecycle
///         (Open -> Funded -> Submitted -> Completed, with Rejected/Expired) is
///         implemented exactly per src/interfaces/IERC8183.sol — every core
///         function keeps its standard signature, every standard event is
///         emitted unchanged.
///
///         WARD MAPPING:
///           client    = the WARD agent wallet (funds jobs).
///           provider  = a field worker (must be a registered + staked active
///                       worker in WorkerRegistry).
///           evaluator = the dedicated CRE-oracle address representing the
///                       Chainlink CRE workflow that attests device telemetry.
///                       `complete()` is therefore exactly "sensor-settled
///                       release": the evaluator (CRE) releasing the budget to
///                       the provider and bumping the provider's reputation.
///           budget    = native Arc USDC (6 decimals).
///           deliverable (bytes32) = the device id (e.g. bytes32("home-wifi")).
///           reason      (bytes32) = a short status/result code.
///
///         WARD EXTRAS layered WITHOUT touching the standard surface:
///           1. Active-worker gate: createJob/setProvider require the provider
///              (when non-zero) to be a registered+staked active worker.
///           2. Spending policy enforced inside fund(): per-job cap, rolling
///              UTC-daily cap, and an owner-approval threshold above which a
///              per-job `ownerApproved` flag must be set.
///           3. Reputation bump: complete() bumps WorkerRegistry.reputation.
///           4. The owner-approval flag is set either via the WARD-only
///              setOwnerApproved() (owner) OR by ABI-encoding a bool into the
///              standard `fund` optParams (so a chain client never needs a
///              non-standard call). Core signatures stay ERC-8183-exact.
///           5. The optional per-job IACPHook is invoked (when set and
///              ERC-165-advertised) before/after each lifecycle mutation; the
///              default hook is the zero address (no-op).
contract WardEscrow is IERC8183, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Payment token escrowed (native Arc USDC, 6 decimals).
    IERC20 public immutable usdc;

    /// @notice Worker registry for active-worker checks and reputation bumps.
    IWorkerRegistry public immutable registry;

    /// @notice Max USDC a single job's budget may escrow (WARD per-job cap).
    uint256 public perJobCap;

    /// @notice Max total USDC that may be funded across jobs in one UTC day.
    uint256 public dailyCap;

    /// @notice Budgets above this require `ownerApproved == true` to fund.
    uint256 public ownerApprovalThreshold;

    /// @notice Reputation points awarded to a provider on each completed job.
    uint256 public constant REPUTATION_PER_JOB = 1;

    /// @notice ERC-165 interface id the WARD reputation hook is expected to
    ///         advertise; only hooks that advertise IACPHook are invoked.
    bytes4 internal constant ACP_HOOK_INTERFACE_ID = type(IACPHook).interfaceId;

    /// @notice Next job id to assign (job ids start at 1).
    uint256 public nextJobId = 1;

    /// @notice jobId => canonical ERC-8183 job record.
    mapping(uint256 jobId => Job job) private jobs;

    /// @notice jobId => WARD owner-approval flag for above-threshold budgets.
    mapping(uint256 jobId => bool approved) public ownerApproved;

    /// @notice UTC day index => total USDC funded that day (for the daily cap).
    mapping(uint256 dayIndex => uint256 funded) public fundedOnDay;

    /// @notice Emitted when caps / approval threshold change (WARD extra).
    event CapsUpdated(uint256 perJobCap, uint256 dailyCap, uint256 ownerApprovalThreshold);

    /// @notice Emitted when the owner toggles a job's above-threshold approval.
    event OwnerApprovalSet(uint256 indexed jobId, bool approved);

    error ZeroAddress();
    error ZeroAmount();
    error ExpiredAtInPast();
    error NotClient();
    error NotProvider();
    error NotEvaluator();
    error NotClientOrProvider();
    error NotClientOrEvaluator();
    error WrongStatus(JobStatus expected, JobStatus actual);
    error BudgetNotSet();
    error ExceedsPerJobCap();
    error ExceedsDailyCap();
    error OwnerApprovalRequired();
    error ProviderNotActiveWorker();
    error NotExpiredYet();
    error UnknownJob();

    /// @param usdc_ Payment token (native Arc USDC).
    /// @param registry_ Worker registry.
    /// @param owner_ Contract owner (host / policy admin).
    /// @param perJobCap_ Max USDC per job budget.
    /// @param dailyCap_ Max USDC funded per UTC day.
    /// @param ownerApprovalThreshold_ Budgets above this need owner approval.
    constructor(
        IERC20 usdc_,
        IWorkerRegistry registry_,
        address owner_,
        uint256 perJobCap_,
        uint256 dailyCap_,
        uint256 ownerApprovalThreshold_
    ) Ownable(owner_) {
        if (address(usdc_) == address(0) || address(registry_) == address(0) || owner_ == address(0)) {
            revert ZeroAddress();
        }
        usdc = usdc_;
        registry = registry_;
        perJobCap = perJobCap_;
        dailyCap = dailyCap_;
        ownerApprovalThreshold = ownerApprovalThreshold_;
        emit CapsUpdated(perJobCap_, dailyCap_, ownerApprovalThreshold_);
    }

    /*//////////////////////////////////////////////////////////////
                        WARD POLICY ADMIN (extras)
    //////////////////////////////////////////////////////////////*/

    /// @notice Update WARD spending caps and the approval threshold. Owner only.
    function setCaps(uint256 perJobCap_, uint256 dailyCap_, uint256 ownerApprovalThreshold_) external onlyOwner {
        perJobCap = perJobCap_;
        dailyCap = dailyCap_;
        ownerApprovalThreshold = ownerApprovalThreshold_;
        emit CapsUpdated(perJobCap_, dailyCap_, ownerApprovalThreshold_);
    }

    /// @notice WARD extra: pre-approve an above-threshold job for funding. Owner
    ///         only. Alternatively the client may pass an ABI-encoded `true`
    ///         bool in fund()'s optParams; either path satisfies the threshold.
    function setOwnerApproved(uint256 jobId, bool approved) external onlyOwner {
        if (jobs[jobId].id == 0) revert UnknownJob();
        ownerApproved[jobId] = approved;
        emit OwnerApprovalSet(jobId, approved);
    }

    /*//////////////////////////////////////////////////////////////
                        ERC-8183 CORE LIFECYCLE
    //////////////////////////////////////////////////////////////*/

    /// @inheritdoc IERC8183
    /// @dev WARD extra: when `provider` is non-zero it must be an active worker.
    function createJob(
        address provider,
        address evaluator,
        uint256 expiredAt,
        string calldata description,
        address hook
    ) external nonReentrant returns (uint256 jobId) {
        if (evaluator == address(0)) revert ZeroAddress();
        if (expiredAt <= block.timestamp) revert ExpiredAtInPast();
        if (provider != address(0) && !registry.isActiveWorker(provider)) revert ProviderNotActiveWorker();

        jobId = nextJobId++;
        jobs[jobId] = Job({
            id: jobId,
            client: msg.sender,
            provider: provider,
            evaluator: evaluator,
            description: description,
            budget: 0,
            expiredAt: expiredAt,
            status: JobStatus.Open,
            hook: hook
        });

        emit JobCreated(jobId, msg.sender, provider, evaluator, expiredAt, hook);
    }

    /// @inheritdoc IERC8183
    /// @dev Client only, Open. WARD extra: provider must be an active worker.
    function setProvider(uint256 jobId, address provider) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.client) revert NotClient();
        if (job.status != JobStatus.Open) revert WrongStatus(JobStatus.Open, job.status);
        if (provider == address(0)) revert ZeroAddress();
        if (!registry.isActiveWorker(provider)) revert ProviderNotActiveWorker();

        _before(job, msg.sig, "");
        job.provider = provider;
        emit ProviderSet(jobId, provider);
        _after(job, msg.sig, "");
    }

    /// @inheritdoc IERC8183
    /// @dev Client or provider, Open.
    function setBudget(uint256 jobId, uint256 amount, bytes calldata optParams) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.client && msg.sender != job.provider) revert NotClientOrProvider();
        if (job.status != JobStatus.Open) revert WrongStatus(JobStatus.Open, job.status);
        if (amount == 0) revert ZeroAmount();

        _before(job, msg.sig, optParams);
        job.budget = amount;
        emit BudgetSet(jobId, amount);
        _after(job, msg.sig, optParams);
    }

    /// @inheritdoc IERC8183
    /// @dev Client only, Open -> Funded. Pulls `budget` USDC via transferFrom.
    ///      WARD extras enforced here: per-job cap, rolling daily cap, and the
    ///      owner-approval threshold. `optParams` MAY be an ABI-encoded bool
    ///      that, when true, supplies the owner approval inline (equivalent to
    ///      calling setOwnerApproved(jobId, true) first).
    function fund(uint256 jobId, bytes calldata optParams) external nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.client) revert NotClient();
        if (job.status != JobStatus.Open) revert WrongStatus(JobStatus.Open, job.status);

        uint256 amount = job.budget;
        if (amount == 0) revert BudgetNotSet();
        if (amount > perJobCap) revert ExceedsPerJobCap();

        // WARD owner-approval threshold: above it, require a stored approval flag
        // OR an inline `abi.encode(true)` in optParams.
        if (amount > ownerApprovalThreshold && !ownerApproved[jobId] && !_decodeApproval(optParams)) {
            revert OwnerApprovalRequired();
        }

        // WARD rolling UTC-daily cap.
        uint256 dayIndex = block.timestamp / 1 days;
        uint256 newDayTotal = fundedOnDay[dayIndex] + amount;
        if (newDayTotal > dailyCap) revert ExceedsDailyCap();
        fundedOnDay[dayIndex] = newDayTotal;

        _before(job, msg.sig, optParams);
        job.status = JobStatus.Funded;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit JobFunded(jobId, msg.sender, amount);
        _after(job, msg.sig, optParams);
    }

    /// @inheritdoc IERC8183
    /// @dev Provider only, Funded -> Submitted. `deliverable` = device id.
    function submit(uint256 jobId, bytes32 deliverable, bytes calldata optParams) external {
        Job storage job = _job(jobId);
        if (msg.sender != job.provider) revert NotProvider();
        if (job.status != JobStatus.Funded) revert WrongStatus(JobStatus.Funded, job.status);

        _before(job, msg.sig, optParams);
        job.status = JobStatus.Submitted;
        emit JobSubmitted(jobId, msg.sender, deliverable);
        _after(job, msg.sig, optParams);
    }

    /// @inheritdoc IERC8183
    /// @dev Evaluator ONLY, Submitted -> Completed. This is WARD's
    ///      "sensor-settled release": the CRE-evaluator releasing the budget to
    ///      the provider AND bumping the provider's reputation. `reason` = a
    ///      short result code.
    function complete(uint256 jobId, bytes32 reason, bytes calldata optParams) external nonReentrant {
        Job storage job = _job(jobId);
        if (msg.sender != job.evaluator) revert NotEvaluator();
        if (job.status != JobStatus.Submitted) revert WrongStatus(JobStatus.Submitted, job.status);

        address provider = job.provider;
        uint256 amount = job.budget;

        _before(job, msg.sig, optParams);
        // Effects before interactions (reentrancy-safe; nonReentrant in depth).
        job.status = JobStatus.Completed;

        registry.bumpReputation(provider, REPUTATION_PER_JOB);
        usdc.safeTransfer(provider, amount);

        emit JobCompleted(jobId, msg.sender, reason);
        emit PaymentReleased(jobId, provider, amount);
        _after(job, msg.sig, optParams);
    }

    /// @inheritdoc IERC8183
    /// @dev client while Open, OR evaluator while Funded|Submitted. Refunds the
    ///      client iff the escrow held funds (Funded|Submitted). -> Rejected.
    function reject(uint256 jobId, bytes32 reason, bytes calldata optParams) external nonReentrant {
        Job storage job = _job(jobId);
        JobStatus status = job.status;

        bool funded = status == JobStatus.Funded || status == JobStatus.Submitted;
        if (status == JobStatus.Open) {
            if (msg.sender != job.client) revert NotClient();
        } else if (funded) {
            if (msg.sender != job.evaluator) revert NotEvaluator();
        } else {
            // Not in a rejectable status.
            revert WrongStatus(JobStatus.Open, status);
        }

        address client = job.client;
        uint256 amount = job.budget;

        _before(job, msg.sig, optParams);
        job.status = JobStatus.Rejected;

        if (funded) {
            usdc.safeTransfer(client, amount);
            emit Refunded(jobId, client, amount);
        }
        emit JobRejected(jobId, msg.sender, reason);
        _after(job, msg.sig, optParams);
    }

    /// @inheritdoc IERC8183
    /// @dev Anyone, while Funded|Submitted and past expiredAt. -> Expired,
    ///      refunds the client.
    function claimRefund(uint256 jobId) external nonReentrant {
        Job storage job = _job(jobId);
        JobStatus status = job.status;
        if (status != JobStatus.Funded && status != JobStatus.Submitted) {
            revert WrongStatus(JobStatus.Funded, status);
        }
        if (block.timestamp <= job.expiredAt) revert NotExpiredYet();

        address client = job.client;
        uint256 amount = job.budget;

        _before(job, msg.sig, "");
        job.status = JobStatus.Expired;

        usdc.safeTransfer(client, amount);
        emit JobExpired(jobId);
        emit Refunded(jobId, client, amount);
        _after(job, msg.sig, "");
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    /// @notice Full ERC-8183 job record.
    function getJob(uint256 jobId) external view returns (Job memory job) {
        return jobs[jobId];
    }

    /// @notice Convenience accessor for a job's current status.
    function jobStatus(uint256 jobId) external view returns (JobStatus status) {
        return jobs[jobId].status;
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNAL
    //////////////////////////////////////////////////////////////*/

    function _job(uint256 jobId) internal view returns (Job storage job) {
        job = jobs[jobId];
        if (job.id == 0) revert UnknownJob();
    }

    /// @dev Decode an optional `abi.encode(bool)` owner-approval flag from
    ///      optParams. Empty or malformed params decode to false.
    function _decodeApproval(bytes calldata optParams) internal pure returns (bool approved) {
        if (optParams.length != 32) return false;
        return abi.decode(optParams, (bool));
    }

    /// @dev Invoke the per-job hook's beforeAction when set and ERC-165 valid.
    function _before(Job storage job, bytes4 selector, bytes memory data) internal {
        address hook = job.hook;
        if (hook != address(0) && _isHook(hook)) {
            IACPHook(hook).beforeAction(job.id, selector, data);
        }
    }

    /// @dev Invoke the per-job hook's afterAction when set and ERC-165 valid.
    function _after(Job storage job, bytes4 selector, bytes memory data) internal {
        address hook = job.hook;
        if (hook != address(0) && _isHook(hook)) {
            IACPHook(hook).afterAction(job.id, selector, data);
        }
    }

    /// @dev True iff `hook` advertises IACPHook via ERC-165 (best-effort; a
    ///      reverting or non-conforming address is simply skipped, keeping the
    ///      hook strictly optional and non-blocking).
    function _isHook(address hook) internal view returns (bool ok) {
        try IERC165(hook).supportsInterface(ACP_HOOK_INTERFACE_ID) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }
}
