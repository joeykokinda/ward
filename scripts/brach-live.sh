#!/usr/bin/env bash
# Flip the WARD agent on `brach` from DRY to LIVE chain (Arc Testnet).
# Contains NO secrets — it reads everything from ONE scp'd file: spike/arc/.env
#
# Run ON brach:
#   1) cd ~/EthGlobalBackend/ward && git pull            # gets deployments/ + this script
#   2) copy the single env file from your dev box (run on the DEV box, push to brach):
#        scp ~/Projects/web3/EthGlobal2026/spike/arc/.env rex@<brach-ip>:~/EthGlobalBackend/ward/spike/arc/.env
#   3) bash scripts/brach-live.sh
# spike/arc/.env supplies DEPLOYER_PRIVATE_KEY, ANTHROPIC_API_KEY, WORKER_ADDRESS,
# WORKER_PRIVATE_KEY — no JSON, no manual export, no fish quirks.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"; cd "$REPO"
[ -f spike/arc/.env ] || { echo "ERR: missing spike/arc/.env — scp it from your dev box (step 2)"; exit 1; }
set -a; . spike/arc/.env; set +a
fail=0
for v in DEPLOYER_PRIVATE_KEY ANTHROPIC_API_KEY WORKER_ADDRESS WORKER_PRIVATE_KEY EVALUATOR_ADDRESS EVALUATOR_PRIVATE_KEY; do
  if [ -z "${!v:-}" ]; then echo "ERR: $v is empty in spike/arc/.env"; fail=1; fi
done
[ "$fail" = 0 ] || { echo "Fix spike/arc/.env (re-scp from dev box) and re-run."; exit 1; }

if grep -q 'WARD: LIVE block' agent/.env 2>/dev/null; then
  echo "NOTE: live block already in agent/.env — removing the old one before rewriting."
  # strip the previous block (from the marker line to EOF) so re-runs are idempotent
  sed -i '/# --- WARD: LIVE block/,$d' agent/.env
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
EVALUATOR_ADDRESS=$EVALUATOR_ADDRESS
EVALUATOR_PRIVATE_KEY=$EVALUATOR_PRIVATE_KEY
WARD_WORKER_KEYS={"$WORKER_ADDRESS":"$WORKER_PRIVATE_KEY"}
WARD_WORKER_ROSTER=[{"address":"$WORKER_ADDRESS","handle":"mike","ensName":"mike.ward-agent.eth","skills":"plumbing,networking,hardware","region":"Brooklyn NY","reputation":1}]
EOF
echo "wrote LIVE block to agent/.env; restarting ward-sim + ward-agent…"
systemctl --user restart ward-sim ward-agent
sleep 4
echo "agent mode now:"; curl -s http://127.0.0.1:8091/healthz; echo
echo
echo "Want to see \"chain\":\"LIVE\" and agent_address 0xDCe5… (not 0xWARDAGENTDRY…)."