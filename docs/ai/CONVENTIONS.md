# Conventions

## General

- Prefer TypeScript for all new code.
- Keep components small and single-purpose.
- Avoid adding dependencies without clear need.
- Keep the project as a small monolith.

## Next.js App Router

- Use `app/` routing conventions (`page.tsx`, `layout.tsx`).
- Keep global concerns in root `app/layout.tsx`.
- Keep route-specific logic inside the route segment folder.
- Keep route handlers thin; move business logic into `features/`.

## Backend Structure

- Put reusable word-entry reads/writes in `features/vocabulary-core/`.
- Put orchestration logic in `features/word-lookup/`.
- Keep Japanese-specific logic in `features/japanese-dictionary/` and Japanese prompt files.
- Keep grammar-learning logic in `features/grammar-learning/`; keep grammar prompts in `features/grammar-learning/prompts/`.
- Keep conversation orchestration, output validation, persistence, and prompts in `features/conversation/`. Conversation routes must not call AI or mutate learning destinations directly.
- Treat model-produced conversation learning items and memories as suggestions. Re-resolve all dictionary, collection, and grammar targets on the server before promotion.
- Keep AI generation logic separate from dictionary lookup logic.
- Keep SQL centralized under `shared/db/sql/`.
- Use parameterized SQL only.

## Styling

- Prefer Tailwind utility classes for component styling.
- Keep global CSS in `app/globals.css` limited to reset/theme primitives.
- Use `单词本` consistently in the Chinese dictionary UI. Keep `Collection` and
  `collection` for internal code, API, and database naming only.
- Present non-persistable lookup placeholders as incomplete or not found. Do not
  label them as AI-generated content when no complete entry was produced.

## Naming

- Components: `PascalCase`
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` when truly constant
- File names for routes/layouts follow Next.js reserved names.

## Imports

- Prefer alias imports with `@/` when paths get long.
- Group imports in this order: external packages, internal modules, relative files.
- Import DTOs from the owning domain module under `shared/types/`; keep
  `shared/types/api.ts` as a compatibility barrel for mixed or legacy consumers.

## Quality Bar

- Run `npm run lint` before commit.
- Run `npm run build` before commit when changing app structure, types, or route handlers.
- Run `npm run test:e2e` when changing core user flows such as lookup, overview, history, collections, conversation, review inbox, or collection auto-filtering.
- Keep commits focused and descriptive.
- Update `docs/ai/*` when architecture or workflow changes.
- Keep `e2e/fixtures.sql` and Playwright expectations aligned with any intentional product-copy or workflow changes.
