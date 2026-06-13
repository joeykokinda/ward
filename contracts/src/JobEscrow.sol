// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IWorkerRegistry} from "./interfaces/IWorkerRegistry.sol";
import {ICreConsumer, HealthAttestation} from "./interfaces/ICreConsumer.sol";

/// @title JobEscrow
/// @notice Proof-of-Physical-Work escrow for WARD. The agent (or any client)
///         posts a USDC-funded job to fix an instrumented device. USDC is held
///         until a machine attestation, verified through the CRE seam
///         (`ICreConsumer`), proves the device is healthy again. Only then does
///         the worker get paid and gain reputation. No human "approve" sits in
///         the happy path; settlement is gated on an attested physical fact.
///
///         The CRE verification mechanism lives entirely behind `ICreConsumer`
///         (see src/interfaces/ICreConsumer.sol) so it can be swapped per the
///         SPIKES.md decision matrix without touching job lifecycle logic.
contract JobEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice Canonical job lifecycle (INTERFACES.md):
    ///         OPEN -> ACCEPTED -> WORK_DONE -> SETTLED, with EXPIRED/REFUNDED
    ///         as the off-happy-path terminus. ATTESTING is the transient moment
    ///         inside settle(); not stored as its own resting state.
    enum JobState {
        None,
        Open,
        Accepted,
        WorkDone,
        Settled,
        Refunded
    }

    /// @notice A single job record.
    struct Job {
        bytes32 propertyId;
        bytes32 deviceId;
        uint256 amount;
        uint256 deadline;
        address client;
        address worker;
        JobState state;
    }

    /// @notice USDC token escrowed (6 decimals).
    IERC20 public immutable usdc;

    /// @notice Worker registry for active-worker checks and reputation bumps.
    IWorkerRegistry public immutable registry;

    /// @notice The attestation verifier (CRE forwarder, fallback oracle, or mock).
    ///         Swappable by the owner without touching job logic.
    ICreConsumer public creVerifier;

    /// @notice Max USDC a single job may escrow.
    uint256 public perJobCap;

    /// @notice Max total USDC that may be escrowed across jobs in one UTC day.
    uint256 public dailyCap;

    /// @notice Jobs above this amount require `ownerApproved == true` to create.
    uint256 public ownerApprovalThreshold;

    /// @notice Reputation points awarded to a worker on each settled job.
    uint256 public constant REPUTATION_PER_JOB = 1;

    /// @notice Next job id to assign (job ids start at 1).
    uint256 public nextJobId = 1;

    /// @notice jobId => job record.
    mapping(uint256 jobId => Job job) private jobs;

    /// @notice UTC day index => total USDC escrowed that day (for the daily cap).
    mapping(uint256 dayIndex => uint256 escrowed) public escrowedOnDay;

    event JobCreated(uint256 jobId, bytes32 propertyId, bytes32 deviceId, uint256 amount);
    event JobAccepted(uint256 jobId, address worker);
    event WorkMarkedDone(uint256 jobId);
    event JobSettled(uint256 jobId, address worker, uint256 amount);
    event JobRefunded(uint256 jobId);
    event CreVerifierUpdated(address verifier);
    event CapsUpdated(uint256 perJobCap, uint256 dailyCap, uint256 ownerApprovalThreshold);

    error ZeroAddress();
    error ZeroAmount();
    error DeadlineInPast();
    error ExceedsPerJobCap();
    error ExceedsDailyCap();
    error OwnerApprovalRequired();
    error WrongState(JobState expected, JobState actual);
    error NotActiveWorker();
    error NotAssignedWorker();
    error DeadlineNotPassed();
    error DeadlinePassed();
    error AttestationWrongJob();
    error DeviceNotHealthy();

    /// @param usdc_ USDC token to escrow.
    /// @param registry_ Worker registry.
    /// @param creVerifier_ Initial attestation verifier (CRE seam implementation).
    /// @param owner_ Contract owner (the host / human-in-the-loop approver).
    /// @param perJobCap_ Max USDC per job.
    /// @param dailyCap_ Max USDC escrowed per UTC day.
    /// @param ownerApprovalThreshold_ Jobs above this need owner approval.
    constructor(
        IERC20 usdc_,
        IWorkerRegistry registry_,
        ICreConsumer creVerifier_,
        address owner_,
        uint256 perJobCap_,
        uint256 dailyCap_,
        uint256 ownerApprovalThreshold_
    ) Ownable(owner_) {
        if (
            address(usdc_) == address(0) || address(registry_) == address(0) || address(creVerifier_) == address(0)
                || owner_ == address(0)
        ) revert ZeroAddress();
        usdc = usdc_;
        registry = registry_;
        creVerifier = creVerifier_;
        perJobCap = perJobCap_;
        dailyCap = dailyCap_;
        ownerApprovalThreshold = ownerApprovalThreshold_;
        emit CapsUpdated(perJobCap_, dailyCap_, ownerApprovalThreshold_);
    }

    /// @notice Swap the attestation verifier (the CRE seam). Owner only.
    /// @param verifier New verifier implementing ICreConsumer.
    function setCreVerifier(ICreConsumer verifier) external onlyOwner {
        if (address(verifier) == address(0)) revert ZeroAddress();
        creVerifier = verifier;
        emit CreVerifierUpdated(address(verifier));
    }

    /// @notice Update spending caps and approval threshold. Owner only.
    function setCaps(uint256 perJobCap_, uint256 dailyCap_, uint256 ownerApprovalThreshold_) external onlyOwner {
        perJobCap = perJobCap_;
        dailyCap = dailyCap_;
        ownerApprovalThreshold = ownerApprovalThreshold_;
        emit CapsUpdated(perJobCap_, dailyCap_, ownerApprovalThreshold_);
    }

    /// @notice Create a USDC-funded job. Pulls `amount` from the caller (agent).
    ///         Enforces the per-job cap and the per-day total cap. Jobs above
    ///         `ownerApprovalThreshold` require `ownerApproved == true`
    ///         (the human-in-the-loop gate).
    /// @param propertyId Property the device belongs to.
    /// @param deviceId Device to be fixed.
    /// @param amount USDC escrowed (6 decimals).
    /// @param deadline Unix seconds after which an unsettled job can be refunded.
    /// @param ownerApproved Caller-supplied approval flag for large jobs. Must be
    ///        true when `amount > ownerApprovalThreshold`; the agent only sets it
    ///        after the host approves out of band.
    /// @return jobId The new job id.
    function createJob(bytes32 propertyId, bytes32 deviceId, uint256 amount, uint256 deadline, bool ownerApproved)
        external
        nonReentrant
        returns (uint256 jobId)
    {
        if (amount == 0) revert ZeroAmount();
        if (amount > perJobCap) revert ExceedsPerJobCap();
        if (deadline <= block.timestamp) revert DeadlineInPast();
        if (amount > ownerApprovalThreshold && !ownerApproved) revert OwnerApprovalRequired();

        uint256 dayIndex = block.timestamp / 1 days;
        uint256 newDayTotal = escrowedOnDay[dayIndex] + amount;
        if (newDayTotal > dailyCap) revert ExceedsDailyCap();
        escrowedOnDay[dayIndex] = newDayTotal;

        jobId = nextJobId++;
        jobs[jobId] = Job({
            propertyId: propertyId,
            deviceId: deviceId,
            amount: amount,
            deadline: deadline,
            client: msg.sender,
            worker: address(0),
            state: JobState.Open
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit JobCreated(jobId, propertyId, deviceId, amount);
    }

    /// @notice Accept an open job. Registered + staked (active) workers only.
    /// @param jobId Job to accept.
    function acceptJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Open) revert WrongState(JobState.Open, job.state);
        if (!registry.isActiveWorker(msg.sender)) revert NotActiveWorker();
        job.worker = msg.sender;
        job.state = JobState.Accepted;
        emit JobAccepted(jobId, msg.sender);
    }

    /// @notice Assigned worker signals the physical fix is done; awaits attestation.
    /// @param jobId Job to mark done.
    function markWorkDone(uint256 jobId) external {
        Job storage job = jobs[jobId];
        if (job.state != JobState.Accepted) revert WrongState(JobState.Accepted, job.state);
        if (msg.sender != job.worker) revert NotAssignedWorker();
        job.state = JobState.WorkDone;
        emit WorkMarkedDone(jobId);
    }

    /// @notice Settle a job: verify the device-healthy attestation through the
    ///         CRE seam, release escrowed USDC to the worker, and bump reputation.
    ///         Anyone may submit the attestation (the CRE forwarder typically
    ///         does); authenticity is enforced by the verifier, not the caller.
    /// @param jobId Job to settle. Must equal `attestation.jobId`.
    /// @param attestation The health attestation (CRE report / authorized
    ///        reporter signature). See ICreConsumer.
    function settle(uint256 jobId, HealthAttestation calldata attestation) external nonReentrant {
        Job storage job = jobs[jobId];
        if (job.state != JobState.WorkDone) revert WrongState(JobState.WorkDone, job.state);
        if (block.timestamp > job.deadline) revert DeadlinePassed();
        if (attestation.jobId != jobId || attestation.deviceId != job.deviceId) revert AttestationWrongJob();

        // CRE seam: verification mechanism is fully isolated behind ICreConsumer.
        bool healthy = creVerifier.verifyHealthy(attestation);
        if (!healthy) revert DeviceNotHealthy();

        // Effects before interactions (reentrancy-safe; nonReentrant in depth).
        address worker = job.worker;
        uint256 amount = job.amount;
        job.state = JobState.Settled;

        registry.bumpReputation(worker, REPUTATION_PER_JOB);
        usdc.safeTransfer(worker, amount);
        emit JobSettled(jobId, worker, amount);
    }

    /// @notice Refund the client after the deadline if the job never settled.
    /// @param jobId Job to refund.
    function refundExpired(uint256 jobId) external nonReentrant {
        Job storage job = jobs[jobId];
        JobState state = job.state;
        if (state != JobState.Open && state != JobState.Accepted && state != JobState.WorkDone) {
            revert WrongState(JobState.WorkDone, state);
        }
        if (block.timestamp <= job.deadline) revert DeadlineNotPassed();

        address client = job.client;
        uint256 amount = job.amount;
        job.state = JobState.Refunded;

        usdc.safeTransfer(client, amount);
        emit JobRefunded(jobId);
    }

    /// @notice Full job record.
    function getJob(uint256 jobId) external view returns (Job memory job) {
        return jobs[jobId];
    }

    /// @notice Convenience accessor for a job's current state.
    function jobState(uint256 jobId) external view returns (JobState state) {
        return jobs[jobId].state;
    }
}
