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
  - `app/page.tsx`: single-page UI for Japanese word lookup
  - `app/api/words/explain/route.ts`: full lookup flow endpoint
- `features/`: business modules
  - `features/word-lookup/`: orchestration service
  - `features/japanese-dictionary/`: Japanese-specific dictionary lookup
  - `features/ai-explanation/`: AI prompt and explanation generation
- `shared/`: cross-cutting code
  - `shared/db/`: centralized PostgreSQL access and SQL
  - `shared/types/`: request/response DTOs
  - `shared/utils/`: app-level errors
- `types/`: local ambient typings
- Root configs: `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`
- AI docs index: root `AGENTS.md` -> `docs/ai/*`

## Runtime Flow

1. `npm run dev` starts Next.js dev server.
2. `app/page.tsx` renders the single V0 UI.
3. The page submits `POST /api/words/explain`.
4. `WordLookupService` coordinates dictionary lookup and AI explanation.
5. `JapaneseDictionaryService` reads from PostgreSQL through `shared/db/`.
6. `AIExplanationService` generates a Chinese learning-oriented explanation.
7. The API returns a combined response for the UI to render.

## Current Product Scope

- Single-user local V0
- Japanese word lookup
- AI explanation for Chinese native speakers

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
