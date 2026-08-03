# AI Project Memory

These instructions replace any previously provided AGENTS.md instructions for this repo.

This file is the canonical AI-facing project memory for `lexinote`.
Keep repo-specific agent instructions here so they stay consistent across machines.

## Working Preferences

- The user prefers English corrections before I answer.
- When the user's English is not correct, I should first give a short corrected version, then answer simply and clearly.
- For local development and database inspection, prefer CLI tools by default and use MCP only when it is specifically needed.
- When the user asks a question in Chinese, first provide an English version of the question before answering in Chinese.
- Before starting any repository task, fetch `origin/main` and ensure the work branch is rebased onto the latest `origin/main`; create a new work branch from that refreshed base when needed.
- If uncommitted changes or conflicts make rebasing unsafe, preserve the user's work and resolve the situation safely before proceeding. Never discard user changes to complete a rebase.
- When pushing code to `origin`, automatically create a PR and merge it into `main` when repository permissions, branch protection, and checks allow it.
- After completing a requested repo modification, default to committing the finished change, pushing a branch to `origin`, opening a PR to `main`, and merging it once repository permissions, branch protection, and checks allow it, unless the user asks not to commit, push, or merge.
- Preserve unrelated user changes, and do not publish incomplete work or changes with failing required checks.

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
- Conversation learning is available under `/conversation` with ChatGPT-style sessions, Chinese/Japanese translation modes, Japanese polishing/explanation, session summaries, confirmed global/session memories, and user-confirmed learning extraction. Keep its service/repository/prompt logic under `features/conversation/`; route handlers remain thin.
- Conversation generation is a two-stage flow: `defaultTeacher` streams the main answer, then `cheap` returns validated structured details, up to five learning candidates, memory suggestions, the first automatic title, and an updated session summary. A successful answer remains usable when analysis fails.
- Conversation structured analysis receives only the current assistant answer and its parent user message; older context is represented by the previous session summary and must not be re-extracted as learning candidates. Persisted candidates are deduplicated within a session by kind, normalized surface form, and meaning so polysemous senses remain distinct.
- Conversation model context includes structured preferences, active global memories, active memories for the current session, the current session summary, and at most 16 recent messages/16,000 characters. Suggested or dismissed memories must never enter prompts, and automatic summaries never cross sessions.
- Conversation learning candidates and memory suggestions never write directly into dictionary, collections, review records, or active memory. Vocabulary/expression promotion re-resolves the server-side dictionary entry and reading through `VocabularyCoreService`/`WordLookupService`; grammar promotion binds an existing concrete sense and adds a due `learning` review record without creating mistake evidence.
- Unmatched or ambiguous conversation grammar candidates appear in `/review` under the conversation inbox. Deleting a conversation removes messages, session memories, and unconfirmed candidates, while promoted dictionary/collection/grammar records and confirmed global memories remain.
- Conversation sending requires AI Gateway credentials. Without credentials, history, preferences, and memories remain available, but sending is disabled; do not add a fabricated local translation fallback.
- Grammar learning uses `features/grammar-learning/` for service logic, AI/fallback practice generation, AI/fallback sentence feedback, and repository access. Route handlers should stay thin and call `GrammarLearningService` for legacy/search flows or `PracticeSessionService` for adaptive practice sessions.
- Grammar browsing is organized by knowledge dimension and taxonomy node. Search uses offset pagination, and the client must abort or generation-guard stale initial and load-more requests when the query, dimension, or category changes.
- Grammar summary responses include the current user's `learningStatus`, using the same `review_records.status` source as progress totals. Grammar cards show an `已掌握` badge only when that status is `mastered`.
- Grammar tables and core compatibility data are created from `shared/db/sql/schema.sql`; expanded learning content is seeded by `shared/db/sql/grammar-content.sql`. Together they provide 7 knowledge dimensions, 46 taxonomy nodes, 339 active learning units, 27 structured comparison sets, 10 stable error types, 5 configurable learning stages, and 19 learning modules. Eleven legacy comparison/error `grammar_points` remain as migrated compatibility records, preserving their IDs and user references. Do not reintroduce destructive grammar-point cleanup.
- A `grammar_points` row represents one teachable sense. Use `canonical_form`, `sense_key`, and `form_group_slug` for polysemous forms; detail lookup accepts either UUID or stable `sense_key`. Structured connections live in `grammar_point_connections`, prerequisites in `grammar_point_prerequisites`, and curriculum stage/module order in `grammar_point_curriculum`. Preserve legacy `structure` for display/API compatibility, but practice generation should prefer structured connections.
- Comparison members must remain normalized through `comparison_set_members`; structured rules and minimal pairs live on `comparison_sets`. Structured feedback is persisted both in backward-compatible `ai_feedback` fields and normalized `ai_feedback_issues` rows that reference `error_types`. Review responses aggregate due items by concrete grammar sense, error type, scenario, and register without joining taxonomy tags.
- Grammar practice is session-based: `practice_sessions` own ordered `exercise_instances`. Legacy attempts still update the six compatibility dimensions in `learner_skill_states`; V2 attempts also update `learner_objective_states` by `grammar_point_id + sense_key + learning_objective`, while assisted work, recognition, independent production, and answer exposure remain distinct evidence kinds.
- V2 session planning prioritizes objective-level mastery, recent structured errors, hint dependence, answer exposure, elapsed time, and prerequisite evidence. Versioned high-frequency specialization profiles constrain supported objectives, exercise types, misconceptions, and hint emphasis; the current practice content version is persisted with sessions and generated items.
- New practice generation is limited to two learner-facing forms: choice (`meaning_choice` or `contrast_choice`) and Chinese-to-Japanese translation (`guided_translation`). Legacy repair, register-rewrite, and contextual-response records remain readable, but unfinished historical intents must be normalized before any new AI or fallback generation. The compatibility `POST /api/practice/generate` path produces translation tasks only.
- Generated reference answers become the item-specific allowed variants in `AnswerContract`. Evaluation conservatively accepts punctuation, softener, and other validated natural equivalents while still requiring target form, meaning anchors, and the permitted register; the same reconciliation runs after fallback or AI feedback.
- Structured issues distinguish one primary/root issue from secondary effects and may persist confidence, a quoted evidence span, and affected scoring dimensions in both normalized issue tables and compatibility JSON. Review progress has one user-facing record per `user_id + grammar_point_id`: objective-level states remain internal adaptive-learning evidence and are returned as a consolidated breakdown, while an existing `review_records` row absorbs the recommendation instead of creating a second visible item. Started grammar not marked `mastered` belongs to `pendingCompletionCount`. A mastered item contributes to `dueReviewCount` only when `next_review_at <= NOW()`; mastered items scheduled later remain visible under future review without inflating today's count. Legacy `reviewCount` remains the compatibility total. `/grammar/quality` reads server-side generation metrics without exposing answers or user text.
- Active exercise APIs must not expose `expected_features`, reference answers, the full hint ladder, or grammar examples before submission. Generated translation and contextual prompts may contain the target grammar label but never a candidate Japanese answer. Translation tasks must provide one complete, directly translatable Chinese sentence; never concatenate an abstract communication goal with a required-detail label, and keep fallback references semantically aligned with the Chinese task. After a text attempt, return direct conversational feedback and a specific correction while keeping the predefined reference-answer set hidden until a correct attempt or explicit reveal; persist the same structured issues and correction for review.
- Pedagogical planning is deterministic and lives under `features/grammar-learning/domain/`; with `PRACTICE_GENERATION_V2=1`, a versioned five-item `PracticeIntent` plan and each `AnswerContract` are persisted before evaluation. AI only realizes one planned item through type-specific prompts; strict schema/static/contract validators, bounded targeted repair, semantic review, and the fallback support matrix prevent unvalidated output from reaching the client. Legacy `POST /api/practice/generate` and `/submit` remain available for compatibility.
- Grammar browsing provides both knowledge-dimension filtering and persisted curriculum order. Course cards use stage-wide `recommended_order` until a module is selected, then use `module_order`. All cards expose one consolidated learning status, and practical-level/status filters are server-side AND filters. Structured comparison sets are browsable at `/grammar/comparisons` without exposing internal slugs.
- Fallback answer reconciliation must enforce item-specific target forms and required grammar features even when a sentence resembles a known variant. In existence sentences, reject action-location `で` where existence-location `に` is required. In target practice for `〜てもらえますか`, keep the main correction in the target form and present `〜ていただけますか` only as a more formal alternative.
- The grammar MVP is single-user local-first. APIs default to user id `00000000-0000-0000-0000-000000000001` when no user id is supplied.
- If Vercel AI Gateway credentials are missing, grammar practice generation and sentence feedback fall back to deterministic local behavior, including the hospital + polite `〜てもらえますか` acceptance flow.
- Request-time database initialization is disabled by default in production/Vercel; apply `shared/db/sql/schema.sql` and `shared/db/sql/grammar-content.sql` intentionally before deploying code that depends on them. Serverless PostgreSQL pools default to `PG_POOL_MAX=1` unless overridden.
- Deployment access protection is app-level in `proxy.ts`: Basic Auth is enabled by `APP_BASIC_AUTH_PASSWORD`, and optional TOTP 2FA is enabled by `APP_TWO_FACTOR_TOTP_SECRET`.
- TOTP 2FA uses `/auth/two-factor`, `/auth/two-factor/setup?token=...`, `POST /api/auth/two-factor/verify`, and signed HttpOnly `lexinote_2fa` cookies. Administrator reset is backend-only through `npm run auth:reset-2fa`; do not add a public reset endpoint without a full user auth system, and do not leave `APP_TWO_FACTOR_SETUP_TOKEN` configured after QR enrollment is complete.
- `features/vocabulary-core/` is the shared service boundary for reusable word-entry operations. New learning features should depend on it for entry reads, detail lookup, pagination, and persistence instead of coupling to lookup orchestration.
- Persisted dictionary entries use `word + pronunciation` as the storage key so homographs with different readings do not overwrite each other.
- Local dictionary hits read from PostgreSQL and prefer reusing persisted examples when available; otherwise they may pass through AI for example generation.
- Dictionary misses fall back to a fully AI-completed entry and persist that result into PostgreSQL.
- Optional lookup context can be supplied to disambiguate meaning and regenerate context-aware examples, but the lookup flow is now more local-first: if a persisted entry already has examples and the context is not instructional, the app may return the local result without calling AI.
- Before AI base-form resolution, lookup uses conservative local fallback rules for common Japanese inflections and adjective forms, and only adopts a fallback when it hits a persisted local entry.
- Lookup responses include metadata for resolution type, contextual status, persistence status, selected pronunciation, and example readiness; the dictionary UI surfaces these as result status tags.
- Client dictionary lookups are abortable and generation-guarded. Starting another lookup or restoring history invalidates the previous request so stale responses cannot replace the current result or append history.
- Browser search-history persistence is best-effort. Storage access failures must fall back to in-memory history without breaking lookup or clear actions.
- Context-aware results are not persisted as standalone contextual rows by default. The service normalizes context-shaped readings back to dictionary-form pronunciations before deciding whether anything should be saved.
- Collections are now a first-class product surface. `collections` and `collection_words` model a many-to-many relation between concrete dictionary entries (`word_id`) and collections.
- A single dictionary entry can belong to multiple collections, but the same `word_id` can appear only once inside a given collection, no matter whether it was added manually or by AI auto-filtering.
- Collection cards keep their navigation link separate from edit, delete, resync, and remove buttons. Do not use a `role="link"` card that contains nested interactive controls.
- Overview and collection add-word pagination use abortable, generation-guarded requests. When resetting a search, clear stale cursors so old pages cannot be appended to new query results.
- Collection summary loads and auto-filter polling are abortable and generation-guarded. Successful collection mutations invalidate overlapping list responses before updating local state.
- Collection auto-filtering runs asynchronously through `auto_filter_jobs`. New dictionary entries only enqueue classification when a truly new entry is persisted.
- `auto_filter_jobs` has bounded retries, a stale-running lease, and request-triggered polling so pending or crashed jobs can be recovered without manual database edits. Exhausted stale `collection_sync` jobs must also move the owning collection to `failed` when the job still matches the current rule version.
- Saving or editing an auto-filter rule no longer rescans all existing words by default. Existing words are only re-evaluated when the user explicitly requests an AI re-sync for that collection.
- Collection AI re-sync has a candidate-count guard controlled by `AUTO_FILTER_MAX_SYNC_CANDIDATES` (default `240`) so large dictionaries do not accidentally create unbounded LLM cost.
- If Vercel AI Gateway credentials are missing, dictionary hits still return core fields but examples stay empty, and misses return fallback placeholder fields.

## Conflict Handling

- Execution priority: `Memory.md` > `docs/ai/RUNBOOK.md` > `docs/ai/CONVENTIONS.md` > `docs/ai/ARCHITECTURE.md`.
- If instructions conflict, follow the higher-priority file and leave a note in the PR or commit message.
