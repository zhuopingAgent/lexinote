# AI Agent Entry

This repository keeps AI-facing project docs in a fixed structure.

## Start Here

- [Architecture](docs/ai/ARCHITECTURE.md)
- [Runbook](docs/ai/RUNBOOK.md)
- [Conventions](docs/ai/CONVENTIONS.md)

## Scope

- `AGENTS.md` is the stable entry point at repo root.
- Detailed docs live under `docs/ai/`.
- Keep file names fixed so tooling and agents can reliably discover them.

## Conflict Handling

- Execution priority: `RUNBOOK.md` > `CONVENTIONS.md` > `ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR/commit message.
