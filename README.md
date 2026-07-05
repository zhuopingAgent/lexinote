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

`AI_GATEWAY_API_KEY` is optional for local development. In Vercel deployments, the app can use Vercel's project-scoped `VERCEL_OIDC_TOKEN` instead. If neither credential is available, local dictionary hits still work, but AI-generated examples and AI auto-filtering are unavailable or fall back.

AI requests go through Vercel AI Gateway at `AI_GATEWAY_BASE_URL`, which defaults to `https://ai-gateway.vercel.sh/v1`. The canonical model roles are:

- `cheap`: `openai/gpt-5-nano`
- `defaultTeacher`: `openai/gpt-4.1-mini`
- `premiumTeacher`: `openai/gpt-5-mini`
- `longContext`: `alibaba/qwen3.7-plus`
- `speech`: `openai/whisper-1`

Current text workflows use `cheap` for normalization and incremental collection
classification, `defaultTeacher` for entry/practice generation and collection
backfills, and `premiumTeacher` for reconciliation and sentence feedback.
`longContext` and `speech` are reserved roles for future large-context and
transcription workflows.

For local AI access, either create a Vercel AI Gateway API key and set
`AI_GATEWAY_API_KEY`, or link the project with `vercel link` and run
`vercel env pull` to use Vercel's project-scoped `VERCEL_OIDC_TOKEN`.

`APP_BASIC_AUTH_PASSWORD` enables deployment-wide Basic Auth for all app routes and APIs. Leave it empty for local development unless you explicitly want to test production-style access protection. `APP_BASIC_AUTH_USERNAME` defaults to `lexinote`.

`APP_TWO_FACTOR_TOTP_SECRET` enables the second authentication layer. When set,
the app requires a 6-digit TOTP code after Basic Auth and stores successful
verification in a signed HttpOnly cookie. `APP_TWO_FACTOR_COOKIE_SECRET` signs
that cookie, and `APP_TWO_FACTOR_SESSION_SECONDS` defaults to `43200`. To reset
the administrator authenticator secret, run `npm run auth:reset-2fa`; add
`-- --write-local` to update `.env.local`. The reset command also prints a
`setupPath` for `/auth/two-factor/setup`, where the administrator can scan a QR
code with an authenticator app. `APP_TWO_FACTOR_SETUP_TOKEN` protects that setup
page and should be removed from Vercel after binding is complete.

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

Out of scope for now: multi-user account separation, advanced voice, and fully automated database migrations.

## Structure

- `app/`: UI, hooks, API routes, and collection detail pages
- `features/`: word lookup, dictionary, AI explanation, collection, and auto-filter services
- `shared/db/`: centralized SQL and PostgreSQL access
