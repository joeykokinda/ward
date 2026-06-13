#!/usr/bin/env bash
# Flip the WARD agent on `brach` from DRY to LIVE chain (Arc Testnet).
# Contains NO secrets — it reads them at runtime from scp'd key files + env.
#
# Run ON brach, in this order:
#   1) cd ~/EthGlobalBackend/ward && git pull          # gets deployments/5042002.json + this script
#   2) from brach, pull the key files off your dev machine over Tailscale:
#        scp 100.85.79.108:~/Projects/web3/EthGlobal2026/spike/arc/.env             spike/arc/.env
#        scp 100.85.79.108:~/Projects/web3/EthGlobal2026/spike/arc/.env.worker.json spike/arc/.env.worker.json
#   3) bash scripts/brach-live.sh
#      (ANTHROPIC_API_KEY is read from the scp'd spike/arc/.env; no export needed.
#       If you prefer, in fish set it first: set -x ANTHROPIC_API_KEY sk-ant-...)
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"; cd "$REPO"
[ -f spike/arc/.env ] || { echo "ERR: missing spike/arc/.env — scp it from your dev machine (step 2)"; exit 1; }
[ -f spike/arc/.env.worker.json ] || { echo "ERR: missing spike/arc/.env.worker.json — scp it (step 2)"; exit 1; }
set -a; . spike/arc/.env; set +a   # -> DEPLOYER_PRIVATE_KEY (+ ANTHROPIC_API_KEY if present in the file)
: "${ANTHROPIC_API_KEY:?ERR: ANTHROPIC_API_KEY not set. Either it is in spike/arc/.env (recommended), or in fish run: set -x ANTHROPIC_API_KEY sk-ant-... before this script}"
WADDR=$(python3 -c "import json;print(json.load(open('spike/arc/.env.worker.json'))[0]['address'])")
WKEY=$(python3 -c "import json;print(json.load(open('spike/arc/.env.worker.json'))[0]['private_key'])")
if grep -q 'WARD: LIVE block' agent/.env 2>/dev/null; then
  echo "live block already present in agent/.env — edit/remove it before re-running"; exit 1
fi
cat >> agent/.env <<EOF

# --- WARD: LIVE block (Arc) — scripts/brach-live.sh ---
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
USDC_ADDRESS=0x3600000000000000000000000000000000000000
WARD_DEPLOYMENTS_DIR=$REPO/deployments
WARD_JOB_AMOUNT=1000000
AGENT_PRIVATE_KEY=$DEPLOYER_PRIVATE_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY
WARD_WORKER_KEYS={"$WADDR":"$WKEY"}
WARD_WORKER_ROSTER=[{"address":"$WADDR","handle":"mike","ensName":"mike.ward-agent.eth","skills":"networking,router","region":"Greenwich CT","reputation":1}]
EOF
echo "wrote LIVE block to agent/.env; restarting ward-agent…"
systemctl --user restart ward-agent
sleep 4
echo "agent mode now:"; curl -s http://127.0.0.1:8091/healthz; echo
echo "Expect \"chain\":\"LIVE\". If so, the next simulated incident settles on real Arc."