import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import nextEnv from "@next/env";
import pg from "pg";
import { CONVERSATION_SOAK_CASES } from "./conversation-soak-cases.mjs";
import { evaluateConversationSoakResult } from "./conversation-soak-evaluator.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const { Pool } = pg;
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_SESSION_COUNT = 100;
const DEFAULT_CONCURRENCY = 1;
const REQUEST_TIMEOUT_MS = 90_000;
const DEFAULT_GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/responses";
const RUN_METRICS = {
  answerRequests: 0,
  analysisRequests: 0,
  judgeRequests: 0,
  httpAttempts: 0,
};

const JUDGE_SCHEMA = {
  type: "object",
  properties: {
    overall_pass: { type: "boolean" },
    turns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          turn_number: { type: "integer" },
          response_faithful: { type: "boolean" },
          response_natural: { type: "boolean" },
          unsupported_addition: { type: "boolean" },
          learning_grounded: { type: "boolean" },
          historical_leak: { type: "boolean" },
          severity: { type: "string", enum: ["pass", "warning", "error"] },
          issues: { type: "array", items: { type: "string" } },
        },
        required: [
          "turn_number",
          "response_faithful",
          "response_natural",
          "unsupported_addition",
          "learning_grounded",
          "historical_leak",
          "severity",
          "issues",
        ],
        additionalProperties: false,
      },
    },
  },
  required: ["overall_pass", "turns"],
  additionalProperties: false,
};

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured`);
  return value;
}

function integerEnvironment(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function booleanEnvironment(name, fallback = false) {
  const value = process.env[name]?.trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes"].includes(value);
}

function applicationAuthHeaders() {
  const headers = {};
  const authorization = process.env.SOAK_HTTP_AUTHORIZATION?.trim();
  const cookie = process.env.SOAK_HTTP_COOKIE?.trim();
  if (authorization) headers.Authorization = authorization;
  if (cookie) headers.Cookie = cookie;
  return headers;
}

function normalizeGrammar(value) {
  return value
    .normalize("NFKC")
    .replace(/[~～]/gu, "〜")
    .replace(/\s+/gu, "")
    .replace(/^〜+/u, "");
}

function customDebugCase() {
  return {
    id: "real-debug-account-after-te-miru",
    suite: "real-agent-soak",
    mode: "auto",
    scenario: "cross_turn_history_leak",
    input:
      "这个账户我登录不上去，密码重设的话需要绑定的邮箱和手机号，手机号是一个50结尾的号码，但我也没有权限使用。",
    riskTags: ["cross_turn", "historical_candidate", "translation_fidelity"],
    expect: {
      responseLanguage: "ja",
      responseAny: ["パスワード", "電話番号"],
      responseNone: ["アクセス権", "対応方法を教えて"],
      learning: null,
    },
    forbiddenLearningSurfaces: ["〜てみる"],
  };
}

function buildSessionPlans(count) {
  const learningCases = CONVERSATION_SOAK_CASES.filter(
    (testCase) => testCase.expect.learning
  );
  const ordinaryCases = CONVERSATION_SOAK_CASES.filter(
    (testCase) => !testCase.expect.learning
  );
  if (count > Math.min(learningCases.length, Math.floor(ordinaryCases.length / 2))) {
    throw new Error(`Cannot build ${count} unique three-turn plans`);
  }

  return Array.from({ length: count }, (_, index) => {
    const first =
      index === 0
        ? CONVERSATION_SOAK_CASES.find(
            (testCase) => testCase.id === "auto-daily-plan"
          ) ?? learningCases[0]
        : learningCases[index];
    const second = index === 0 ? customDebugCase() : ordinaryCases[index];
    const third = ordinaryCases[count + index];
    return {
      id: `real-soak-${String(index + 1).padStart(3, "0")}`,
      turns: [first, second, third],
    };
  });
}

async function fetchWithTimeout(url, init = {}, retries = 2) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      RUN_METRICS.httpAttempts += 1;
      const response = await fetch(url, { ...init, signal: controller.signal });
      if (
        response.ok ||
        (response.status < 500 && response.status !== 408 && response.status !== 429)
      ) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${await response.text()}`);
    } catch (error) {
      lastError = error;
    } finally {
      clearTimeout(timeout);
    }
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
    }
  }
  throw lastError ?? new Error(`Request failed: ${url}`);
}

async function requestJson(baseUrl, pathname, init = {}) {
  const response = await fetchWithTimeout(`${baseUrl}${pathname}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...applicationAuthHeaders(),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(`${init.method ?? "GET"} ${pathname} failed: ${response.status} ${text}`);
  }
  return body;
}

function parseApplicationSse(text) {
  const events = [];
  for (const block of text.split(/\r?\n\r?\n/u)) {
    const type = block
      .split(/\r?\n/u)
      .find((line) => line.startsWith("event:"))
      ?.slice(6)
      .trim();
    const data = block
      .split(/\r?\n/u)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n");
    if (!type || !data) continue;
    try {
      events.push({ type, data: JSON.parse(data) });
    } catch {
      events.push({ type, data: { raw: data } });
    }
  }
  return events;
}

async function sendTurn(baseUrl, sessionId, testCase, clientMessageId) {
  RUN_METRICS.answerRequests += 1;
  const response = await fetchWithTimeout(
    `${baseUrl}/api/conversations/${sessionId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...applicationAuthHeaders(),
      },
      body: JSON.stringify({
        clientMessageId,
        content: testCase.input,
        mode: testCase.mode,
      }),
    },
    0
  );
  const events = parseApplicationSse(await response.text());
  const errorEvent = events.find((event) => event.type === "error");
  if (errorEvent) {
    throw new Error(`SSE error: ${JSON.stringify(errorEvent.data)}`);
  }
  const completed = events.find((event) => event.type === "completed")?.data
    ?.message;
  if (!completed?.id || completed.status !== "completed") {
    throw new Error(`Missing completed assistant event: ${JSON.stringify(events)}`);
  }
  return { assistantMessage: completed, events };
}

function extractGatewayText(response) {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text.trim();
  }
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("")
    .trim();
}

async function judgeSession(plan, turns) {
  const gatewayKey = requiredEnvironment("SOAK_AI_GATEWAY_API_KEY");
  const gatewayUrl =
    process.env.SOAK_AI_GATEWAY_URL?.trim() || DEFAULT_GATEWAY_URL;
  const transcript = turns.map((turn, index) => ({
    turn_number: index + 1,
    mode: turn.testCase.mode,
    user_input: turn.testCase.input,
    assistant_response: turn.assistantMessage.content,
    learning_items: turn.analysis.learningItems.map((item) => ({
      kind: item.kind,
      surface_form: item.surfaceForm,
      meaning_zh: item.meaningZh,
      source_excerpt: item.sourceExcerpt,
    })),
  }));
  RUN_METRICS.judgeRequests += 1;
  const response = await fetchWithTimeout(gatewayUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${gatewayKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-5-nano",
      max_output_tokens: 1_800,
      reasoning: { effort: "minimal" },
      input: [
        {
          type: "message",
          role: "system",
          content:
            "你是严格的中日学习助手质量审计员。逐轮检查翻译是否忠实自然、是否添加原文没有的意图，以及学习候选是否只由当前轮原文支持。历史轮出现过但当前轮没有依据的候选属于 historical_leak。小的措辞偏好记 warning；语义错误、错误语言、无依据候选、事实增加或历史泄漏记 error。",
        },
        {
          type: "message",
          role: "user",
          content: `审计 session ${plan.id}：\n${JSON.stringify(transcript)}`,
        },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "lexinote_agent_soak_judge",
          strict: true,
          schema: JUDGE_SCHEMA,
        },
      },
    }),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(
      `Agent judge failed: ${response.status} ${JSON.stringify(body)}`
    );
  }
  const output = extractGatewayText(body);
  if (!output) throw new Error("Agent judge returned no structured output");
  return JSON.parse(output);
}

function sessionInvariantIssues(items, assistantMessageIds) {
  const issues = [];
  const itemKeys = new Set();
  const grammarPointIds = new Set();
  for (const item of items) {
    const itemKey = JSON.stringify([
      item.kind,
      item.kind === "grammar"
        ? normalizeGrammar(item.surface_form)
        : item.surface_form.normalize("NFKC").trim().toLowerCase(),
      item.meaning_zh.normalize("NFKC").trim().toLowerCase(),
    ]);
    if (itemKeys.has(itemKey)) {
      issues.push(`duplicate persisted learning item: ${item.kind}:${item.surface_form}`);
    }
    itemKeys.add(itemKey);
    if (!assistantMessageIds.has(item.source_message_id)) {
      issues.push(`learning item has unexpected source message: ${item.id}`);
    }
    if (item.kind !== "grammar") continue;
    const candidates = Array.isArray(item.grammar_candidates)
      ? item.grammar_candidates
      : [];
    const grammarPointId =
      item.grammar_point_id ||
      (candidates.length === 1 ? candidates[0].grammarPointId : null);
    if (!grammarPointId) continue;
    if (grammarPointIds.has(grammarPointId)) {
      issues.push(`duplicate resolved grammar point: ${grammarPointId}`);
    }
    grammarPointIds.add(grammarPointId);
  }
  return issues;
}

async function promoteOne(baseUrl, item, collectionId) {
  let body =
    item.kind === "grammar"
      ? item.grammarCandidates.length === 1
        ? { grammarPointId: item.grammarCandidates[0].grammarPointId }
        : null
      : { collectionId };
  if (!body) return { attempted: false, reason: "candidate requires selection" };
  let result = await requestJson(
    baseUrl,
    `/api/conversation/learning-items/${item.id}/promote`,
    { method: "POST", body: JSON.stringify(body) }
  );
  if (result.requiresSelection && result.pronunciationCandidates?.[0]) {
    body = {
      collectionId,
      pronunciation: result.pronunciationCandidates[0].pronunciation,
    };
    result = await requestJson(
      baseUrl,
      `/api/conversation/learning-items/${item.id}/promote`,
      { method: "POST", body: JSON.stringify(body) }
    );
  }
  return {
    attempted: true,
    saved: result.item?.status === "saved",
    item: result.item ?? null,
  };
}

async function runSession({
  baseUrl,
  collectionId,
  pool,
  plan,
  index,
  promotionBudget,
  runLabel,
}) {
  const startedAt = Date.now();
  const result = {
    id: plan.id,
    sessionId: null,
    status: "passed",
    durationMs: 0,
    turns: [],
    invariantIssues: [],
    judge: null,
    error: null,
  };
  try {
    const created = await requestJson(baseUrl, "/api/conversations", {
      method: "POST",
      body: JSON.stringify({ mode: plan.turns[0].mode }),
    });
    result.sessionId = created.session.id;
    await requestJson(baseUrl, `/api/conversations/${result.sessionId}`, {
      method: "PATCH",
      body: JSON.stringify({ title: `${runLabel}-${plan.id}` }),
    });

    for (const [turnIndex, testCase] of plan.turns.entries()) {
      const sent = await sendTurn(
        baseUrl,
        result.sessionId,
        testCase,
        `${plan.id}-turn-${turnIndex + 1}`
      );
      RUN_METRICS.analysisRequests += 1;
      const analysis = await requestJson(
        baseUrl,
        `/api/conversations/${result.sessionId}/messages/${sent.assistantMessage.id}/analysis`,
        { method: "POST", body: "{}" }
      );
      const deterministic = evaluateConversationSoakResult(testCase, {
        assistantMessage: sent.assistantMessage,
        analysis,
      });
      const forbiddenLearning = (testCase.forbiddenLearningSurfaces ?? []).filter(
        (surface) =>
          analysis.learningItems.some(
            (item) => normalizeGrammar(item.surfaceForm) === normalizeGrammar(surface)
          )
      );
      if (forbiddenLearning.length > 0) {
        deterministic.status = "failed";
        deterministic.issues.push({
          code: "historical_learning_leak",
          message: `forbidden historical surfaces: ${forbiddenLearning.join(", ")}`,
          severity: "error",
        });
      }
      let promotion = null;
      if (
        promotionBudget.remaining > 0 &&
        (index + turnIndex) % 7 === 0 &&
        analysis.learningItems[0]
      ) {
        promotionBudget.remaining -= 1;
        promotion = await promoteOne(baseUrl, analysis.learningItems[0], collectionId);
        if (promotion.attempted && !promotion.saved) {
          deterministic.status = "failed";
          deterministic.issues.push({
            code: "promotion_failed",
            message: "learning item promotion did not reach saved status",
            severity: "error",
          });
        }
      }
      result.turns.push({
        testCase,
        assistantMessage: sent.assistantMessage,
        analysis,
        deterministic,
        promotion,
      });
    }

    const persisted = await pool.query(
      `SELECT id::text, source_message_id::text, kind, surface_form, meaning_zh,
              status, grammar_candidates, grammar_point_id::text
       FROM conversation_learning_items
       WHERE session_id = $1::uuid
       ORDER BY created_at, id`,
      [result.sessionId]
    );
    result.invariantIssues = sessionInvariantIssues(
      persisted.rows,
      new Set(result.turns.map((turn) => turn.assistantMessage.id))
    );
    result.judge = await judgeSession(plan, result.turns);
    const deterministicFailed = result.turns.some(
      (turn) => turn.deterministic.status === "failed"
    );
    const deterministicWarning = result.turns.some(
      (turn) => turn.deterministic.status === "warning"
    );
    const judgeError = result.judge.turns.some(
      (turn) => turn.severity === "error"
    );
    const judgeWarning = result.judge.turns.some(
      (turn) => turn.severity === "warning"
    );
    result.status =
      deterministicFailed || judgeError || result.invariantIssues.length > 0
        ? "failed"
        : deterministicWarning || judgeWarning
          ? "warning"
          : "passed";
  } catch (error) {
    result.status = "failed";
    result.error = error instanceof Error ? error.stack ?? error.message : String(error);
  }
  result.durationMs = Date.now() - startedAt;
  return result;
}

function summarize(results) {
  const summary = {
    sessions: results.length,
    turns: results.reduce((total, result) => total + result.turns.length, 0),
    passed: 0,
    warning: 0,
    failed: 0,
    requestFailures: 0,
    promotionsAttempted: 0,
    promotionsSaved: 0,
    deterministicIssues: {},
    judgeIssues: {},
    invariantIssues: {},
    modes: {},
    modelCalls: { ...RUN_METRICS },
  };
  for (const result of results) {
    summary[result.status] += 1;
    if (result.error) summary.requestFailures += 1;
    for (const turn of result.turns) {
      summary.modes[turn.testCase.mode] = (summary.modes[turn.testCase.mode] ?? 0) + 1;
      if (turn.promotion?.attempted) summary.promotionsAttempted += 1;
      if (turn.promotion?.saved) summary.promotionsSaved += 1;
      for (const issue of turn.deterministic.issues) {
        summary.deterministicIssues[issue.code] =
          (summary.deterministicIssues[issue.code] ?? 0) + 1;
      }
    }
    for (const turn of result.judge?.turns ?? []) {
      for (const issue of turn.issues) {
        summary.judgeIssues[issue] = (summary.judgeIssues[issue] ?? 0) + 1;
      }
    }
    for (const issue of result.invariantIssues) {
      summary.invariantIssues[issue] = (summary.invariantIssues[issue] ?? 0) + 1;
    }
  }
  return summary;
}

async function writeReport(results, outputRoot, runMetadata) {
  const timestamp = new Date().toISOString().replace(/[:.]/gu, "-");
  const outputDirectory = path.join(outputRoot, timestamp);
  await fs.mkdir(outputDirectory, { recursive: true });
  const summary = summarize(results);
  await fs.writeFile(
    path.join(outputDirectory, "results.json"),
    `${JSON.stringify(
      { generatedAt: new Date().toISOString(), runMetadata, summary, results },
      null,
      2
    )}\n`
  );
  const failing = results.filter((result) => result.status === "failed");
  const markdown = [
    "# Conversation Agent Soak Report",
    "",
    `- Sessions: ${summary.sessions}`,
    `- Turns: ${summary.turns}`,
    `- Passed: ${summary.passed}`,
    `- Warning: ${summary.warning}`,
    `- Failed: ${summary.failed}`,
    `- Promotions: ${summary.promotionsSaved}/${summary.promotionsAttempted}`,
    `- Model calls: ${JSON.stringify(summary.modelCalls)}`,
    `- Modes: ${JSON.stringify(summary.modes)}`,
    "",
    "## Failed Sessions",
    "",
    ...(failing.length > 0
      ? failing.map(
          (result) =>
            `- ${result.id} (${result.sessionId ?? "no session"}): ${
              result.error?.split("\n")[0] ??
              [...result.invariantIssues, ...(result.judge?.turns ?? []).flatMap((turn) => turn.issues)]
                .slice(0, 3)
                .join("; ")
            }`
        )
      : ["- None"]),
    "",
  ].join("\n");
  await fs.writeFile(path.join(outputDirectory, "summary.md"), markdown);
  return { outputDirectory, summary };
}

async function cleanupRun(baseUrl, results, collectionId) {
  const failures = [];
  for (const result of results) {
    if (!result.sessionId) continue;
    try {
      await requestJson(baseUrl, `/api/conversations/${result.sessionId}`, {
        method: "DELETE",
      });
    } catch (error) {
      failures.push(`${result.sessionId}: ${String(error)}`);
    }
  }
  try {
    await requestJson(baseUrl, `/api/collections/${collectionId}`, {
      method: "DELETE",
    });
  } catch (error) {
    failures.push(`collection ${collectionId}: ${String(error)}`);
  }
  return failures;
}

async function main() {
  const baseUrl = requiredEnvironment("SOAK_BASE_URL").replace(/\/+$/u, "");
  const databaseUrl = requiredEnvironment("SOAK_DATABASE_URL");
  const sessionCount = integerEnvironment(
    "SOAK_SESSION_COUNT",
    DEFAULT_SESSION_COUNT
  );
  const concurrency = integerEnvironment("SOAK_CONCURRENCY", DEFAULT_CONCURRENCY);
  const promotionLimit = integerEnvironment("SOAK_PROMOTION_LIMIT", 0);
  const allowProductionWrites = booleanEnvironment("SOAK_ALLOW_PRODUCTION_WRITES");
  const cleanup = booleanEnvironment("SOAK_CLEANUP", true);
  if (!allowProductionWrites) {
    throw new Error(
      "SOAK_ALLOW_PRODUCTION_WRITES=1 is required because this test creates real records"
    );
  }
  const runLabel =
    process.env.SOAK_RUN_LABEL?.trim() ||
    `SOAK-PROD-${new Date().toISOString().replace(/[-:TZ.]/gu, "").slice(0, 14)}`;
  const outputRoot =
    process.env.SOAK_OUTPUT_DIR?.trim() ||
    path.join(process.cwd(), "output", "conversation-agent-soak");
  const plans = buildSessionPlans(sessionCount);
  const pool = new Pool({ connectionString: databaseUrl, max: concurrency + 2 });
  const baseline = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM conversation_sessions WHERE user_id = $1::uuid) AS sessions,
       (SELECT COUNT(*)::int FROM conversation_messages WHERE user_id = $1::uuid) AS messages,
       (SELECT COUNT(*)::int FROM conversation_learning_items WHERE user_id = $1::uuid) AS learning_items,
       (SELECT COUNT(*)::int FROM review_records WHERE user_id = $1::uuid) AS review_records`,
    [DEFAULT_USER_ID]
  );
  const collection = await requestJson(baseUrl, "/api/collections", {
    method: "POST",
    body: JSON.stringify({
      name: runLabel,
      description: "Temporary production Agent soak test collection",
    }),
  });
  const collectionId = collection.collection.collectionId;

  const results = new Array(plans.length);
  const promotionBudget = { remaining: promotionLimit };
  let nextIndex = 0;
  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= plans.length) return;
      const result = await runSession({
        baseUrl,
        collectionId,
        pool,
        plan: plans[index],
        index,
        promotionBudget,
        runLabel,
      });
      results[index] = result;
      process.stdout.write(
        `[${index + 1}/${plans.length}] ${result.id} ${result.status} ${(
          result.durationMs / 1_000
        ).toFixed(1)}s\n`
      );
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, plans.length) }, () => worker())
  );
  const runMetadata = {
    runLabel,
    baseUrl,
    databaseHost: new URL(databaseUrl).hostname,
    baseline: baseline.rows[0],
    collectionId,
    cleanupRequested: cleanup,
    promotionLimit,
  };
  const report = await writeReport(results, outputRoot, runMetadata);
  const cleanupFailures = cleanup
    ? await cleanupRun(baseUrl, results, collectionId)
    : [];
  await pool.end();
  process.stdout.write(`${JSON.stringify(report.summary, null, 2)}\n`);
  process.stdout.write(`CLEANUP_FAILURES=${JSON.stringify(cleanupFailures)}\n`);
  process.stdout.write(`REPORT_DIR=${report.outputDirectory}\n`);
  if (report.summary.failed > 0) process.exitCode = 2;
}

await main();
