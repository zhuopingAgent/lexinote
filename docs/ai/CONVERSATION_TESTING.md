# Conversation Testing

## Purpose

The conversation test suite protects two different products that share one page:

- a general text chatbot with explicit Chinese/Japanese quick modes;
- an optional Japanese-learning workflow that analyzes one selected turn and promotes only user-confirmed items.

Tests must keep generation, maintenance, analysis, and promotion independent. A passing translation assertion is not evidence that learning persistence, memory isolation, or concurrency is correct.

## Test Layers

### 1. Domain Contracts

Use fast Vitest tests for deterministic behavior under `features/conversation/domain/` and prompts:

- mode routing and prompt context;
- `/analysis` command parsing and focus normalization;
- message/character limits and context truncation;
- structured output type, length, source-reference, and candidate-count validation;
- grammar canonicalization, reconciliation, exact matching, and candidate deduplication.

Add a regression case for every production output bug that can be reduced to deterministic input/output. Keep table-driven cases when many scenarios exercise the same rule.

### 2. Application Workflows

Test each service through its application ports, not through a concrete repository:

- `ConversationSessionService`: ownership, pagination, preferences, and memory scope;
- `ConversationMessageService`: idempotency conflicts, retry-in-place, context cut-off, SSE order, cancellation, empty/oversized output, and exposed Gateway errors;
- `ConversationMaintenanceService`: catch-up, replay, monotonic progress, and concurrent loser behavior;
- `ConversationAnalysisService`: idempotency, focus filtering, deduplication, lease loss/reclaim, partial failure cleanup, and concrete grammar matching;
- `ConversationLearningService`: local vocabulary hit, AI completion, reading choice, duplicate collection membership, grammar binding, and no fabricated mistake evidence.

Application tests may mock AI and persistence, but must assert both returned DTOs and important port calls.

### 3. PostgreSQL Persistence

Run repository and schema tests against a disposable PostgreSQL database for behavior SQL text inspection cannot prove:

- apply `schema.sql` twice;
- session/user isolation and deletion retention rules;
- message and analysis idempotency constraints;
- lease fencing after stale reclaim;
- concurrent completion of two revisions for one message;
- message-before-analysis lock ordering and deadlock absence;
- atomic `summary_through_at` plus memory suggestion writes;
- context queries ending at the triggering message;
- current-analysis and learning-item deduplication queries.

These tests must use a database ending in `_e2e` or `_test`. Never point destructive setup at Preview or Production.

### 4. Route And Stream Contracts

Route tests own HTTP status mapping, malformed JSON, typed request forwarding, SSE headers, and the event sequence:

1. `assistant_created`
2. zero or more `text_delta`
3. one terminal `completed` or `error`

Do not duplicate prompt or repository assertions in route tests.

### 5. Playwright Workflows

Keep a small set of high-value browser journeys:

- draft-to-first-session navigation and multiple-session switching;
- mobile drawer and no horizontal overflow;
- simulated streaming, stop, failed-response retry, and double-submit protection;
- manual analysis, adjusted reanalysis, and no historical candidate reappearance;
- vocabulary/reading/collection promotion and grammar inbox binding;
- settings, memory confirmation, session rename, and deletion.

Use deterministic API fixtures for interaction behavior. Do not generate hundreds of repetitions of the same mocked journey.

### 6. Real Agent Soak

`npm run test:soak:conversation` is opt-in and cost-bearing. It exercises real Gateway models, stateful sessions, explicit maintenance and analysis calls, a model judge, and database invariants. A soak should vary language, mode, turn history, correction intent, ambiguity, and promotion state; it is not a substitute for deterministic regression tests.

Run a small Preview sample before a large run. Production requires the explicit write guard, a database snapshot, promotions disabled by default, and a cleanup audit.

## Release Gates

Every conversation change requires:

1. `npm run lint`
2. `npm run typecheck`
3. `npm run test`
4. `npm run build`

Changes to routes, client workflows, schema, SQL locking, or promotion behavior also require `npm run test:e2e` with a disposable PostgreSQL database. Real Agent soak is required only for prompt/model-quality releases or when a deterministic regression cannot represent the risk.

## Test Retirement

Delete a test only when its product behavior no longer exists or a narrower replacement proves the same contract. When architecture changes, migrate valid assertions to the owning layer before removing tests tied to the old class or endpoint. Record intentionally retired behavior in the PR description.

Examples of obsolete tests:

- automatic learning analysis after every answer;
- message-level `analysisStatus` or translation-detail DTOs removed from the public contract;
- bulk mocked "soak" loops that only replay one browser fixture.

Examples that remain valid after refactoring:

- Gateway budget/rate errors, cancellation, and retry;
- session ownership and cursor validation;
- summary catch-up and stale-writer rejection;
- analysis idempotency, failure cleanup, deduplication, and promotion safety.
