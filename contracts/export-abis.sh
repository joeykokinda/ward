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

# Map artifact source -> exported ABI name. WardEscrow is exported BOTH as
# JobEscrow.json (frontend/chain.py compat: they read the "JobEscrow" key) and
# as WardEscrow.json (its real, ERC-8183 name).
declare -A ABI_MAP=(
    [MockUSDC]=MockUSDC
    [WorkerRegistry]=WorkerRegistry
    [WardEscrow]=WardEscrow
    [WardReputationHook]=WardReputationHook
)

for src in "${!ABI_MAP[@]}"; do
    out_name="${ABI_MAP[$src]}"
    artifact="out/${src}.sol/${src}.json"
    if [[ ! -f "$artifact" ]]; then
        echo "error: missing artifact $artifact (run 'forge build' first)" >&2
        exit 1
    fi
    jq '.abi' "$artifact" > "$DEPLOY_DIR/abis/${out_name}.json"
    echo "wrote $DEPLOY_DIR/abis/${out_name}.json"
done

# Frontend + chain.py read the "JobEscrow" deployment key; export WardEscrow's
# ABI under that name too so existing consumers keep working unchanged.
jq '.abi' "out/WardEscrow.sol/WardEscrow.json" > "$DEPLOY_DIR/abis/JobEscrow.json"
echo "wrote $DEPLOY_DIR/abis/JobEscrow.json (= WardEscrow / ERC-8183)"
