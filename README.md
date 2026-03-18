LexiNote is a small Next.js monolith for Japanese word lookup plus AI explanation.

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

`OPENAI_API_KEY` is optional. If missing, the app returns a fallback explanation instead of calling the LLM.

Project-level PostgreSQL MCP uses Next's environment loading, so it follows the same `DATABASE_URL` resolution as the app.
It exposes schema resources plus a `query_readonly` tool for debugging local data.

## Scripts

- `npm run dev`
- `npm run lint`
- `npm run build`
- `npm run test`
- `npm run test:e2e`

`npm run test:e2e` requires `E2E_DATABASE_URL` and a local PostgreSQL test database. The Playwright global setup will apply `shared/db/sql/schema.sql` and `shared/db/sql/seed.sql` to that test database before the browser test runs.

## Current Scope

- Word lookup
- AI explanation for Chinese native speakers

Out of scope for now: auth, history, favorites, exercises, review, voice, cloud deployment.

## Structure

- `app/`: UI and API routes
- `features/`: word lookup, dictionary, AI explanation services
- `shared/db/`: centralized SQL and PostgreSQL access
