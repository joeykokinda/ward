# WARD — Submission Checklist

Every box is a hard gate. Work through it during the event, not the final hour.

## 🚨 NON-NEGOTIABLES 🚨

- [ ] **ENS booth, Sunday morning, IN PERSON.** Mandatory for ALL ENS prizes. Missing it forfeits them regardless of code quality.
- [ ] **Commit in intervals all weekend.** Small, frequent commits showing real progression — never one 1000-line dump. Single-massive-commit histories risk DQ. Never backdate; commit dates must be real.
- [ ] **Live demo URL** (Vercel) on the showcase page, verified working from a phone on cell data.
- [ ] **Demo video ≤3 min**, recorded Saturday evening before exhaustion, explorer proof of settle on screen, honest about attestation latency.

## Chainlink CRE

- [ ] Workflow meaningfully used (it settles the escrow), integrates chain + external API.
- [ ] Successful CLI simulation captured (qualifying bar) — and take their offer to deploy it live during the event.
- [ ] Chainlink-usage paragraph in the project description.

## Arc

- [ ] USDC conditional escrow on Arc testnet, end-to-end automatic release demonstrated.
- [ ] Working frontend AND backend (functional MVP requirement).
- [ ] **Architecture diagram** (explicit requirement).
- [ ] Video + documentation of Circle tools usage.
- [ ] **State explicitly which Arc bounty** (default: Best Smart Contracts with Advanced Stablecoin Logic — the bounty whose text contains our escrow example; confirm at booth). GitHub repo link.

## ENS

- [ ] Agent primary name + worker subnames live; ENSIP-26 text records resolving; ENSIP-25 verification; agent discovery via ENS resolution.
- [ ] Zero hardcoded values (they check). ENS-specific code documented (pool requirement).
- [ ] Video AND live demo link on showcase; open-source repo.
- [ ] Sunday morning booth presentation (see non-negotiables).

## Submission text

- [ ] First two sentences name the tech: "Escrowed USDC on Arc is released by a Chainlink CRE workflow that attests device telemetry. ENS is the identity and discovery layer for the agent and its worker registry."
- [ ] One-liner: "Proof-of-Physical-Work: escrow released by machine-attested telemetry, not human approval. Machines hire humans; sensors settle the bill."
- [ ] Architecture diagram image attached.
- [ ] Rehearsed answers baked into the description: "done 20x" (prior marketplaces settled on human approval), oracle problem (attested telemetry; instrumented-assets-only is the point), why-LLM (diagnosis + dispatch only; spending contract-capped + owner threshold).

## Judging table

- [ ] Pre-staged: settled historical jobs visible + one L1 self-fix in the log.
- [ ] Trigger live failure at pitch START so settlement lands during Q&A.
- [ ] QR code printed for worker view. Backup video on phone.
- [ ] 15 min before slot: Railway up, Vercel up, wallets funded, sim healthy, reset done.
- [ ] Booth-specific pitches per PITCHES.md.
