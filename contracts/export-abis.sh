#!/usr/bin/env bash
# Export each WARD contract's ABI from the Foundry build artifacts into
# deployments/abis/<name>.json. Run after `forge build` (and after Deploy).
# Frontend (web/) and agent read these alongside deployments/<chainId>.json.
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required to export ABIs" >&2
    exit 1
fi

mkdir -p deployments/abis

CONTRACTS=(MockUSDC WorkerRegistry JobEscrow AuthorizedReporterVerifier)

for name in "${CONTRACTS[@]}"; do
    artifact="out/${name}.sol/${name}.json"
    if [[ ! -f "$artifact" ]]; then
        echo "error: missing artifact $artifact (run 'forge build' first)" >&2
        exit 1
    fi
    jq '.abi' "$artifact" > "deployments/abis/${name}.json"
    echo "wrote deployments/abis/${name}.json"
done
