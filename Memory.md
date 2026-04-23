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
- The main UI is no longer a pure single lookup page. `app/page.tsx` is now a multi-view shell for dictionary lookup, overview, history, and collections.
- Persisted dictionary entries use `word + pronunciation` as the storage key so homographs with different readings do not overwrite each other.
- Local dictionary hits read from PostgreSQL and prefer reusing persisted examples when available; otherwise they may pass through AI for example generation.
- Dictionary misses fall back to a fully AI-completed entry and persist that result into PostgreSQL.
- Optional lookup context can be supplied to disambiguate meaning and regenerate context-aware examples, but the lookup flow is now more local-first: if a persisted entry already has examples and the context is not instructional, the app may return the local result without calling AI.
- Context-aware results are not persisted as standalone contextual rows by default. The service normalizes context-shaped readings back to dictionary-form pronunciations before deciding whether anything should be saved.
- Collections are now a first-class product surface. `collections` and `collection_words` model a many-to-many relation between concrete dictionary entries (`word_id`) and collections.
- A single dictionary entry can belong to multiple collections, but the same `word_id` can appear only once inside a given collection, no matter whether it was added manually or by AI auto-filtering.
- Collection auto-filtering runs asynchronously through `auto_filter_jobs`. New dictionary entries only enqueue classification when a truly new entry is persisted.
- If `OPENAI_API_KEY` is missing, dictionary hits still return core fields but examples stay empty, and misses return fallback placeholder fields.

## Conflict Handling

- Execution priority: `Memory.md` > `docs/ai/RUNBOOK.md` > `docs/ai/CONVENTIONS.md` > `docs/ai/ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR or commit message.
