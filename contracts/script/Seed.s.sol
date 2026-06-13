// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {JobEscrow} from "../src/JobEscrow.sol";
import {HealthAttestation} from "../src/interfaces/ICreConsumer.sol";

/// @notice Seeds a freshly deployed WARD stack on local anvil so the app opens
///         with history: 5 registered+staked workers (mike, sara, deon, lena,
///         raj), an agent funded with 500 USDC, and 3 historical jobs that are
///         created, accepted, worked, and SETTLED end to end.
///
///         Reads addresses from deployments/<chainId>.json. Assumes the local
///         CreVerifier is the MockCreVerifier (default local deploy), which
///         attests healthy, so settle() releases USDC and bumps reputation.
///
///         Accounts are derived from the standard test mnemonic (anvil default),
///         which is pre-funded with ETH on anvil. Run against anvil only.
contract Seed is Script {
    using stdJson for string;

    // Standard Foundry/anvil test mnemonic. Accounts are pre-funded on anvil.
    string internal constant MNEMONIC = "test test test test test test test test test test test junk";

    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant AGENT_FUNDING = 500 * USDC_UNIT;
    uint256 internal constant WORKER_STAKE = 50 * USDC_UNIT;
    uint256 internal constant JOB_AMOUNT = 75 * USDC_UNIT; // demo amount, below threshold

    function run() external {
        uint256 chainId = block.chainid;
        // Canonical deployments dir is the repo root /deployments (../ from the
        // contracts/ foundry project root).
        string memory deployment = vm.readFile(string.concat("../deployments/", vm.toString(chainId), ".json"));

        MockUSDC usdc = MockUSDC(deployment.readAddress(".MockUSDC"));
        WorkerRegistry registry = WorkerRegistry(deployment.readAddress(".WorkerRegistry"));
        JobEscrow escrow = JobEscrow(deployment.readAddress(".JobEscrow"));

        // Derive deterministic accounts from the test mnemonic.
        // index 0 = agent, indices 1..5 = the five workers.
        uint256 agentKey = vm.deriveKey(MNEMONIC, 0);
        address agent = vm.addr(agentKey);

        string[5] memory handles = ["mike", "sara", "deon", "lena", "raj"];
        // Regions match the canonical fixtures (web/lib/data/fixtures.ts + db/seed)
        // so mock and live modes show the same worker profiles to a judge.
        string[5] memory regions = ["Greenwich, CT", "Stamford, CT", "Brooklyn, NY", "Hudson, NY", "Greenwich, CT"];
        uint256[5] memory workerKeys;
        address[5] memory workers;
        for (uint256 i = 0; i < 5; i++) {
            workerKeys[i] = vm.deriveKey(MNEMONIC, uint32(i + 1));
            workers[i] = vm.addr(workerKeys[i]);
        }

        // 1. Register + stake all five workers.
        for (uint256 i = 0; i < 5; i++) {
            vm.startBroadcast(workerKeys[i]);
            usdc.mint(workers[i], WORKER_STAKE);
            registry.register(
                handles[i], string.concat(handles[i], ".ward-agent.eth"), "wifi,router,onsite", regions[i]
            );
            usdc.approve(address(registry), WORKER_STAKE);
            registry.stakeUSDC(WORKER_STAKE);
            vm.stopBroadcast();
            console2.log("registered+staked worker", handles[i], workers[i]);
        }

        // 2. Fund the agent with 500 USDC and approve the escrow.
        vm.startBroadcast(agentKey);
        usdc.mint(agent, AGENT_FUNDING);
        usdc.approve(address(escrow), type(uint256).max);
        vm.stopBroadcast();
        console2.log("funded agent", agent, "USDC", AGENT_FUNDING);

        // 3. Create + accept + work + SETTLE 3 historical jobs, one per property,
        //    each assigned to a different worker, so reputation is non-trivial.
        bytes32[3] memory props = [bytes32("prop-1"), bytes32("prop-2"), bytes32("prop-3")];
        bytes32[3] memory devices = [bytes32("prop-1-router"), bytes32("prop-2-router"), bytes32("prop-3-router")];
        uint256[3] memory assignees = [uint256(0), uint256(1), uint256(2)]; // mike, sara, deon

        for (uint256 j = 0; j < 3; j++) {
            uint256 deadline = block.timestamp + 7 days;

            vm.startBroadcast(agentKey);
            uint256 jobId = escrow.createJob(props[j], devices[j], JOB_AMOUNT, deadline, false);
            vm.stopBroadcast();

            uint256 wk = workerKeys[assignees[j]];
            vm.startBroadcast(wk);
            escrow.acceptJob(jobId);
            escrow.markWorkDone(jobId);
            vm.stopBroadcast();

            // Mock verifier attests healthy; settle releases USDC + bumps rep.
            HealthAttestation memory att = HealthAttestation({
                jobId: jobId, deviceId: devices[j], healthy: true, reportTimestamp: block.timestamp, signature: ""
            });
            vm.startBroadcast(agentKey);
            escrow.settle(jobId, att);
            vm.stopBroadcast();

            console2.log("settled historical job", jobId);
        }

        console2.log("Seed complete: 5 workers, agent +500 USDC, 3 settled jobs.");
    }
}
