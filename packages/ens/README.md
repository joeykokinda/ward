# `@ward/ens` — WARD ENS Identity Layer

ENS is the discovery + identity layer for the WARD agent economy:

- the agent is **`ward-agent.eth`**, verified per **ENSIP-25**;
- every worker is a subname **`<handle>.ward-agent.eth`** carrying **ENSIP-26**
  agent text records plus WARD's worker attributes;
- the agent **discovers and ranks workers by resolving ENS**, not by reading a
  database.

Everything queries the chain **live** (Sepolia by default) — there are **zero
hardcoded resolution results**. The only constants are network coordinates (RPC
URLs, ENS contract addresses), and every one of those is env-overridable.

```
packages/ens/src/
├── config.ts     env-driven RPC + ENS contract addresses + agent registry
├── resolve.ts    name→addr, addr→primary name, text reads, round-trip proof
├── records.ts    ENSIP-26 schema + WARD worker record schema (read/write)
├── verify.ts     ENSIP-25 verification + ERC-7930 interoperable-address codec
├── subnames.ts   mint <handle>.ward-agent.eth + set records (dry-run / execute)
├── discover.ts   skill/region → ranked workers, via ENS resolution
├── cli.ts        resolve / records / verify / mint-subname / discover
└── index.ts      barrel export for web/lib + agent
```

## Standards implemented (to spec, not guessed)

### ENSIP-25 — AI Agent Registry ENS Name Verification

Spec: <https://docs.ens.domains/ensip/25/>

ENSIP-25 binds an ENS name to an agent identity in an onchain agent registry
through **one parameterized text record**:

```
agent-registration[<registry>][<agentId>]
```

- `<registry>` is an **ERC-7930 interoperable address** (`0x`-hex) encoding the
  registry contract + its chain.
- `<agentId>` is the registry's id string (MUST NOT contain `[` or `]`).
- **Verification rule (4 steps in the spec):** resolve that text record on the
  claimed name; **a non-empty value is the attestation** — the name is verified.
  Implementations SHOULD set the value to `"1"`.

`verify.ts` implements the ERC-7930 binary codec exactly
(<https://eips.ethereum.org/EIPS/eip-7930>):

```
Version(2) ChainType(2) ChainRefLen(1) ChainRef(N) AddrLen(1) Addr(M)
0x0001     0x0000(eip155) 0x01          0x01        0x14       <20 bytes>
```

It reproduces the spec's worked example **byte-for-byte**:
`encodeInteroperableAddress(1, 0x8004…a432)` →
`0x000100000101148004a169fb4a3325136eb29fa0ceb6d2e539a432`, giving the key
`agent-registration[0x0001…a432][167]` — identical to the ENSIP-25 example.

`verifyWardAgent()` runs the live check against the env-configured registry.

### ENSIP-26 — Agent Text Records

Spec: <https://docs.ens.domains/ensip/26/>

ENSIP-26 extends ENSIP-5 with exactly two key shapes, read/written via the
resolver's `text(bytes32 node, string key)`:

- **`agent-context`** — free-form (text/Markdown/YAML/JSON) description of the
  agent; may reference registries/endpoints.
- **`agent-endpoint[<protocol>]`** — a URL for a named protocol; defined
  protocols are `mcp`, `a2a`, `web`. Value must be a valid URL (IPFS allowed).

`records.ts` implements both. WARD writes `agent-context` (+ `agent-endpoint[web]`)
onto every worker subname, so a **generic** agent crawler — not just WARD — can
discover a worker.

### WARD worker schema (ENSIP-5 namespaced text records)

ENSIP-26 deliberately does **not** define skill/region/reputation keys, so WARD
stores those as ordinary ENSIP-5 text records under a project namespace to avoid
colliding with any future standard:

| key | value |
|---|---|
| `eth.ward.role` | `worker` |
| `eth.ward.skills` | comma list, e.g. `router,network,hardware` |
| `eth.ward.region` | e.g. `Greenwich, CT` |
| `eth.ward.reputation` | **pointer** `eip155:<chainId>:<registry>/reputationOf/<addr>` |

The reputation **pointer** lives in ENS; the reputation **number** lives onchain
in `WorkerRegistry`. `discover.ts` reads the pointer from ENS and the score from
the chain, so there is no stale cached value.

## CLI

```bash
cd packages/ens && pnpm install

pnpm resolve vitalik.eth --chain mainnet      # forward + reverse + round-trip
pnpm resolve mike.ward-agent.eth              # (Sepolia default)
pnpm records mike.ward-agent.eth              # ENSIP-26 / WARD records, live
pnpm verify                                   # ENSIP-25 for ward-agent.eth
pnpm discover --skill router --region Greenwich
pnpm mint-subname mike --dry-run --owner 0x… --skills router,network --region "Greenwich, CT"
```

Global flags: `--chain sepolia|mainnet`, `--rpc <url>`.

### Proven live

```
$ pnpm resolve vitalik.eth --chain mainnet
  name        : vitalik.eth
  address     : 0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045
  primaryName : vitalik.eth
  round-trip  : MATCH (name owns its reverse record)
```

Sepolia is also reachable (`nick.eth` resolves on Sepolia). When a Sepolia
public RPC rate-limits, pass `--chain mainnet` or set `SEPOLIA_RPC_URL` to a
dedicated endpoint; the CLI prints which chain/RPC answered.

## Subname issuance — where & how

- **Network:** worker subnames are issued on **L1 Sepolia** (ARCHITECTURE.md:
  "ENS stays on Sepolia regardless").
- **Mechanism:** **ENS NameWrapper** `setSubnodeRecord(parentNode, label, owner,
  resolver, ttl, fuses, expiry)` on the parent node, then **PublicResolver**
  `setText(node, key, value)` per record. `ward-agent.eth` must be a wrapped
  `.eth` name (held by the NameWrapper) — the standard "create subname" path.
- **Contracts (Sepolia, env-overridable):** NameWrapper
  `0x0635513f179D50A207757E05759CbD106d7dFcE8`, PublicResolver
  `0xE99638b40E4Fff0129D56f03b55b6bbC4BBE49b5`, Registry
  `0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e`. Source:
  <https://docs.ens.domains/learn/deployments/>.
- **Why not an L2 subname registrar?** An L2 path (e.g. Durin / Namechain) is a
  valid production gas optimization but adds a CCIP-read resolver-gateway
  dependency not worth the demo risk. Keeping the whole identity graph on one
  Sepolia client means the agent reads workers, its own name, and reverse
  records from a single endpoint. Documented as future work.

### `mint-subname` is dry-run by default

`pnpm mint-subname <handle> --dry-run` (the default) computes and prints **every
exact tx** — target contract, function, decoded args, and ABI-encoded calldata —
**without a private key and without sending anything**. Example: minting one
worker produces **7 txs** (1 `NameWrapper.setSubnodeRecord` + 6
`PublicResolver.setText`). Live execution requires `--execute` **and**
`CONTROLLER_PRIVATE_KEY` (the owner of `ward-agent.eth`); it is never the
default and was never run in this build.

## Environment

| var | default | purpose |
|---|---|---|
| `SEPOLIA_RPC_URL` | `https://ethereum-sepolia-rpc.publicnode.com` | ENS reads/writes |
| `MAINNET_RPC_URL` | `https://ethereum-rpc.publicnode.com` | mainnet fallback for `resolve` |
| `WARD_ENS_ROOT` | `ward-agent.eth` | the agent name |
| `WARD_AGENT_REGISTRY` | `0x0…0` (placeholder) | ENSIP-25 registry address |
| `WARD_AGENT_REGISTRY_CHAIN_ID` | `11155111` | registry chain id |
| `WARD_AGENT_ID` | `1` | agent id in the registry |
| `WARD_WORKER_HANDLES` | `mike,sara,deon,lena,raj` | discovery candidate set |
| `CONTROLLER_PRIVATE_KEY` | — | **live mint only**; owner of `ward-agent.eth` |
| `ENS_*` (registry/resolver/wrapper/…) | canonical Sepolia | override deployments |

## Frontend usage

```ts
import { resolvePrimaryName, readWorkerRecord, verifyWardAgent,
         discoverWorkers } from "@ward/ens";

const record = await readWorkerRecord("mike.ward-agent.eth"); // live ENS read
const ranked = await discoverWorkers({ skill: "router", region: "Greenwich" });
const verified = (await verifyWardAgent()).verified;
```

## Live on Sepolia

`ward-agent.eth` is **registered, wrapped, and resolving live on Sepolia**, with
5 worker subnames carrying ENSIP-26 + WARD records. `src/register.ts`
(`pnpm register`) performs the one-time bootstrap: register the 2LD → wrap via
NameWrapper → set the agent's own records (addr, `agent-context`,
`agent-endpoint[web]`, ENSIP-25 `agent-registration[…] = "1"`) → set the
controller's primary name. Workers are minted with `pnpm mint-subname <handle>
--execute` (subname held by the controller/fleet manager via `--subname-owner`,
addr record → the worker's wallet).

| name | resolves to |
|---|---|
| `ward-agent.eth` | controller `0xDCe5…bAea4` (primary-name round-trips) |
| `mike.ward-agent.eth` | Arc worker `0x6d7B…f033` (router/networking, rep=1) |
| `sara/deon/lena/raj.ward-agent.eth` | synthetic fleet (distinct addrs) |

Reputation is read **live from Arc** (chain 5042002) via the CAIP-10 pointer in
ENS — set `ARC_RPC_URL` (or `REPUTATION_RPC_URL`) so `discover` ranks by the
on-chain score.

### Sepolia deployment-address corrections (current testnet generation)

The ENS docs/wiki table for Sepolia is mid-migration and partly stale. The
addresses this package actually uses (env-overridable in `config.ts`):

- **ETH registrar**: `0xdf60C561Ca35AD3C89D24BbA854654b1c3477078`
  (TestnetV1PremigrationRegistrar — the only authorized controller on the
  BaseRegistrar; free, single-tx `register`, no commit/reveal). The documented
  `0xfb3c…F968` is no longer authorized (its `register` reverts in BaseRegistrar).
- **PublicResolver**: `0x8FADE66B79cC9f707aB26799354482EB93a5B7dD` (the resolver
  live names use; the older `0xE996…49b5` isn't what resolution routes to).
- **UniversalResolver**: `0xBaBC7678D7A63104f1658c11D6AE9A21cdA09725`. We call
  its 2-arg `resolve(bytes,bytes)` directly (`resolve.ts`) because viem's bundled
  UR ABI assumes a newer variant than the one deployed.
- **NameWrapper** `0x0635…dCE8`, **Registry** `0x0000…2e1e`: unchanged.
```
