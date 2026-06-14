#!/usr/bin/env bash
# WARD local dev stack — one command brings up the whole thing on anvil with no
# external credentials, and a real on-chain incident settles end-to-end.
#
#   scripts/dev-stack.sh up        # start anvil + deploy + seed + sim + agent (LIVE on anvil)
#   scripts/dev-stack.sh down      # stop sim + agent + anvil started by `up`
#   scripts/dev-stack.sh status    # show what's running
#   scripts/dev-stack.sh           # same as `up`
#
# Idempotent: re-running `up` reuses a running anvil, redeploys + reseeds, and
# restarts the sim + agent. Everything is local; the agent runs LIVE against the
# anvil-deployed ERC-8183 contracts. Logs land in /tmp/ward-*.log; PIDs in
# .dev-stack/.
set -euo pipefail

# ----------------------------------------------------------------- locations
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
RUN_DIR="$ROOT/.dev-stack"
mkdir -p "$RUN_DIR"

export PATH="$HOME/.foundry/bin:$HOME/.local/bin:$PATH"

# ----------------------------------------------------------------- config
RPC_URL="http://127.0.0.1:8545"
CHAIN_ID=31337
SIM_PORT=8090
AGENT_PORT=8091
SIM_BASE_URL="http://localhost:${SIM_PORT}"
AGENT_URL="http://localhost:${AGENT_PORT}"

# anvil default account 0 = deployer + agent. Indices 1..5 = the five workers
# (mike, sara, deon, lena, raj), matching contracts/script/Seed.s.sol. These are
# the public, well-known anvil test keys; safe only on a local throwaway chain.
DEPLOYER_KEY="0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
AGENT_KEY="$DEPLOYER_KEY"
AGENT_ADDR="0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"

MIKE_ADDR="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
SARA_ADDR="0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"
DEON_ADDR="0x90F79bf6EB2c4f870365E785982E1f101E93b906"
LENA_ADDR="0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65"
RAJ_ADDR="0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc"

MIKE_KEY="0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
SARA_KEY="0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
DEON_KEY="0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"
LENA_KEY="0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"
RAJ_KEY="0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba"

# ----------------------------------------------------------------- helpers
log() { printf '\033[36m[dev-stack]\033[0m %s\n' "$*"; }
err() { printf '\033[31m[dev-stack]\033[0m %s\n' "$*" >&2; }

anvil_running() { cast block-number --rpc-url "$RPC_URL" >/dev/null 2>&1; }

pid_alive() { [[ -n "${1:-}" ]] && kill -0 "$1" >/dev/null 2>&1; }

wait_for() {
  # wait_for <name> <url> <max_seconds>
  local name="$1" url="$2" max="${3:-30}" i=0
  while (( i < max )); do
    if curl -fsS "$url" >/dev/null 2>&1; then return 0; fi
    sleep 1; i=$((i+1))
  done
  return 1
}

# ----------------------------------------------------------------- anvil
start_anvil() {
  if anvil_running; then
    log "anvil already up at $RPC_URL (reusing)"
    return 0
  fi
  log "starting anvil ($RPC_URL, chainId $CHAIN_ID) ..."
  anvil --silent > /tmp/ward-anvil.log 2>&1 &
  echo $! > "$RUN_DIR/anvil.pid"
  local i=0
  while (( i < 20 )); do
    if anvil_running; then log "anvil up (pid $(cat "$RUN_DIR/anvil.pid"))"; return 0; fi
    sleep 1; i=$((i+1))
  done
  err "anvil failed to start; see /tmp/ward-anvil.log"; return 1
}

# ----------------------------------------------------------------- contracts
deploy_and_seed() {
  log "deploying contracts (ERC-8183 WardEscrow + WorkerRegistry) ..."
  # Pre-create the canonical deployments dir so foundry can resolve the
  # fs_permissions path (../deployments) on a clean checkout before the script's
  # own vm.createDir runs.
  mkdir -p "$ROOT/deployments/abis"
  pushd "$ROOT/contracts" >/dev/null
  # USDC_ADDRESS unset => Deploy deploys MockUSDC for the local chain.
  PRIVATE_KEY="$DEPLOYER_KEY" \
    forge script script/Deploy.s.sol --rpc-url "$RPC_URL" --broadcast >/tmp/ward-deploy.log 2>&1 \
    || { err "deploy failed; see /tmp/ward-deploy.log"; popd >/dev/null; return 1; }
  ./export-abis.sh >/tmp/ward-abis.log 2>&1 \
    || { err "export-abis failed; see /tmp/ward-abis.log"; popd >/dev/null; return 1; }
  log "seeding (5 workers, agent +500 USDC, 3 settled jobs) ..."
  forge script script/Seed.s.sol --rpc-url "$RPC_URL" --broadcast >/tmp/ward-seed.log 2>&1 \
    || { err "seed failed; see /tmp/ward-seed.log"; popd >/dev/null; return 1; }
  popd >/dev/null

  USDC_ADDRESS="$(jq -r '.MockUSDC' "$ROOT/deployments/${CHAIN_ID}.json")"
  log "deployed: $(jq -c '{MockUSDC,WorkerRegistry,Evaluator,JobEscrow}' "$ROOT/deployments/${CHAIN_ID}.json")"
}

# ----------------------------------------------------------------- sim
start_sim() {
  if [[ -f "$RUN_DIR/sim.pid" ]] && pid_alive "$(cat "$RUN_DIR/sim.pid")"; then
    log "sim already running (pid $(cat "$RUN_DIR/sim.pid")); restarting"
    kill "$(cat "$RUN_DIR/sim.pid")" 2>/dev/null || true
    sleep 1
  fi
  pushd "$ROOT/sim" >/dev/null
  if [[ ! -x .venv/bin/uvicorn && ! -f .venv/bin/python ]]; then
    log "creating sim venv ..."
    uv venv --python 3.12 >/dev/null 2>&1
    uv pip install -r requirements.txt >/dev/null 2>&1
  fi
  log "starting device sim on :$SIM_PORT ..."
  .venv/bin/python -m uvicorn main:app --host 0.0.0.0 --port "$SIM_PORT" \
    > /tmp/ward-sim.log 2>&1 &
  echo $! > "$RUN_DIR/sim.pid"
  popd >/dev/null
  if wait_for sim "$SIM_BASE_URL/fleet" 30; then
    log "sim up (pid $(cat "$RUN_DIR/sim.pid")) — $SIM_BASE_URL"
  else
    err "sim did not become reachable; see /tmp/ward-sim.log"; return 1
  fi
}

# ----------------------------------------------------------------- agent
start_agent() {
  if [[ -f "$RUN_DIR/agent.pid" ]] && pid_alive "$(cat "$RUN_DIR/agent.pid")"; then
    log "agent already running (pid $(cat "$RUN_DIR/agent.pid")); restarting"
    kill "$(cat "$RUN_DIR/agent.pid")" 2>/dev/null || true
    sleep 1
  fi
  : "${USDC_ADDRESS:=$(jq -r '.MockUSDC' "$ROOT/deployments/${CHAIN_ID}.json")}"

  # Canonical worker roster = the registered+staked anvil workers (Seed.s.sol),
  # so the agent dispatches to an address that is actually active on-chain and
  # whose key it holds (WARD_WORKER_KEYS) to sign accept/markWorkDone.
  local roster keys
  roster=$(cat <<JSON
[{"address":"$MIKE_ADDR","handle":"mike","ensName":"mike.ward-agent.eth","skills":"network,router,hardware","region":"Greenwich, CT","reputation":98},
 {"address":"$SARA_ADDR","handle":"sara","ensName":"sara.ward-agent.eth","skills":"network,smart-lock","region":"Stamford, CT","reputation":91},
 {"address":"$DEON_ADDR","handle":"deon","ensName":"deon.ward-agent.eth","skills":"hardware,hvac","region":"Brooklyn, NY","reputation":87},
 {"address":"$LENA_ADDR","handle":"lena","ensName":"lena.ward-agent.eth","skills":"network,sensor","region":"Hudson, NY","reputation":84},
 {"address":"$RAJ_ADDR","handle":"raj","ensName":"raj.ward-agent.eth","skills":"router,general","region":"Greenwich, CT","reputation":79}]
JSON
)
  keys=$(cat <<JSON
{"$MIKE_ADDR":"$MIKE_KEY","$SARA_ADDR":"$SARA_KEY","$DEON_ADDR":"$DEON_KEY","$LENA_ADDR":"$LENA_KEY","$RAJ_ADDR":"$RAJ_KEY"}
JSON
)

  log "starting agent (LIVE on anvil) on :$AGENT_PORT ..."
  pushd "$ROOT/agent" >/dev/null
  ARC_RPC_URL="$RPC_URL" \
  ARC_CHAIN_ID="$CHAIN_ID" \
  AGENT_PRIVATE_KEY="$AGENT_KEY" \
  USDC_ADDRESS="$USDC_ADDRESS" \
  SIM_BASE_URL="$SIM_BASE_URL" \
  WARD_PORT="$AGENT_PORT" \
  WARD_DEPLOYMENTS_DIR="$ROOT/deployments" \
  WARD_WORKER_ROSTER="$roster" \
  WARD_WORKER_KEYS="$keys" \
  WARD_POLL_INTERVAL="3.0" \
  WARD_ATTEST_POLL="1.0" \
  WARD_ATTEST_TIMEOUT="60.0" \
    .venv/bin/python -m ward_agent.server > /tmp/ward-agent.log 2>&1 &
  echo $! > "$RUN_DIR/agent.pid"
  popd >/dev/null
  if wait_for agent "$AGENT_URL/healthz" 30; then
    log "agent up (pid $(cat "$RUN_DIR/agent.pid")) — $AGENT_URL"
  else
    err "agent did not become reachable; see /tmp/ward-agent.log"; return 1
  fi
}

# ----------------------------------------------------------------- commands
cmd_up() {
  command -v jq >/dev/null 2>&1 || { err "jq is required"; exit 1; }
  command -v forge >/dev/null 2>&1 || { err "forge not on PATH ($HOME/.foundry/bin)"; exit 1; }
  command -v uv >/dev/null 2>&1 || { err "uv not on PATH ($HOME/.local/bin)"; exit 1; }

  start_anvil
  deploy_and_seed
  start_sim
  start_agent

  local chain_mode
  chain_mode=$(curl -fsS "$AGENT_URL/healthz" 2>/dev/null | jq -r '.mode.chain' 2>/dev/null || echo "?")

  cat <<EOF

  ====================================================================
  WARD dev stack is UP  (chain mode: ${chain_mode})
  --------------------------------------------------------------------
  anvil       $RPC_URL  (chainId $CHAIN_ID)
  device sim  $SIM_BASE_URL        (console UI at /, fleet at /fleet)
  agent       $AGENT_URL
                - SSE event stream : $AGENT_URL/events
                - recent events    : $AGENT_URL/events/recent
                - health/mode      : $AGENT_URL/healthz
                - trigger incident : POST $AGENT_URL/incident/simulate
  deployments $ROOT/deployments/${CHAIN_ID}.json (+ abis/)

  Trigger a real on-chain hard-fault incident:
    curl -X POST $AGENT_URL/incident/simulate \\
         -H 'content-type: application/json' \\
         -d '{"propertyId":"home-leak","mode":"hard","autoComplete":true}'
    curl -N $AGENT_URL/events            # watch the reasoning stream

  Frontend (live wiring against this stack):
    cd web && \\
    NEXT_PUBLIC_DATA_ADAPTER=live \\
    NEXT_PUBLIC_AGENT_URL=$AGENT_URL \\
    NEXT_PUBLIC_ARC_CHAIN_ID=$CHAIN_ID \\
    NEXT_PUBLIC_ARC_EXPLORER=$RPC_URL \\
    NEXT_PUBLIC_WORKER_REGISTRY=$(jq -r '.WorkerRegistry' "$ROOT/deployments/${CHAIN_ID}.json") \\
    NEXT_PUBLIC_JOB_ESCROW=$(jq -r '.JobEscrow' "$ROOT/deployments/${CHAIN_ID}.json") \\
    NEXT_PUBLIC_USDC_ADDRESS=$(jq -r '.MockUSDC' "$ROOT/deployments/${CHAIN_ID}.json") \\
      pnpm dev        # http://localhost:3000

  Tear down:  scripts/dev-stack.sh down
  ====================================================================

EOF
}

cmd_down() {
  for svc in agent sim anvil; do
    if [[ -f "$RUN_DIR/$svc.pid" ]]; then
      local pid; pid="$(cat "$RUN_DIR/$svc.pid")"
      if pid_alive "$pid"; then
        log "stopping $svc (pid $pid)"; kill "$pid" 2>/dev/null || true
      fi
      rm -f "$RUN_DIR/$svc.pid"
    fi
  done
  log "dev stack down."
}

cmd_status() {
  anvil_running && log "anvil: UP ($RPC_URL)" || log "anvil: down"
  if [[ -f "$RUN_DIR/sim.pid" ]] && pid_alive "$(cat "$RUN_DIR/sim.pid")"; then
    log "sim:   UP (pid $(cat "$RUN_DIR/sim.pid")) $SIM_BASE_URL"; else log "sim:   down"; fi
  if [[ -f "$RUN_DIR/agent.pid" ]] && pid_alive "$(cat "$RUN_DIR/agent.pid")"; then
    log "agent: UP (pid $(cat "$RUN_DIR/agent.pid")) $AGENT_URL"; else log "agent: down"; fi
}

case "${1:-up}" in
  up)     cmd_up ;;
  down)   cmd_down ;;
  status) cmd_status ;;
  *)      err "usage: $0 {up|down|status}"; exit 1 ;;
esac
