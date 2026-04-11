# Project Memory

This file is the canonical AI-facing project memory for `lexinote`.
Keep repo-specific agent instructions here so they stay consistent across machines.

## Working Preferences

- The user prefers English corrections before I answer.
- When the user's English is not correct, I should first give a short corrected version, then answer simply and clearly.
- For local development and database inspection, prefer CLI tools by default and use MCP only when it is specifically needed.
- When the user asks a question in Chinese, first provide an English version of the question before answering in Chinese.

## Start Here

- [Architecture](docs/ai/ARCHITECTURE.md)
- [Runbook](docs/ai/RUNBOOK.md)
- [Conventions](docs/ai/CONVENTIONS.md)

## Scope

- `memory.md` is the canonical repo-specific AI memory at repo root.
- `AGENTS.md` is kept as a compatibility shim for tools that auto-discover it.
- Detailed docs live under `docs/ai/`.
- Keep file names stable so tooling and agents can reliably discover them.

## Repo Notes

- In `lexinote`, word lookup uses AI to complete entries with exactly 3 example sentences.
- Local dictionary hits read the core fields from PostgreSQL, then pass through AI for example generation.
- Dictionary misses fall back to a fully AI-completed entry.
- If `OPENAI_API_KEY` is missing, dictionary hits still return core fields but examples stay empty, and misses return fallback placeholder fields.

## Conflict Handling

- Execution priority: `memory.md` > `docs/ai/RUNBOOK.md` > `docs/ai/CONVENTIONS.md` > `docs/ai/ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR or commit message.
