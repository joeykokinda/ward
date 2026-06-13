#!/usr/bin/env bash
# Export each WARD contract's ABI from the Foundry build artifacts into the
# repo-root /deployments/abis/<name>.json (the single canonical location read by
# the agent + frontend). Run after `forge build` (and after Deploy).
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v jq >/dev/null 2>&1; then
    echo "error: jq is required to export ABIs" >&2
    exit 1
fi

# Canonical deployments dir is the repo root /deployments (../ from contracts/).
DEPLOY_DIR="../deployments"
mkdir -p "$DEPLOY_DIR/abis"

CONTRACTS=(MockUSDC WorkerRegistry JobEscrow AuthorizedReporterVerifier)

for name in "${CONTRACTS[@]}"; do
    artifact="out/${name}.sol/${name}.json"
    if [[ ! -f "$artifact" ]]; then
        echo "error: missing artifact $artifact (run 'forge build' first)" >&2
        exit 1
    fi
    jq '.abi' "$artifact" > "$DEPLOY_DIR/abis/${name}.json"
    echo "wrote $DEPLOY_DIR/abis/${name}.json"
done
