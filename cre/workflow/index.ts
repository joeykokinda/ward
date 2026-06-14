/**
 * WARD — CRE attestation workflow.
 *
 * Fetches a WARD device status from the public sim HTTPS endpoint, verifies the
 * fault is resolved (online === true && faultMode === "none"), and writes an
 * onchain report to the WardCreConsumer contract on Arc Testnet. The consumer
 * calls back into JobEscrow.settle(jobId) via the ICreConsumer seam.
 *
 * API shape — GET /device/{id}/status -> DeviceStatus:
 *   { deviceId, propertyId, kind, online, uptimeSec, signalDbm, faultMode, lastChangedIso }
 *
 * Authoritative SDK shape mirrored from
 * smartcontractkit/cre-sdk-typescript .../workflows/on-chain-write/index.ts
 * (cre-sdk @ 1.11.0). The write path is forwarder -> consumer.onReport(metadata, report).
 *
 * SWAP-BEFORE-DEMO (all in config.json, no code change needed):
 *   - statusUrl -> https://<live-sim-host>/device/prop-2-router/status
 *   - jobId     -> the JobEscrow jobId being settled
 *   - evms[0].wardConsumerAddress -> deployed WardCreConsumer on Arc Testnet
 *   - evms[0].chainSelectorName   -> "arc-testnet" (CRE Forwarder Directory)
 *
 * The default config points at a documented public placeholder
 * (https://jsonplaceholder.typicode.com/todos/1, which returns
 * {"completed": true}) shaped so the happy path passes, so the workflow
 * simulates end-to-end with zero external setup. See README.md.
 */
import {
	bytesToHex,
	CronCapability,
	consensusIdenticalAggregation,
	EVMClient,
	getNetwork,
	HTTPClient,
	type HTTPSendRequester,
	handler,
	ok,
	prepareReportRequest,
	Runner,
	type Runtime,
	TxStatus,
	text,
} from '@chainlink/cre-sdk'
import { type Address, encodeAbiParameters, encodeFunctionData, toHex } from 'viem'
import { z } from 'zod'
import { WARD_CRE_CONSUMER_ABI } from './abi'

const configSchema = z.object({
	// cron schedule (6-field, seconds-leading) — CRE cron trigger
	schedule: z.string(),
	// Fully-resolved device status URL.
	//   Real WARD sim: https://<sim-host>/device/prop-2-router/status
	//   Placeholder:   https://jsonplaceholder.typicode.com/todos/1  (returns {completed:true})
	statusUrl: z.string(),
	// JobEscrow jobId this attestation settles
	jobId: z.string(),
	evms: z.array(
		z.object({
			// deployed WardCreConsumer (ICreConsumer) on the target chain
			wardConsumerAddress: z.string(),
			// CRE chain-selector name. Arc Testnet -> "arc-testnet"
			chainSelectorName: z.string(),
			gasLimit: z.string(),
		}),
	),
})

type Config = z.infer<typeof configSchema>

// DeviceStatus per the shared interface contract. Only the fields the attestation reads are required.
const deviceStatusSchema = z.object({
	deviceId: z.string(),
	online: z.boolean(),
	faultMode: z.enum(['none', 'soft', 'hard']),
})

/**
 * HTTP fetch callback. Runs inside the DON consensus envelope: every node
 * fetches independently and the results are aggregated. We return a stable
 * JSON string ("true"/"false") so identical-consensus is deterministic.
 *
 * NOTE: with the jsonplaceholder placeholder the real DeviceStatus shape is not
 * returned; the placeholder branch below makes the happy path pass for sim. When
 * apiUrlBase points at the real WARD sim this parses the real DeviceStatus.
 */
const fetchDeviceHealthy = (sendRequester: HTTPSendRequester, config: Config): string => {
	const response = sendRequester.sendRequest({ url: config.statusUrl, method: 'GET' }).result()

	if (!ok(response)) {
		throw new Error(`device status fetch failed: HTTP ${response.statusCode}`)
	}

	const body = text(response)
	const parsed = JSON.parse(body)

	// Placeholder compatibility: jsonplaceholder returns {userId, id, title, completed}.
	// Treat `completed === true` as "device healthy" so the sim happy path runs
	// with no external infra. Remove this branch once apiUrlBase is the real sim.
	if (typeof parsed.completed === 'boolean' && parsed.online === undefined) {
		return String(parsed.completed === true)
	}

	const status = deviceStatusSchema.parse(parsed)
	const healthy = status.online === true && status.faultMode === 'none'
	return String(healthy)
}

const onCronTrigger = (runtime: Runtime<Config>) => {
	const healthyStr = new HTTPClient()
		.sendRequest(
			runtime,
			fetchDeviceHealthy,
			consensusIdenticalAggregation(),
		)(runtime.config)
		.result()

	const healthy = healthyStr === 'true'
	runtime.log(`device status ${runtime.config.statusUrl} healthy=${healthy}`)

	if (!healthy) {
		// Not yet fixed — emit nothing onchain this round. The cron re-checks next tick.
		runtime.log('device not healthy; skipping onchain settle this round')
		return { settled: false, jobId: runtime.config.jobId, txHash: '0x' }
	}

	const evmConfig = runtime.config.evms[0]
	const network = getNetwork({
		chainFamily: 'evm',
		chainSelectorName: evmConfig.chainSelectorName,
		isTestnet: true,
	})
	if (!network) {
		throw new Error(`network not found for chain selector: ${evmConfig.chainSelectorName}`)
	}

	const evmClient = new EVMClient(network.chainSelector.selector)

	// Encode the WARD report payload the consumer's _processReport decodes:
	//   abi.decode(report, (uint256 jobId, bool healthy))
	// The consumer, on healthy==true, calls JobEscrow.settle(jobId).
	const reportPayload = encodeAbiParameters(
		[
			{ name: 'jobId', type: 'uint256' },
			{ name: 'healthy', type: 'bool' },
		],
		[BigInt(runtime.config.jobId), true],
	)

	// onReport(metadata, report): the forwarder fills `metadata`; we pass the
	// report payload. First arg is a placeholder ("0x") per the IReceiver seam.
	const writeCallData = encodeFunctionData({
		abi: WARD_CRE_CONSUMER_ABI,
		functionName: 'onReport',
		args: [toHex('0x'), reportPayload],
	})

	const report = runtime.report(prepareReportRequest(writeCallData)).result()

	const resp = evmClient
		.writeReport(runtime, {
			receiver: evmConfig.wardConsumerAddress as Address,
			report,
		})
		.result()

	if (resp.txStatus !== TxStatus.SUCCESS) {
		throw new Error(`writeReport failed: ${resp.errorMessage || resp.txStatus}`)
	}

	const txHash: string = resp.txHash ? bytesToHex(resp.txHash) : '0x'
	runtime.log(`settled jobId=${runtime.config.jobId} tx=${txHash}`)

	return { settled: true, jobId: runtime.config.jobId, txHash }
}

const initWorkflow = (config: Config) => {
	const cron = new CronCapability()
	return [handler(cron.trigger({ schedule: config.schedule }), onCronTrigger)]
}

export async function main() {
	const runner = await Runner.newRunner<Config>({ configSchema })
	await runner.run(initWorkflow)
}

main()
