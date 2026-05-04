LexiNote is a small Next.js monolith for Japanese word lookup, local dictionary
storage, collections, and AI-assisted explanations/classification.

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local env file:

```bash
cp .env.example .env.local
```

Create the local PostgreSQL database:

```bash
createdb lexinote
createdb lexinote_e2e
```

Seed the minimal dictionary table:

```bash
psql postgresql://postgres:postgres@localhost:5432/lexinote -f shared/db/sql/seed.sql
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment

`DATABASE_URL` is required.

`E2E_DATABASE_URL` is required for `npm run test:e2e`. It must point to a local test database such as `lexinote_e2e`.

`OPENAI_API_KEY` is optional. If missing, local dictionary hits still work, but AI-generated examples and AI auto-filtering are unavailable or fall back.

`AUTO_FILTER_MAX_SYNC_CANDIDATES` is optional and defaults to `240`. It caps a single collection AI re-sync before any LLM calls are made, preventing accidental large-batch spend.

Project-level PostgreSQL MCP uses Next's environment loading, so it follows the same `DATABASE_URL` resolution as the app.
It exposes schema resources plus a `query_readonly` tool for debugging local data.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

`npm run test:e2e` requires `E2E_DATABASE_URL` and a local PostgreSQL test database. The Playwright global setup applies `shared/db/sql/schema.sql`, truncates the core tables, and loads `e2e/fixtures.sql` before the browser test starts.

## Current Scope

- Word lookup with local-first persistence
- AI explanation for Chinese native speakers
- Overview of persisted dictionary entries
- Search history in browser storage
- Collection CRUD and collection word management
- Async AI auto-filtering with job retries, stale-job recovery, and a per-sync candidate cap

Out of scope for now: auth, multi-user support, favorites, exercises, review, advanced voice, cloud deployment.

## Structure

- `app/`: UI, hooks, API routes, and collection detail pages
- `features/`: word lookup, dictionary, AI explanation, collection, and auto-filter services
- `shared/db/`: centralized SQL and PostgreSQL access
