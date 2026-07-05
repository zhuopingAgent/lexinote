# AI Project Memory

This file is the canonical AI-facing project memory for `lexinote`.
Keep repo-specific agent instructions here so they stay consistent across machines.

## Working Preferences

- The user prefers English corrections before I answer.
- When the user's English is not correct, I should first give a short corrected version, then answer simply and clearly.
- For local development and database inspection, prefer CLI tools by default and use MCP only when it is specifically needed.
- When the user asks a question in Chinese, first provide an English version of the question before answering in Chinese.
- When pushing code to `origin`, automatically create a PR and merge it into `main` when repository permissions, branch protection, and checks allow it.

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
- Grammar learning functionality is active again. `app/grammar/page.tsx` is a grammar learning workbench, with detail, practice, favorites, and review pages under `/grammar`, `/practice`, `/favorites`, and `/review`.
- Grammar learning uses `features/grammar-learning/` for service logic, AI/fallback practice generation, AI/fallback sentence feedback, and repository access. Route handlers should stay thin and call `GrammarLearningService`.
- Grammar tables are created from `shared/db/sql/schema.sql` and seed 9 major grammar category groups, 56 MVP grammar subcategories, category example expressions, scene/register tags, 155 grammar points, examples, common mistakes, and similar grammar relations. Do not reintroduce the old `DROP TABLE IF EXISTS grammar_points` cleanup.
- The grammar MVP is single-user local-first. APIs default to user id `00000000-0000-0000-0000-000000000001` when no user id is supplied.
- If `OPENAI_API_KEY` is missing, grammar practice generation and sentence feedback fall back to deterministic local feedback, including the hospital + polite `〜てもらえますか` acceptance flow.
- `features/vocabulary-core/` is the shared service boundary for reusable word-entry operations. New learning features should depend on it for entry reads, detail lookup, pagination, and persistence instead of coupling to lookup orchestration.
- Persisted dictionary entries use `word + pronunciation` as the storage key so homographs with different readings do not overwrite each other.
- Local dictionary hits read from PostgreSQL and prefer reusing persisted examples when available; otherwise they may pass through AI for example generation.
- Dictionary misses fall back to a fully AI-completed entry and persist that result into PostgreSQL.
- Optional lookup context can be supplied to disambiguate meaning and regenerate context-aware examples, but the lookup flow is now more local-first: if a persisted entry already has examples and the context is not instructional, the app may return the local result without calling AI.
- Before AI base-form resolution, lookup uses conservative local fallback rules for common Japanese inflections and adjective forms, and only adopts a fallback when it hits a persisted local entry.
- Lookup responses include metadata for resolution type, contextual status, persistence status, selected pronunciation, and example readiness; the dictionary UI surfaces these as result status tags.
- Context-aware results are not persisted as standalone contextual rows by default. The service normalizes context-shaped readings back to dictionary-form pronunciations before deciding whether anything should be saved.
- Collections are now a first-class product surface. `collections` and `collection_words` model a many-to-many relation between concrete dictionary entries (`word_id`) and collections.
- A single dictionary entry can belong to multiple collections, but the same `word_id` can appear only once inside a given collection, no matter whether it was added manually or by AI auto-filtering.
- Overview and collection add-word pagination use abortable, generation-guarded requests. When resetting a search, clear stale cursors so old pages cannot be appended to new query results.
- Collection auto-filtering runs asynchronously through `auto_filter_jobs`. New dictionary entries only enqueue classification when a truly new entry is persisted.
- `auto_filter_jobs` has bounded retries, a stale-running lease, and request-triggered polling so pending or crashed jobs can be recovered without manual database edits. Exhausted stale `collection_sync` jobs must also move the owning collection to `failed` when the job still matches the current rule version.
- Saving or editing an auto-filter rule no longer rescans all existing words by default. Existing words are only re-evaluated when the user explicitly requests an AI re-sync for that collection.
- Collection AI re-sync has a candidate-count guard controlled by `AUTO_FILTER_MAX_SYNC_CANDIDATES` (default `240`) so large dictionaries do not accidentally create unbounded LLM cost.
- If `OPENAI_API_KEY` is missing, dictionary hits still return core fields but examples stay empty, and misses return fallback placeholder fields.

## Conflict Handling

- Execution priority: `Memory.md` > `docs/ai/RUNBOOK.md` > `docs/ai/CONVENTIONS.md` > `docs/ai/ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR or commit message.
