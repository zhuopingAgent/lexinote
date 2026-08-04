import { expect, test, type Page, type Route } from "@playwright/test";
import { CONVERSATION_SOAK_CASES } from "../scripts/conversation-soak-cases.mjs";
import { expectNoHorizontalOverflow } from "./helpers";

const NOW = "2026-08-04T00:00:00.000Z";
const COLLECTION_ID = 7;

type SoakCase = (typeof CONVERSATION_SOAK_CASES)[number];

function uuidFor(index: number, suffix: number) {
  const tail = String(index * 10 + suffix).padStart(12, "0");
  return `10000000-0000-4000-8000-${tail}`;
}

function session(testCase: SoakCase, index: number) {
  return {
    id: uuidFor(index, 1),
    title: "新对话",
    mode: testCase.mode,
    summary: "",
    titleIsManual: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function message(input: {
  testCase: SoakCase;
  index: number;
  role: "user" | "assistant";
  content: string;
  status?: "streaming" | "completed";
}) {
  const userMessageId = uuidFor(input.index, 2);
  return {
    id: input.role === "user" ? userMessageId : uuidFor(input.index, 3),
    sessionId: uuidFor(input.index, 1),
    role: input.role,
    content: input.content,
    mode: input.testCase.mode,
    status: input.status ?? "completed",
    parentMessageId: input.role === "assistant" ? userMessageId : null,
    modelName: input.role === "assistant" ? "soak/mock-model" : null,
    errorCode: null,
    errorMessage: null,
    details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
    analysisStatus:
      input.role === "assistant" && input.status !== "streaming"
        ? "completed"
        : input.role === "assistant"
          ? "pending"
          : "not_requested",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: input.status === "streaming" ? null : NOW,
  };
}

function assistantContent(testCase: SoakCase) {
  const signals = testCase.expect.responseAny.join("、") || "自然表达";
  if (testCase.expect.responseLanguage === "ja") {
    return `${signals}について、自然な日本語でお伝えします。`;
  }
  if (testCase.expect.responseLanguage === "mixed") {
    return `${signals}。\n说明：这里给出符合语境的自然表达。`;
  }
  return `${signals}。这是符合原句语气的中文翻译。`;
}

function learningItems(testCase: SoakCase, index: number) {
  const expected = testCase.expect.learning;
  if (!expected) return [];
  const isGrammar = expected.kind === "grammar";
  return [
    {
      id: uuidFor(index, 4),
      sessionId: uuidFor(index, 1),
      sourceMessageId: uuidFor(index, 3),
      kind: expected.kind,
      surfaceForm: expected.surfaceForm,
      reading: isGrammar ? null : "じゅうみんひょう",
      meaningZh: "本用例预期学习项",
      explanationZh: "用于验证对话候选能够进入后续学习流程。",
      sourceExcerpt: testCase.input.slice(0, 200),
      status: "suggested",
      grammarCandidates: isGrammar
        ? [
            {
              grammarPointId: uuidFor(index, 5),
              grammarPoint: expected.surfaceForm,
              canonicalForm: expected.surfaceForm,
              senseKey: `soak-${index}`,
              coreMeaning: "本用例预期语法义项",
            },
          ]
        : [],
      wordId: null,
      grammarPointId: null,
      collectionId: null,
      errorMessage: null,
      createdAt: NOW,
      updatedAt: NOW,
    },
  ];
}

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installSoakRoutes(
  page: Page,
  current: {
    testCase: SoakCase;
    index: number;
    sent: boolean;
    analyzed: boolean;
  }
) {
  await page.route("**/api/conversation/bootstrap**", async (route) => {
    await fulfillJson(route, {
      aiAvailable: true,
      sessions: [],
      nextCursor: null,
      preferences: {
        defaultMode: "auto",
        translationStyle: "natural_first",
        defaultRegister: "polite",
        defaultCollectionId: COLLECTION_ID,
      },
      globalMemories: [],
      collections: [
        {
          collectionId: COLLECTION_ID,
          name: "会话生词",
          description: "",
          wordCount: 0,
          createdAt: NOW,
          autoFilterEnabled: false,
          autoFilterCriteria: "",
          autoFilterSyncStatus: "idle",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 1,
          autoFilterLastSyncedRuleVersion: null,
        },
      ],
    });
  });

  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    const payload = route.request().postDataJSON() as { mode?: string };
    expect(payload.mode).toBe(current.testCase.mode);
    await fulfillJson(route, { session: session(current.testCase, current.index) }, 201);
  });

  await page.route("**/api/conversations/*/messages", async (route) => {
    const payload = route.request().postDataJSON() as { content?: string };
    expect(payload.content).toBe(current.testCase.input);
    current.sent = true;
    const content = assistantContent(current.testCase);
    const user = message({
      testCase: current.testCase,
      index: current.index,
      role: "user",
      content: current.testCase.input,
    });
    const assistant = message({
      testCase: current.testCase,
      index: current.index,
      role: "assistant",
      content: "",
      status: "streaming",
    });
    const completed = message({
      testCase: current.testCase,
      index: current.index,
      role: "assistant",
      content,
    });
    const events = [
      { type: "assistant_created", userMessage: user, assistantMessage: assistant },
      { type: "text_delta", delta: content.slice(0, Math.ceil(content.length / 2)) },
      { type: "text_delta", delta: content.slice(Math.ceil(content.length / 2)) },
      { type: "completed", message: completed },
    ];
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: events
        .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });

  await page.route("**/api/conversations/*/messages/*/analysis", async (route) => {
    current.analyzed = true;
    const content = assistantContent(current.testCase);
    await fulfillJson(route, {
      message: {
        ...message({
          testCase: current.testCase,
          index: current.index,
          role: "assistant",
          content,
        }),
        analysisStatus: "completed",
      },
      session: {
        ...session(current.testCase, current.index),
        title: `Soak ${current.index + 1}`,
        summary: "已完成当前复杂场景。",
      },
      memories: [],
      learningItems: learningItems(current.testCase, current.index),
    });
  });

  await page.route("**/api/conversations/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const content = assistantContent(current.testCase);
    await fulfillJson(route, {
      session: {
        ...session(current.testCase, current.index),
        ...(current.analyzed
          ? { title: `Soak ${current.index + 1}`, summary: "已完成当前复杂场景。" }
          : {}),
      },
      messages: current.sent
        ? [
            message({
              testCase: current.testCase,
              index: current.index,
              role: "user",
              content: current.testCase.input,
            }),
            message({
              testCase: current.testCase,
              index: current.index,
              role: "assistant",
              content,
            }),
          ]
        : [],
      memories: [],
      learningItems: current.analyzed
        ? learningItems(current.testCase, current.index)
        : [],
      olderMessagesCursor: null,
    });
  });
}

test("100 complex conversation cases exercise every mode and learning handoff", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const current = {
    testCase: CONVERSATION_SOAK_CASES[0],
    index: 0,
    sent: false,
    analyzed: false,
  };
  await installSoakRoutes(page, current);

  for (const [index, testCase] of CONVERSATION_SOAK_CASES.entries()) {
    current.testCase = testCase;
    current.index = index;
    current.sent = false;
    current.analyzed = false;
    const bootstrapResponse = page.waitForResponse(
      (response) =>
        response.url().includes("/api/conversation/bootstrap") && response.ok()
    );
    await page.goto("/conversation");
    await bootstrapResponse;
    const modeSelector = page.getByLabel("对话模式");
    await modeSelector.selectOption(testCase.mode);
    await expect(modeSelector).toHaveValue(testCase.mode);
    await page.getByLabel("对话消息").fill(testCase.input);
    await page.getByLabel("对话消息").press("Enter");

    await expect(page.getByRole("article")).toContainText(
      testCase.expect.responseAny[0] ?? "自然表达"
    );
    if (testCase.expect.learning?.kind === "grammar") {
      await expect(page.getByRole("button", { name: "加入复习" })).toBeVisible();
    } else if (testCase.expect.learning?.kind === "vocabulary") {
      await expect(page.getByRole("button", { name: "加入单词本" })).toBeVisible();
    }
    if ((index + 1) % 20 === 0) {
      await expectNoHorizontalOverflow(page);
    }
  }
});
