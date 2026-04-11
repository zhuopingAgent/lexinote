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
  - `app/page.tsx`: single-page UI for Japanese word lookup and example display
  - `app/api/words/lookup/route.ts`: lookup endpoint returning a single JSON payload
- `features/`: business modules
  - `features/word-lookup/`: orchestration service
  - `features/japanese-dictionary/`: Japanese-specific dictionary lookup
  - `features/ai-lookup/`: AI prompt and entry completion for fallback fields and example sentences
- `shared/`: cross-cutting code
  - `shared/db/`: centralized PostgreSQL access and SQL
  - `shared/types/`: request/response DTOs
  - `shared/utils/`: app-level errors
- `types/`: local ambient typings
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`
- AI docs index: root `Memory.md` (with `AGENTS.md` compatibility alias) -> `docs/ai/*`

## Runtime Flow

1. `npm run dev` starts Next.js dev server.
2. `app/page.tsx` renders the single V0 UI.
3. The page submits `POST /api/words/lookup` with a required word and an optional context string.
4. `WordLookupService` coordinates dictionary lookup and AI entry completion.
5. `JapaneseDictionaryService` reads persisted dictionary entries from PostgreSQL through `shared/db/`.
6. Persisted dictionary rows are keyed by `word + pronunciation`, so entries with the same spelling but different readings can coexist.
7. `AIWordLookupService` generates three example sentences for dictionary hits that still lack examples and completes the full entry when the local dictionary misses.
8. Completed AI results are persisted back into `japanese_dictionary_entries`, including the example list, when the lookup is context-free.
9. If the user provides context, the AI narrows the meaning and examples for that context.
10. When the context-shaped result clearly diverges from the generic result, the app asks AI to reconcile both into a better default entry and persists that merged entry.
11. The API returns one combined JSON response for the UI to render.

## Current Product Scope

- Single-user local V0
- Japanese word lookup
- AI-generated example sentences for each lookup
- AI-assisted fallback when the local dictionary misses

Out of scope:

- auth
- multi-user support
- favorites
- history
- exercises
- review
- voice
- cloud deployment

## Extension Guidance

- Keep the current monolith shape.
- Add new backend logic under `features/` before adding new top-level directories.
- Keep Japanese-specific logic inside `features/japanese-dictionary/` and Japanese prompt files.
- Keep SQL centralized under `shared/db/sql/`.
- Prefer changing service boundaries before changing route structure.
