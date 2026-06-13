// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {stdJson} from "forge-std/StdJson.sol";
import {MockUSDC} from "../src/MockUSDC.sol";
import {WorkerRegistry} from "../src/WorkerRegistry.sol";
import {WardEscrow} from "../src/WardEscrow.sol";

/// @notice Seeds a freshly deployed WARD ERC-8183 stack on local anvil so the
///         app opens with history: 5 registered+staked workers, an agent
///         (client) funded with 500 USDC, and 3 historical jobs taken through
///         the full ERC-8183 lifecycle (createJob -> fund -> submit -> complete)
///         and COMPLETED by the evaluator.
///
///         Reads addresses from deployments/<chainId>.json. Accounts derive from
///         the standard anvil test mnemonic. Run against anvil only.
contract Seed is Script {
    using stdJson for string;

    string internal constant MNEMONIC = "test test test test test test test test test test test junk";

    uint256 internal constant USDC_UNIT = 1e6;
    uint256 internal constant AGENT_FUNDING = 500 * USDC_UNIT;
    uint256 internal constant WORKER_STAKE = 50 * USDC_UNIT;
    uint256 internal constant JOB_BUDGET = 75 * USDC_UNIT; // below the 100 USDC threshold

    function run() external {
        uint256 chainId = block.chainid;
        string memory deployment = vm.readFile(string.concat("../deployments/", vm.toString(chainId), ".json"));

        MockUSDC usdc = MockUSDC(deployment.readAddress(".MockUSDC"));
        WorkerRegistry registry = WorkerRegistry(deployment.readAddress(".WorkerRegistry"));
        WardEscrow escrow = WardEscrow(deployment.readAddress(".JobEscrow"));

        // index 0 = agent (client), indices 1..5 = workers, index 6 = evaluator.
        uint256 agentKey = vm.deriveKey(MNEMONIC, 0);
        address agent = vm.addr(agentKey);
        uint256 evaluatorKey = vm.deriveKey(MNEMONIC, 6);
        address evaluator = vm.addr(evaluatorKey);

        string[5] memory handles = ["mike", "sara", "deon", "lena", "raj"];
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
            registry.register(handles[i], string.concat(handles[i], ".ward-agent.eth"), "wifi,router,onsite", regions[i]);
            usdc.approve(address(registry), WORKER_STAKE);
            registry.stakeUSDC(WORKER_STAKE);
            vm.stopBroadcast();
            console2.log("registered+staked worker", handles[i], workers[i]);
        }

        // 2. Fund the agent (client) with 500 USDC and approve the escrow.
        vm.startBroadcast(agentKey);
        usdc.mint(agent, AGENT_FUNDING);
        usdc.approve(address(escrow), type(uint256).max);
        vm.stopBroadcast();
        console2.log("funded agent", agent, "USDC", AGENT_FUNDING);

        // 3. Run 3 historical jobs through the full ERC-8183 lifecycle, each
        //    assigned to a different worker, completed by the evaluator.
        bytes32[3] memory devices = [bytes32("prop-1-router"), bytes32("prop-2-router"), bytes32("prop-3-router")];
        uint256[3] memory assignees = [uint256(0), uint256(1), uint256(2)]; // mike, sara, deon

        for (uint256 j = 0; j < 3; j++) {
            uint256 expiredAt = block.timestamp + 7 days;
            address provider = workers[assignees[j]];

            // createJob (client) + setBudget + fund
            vm.startBroadcast(agentKey);
            uint256 jobId = escrow.createJob(provider, evaluator, expiredAt, "fix instrumented device", address(0));
            escrow.setBudget(jobId, JOB_BUDGET, "");
            escrow.fund(jobId, "");
            vm.stopBroadcast();

            // submit (provider)
            vm.startBroadcast(workerKeys[assignees[j]]);
            escrow.submit(jobId, devices[j], "");
            vm.stopBroadcast();

            // complete (evaluator) -> PaymentReleased + reputation bump
            vm.startBroadcast(evaluatorKey);
            escrow.complete(jobId, bytes32("ok"), "");
            vm.stopBroadcast();

            console2.log("completed historical job", jobId);
        }

        console2.log("Seed complete: 5 workers, agent +500 USDC, 3 completed ERC-8183 jobs.");
    }
}
