# Architecture

## Tech Stack

- Next.js `16` (App Router)
- React `19`
- TypeScript `5`
- node-postgres `pg`
- local PostgreSQL
- Tailwind CSS `4` via PostCSS

## Current Structure

- `app/`: UI entry and route handlers
  - `app/page.tsx`: multi-view client shell for dictionary lookup, overview, local history, and collection management
  - `app/collections/detail/page.tsx`: collection detail page
  - `app/collections/add/page.tsx`: collection add-word page
  - `app/collections/words/detail/page.tsx`: word detail page scoped to a collection
  - `app/api/words/lookup/route.ts`: lookup endpoint returning the lookup payload
  - `app/api/words/route.ts`: overview listing endpoint with search and pagination
  - `app/api/collections/*`: collection CRUD and collection-word APIs
- `features/`: business modules
  - `features/word-lookup/`: orchestration service
  - `features/japanese-dictionary/`: Japanese-specific dictionary lookup
  - `features/ai-lookup/`: AI prompt and entry completion for fallback fields and example sentences
  - `features/collections/`: collection CRUD, collection-word workflows, and auto-filter job processing
- `shared/`: cross-cutting code
  - `shared/db/`: centralized PostgreSQL access and SQL
  - `shared/types/`: request/response DTOs
  - `shared/utils/`: app-level errors
- `types/`: local ambient typings
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`
- E2E coverage: `playwright.config.ts`, `e2e/*`
- AI docs index: root `Memory.md` (with `AGENTS.md` compatibility alias) -> `docs/ai/*`

## Lookup

### What Lives Here

- `app/page.tsx` dictionary view
- `app/api/words/lookup/route.ts`
- `features/word-lookup/`
- `features/japanese-dictionary/`
- `features/ai-lookup/`
- `shared/db/sql/dictionary.sql.ts`

### Runtime Flow

1. `app/page.tsx` renders the dictionary view inside the main multi-view shell.
2. The page submits `POST /api/words/lookup` with a required word and an optional context string.
3. `WordLookupService` coordinates dictionary lookup, local-first selection, AI completion, and persistence rules.
4. `JapaneseDictionaryService` reads persisted entries from PostgreSQL.
5. Persisted dictionary rows are keyed by `word + pronunciation`, so homographs with different readings can coexist.
6. If a local entry already has examples and the provided context is not instructional, lookup may return the local result without calling AI.
7. `AIWordLookupService` generates exactly 3 example sentences for entries that still need examples and completes full entries when the local dictionary misses.
8. Context-aware lookup may produce a contextual entry and an optional reconciled entry, but pronunciations are normalized back toward dictionary-form readings before any persistence decision.
9. Only non-context dictionary-form entries are persisted by default through `persistEntryIfNeeded`.
10. Newly persisted entries can enqueue asynchronous collection auto-filter classification jobs.

### Important Rules

- Treat `word + pronunciation` as the effective storage key.
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
3. Collection detail pages read a collection plus its current words from PostgreSQL.
4. `collection_words` is the many-to-many table between collections and concrete dictionary entries (`word_id`).
5. The same `word_id` can belong to multiple collections, but can appear only once inside any single collection.
6. `collection_words.source` distinguishes `manual` vs `auto` membership.
7. AI auto-filtering is asynchronous: collection saves update status fields, enqueue jobs, and the job runner later performs sync or entry classification.
8. New dictionary entries only enqueue classification when a truly new entry is persisted.

### Important Rules

- Think in terms of concrete dictionary entries (`word_id`), not bare word strings.
- Manual add and AI auto-filter must never create duplicate rows inside one collection.
- Collection auto-filtering is job-driven, not inline request work.
- If you change collection membership semantics, update both docs and E2E fixtures/specs in the same change.

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

Out of scope:

- auth
- multi-user support
- exercises
- review
- favorites
- voice features beyond the browser `speechSynthesis` helper used in the word card UI
- cloud deployment

## Extension Guidance

- Keep the current monolith shape.
- Add new backend logic under `features/` before adding new top-level directories.
- Keep Japanese-specific logic inside `features/japanese-dictionary/` and Japanese prompt files.
- Keep SQL centralized under `shared/db/sql/`.
- Prefer changing service boundaries before changing route structure.
- When changing user-facing flows, also check whether `e2e/*`, `Memory.md`, and `docs/ai/*` need to move in lockstep.
