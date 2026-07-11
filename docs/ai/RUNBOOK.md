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
- Request-time database initialization is disabled by default in production and on Vercel. Apply `schema.sql` and `grammar-content.sql` intentionally before deploying code that depends on them; set `DATABASE_AUTO_INIT=1` only for controlled one-off environments.
- `PG_POOL_MAX` can override the PostgreSQL pool size. It defaults to `1` on Vercel/serverless and `10` elsewhere.
- `PG_CONNECTION_TIMEOUT_MS` defaults to `5000`; `PG_IDLE_TIMEOUT_MS` defaults to `10000`.
- `E2E_DATABASE_URL` is required for `npm run test:e2e` and should point to a local test database such as `lexinote_e2e`.
- `E2E_RUN_LIVE_AI=1` opts the Playwright server into using locally configured Gateway credentials for the live AI auto-filter case. The default E2E run clears Gateway credentials and skips that cost-bearing case.
- `AI_GATEWAY_API_KEY` is optional for local development. Vercel deployments can use `VERCEL_OIDC_TOKEN` instead. If neither Gateway credential is available, local dictionary lookups still return core fields but AI-generated example sentences stay empty, and unknown words return fallback word fields.
- Common Japanese inflections and adjective forms can still resolve locally without AI Gateway credentials when the conservative local base-form fallback hits an existing persisted entry.
- Grammar practice generation and sentence feedback also work without AI Gateway credentials by using deterministic local fallback output.
- `AI_GATEWAY_BASE_URL` defaults to `https://ai-gateway.vercel.sh/v1`.
- Canonical AI Gateway model roles live in `shared/ai/gateway.ts`: `cheap` is `openai/gpt-5-nano`, `defaultTeacher` is `openai/gpt-4.1-mini`, `premiumTeacher` is `openai/gpt-5-mini`, `longContext` is `alibaba/qwen3.7-plus`, and `speech` is `openai/whisper-1`.
- Current text workflows use `cheap` for normalization and incremental collection classification, `defaultTeacher` for entry/practice generation and collection backfills, and `premiumTeacher` for reconciliation and sentence feedback. `longContext` and `speech` are reserved roles until a large-context or transcription workflow is added.
- For local AI access, either set `AI_GATEWAY_API_KEY` from Vercel AI Gateway API Keys or run `vercel link && vercel env pull` to obtain a project-scoped `VERCEL_OIDC_TOKEN`. Local OIDC tokens are short-lived, so pull again if they expire.
- `APP_BASIC_AUTH_PASSWORD` enables Basic Auth for all app routes and APIs. Vercel Production and Preview deployments should set it while local development can leave it empty. `APP_BASIC_AUTH_USERNAME` defaults to `lexinote`.
- `APP_TWO_FACTOR_TOTP_SECRET` enables the TOTP second factor after Basic Auth. `APP_TWO_FACTOR_COOKIE_SECRET` signs the HttpOnly 2FA session cookie, and `APP_TWO_FACTOR_SESSION_SECONDS` defaults to `43200`.
- `APP_TWO_FACTOR_SETUP_TOKEN` enables the protected QR setup page at `/auth/two-factor/setup?token=...`. It should be present only during administrator binding/reset and removed from Vercel after the authenticator app is enrolled.
- `APP_TWO_FACTOR_ISSUER` and `APP_TWO_FACTOR_ACCOUNT_NAME` customize the label shown inside authenticator apps.
- `AUTO_FILTER_MAX_SYNC_CANDIDATES` defaults to `240` and caps a single collection AI re-sync before any LLM calls are made.

## Vercel Deployment

- GitHub `main` is connected as the production branch, so pushing or merging to `main` triggers a production deployment.
- Production and Preview must use separate Neon resources. Production uses `lexinote-postgres`; Preview uses `lexinote-postgres-preview`.
- Production and Preview must use separate AI Gateway API keys. Production should use a `$10` monthly budget; Preview should use a `$1` monthly budget.
- Vercel SSO deployment protection is enabled for production deployment URLs and previews, and Git fork protection is enabled. Because the production alias can remain publicly reachable on the current plan, the app also uses Basic Auth when `APP_BASIC_AUTH_PASSWORD` is set.
- Production and Preview should set `APP_TWO_FACTOR_TOTP_SECRET` and `APP_TWO_FACTOR_COOKIE_SECRET` after the administrator has saved the authenticator secret. Temporarily set `APP_TWO_FACTOR_SETUP_TOKEN` only while binding through the QR setup page.
- After changing any Vercel environment variable that is read at runtime, trigger a new deployment so the serverless functions receive the updated value.

## Two-Factor Reset

- Generate a new administrator TOTP secret:
  `npm run auth:reset-2fa`
- Generate and write the new values into local `.env.local`:
  `npm run auth:reset-2fa -- --write-local`
- The command prints an `otpauth://` URI and a `setupPath` for adding the account to an authenticator app. Treat the terminal output as sensitive.
- For Vercel, remove the old `APP_TWO_FACTOR_TOTP_SECRET`, `APP_TWO_FACTOR_COOKIE_SECRET`, and `APP_TWO_FACTOR_SETUP_TOKEN`, add the new values to the target environment, and redeploy.
- Open `/auth/two-factor/setup?token=...` after redeploy, scan the QR code, enter one TOTP code, then remove `APP_TWO_FACTOR_SETUP_TOKEN` and redeploy again.
- Rotating `APP_TWO_FACTOR_TOTP_SECRET` invalidates existing 2FA sessions because the session cookie is bound to the current TOTP secret fingerprint. Rotating `APP_TWO_FACTOR_COOKIE_SECRET` also invalidates all existing 2FA sessions.

## Production Database Changes

- Treat `shared/db/sql/schema.sql` as the schema source of truth until a migration tool is introduced.
- Apply schema changes intentionally before deploying code that depends on them:
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f shared/db/sql/schema.sql`
- Apply expanded grammar content after the schema:
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f shared/db/sql/grammar-content.sql`
- Apply seed data when needed:
  `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f shared/db/sql/seed.sql`
- Do not run schema or seed SQL against Production from a generic `.env.local` shell without first confirming the target host. Use the Vercel-pulled environment file or print only the database host/name before running SQL.

## Database Notes

- `japanese_dictionary_entries` uses the composite key `word + pronunciation`.
- `japanese_dictionary_entries.examples` stores persisted example sentences as JSONB.
- The app can backfill this column from AI responses during normal lookup traffic.
- Reusable vocabulary entry reads/writes now enter through `VocabularyCoreService`, which currently delegates to the Japanese dictionary backend without changing schema or persistence behavior.
- `collections` and `collection_words` model a many-to-many relation between collections and concrete dictionary entries (`word_id`).
- The same `word_id` can appear only once inside a given collection, no matter whether it is added manually or by AI auto-filtering.
- `collection_words.source` distinguishes `manual` vs `auto` membership.
- `auto_filter_jobs` stores asynchronous collection auto-filter work; lookup requests enqueue jobs instead of doing all classification inline.
- `auto_filter_jobs` uses bounded retries plus a stale-running lease. API entry points start a lightweight in-process poller so pending or crashed jobs can resume after the app receives traffic.
- When a stale `collection_sync` job exhausts retries, the recovery SQL also marks the owning collection as `failed` if that job still matches the current auto-filter rule version.
- Editing auto-filter criteria affects future incremental classification, but rescanning existing words now requires an explicit collection-level AI resync.
- If a collection AI re-sync fails with a candidate-count message, either narrow the local dataset/rule first or intentionally raise `AUTO_FILTER_MAX_SYNC_CANDIDATES`.
- When a lookup includes `context`, the app may still build a context-shaped result, but local persisted entries are preferred when they already have examples and the context is not instructional.
- Lookup responses include result metadata for resolution type, contextual status, persistence status, selected pronunciation, and example readiness; the dictionary UI uses this for status tags.
- Re-running `shared/db/sql/seed.sql` keeps existing persisted examples because the seed only upserts the core dictionary fields.
- Overview and collection add-word screens use guarded pagination requests; stale cursors should be cleared whenever a search reset starts.
- Grammar learning tables, 7 knowledge dimensions, 46 knowledge taxonomy nodes, 153 core learning units, 9 core comparison sets, 10 stable error types, 5 learning stages, and 11 migrated legacy compatibility records are created by `shared/db/sql/schema.sql`.
- `shared/db/sql/grammar-content.sql` expands the curriculum to 339 active learning units, 27 structured comparison sets, and 19 non-empty learning modules. `shared/db/sql/seed.sql` applies both SQL files for local setup.
- Grammar seed migrations are key-based and repeatable. E2E global setup applies both grammar SQL files twice and verifies stable record counts, three examples for every expanded unit, active-unit content completeness, comparison member integrity, legacy feedback migration, module and curriculum coverage, prerequisite acyclicity/order, polysemous senses, and taxonomy integrity before loading fixtures.
- Grammar APIs default to the local single-user id `00000000-0000-0000-0000-000000000001` when no user id is provided.
- Grammar sentence feedback writes `user_sentences`, `ai_feedback`, `review_records`, and `learning_history`; review records should update when feedback contains mistakes.
- Adaptive grammar practice stores sessions, exercises, attempts, normalized attempt issues, mastery evidence, and per-skill learner state. The old generate/submit endpoints remain compatibility APIs, while `/api/practice/sessions` is the primary product flow.
- Active practice responses hide expected features, reference answers, complete hint ladders, and grammar examples before submission. Translation prompts are rejected if they contain a candidate Japanese answer or do not provide a complete quoted Chinese sentence. Fallback translation tasks use concrete Chinese cues with semantically matching references instead of joining abstract goal/detail labels. A failed text attempt returns direct, specific correction feedback, while the predefined reference-answer set remains hidden until a correct attempt or explicit reveal.

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
- If AI Gateway credentials are missing, dictionary hits still work but example sentences stay empty, and unknown words fall back to placeholder fields.
- If AI Gateway credentials are missing, grammar practice and feedback should still return usable fallback content. The acceptance fallback for `〜てもらえますか` + hospital + polite should flag `先生、もう一度説明してもらえる？` as too casual and suggest `すみません、もう一度説明していただけますか。`.

### E2E Test Fails Before Browser Starts

- Check that `E2E_DATABASE_URL` is set before running `npm run test:e2e`.
- Check that the test database name ends with `_e2e` or `_test`.
- Check that local PostgreSQL is running and reachable from that connection string.
- Run `npx playwright install chromium` once if the Playwright browser binaries are missing.
- `e2e/global-setup.mjs` applies `schema.sql` and `grammar-content.sql`, validates the grammar domain, truncates the E2E fixture tables, and then loads `e2e/fixtures.sql` before the test starts.
- `npm run test:e2e` starts a production-style server on `127.0.0.1:3100` via `npm run build && npm run start`, so it should not share a running `next dev` process or assume port `3000`.
- The Playwright server clears app-level Basic Auth and 2FA secrets so local deployment-protection settings do not block product-flow tests.

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
- Treat `shared/db/sql/schema.sql` as the schema source of truth and `shared/db/sql/grammar-content.sql` as the expanded grammar curriculum source of truth.
- Keep route handlers thin and push logic into services under `features/`.
- Keep grammar-learning logic in `features/grammar-learning/`, with prompts under `features/grammar-learning/prompts/`.
- For future study features, use `features/vocabulary-core/` for shared word-entry access instead of reaching directly into lookup orchestration.
- If you change collection flows, overview behavior, or lookup persistence side effects, update both `docs/ai/*` and `e2e/*` in the same change.
