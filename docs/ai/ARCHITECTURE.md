# Architecture

## Tech Stack

- Next.js `16` (App Router)
- React `19`
- TypeScript `7` for CLI type-checking, with TypeScript `6` installed as the tool API compatibility layer
- node-postgres `pg`
- local PostgreSQL
- Tailwind CSS `4` via PostCSS

## Current Structure

- `app/`: UI entry and route handlers
  - `app/page.tsx`: multi-view client shell for dictionary lookup, overview, local history, and collection management
  - `app/grammar/page.tsx`: grammar learning workbench with search, category browsing, and grammar cards
  - `app/grammar/[grammarPointId]/page.tsx`: grammar detail view with examples, usage tags, similar grammar, favorites, and practice entry
  - `app/practice/page.tsx`: grammar scenario practice generation and sentence feedback flow
  - `app/favorites/page.tsx`: saved grammar points
  - `app/review/page.tsx`: mistake-book and review records
  - `app/collections/detail/page.tsx`: collection detail page
  - `app/collections/add/page.tsx`: collection add-word page
  - `app/collections/words/detail/page.tsx`: word detail page scoped to a collection
  - `app/api/grammar/*`: grammar search, detail, and taxonomy endpoints
  - `app/api/practice/*`: grammar practice generation and sentence feedback endpoints
  - `app/api/favorites/route.ts`: grammar favorite list/toggle endpoint
  - `app/api/review/today/route.ts`: grammar review endpoint
  - `app/auth/two-factor/page.tsx`: TOTP challenge page for deployment access protection
  - `app/api/auth/two-factor/verify/route.ts`: TOTP verification endpoint that issues the 2FA session cookie
  - `app/api/words/lookup/route.ts`: lookup endpoint returning the lookup payload
  - `app/api/words/route.ts`: overview listing endpoint with search and pagination
  - `app/api/collections/*`: collection CRUD and collection-word APIs
- `features/`: business modules
  - `features/grammar-learning/`: grammar search/detail, practice generation, sentence feedback, favorites, review, and grammar AI prompts/fallbacks
  - `features/vocabulary-core/`: stable vocabulary-entry boundary shared by lookup, collections, and future study features
  - `features/word-lookup/`: orchestration service
  - `features/japanese-dictionary/`: Japanese-specific dictionary lookup
  - `features/ai-lookup/`: AI prompt and entry completion for fallback fields and example sentences
  - `features/collections/`: collection CRUD, collection-word workflows, and auto-filter job processing
- `shared/`: cross-cutting code
  - `shared/auth/`: Basic Auth-adjacent two-factor helpers, TOTP verification, and signed 2FA session cookies
  - `shared/db/`: centralized PostgreSQL access and SQL
  - `shared/types/`: request/response DTOs
  - `shared/utils/`: app-level errors
- `types/`: local ambient typings
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`
- Root proxy: `proxy.ts` enforces deployment-level Basic Auth and optional TOTP before app routes and APIs run
- E2E coverage: `playwright.config.ts`, `e2e/*`
- AI docs index: root `Memory.md` (with `AGENTS.md` compatibility alias) -> `docs/ai/*`

## Access Protection

### What Lives Here

- `proxy.ts`
- `app/auth/two-factor/page.tsx`
- `app/auth/two-factor/setup/page.tsx`
- `app/api/auth/two-factor/verify/route.ts`
- `shared/auth/two-factor.ts`
- `scripts/reset-two-factor.mjs`

### Runtime Flow

1. `proxy.ts` is the first application-level gate for pages and APIs.
2. When `APP_BASIC_AUTH_PASSWORD` is set, requests must pass Basic Auth before any app route runs.
3. When `APP_TWO_FACTOR_TOTP_SECRET` is set, requests that passed Basic Auth must also present a valid signed `lexinote_2fa` cookie.
4. Page requests without a valid 2FA cookie redirect to `/auth/two-factor`; API requests return `403 TWO_FACTOR_REQUIRED`.
5. `/auth/two-factor/setup?token=...` shows an authenticator QR code only when `APP_TWO_FACTOR_SETUP_TOKEN` matches.
6. `POST /api/auth/two-factor/verify` checks a 6-digit TOTP code and sets an HttpOnly signed 2FA session cookie.
7. The 2FA session cookie is signed with `APP_TWO_FACTOR_COOKIE_SECRET`, expires according to `APP_TWO_FACTOR_SESSION_SECONDS`, and is bound to the current TOTP secret fingerprint so TOTP secret rotation invalidates existing sessions.
8. Administrator reset is intentionally backend-only through `npm run auth:reset-2fa`, which generates a new TOTP secret, cookie secret, setup token, `otpauth://` URI, and QR setup path.

### Important Rules

- Do not add a public reset endpoint for 2FA. Reset should remain an administrator backend operation unless a full user auth system exists.
- Do not leave `APP_TWO_FACTOR_SETUP_TOKEN` configured after QR enrollment is complete.
- Keep local development easy: Basic Auth and 2FA are disabled unless their env vars are set.
- After changing any Vercel auth env var, redeploy so proxy/serverless runtime receives the new value.

## Lookup

### What Lives Here

- `app/page.tsx` dictionary view
- `app/api/words/lookup/route.ts`
- `features/vocabulary-core/`
- `features/word-lookup/`
- `features/japanese-dictionary/`
- `features/ai-lookup/`
- `shared/db/sql/dictionary.sql.ts`

### Runtime Flow

1. `app/page.tsx` renders the dictionary view inside the main multi-view shell.
2. The page submits `POST /api/words/lookup` with a required word and an optional context string.
3. `WordLookupService` coordinates lookup-specific selection, AI completion, context reconciliation, and persistence rules.
4. Reusable vocabulary entry reads/writes go through `VocabularyCoreService`.
5. `VocabularyCoreService` currently delegates to `JapaneseDictionaryService`, which reads persisted entries from PostgreSQL.
6. Persisted dictionary rows are keyed by `word + pronunciation`, so homographs with different readings can coexist.
7. If an exact local miss looks like a common Japanese inflection or adjective form, conservative local base-form fallback rules generate candidates and only adopt one when it hits a persisted local entry.
8. If a local entry already has examples and the provided context is not instructional, lookup may return the local result without calling AI.
9. `AIWordLookupService` generates exactly 3 example sentences for entries that still need examples and completes full entries when the local dictionary misses.
10. Context-aware lookup may produce a contextual entry and an optional reconciled entry, but pronunciations are normalized back toward dictionary-form readings before any persistence decision.
11. Lookup responses include metadata for resolution type, contextual status, persistence status, selected pronunciation, and example readiness so the UI can explain the result state.
12. Only non-context dictionary-form entries are persisted by default through `persistEntryIfNeeded`.
13. Newly persisted entries can enqueue asynchronous collection auto-filter classification jobs.

### Important Rules

- Treat `word + pronunciation` as the effective storage key.
- Use `VocabularyCoreService` for reusable vocabulary entry reads, detail lookup, pagination, and persistence. Keep lookup-only AI/context orchestration in `WordLookupService`.
- Keep local base-form fallback conservative: generated candidates should only be used after a local dictionary hit.
- Do not assume every query with context should call AI; the service is now local-first in many cases.
- Do not assume context-shaped readings should be persisted as standalone entries.
- If you change lookup behavior, also review `Memory.md`, `RUNBOOK.md`, and `e2e/app-regression.spec.ts`.

## Collections

### What Lives Here

- `app/page.tsx` collections view
- `app/collections/detail/page.tsx`
- `app/collections/add/page.tsx`
- `app/collections/words/detail/page.tsx`
- `app/api/collections/*`
- `features/collections/`
- `shared/db/sql/collections.sql.ts`

### Runtime Flow

1. The main shell can switch into the collections view from the sidebar or query param.
2. Collection CRUD goes through `app/api/collections/*` and `CollectionService`.
3. Collection word add/detail and auto-filter classification reuse vocabulary entries through `VocabularyCoreService`.
4. Collection detail pages read a collection plus its current words from PostgreSQL.
5. `collection_words` is the many-to-many table between collections and concrete dictionary entries (`word_id`).
6. The same `word_id` can belong to multiple collections, but can appear only once inside any single collection.
7. `collection_words.source` distinguishes `manual` vs `auto` membership.
8. AI auto-filtering is asynchronous: saving collection rules updates status fields, but existing words are only rescanned when the user explicitly triggers an AI resync for that collection.
9. New dictionary entries only enqueue incremental classification when a truly new entry is persisted.
10. Auto-filter jobs have bounded retries, a stale-running lease, and request-triggered polling from API entry points so crashed jobs can recover. Exhausted stale `collection_sync` jobs also update the collection status to `failed` when the job's rule version still matches the collection.
11. Explicit collection AI re-syncs guard against accidental large LLM scans through `AUTO_FILTER_MAX_SYNC_CANDIDATES` (default `240`).

### Important Rules

- Think in terms of concrete dictionary entries (`word_id`), not bare word strings.
- Reuse `VocabularyCoreService` when collection code needs dictionary candidates or entry details.
- Manual add and AI auto-filter must never create duplicate rows inside one collection.
- Collection auto-filtering is job-driven, not inline request work.
- Auto-filter jobs should remain recoverable: preserve retry, lease, and stale-running semantics when touching `auto_filter_jobs`.
- Do not assume editing an auto-filter rule should rescan the whole dictionary; explicit resync is now a separate user action.
- Do not remove the AI re-sync candidate cap unless a replacement cost-control mechanism exists.
- Paginated client lists must guard reset/load-more requests with aborts or generation tokens, and reset stale cursors when the search query changes.
- If you change collection membership semantics, update both docs and E2E fixtures/specs in the same change.

## Grammar Learning

### What Lives Here

- `app/grammar/page.tsx`
- `app/grammar/[grammarPointId]/page.tsx`
- `app/practice/page.tsx`
- `app/favorites/page.tsx`
- `app/review/page.tsx`
- `app/api/grammar/*`
- `app/api/practice/*`
- `app/api/favorites/route.ts`
- `app/api/review/today/route.ts`
- `features/grammar-learning/`
- `shared/db/sql/grammar.sql.ts`
- grammar tables and seed data in `shared/db/sql/schema.sql`

### Runtime Flow

1. `/grammar` fetches grammar taxonomy and `GET /api/grammar` search results.
2. Grammar detail pages fetch `GET /api/grammar/[grammarPointId]` by UUID or stable `sense_key`, render structured connections, same-form senses, prerequisites, curriculum placement, examples, tags, mistakes, and similar grammar, then log view history against the canonical UUID.
3. `/practice?grammarId=...` fetches grammar detail plus taxonomy, lets the user choose scene, register, and practice level, then calls `POST /api/practice/generate`. Comparison practice uses structured decision rules attached through normalized comparison members.
4. Practice generation uses Vercel AI Gateway when `AI_GATEWAY_API_KEY` or `VERCEL_OIDC_TOKEN` is available and deterministic fallback output otherwise.
5. User sentence submission calls `POST /api/practice/submit`, stores `user_sentences`, stores `ai_feedback`, updates `review_records`, and logs learning history.
6. `/favorites` uses `GET /api/favorites`; detail pages toggle favorites through `POST`/`DELETE /api/favorites`.
7. `/review` uses `GET /api/review/today` to show due mistakes and retry links.

### Important Rules

- Keep route handlers thin and put grammar behavior in `GrammarLearningService`.
- Treat `taxonomy_dimensions` and `taxonomy_nodes` as the knowledge taxonomy. Only the seven active knowledge dimensions belong there; comparison sets and error types are separate domain objects.
- `grammar_points.primary_taxonomy_node_id` is the primary-category source of truth. The legacy category tables and response fields remain only for backward compatibility.
- One active `grammar_points` row is one teachable sense. Polysemous surface forms share `canonical_form` and `form_group_slug` but keep distinct `sense_key`, meaning, connection, usage, and examples.
- `grammar_point_connections` stores generation-ready connection rules; `grammar_point_prerequisites` stores required/recommended dependency edges and rejects cycles; `learning_stages` plus `grammar_point_curriculum` provide database-configured level and recommended order.
- `comparison_set_members` is the canonical relation between a comparison card and grammar senses. `comparison_sets` stores decision rules, connection/register differences, interchangeable boundaries, minimal pairs, and learner mistakes.
- `ai_feedback_issues` normalizes one or more feedback issues against stable `error_types`; legacy feedback columns remain readable. Review aggregation uses the latest feedback per concrete sense and groups it by sense, error type, scenario, and register without traversing taxonomy tags.
- Keep migrated comparison/error grammar-point IDs readable from detail, favorites, practice, and review flows; normal grammar search only lists active learning units.
- The local MVP defaults to user id `00000000-0000-0000-0000-000000000001` when no auth user id exists.
- Keep grammar AI prompts under `features/grammar-learning/prompts/`.
- Grammar practice and feedback must remain usable without AI Gateway credentials; fallback behavior is part of the local development contract.
- Scenario and register tags are first-class data, not free-form display-only labels.
- Sentence feedback should distinguish grammatical correctness, naturalness, register fit, and scene fit.
- Mistakes should update review records so the review page is not disconnected from practice.

## E2E

### What Lives Here

- `playwright.config.ts`
- `e2e/global-setup.mjs`
- `e2e/fixtures.sql`
- `e2e/helpers.ts`
- `e2e/app-regression.spec.ts`
- `e2e/mobile-navigation.spec.ts`

### Runtime Flow

1. `npm run test:e2e` runs Playwright against a production-style local server on `127.0.0.1:3100`.
2. `playwright.config.ts` starts the app with `npm run build && npm run start`.
3. `e2e/global-setup.mjs` validates `E2E_DATABASE_URL`, applies `schema.sql`, truncates core tables, and loads `e2e/fixtures.sql`.
4. The desktop regression suite covers lookup, history, overview, collections, duplicate prevention, and AI auto-filtering.
5. The mobile suite verifies navigation and no horizontal overflow on a narrow viewport.

### Important Rules

- E2E assumes a local PostgreSQL test database ending in `_e2e` or `_test`.
- E2E fixtures are intentionally deterministic; update them if product assumptions change.
- If Playwright browsers are missing, install them once with `npx playwright install chromium`.
- When changing user-visible flows, prefer updating E2E in the same PR so later agents inherit a reliable regression path.

## Current Product Scope

- Single-user local V0
- Japanese word lookup
- Multi-result rendering for homographs with different readings
- AI-generated example sentences for each lookup
- AI-assisted fallback when the local dictionary misses
- Local search history persisted in browser storage
- Overview page for all persisted dictionary entries
- Collection CRUD and collection detail pages
- Adding/removing persisted entries to/from collections
- AI auto-filtering that classifies words into collections asynchronously
- Grammar search, detail pages, practical examples, scenario/register tags, similar grammar comparisons, AI/fallback practice generation, sentence feedback, favorites, and mistake review

Out of scope:

- multi-user support
- self-service user registration/login and role-based access control
- voice features beyond the browser `speechSynthesis` helper used in the word card UI
- fully automated database migrations

## Extension Guidance

- Keep the current monolith shape.
- Add new backend logic under `features/` before adding new top-level directories.
- Use `features/vocabulary-core/` as the shared backend boundary for reusable word-entry operations needed by new learning features.
- Keep Japanese-specific logic inside `features/japanese-dictionary/` and Japanese prompt files.
- Keep SQL centralized under `shared/db/sql/`.
- Prefer changing service boundaries before changing route structure.
- When changing user-facing flows, also check whether `e2e/*`, `Memory.md`, and `docs/ai/*` need to move in lockstep.
