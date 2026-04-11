# AI Project Memory

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

- `Memory.md` is the single canonical repo-specific AI memory at repo root.
- `AGENTS.md` may exist only as a compatibility alias to `Memory.md`, not as a second source of truth.
- Detailed docs live under `docs/ai/`.
- Keep file names stable so tooling and agents can reliably discover them.

## Repo Notes

- In `lexinote`, word lookup uses AI to complete entries with exactly 3 example sentences.
- Persisted dictionary entries use `word + pronunciation` as the storage key so homographs with different readings do not overwrite each other.
- Local dictionary hits read from PostgreSQL and reuse persisted examples when available; otherwise they pass through AI for example generation and persist the completed entry.
- Dictionary misses fall back to a fully AI-completed entry and persist that result into PostgreSQL.
- Optional lookup context can be supplied to disambiguate meaning and regenerate context-aware examples; when the context-shaped result clearly diverges from the generic result, the app asks AI to reconcile both into a better default entry and persists that merged result.
- If `OPENAI_API_KEY` is missing, dictionary hits still return core fields but examples stay empty, and misses return fallback placeholder fields.

## Conflict Handling

- Execution priority: `Memory.md` > `docs/ai/RUNBOOK.md` > `docs/ai/CONVENTIONS.md` > `docs/ai/ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR or commit message.
