# WARD: Specs & planning artifacts (AI-disclosure index)

This project was built using Claude Code as the primary development environment with spec-driven workflows. The developer made all architectural decisions, integration choices, and verified all functionality before commits. Claude assisted with implementation. This index points to the spec, prompt, and planning artifacts committed to the repo, in keeping with the ETHGlobal AI-tool disclosure requirement.

## Canonical build spec

- **`docs/specs/judge-ready-submission-spec.md`**: the canonical judge-ready build spec for the submission (the prompt/spec that drove the final docs and submission pass). Saved separately as part of this commit.

## Planning artifacts in `docs/`

These are the working specs and decision records that drove the build. They are real planning artifacts, kept as-written rather than cleaned up after the fact.

| File | What it is |
|---|---|
| [../AGENT-PLAYBOOK.md](../AGENT-PLAYBOOK.md) | The agent policy: what it is, the escalation ladder it climbs before spending money, and the per-device steps it tries. |
| [../DEPLOY.md](../DEPLOY.md) | The live deploy runbook (phased L1–L7), turning a filled-in `.env` into a live deployment. |

## Where the build is described

The repo `README.md` and `ARCHITECTURE.md` (mermaid diagram) carry the build narrative, alongside the per-component READMEs (`agent/`, `contracts/`, `cre/`, `db/`, `packages/ens/`, `sim/`, `web/`). The commit history shows the progression: the first commit is a docs scaffold created right after kickoff, followed by frequent incremental commits.
