# Runbook

## Local Development

1. Install dependencies:
   `npm install`
2. Create local env:
   `cp .env.example .env.local`
3. Create the local PostgreSQL database:
   `createdb lexinote`
   `createdb lexinote_e2e`
4. Seed the minimal dictionary data:
   `psql postgresql://postgres:postgres@localhost:5432/lexinote -f shared/db/sql/seed.sql`
5. Start dev server:
   `npm run dev`
6. Open:
   `http://localhost:3000`

## Required Environment

- `DATABASE_URL` is required for the lookup flow.
- `E2E_DATABASE_URL` is required for `npm run test:e2e` and should point to a local test database such as `lexinote_e2e`.
- `OPENAI_API_KEY` is optional. If missing, local dictionary lookups still return core fields but AI-generated example sentences stay empty, and unknown words return fallback word fields.
- `OPENAI_MODEL` defaults to `gpt-5.4`.

## Database Notes

- `japanese_dictionary_entries` uses the composite key `word + pronunciation`.
- `japanese_dictionary_entries.examples` stores persisted example sentences as JSONB.
- The app can backfill this column from AI responses during normal lookup traffic.
- When a lookup includes `context`, the app first computes a context-shaped result; if it clearly diverges from the generic result, the app asks AI to reconcile both and persists the merged default entry.
- Re-running `shared/db/sql/seed.sql` keeps existing persisted examples because the seed only upserts the core dictionary fields.

## Quality Checks

- Lint:
  `npm run lint`
- Unit and route tests:
  `npm run test`
- E2E test:
  `npm run test:e2e`
- Production build:
  `npm run build`
- Start production server:
  `npm run start`

## Common Issues

### Port 3000 In Use

- Run with another port:
  `npm run dev -- -p 3001`

### Dependency Drift

- Remove `node_modules` and reinstall:
  `rm -rf node_modules && npm ci`
- Only update `package-lock.json` when intentionally upgrading dependencies.

### Build Fails After Config Change

- Clear build cache:
  `rm -rf .next && npm run build`

### Service Temporarily Unavailable In UI

- Check that `DATABASE_URL` is set in `.env.local`.
- Check that the local database exists and `shared/db/sql/seed.sql` has been applied.
- If `OPENAI_API_KEY` is missing, dictionary hits still work but example sentences stay empty, and unknown words fall back to placeholder fields.

### E2E Test Fails Before Browser Starts

- Check that `E2E_DATABASE_URL` is set before running `npm run test:e2e`.
- Check that the test database name ends with `_e2e` or `_test`.
- Check that local PostgreSQL is running and reachable from that connection string.
- `e2e/global-setup.mjs` will apply `schema.sql` and `seed.sql` to the test database before the test starts.

## MCP Setup

1. Keep `.mcp.json` at repo root with:
   - `next-devtools-mcp`
   - `@playwright/mcp`
   - the project `postgres` launcher at `scripts/run-postgres-mcp.mjs`
2. In Codex/agent session, initialize docs index once:
   `init`
3. Before querying docs, read the index resource once to get exact doc paths:
   `nextjs-docs://llms-index`
4. Query Next docs with an exact path from the index:
   `nextjs_docs(path: "/docs/...")`
5. Use Playwright MCP for browser-based page verification and UI-flow checks.
6. Use PostgreSQL MCP to inspect local schema and run read-only SQL with the `query_readonly` tool during debugging.
7. PostgreSQL MCP uses Next's `@next/env` load order, matching the app's `DATABASE_URL` resolution.
8. PostgreSQL MCP only allows read-only SQL and wraps every query in a read-only transaction.
9. Use `upgrade_nextjs_16` when migrating from older major versions.

## Agent Notes

- Prefer reading `docs/ai/ARCHITECTURE.md` before making structural changes.
- Treat `shared/db/sql/schema.sql` as the single schema source of truth.
- Keep route handlers thin and push logic into services under `features/`.
