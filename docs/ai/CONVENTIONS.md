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

- Put orchestration logic in `features/word-lookup/`.
- Keep Japanese-specific logic in `features/japanese-dictionary/` and Japanese prompt files.
- Keep AI generation logic separate from dictionary lookup logic.
- Keep SQL centralized under `shared/db/sql/`.
- Use parameterized SQL only.

## Styling

- Prefer Tailwind utility classes for component styling.
- Keep global CSS in `app/globals.css` limited to reset/theme primitives.

## Naming

- Components: `PascalCase`
- Variables/functions: `camelCase`
- Constants: `UPPER_SNAKE_CASE` when truly constant
- File names for routes/layouts follow Next.js reserved names.

## Imports

- Prefer alias imports with `@/` when paths get long.
- Group imports in this order: external packages, internal modules, relative files.

## Quality Bar

- Run `npm run lint` before commit.
- Run `npm run build` before commit when changing app structure, types, or route handlers.
- Run `npm run test:e2e` when changing core user flows such as lookup, overview, history, collections, or collection auto-filtering.
- Keep commits focused and descriptive.
- Update `docs/ai/*` when architecture or workflow changes.
- Keep `e2e/fixtures.sql` and Playwright expectations aligned with any intentional product-copy or workflow changes.
