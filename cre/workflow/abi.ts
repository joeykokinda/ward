/**
 * Minimal ABI for the WARD CRE consumer (WardCreConsumer.sol).
 * Only `onReport(bytes metadata, bytes report)` — the IReceiver entrypoint the
 * CRE Forwarder calls — is needed by the workflow. The report payload itself is
 * a raw abi.encode(uint256 jobId, bool healthy) built with viem's
 * encodeAbiParameters in index.ts.
 */
export const WARD_CRE_CONSUMER_ABI = [
	{
		type: 'function',
		name: 'onReport',
		stateMutability: 'nonpayable',
		inputs: [
			{ name: 'metadata', type: 'bytes' },
			{ name: 'report', type: 'bytes' },
		],
		outputs: [],
	},
] as const
