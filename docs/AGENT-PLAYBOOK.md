# WARD Agent Playbook

How the agent thinks: what it is, the escalation ladder it climbs before spending
money, and the per-device steps it tries. This is the policy the agent implements
(via its rules engine + the Claude diagnosis call); it also specs the demo.

## What WARD is

WARD is rails for an autonomous system to hire and pay a verified human for
physically-verifiable work, with settlement, identity, and reputation on-chain.
The instrumented home is the first instance, not the product.

The home agent watches your devices and acts on what it sees. It fixes what it
can in software; when the fault is physical and software cannot touch it, it
hires a verified human and pays them the moment a sensor attests the repair.
That is the one thing a cloud assistant cannot do: an assistant can observe
physical state, but it cannot settle with a human in the physical world. An
agent that takes physical-world action with money is exactly why the human
handoff exists.

On-chain is the settlement, the identity, and the reputation, not the agent's
operation: identity and discovery on ENS, escrow and payment on Arc, the fix
attested by a Chainlink CRE workflow. Crypto is load-bearing only at L3, the
moment the agent pays a human. For one homeowner with a credit card it is not
needed; the buyers that need it are software with no bank account: property
managers, DePIN fleets, DAO treasuries, agent wallets. They share one trait,
software that hires verifiable human labor and cannot use traditional payment
rails, so they all run on the same contracts.

## The actors

- **The agent:** `ward-agent.eth`, one per home. It decides and pays, holding a
  USDC treasury under a spending policy (per-job cap, daily cap, owner-approval
  threshold).
- **The workers:** human field techs, each an ENS subname
  (`mike.ward-agent.eth`, ...). Skills, region, and a reputation pointer live in
  their ENS records. The agent discovers and ranks them live.
- **The evaluator:** a Chainlink CRE workflow that reads device telemetry and
  attests the fix, releasing the escrow. The sensor approves the payment, not a
  person.

## The escalation ladder

When a device reports a fault, WARD does not jump to hiring a human. It climbs a
ladder, cheapest first:

- **L1, self-fix (free, instant, autonomous):** software remedies the agent runs
  itself: reboot, reconfigure, re-pair, cycle a relay, close a smart valve. Most
  incidents end here. This is the everyday value.
- **L2, guided remote (optional):** a scripted multi-step remote remediation when
  one action is not enough, for example a firmware reflash. Still no human.
- **L3, hire a human (escrowed, proof-settled):** only when the fault is physical
  and software cannot resolve it. WARD discovers a verified worker via ENS,
  escrows USDC on Arc, dispatches them, and releases payment when the sensor
  attests the fix.

Why is hiring L3? Because it is the last resort and the most expensive step: it
spends money and dispatches a person. WARD only does it after the free fixes
fail, and only within the owner's spending policy.

## Per-device playbook

| Device | Fault | L1 self-fix tried | If L1 succeeds | If L1 fails |
|---|---|---|---|---|
| WiFi router | link down, no DHCP lease | remote reboot, then firmware reflash | back online, no cost, no human | L3: hire a network tech (line or hardware) |
| Thermostat | off-target, boiler not firing | remote relay cycle + reconfigure | holds setpoint | L3: hire HVAC (zone valve) |
| Front-door lock | bolt state unknown | remote re-pair | bolt confirms locked | L3: hire a locksmith (reseat module) |
| Leak sensor | active water ingress | close the smart shutoff valve | rarely works, supply is usually upstream | L3: hire a plumber (physical repair) |

The WiFi fault is the everyday case: a remote reboot fixes it, no human, no
spend. The leak is the hero because water is the fault software almost never
fixes: the burst is usually upstream of any valve the agent controls, so it
escalates to a plumber. A good demo shows both, so the agent reads as
intelligent (tries the free fix first) rather than "always hires a human."

## How a worker is chosen (L3)

1. Filter the ENS-registered workers to those whose records match the needed
   skill and who are staked.
2. Rank the candidates by skill match, proximity (ETA to the home), and on-chain
   reputation (the CAIP-10 pointer in their ENS record resolves to the Arc
   WorkerRegistry).
3. Open + fund an ERC-8183 escrow for the top candidate, within policy, and
   dispatch them.

## Roadmap

Today: one home, instrumented devices, a phone-reachable worker view. Tomorrow:
WARD ships as **hardware sensor devices** you install (leak, climate, lock,
power), running the agent **locally on your network** so the privileged
physical-world access is first-class and private. Same ERC-8183 contracts, same
CRE attestation, same ENS registry. The same protocol then scales to property
managers and DePIN fleets: any operator that needs to hire humans for
physically-verifiable work.
