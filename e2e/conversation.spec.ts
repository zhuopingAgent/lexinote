import { expect, test, type Page } from "@playwright/test";
import {
  createBrowserErrorCollector,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
} from "./helpers";

const SESSION_A = "11111111-1111-4111-8111-111111111111";
const SESSION_B = "22222222-2222-4222-8222-222222222222";
const NEW_SESSION = "33333333-3333-4333-8333-333333333333";
const USER_MESSAGE = "44444444-4444-4444-8444-444444444444";
const ASSISTANT_MESSAGE = "55555555-5555-4555-8555-555555555555";
const LEARNING_ITEM = "66666666-6666-4666-8666-666666666666";
const GRAMMAR_POINT = "77777777-7777-4777-8777-777777777777";
const ANALYSIS_ID = "99999999-9999-4999-8999-999999999999";
const REVISED_ANALYSIS_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const NOW = "2026-08-02T10:00:00.000Z";

function session(id: string, title: string) {
  return {
    id,
    title,
    mode: "zh_to_ja",
    summary: "",
    summaryThroughAt: null,
    titleIsManual: false,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function message(
  id: string,
  role: "user" | "assistant",
  content: string,
  status: "streaming" | "completed" | "cancelled" | "failed" = "completed"
) {
  return {
    id,
    sessionId: NEW_SESSION,
    role,
    content,
    mode: "zh_to_ja",
    status,
    parentMessageId: role === "assistant" ? USER_MESSAGE : null,
    modelName: role === "assistant" ? "openai/gpt-4.1-mini" : null,
    errorCode: null,
    errorMessage: null,
    details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
    analysisStatus: "not_requested",
    createdAt: NOW,
    updatedAt: NOW,
    completedAt: status === "completed" ? NOW : null,
  };
}

const preferences = {
  defaultMode: "zh_to_ja",
  translationStyle: "natural_first",
  defaultRegister: "polite",
  defaultCollectionId: 7,
};

const collection = {
  collectionId: 7,
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
};

const vocabularyItem = {
  id: LEARNING_ITEM,
  sessionId: NEW_SESSION,
  sourceMessageId: ASSISTANT_MESSAGE,
  analysisId: ANALYSIS_ID,
  kind: "vocabulary",
  surfaceForm: "変更する",
  reading: "へんこうする",
  meaningZh: "更改",
  explanationZh: "日程、计划等的常用动词。",
  sourceExcerpt: "予約時間を変更していただけますか。",
  status: "suggested",
  grammarCandidates: [],
  wordId: null,
  grammarPointId: null,
  collectionId: null,
  errorMessage: null,
  createdAt: NOW,
  updatedAt: NOW,
};

async function mockBootstrap(page: Page) {
  await page.route("**/api/conversation/bootstrap**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        aiAvailable: true,
        sessions: [session(SESSION_A, "医院预约"), session(SESSION_B, "工作邮件")],
        nextCursor: null,
        preferences,
        globalMemories: [],
        collections: [collection],
      }),
    });
  });
  await page.route(
    "**/api/conversations/*/messages/*/maintenance",
    async (route) => {
      const parts = new URL(route.request().url()).pathname.split("/");
      const sessionId = parts[3] ?? NEW_SESSION;
      await route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({
          session: session(sessionId, "已更新对话"),
          memories: [],
        }),
      });
    }
  );
}

test("conversation session CRUD preserves confirmed global memory", async ({
  request,
}) => {
  const createdResponse = await request.post("/api/conversations", {
    data: { mode: "ja_to_zh" },
  });
  expect(createdResponse.status()).toBe(201);
  const created = (await createdResponse.json()) as {
    session: { id: string; mode: string };
  };
  expect(created.session.mode).toBe("ja_to_zh");

  const renamedResponse = await request.patch(
    `/api/conversations/${created.session.id}`,
    { data: { title: "E2E 会话" } }
  );
  expect(renamedResponse.ok()).toBe(true);
  expect(await renamedResponse.json()).toMatchObject({
    session: { id: created.session.id, title: "E2E 会话" },
  });

  const sessionMemoryResponse = await request.post("/api/conversation/memories", {
    data: {
      sessionId: created.session.id,
      scope: "session",
      kind: "context",
      content: "仅当前会话使用",
    },
  });
  expect(sessionMemoryResponse.status()).toBe(201);
  const sessionMemory = (await sessionMemoryResponse.json()) as {
    memory: { id: string };
  };
  const globalMemoryResponse = await request.post("/api/conversation/memories", {
    data: {
      scope: "global",
      kind: "preference",
      content: "优先自然表达",
    },
  });
  expect(globalMemoryResponse.status()).toBe(201);
  const globalMemory = (await globalMemoryResponse.json()) as {
    memory: { id: string };
  };

  const loadedResponse = await request.get(
    `/api/conversations/${created.session.id}`
  );
  expect(loadedResponse.ok()).toBe(true);
  expect(await loadedResponse.json()).toMatchObject({
    session: { title: "E2E 会话" },
    memories: [{ id: sessionMemory.memory.id, scope: "session" }],
  });

  const deletedResponse = await request.delete(
    `/api/conversations/${created.session.id}`
  );
  expect(deletedResponse.status()).toBe(204);
  expect(
    (await request.patch(
      `/api/conversation/memories/${sessionMemory.memory.id}`,
      { data: { content: "不应存在" } }
    )).status()
  ).toBe(404);
  expect(
    (await request.patch(
      `/api/conversation/memories/${globalMemory.memory.id}`,
      { data: { content: "继续保留" } }
    )).ok()
  ).toBe(true);
  expect(
    (await request.delete(
      `/api/conversation/memories/${globalMemory.memory.id}`
    )).status()
  ).toBe(204);
});

test("conversation switches sessions and completes a mocked learning flow", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  let messageWasSent = false;
  let analysisRequests = 0;
  let revisedAnalysisPayload: Record<string, unknown> | null = null;

  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() !== "POST") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ session: session(NEW_SESSION, "新对话") }),
    });
  });
  await page.route("**/api/conversations/*/messages", async (route) => {
    messageWasSent = true;
    const user = message(USER_MESSAGE, "user", "可以帮我改一下预约时间吗？");
    const assistant = message(ASSISTANT_MESSAGE, "assistant", "", "streaming");
    const completed = message(
      ASSISTANT_MESSAGE,
      "assistant",
      "予約時間を変更していただけますか。"
    );
    const events = [
      { type: "assistant_created", userMessage: user, assistantMessage: assistant },
      { type: "text_delta", delta: "予約時間を" },
      { type: "text_delta", delta: "変更していただけますか。" },
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
    analysisRequests += 1;
    const payload = route.request().postDataJSON() as Record<string, unknown>;
    if (analysisRequests > 1) revisedAnalysisPayload = payload;
    const revised = analysisRequests > 1;
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        analysis: {
          id: revised ? REVISED_ANALYSIS_ID : ANALYSIS_ID,
          sessionId: NEW_SESSION,
          messageId: ASSISTANT_MESSAGE,
          revision: revised ? 2 : 1,
          status: "completed",
          focus: revised ? "grammar" : "all",
          instruction: revised ? "只看请求语法，不要词汇" : "",
          overview: revised
            ? "修订后只保留语法视角。"
            : "这句包含礼貌请求时常用的表达。",
          isCurrent: true,
          modelName: "openai/gpt-4.1-nano",
          errorCode: null,
          errorMessage: null,
          createdAt: NOW,
          updatedAt: NOW,
          completedAt: NOW,
        },
        learningItems: revised ? [] : [vocabularyItem],
      }),
    });
  });
  await page.route("**/api/conversation/learning-items/*/promote", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        item: {
          ...vocabularyItem,
          status: "saved",
          wordId: 88,
          collectionId: 7,
        },
      }),
    });
  });
  await page.route("**/api/conversations/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    const id = new URL(route.request().url()).pathname.split("/").at(-1) ?? "";
    const current =
      id === SESSION_A
        ? session(SESSION_A, "医院预约")
        : id === SESSION_B
          ? session(SESSION_B, "工作邮件")
          : session(NEW_SESSION, "新对话");
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session: current,
        messages: messageWasSent && id === NEW_SESSION
          ? [
              message(USER_MESSAGE, "user", "可以帮我改一下预约时间吗？"),
              message(
                ASSISTANT_MESSAGE,
                "assistant",
                "予約時間を変更していただけますか。"
              ),
            ]
          : [],
        memories: [],
        analyses: [],
        learningItems: [],
        olderMessagesCursor: null,
      }),
    });
  });

  await page.goto(`/conversation/${SESSION_A}`);
  await expect(page.getByText("医院预约", { exact: true }).first()).toBeVisible();
  await page.getByRole("link", { name: "工作邮件" }).click();
  await expect(page).toHaveURL(new RegExp(`/conversation/${SESSION_B}$`));
  await expect(page.getByText("工作邮件", { exact: true }).first()).toBeVisible();

  await page.goto("/conversation");
  await page.getByLabel("对话消息").fill("可以帮我改一下预约时间吗？");
  await page.getByLabel("对话消息").press("Enter");
  await expect(page.getByText("予約時間を変更していただけますか。")).toBeVisible();
  await expect(page.getByText("翻译与表达说明")).toHaveCount(0);
  await expect(page.getByText("変更する", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "学习分析" }).click();
  await page.getByRole("button", { name: "开始分析" }).click();
  await expect(page.getByText("変更する", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("article").getByText("默认单词本", { exact: true })
  ).toBeVisible();
  await expect(page.getByText("设为默认单词本", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "加入单词本" }).click();
  await expect(page.getByText("変更する 已保存")).toBeVisible();

  await page.getByLabel("对话消息").fill("/analysis grammar 只看请求语法，不要词汇");
  await page.getByLabel("对话消息").press("Enter");
  await expect(page.getByText("修订后只保留语法视角。")).toBeVisible();
  expect(revisedAnalysisPayload).toMatchObject({
    focus: "grammar",
    instruction: "只看请求语法，不要词汇",
  });
  await expect(page.getByText("変更する 已保存")).toBeVisible();

  await page.getByRole("button", { name: "新对话", exact: true }).click();
  await expect(page).toHaveURL(/\/conversation$/);
  await expect(page.getByText("予約時間を変更していただけますか。")).toBeHidden();
  await expect(page.getByLabel("对话消息")).toHaveValue("");
  await expectNoHorizontalOverflow(page);
  expectNoBrowserErrors(browserErrors);
});

test("a rapid second click on the send position does not cancel generation", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  let messageRequests = 0;

  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ session: session(NEW_SESSION, "新对话") }),
    });
  });
  await page.route("**/api/conversations/*/messages", async (route) => {
    messageRequests += 1;
    await new Promise((resolve) => setTimeout(resolve, 650));
    const user = message(USER_MESSAGE, "user", "双击发送测试");
    const assistant = message(ASSISTANT_MESSAGE, "assistant", "", "streaming");
    const completed = message(
      ASSISTANT_MESSAGE,
      "assistant",
      "予約時間を変更していただけますか。"
    );
    const events = [
      { type: "assistant_created", userMessage: user, assistantMessage: assistant },
      { type: "text_delta", delta: completed.content },
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
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        message: {
          ...message(
            ASSISTANT_MESSAGE,
            "assistant",
            "予約時間を変更していただけますか。"
          ),
          analysisStatus: "completed",
        },
        session: session(NEW_SESSION, "双击发送测试"),
        memories: [],
        learningItems: [],
      }),
    });
  });

  await page.goto("/conversation");
  await page.getByLabel("对话消息").fill("双击发送测试");
  const send = page.getByRole("button", { name: "发送消息" });
  const box = await send.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  const stop = page.getByRole("button", { name: "停止生成" });
  await expect(stop).toBeVisible();
  await expect(stop).toBeDisabled();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);

  await expect(
    page.getByText("予約時間を変更していただけますか。")
  ).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(messageRequests).toBe(1);
  expectNoBrowserErrors(browserErrors);
});

test("cancelled conversation answer can be regenerated in place", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  let retryParentMessageId: string | null = null;
  let retryAssistantMessageId: string | null = null;

  await page.route("**/api/conversations/*/messages", async (route) => {
    const body = route.request().postDataJSON() as {
      retryParentMessageId?: string;
      retryAssistantMessageId?: string;
    };
    retryParentMessageId = body.retryParentMessageId ?? null;
    retryAssistantMessageId = body.retryAssistantMessageId ?? null;
    const assistant = {
      ...message(ASSISTANT_MESSAGE, "assistant", "", "streaming"),
      sessionId: SESSION_A,
    };
    const completed = {
      ...message(
        ASSISTANT_MESSAGE,
        "assistant",
        "予約時間を変更していただけますか。"
      ),
      sessionId: SESSION_A,
    };
    const events = [
      {
        type: "assistant_created",
        userMessage: { ...message(USER_MESSAGE, "user", "预约时间可以改吗？"), sessionId: SESSION_A },
        assistantMessage: assistant,
      },
      { type: "text_delta", delta: "予約時間を変更していただけますか。" },
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
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        message: {
          ...message(
            ASSISTANT_MESSAGE,
            "assistant",
            "予約時間を変更していただけますか。"
          ),
          sessionId: SESSION_A,
          analysisStatus: "completed",
        },
        session: session(SESSION_A, "医院预约"),
        memories: [],
        learningItems: [],
      }),
    });
  });
  await page.route("**/api/conversations/*", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session: session(SESSION_A, "医院预约"),
        messages: [
          { ...message(USER_MESSAGE, "user", "预约时间可以改吗？"), sessionId: SESSION_A },
          {
            ...message(ASSISTANT_MESSAGE, "assistant", "予約時間を", "cancelled"),
            sessionId: SESSION_A,
          },
        ],
        memories: [],
        analyses: [],
        learningItems: [],
        olderMessagesCursor: null,
      }),
    });
  });

  await page.goto(`/conversation/${SESSION_A}`);
  await page.getByRole("button", { name: "重新生成" }).click();
  await expect(page.getByText("予約時間を変更していただけますか。")).toBeVisible();
  expect(retryParentMessageId).toBe(USER_MESSAGE);
  expect(retryAssistantMessageId).toBe(ASSISTANT_MESSAGE);
  await expect(page.getByRole("article")).toHaveCount(1);
  expectNoBrowserErrors(browserErrors);
});

test("conversation deletion uses an accessible in-app confirmation", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);

  await page.route("**/api/conversations/*", async (route) => {
    if (route.request().method() === "DELETE") {
      await route.fulfill({ status: 204, body: "" });
      return;
    }
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        session: session(SESSION_A, "医院预约"),
        messages: [],
        memories: [],
        analyses: [],
        learningItems: [],
        olderMessagesCursor: null,
      }),
    });
  });

  await page.goto(`/conversation/${SESSION_A}`);
  await page.getByLabel("删除 医院预约").click();
  const dialog = page.getByRole("dialog", { name: "删除“医院预约”？" });
  await expect(dialog).toBeVisible();
  const cancelButton = dialog.getByRole("button", { name: "取消" });
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "删除对话" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("删除 医院预约")).toBeFocused();

  await page.getByLabel("删除 医院预约").click();
  await dialog.getByRole("button", { name: "删除对话" }).click();
  await expect(page).toHaveURL(/\/conversation$/);
  await expect(dialog).toBeHidden();
  expectNoBrowserErrors(browserErrors);
});

test("conversation remains useful when AI Gateway is unavailable", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await page.route("**/api/conversation/bootstrap**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        aiAvailable: false,
        sessions: [],
        nextCursor: null,
        preferences,
        globalMemories: [],
        collections: [collection],
      }),
    });
  });

  await page.goto("/conversation");
  await expect(page.getByText("暂无对话", { exact: true })).toBeVisible();
  await expect(page.getByLabel("对话消息")).toBeDisabled();
  await expect(
    page.getByText("AI Gateway 未配置，历史与记忆仍可查看，但暂时不能发送消息。")
  ).toBeVisible();

  await page.getByLabel("打开偏好与记忆").click();
  await expect(
    page.getByRole("dialog", { name: "对话偏好与记忆" })
  ).toBeVisible();
  expectNoBrowserErrors(browserErrors);
});

test("conversation serializes rapid partial preference updates", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  let currentPreferences = { ...preferences };
  let activeRequests = 0;
  let maxActiveRequests = 0;
  const patches: Array<Record<string, unknown>> = [];
  await page.route("**/api/conversation/preferences", async (route) => {
    const patch = route.request().postDataJSON() as Record<string, unknown>;
    patches.push(patch);
    activeRequests += 1;
    maxActiveRequests = Math.max(maxActiveRequests, activeRequests);
    if (patch.defaultMode) {
      await new Promise((resolve) => setTimeout(resolve, 80));
    }
    currentPreferences = { ...currentPreferences, ...patch };
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ preferences: currentPreferences }),
    });
    activeRequests -= 1;
  });

  await page.goto("/conversation");
  await page.getByLabel("打开偏好与记忆").click();
  const defaultMode = page.getByLabel("默认模式");
  const defaultRegister = page.getByLabel("默认语体");
  await defaultMode.selectOption("ja_to_zh");
  await defaultRegister.selectOption("business");

  await expect(defaultMode).toHaveValue("ja_to_zh");
  await expect(defaultRegister).toHaveValue("business");
  expect(patches).toEqual([
    { defaultMode: "ja_to_zh" },
    { defaultRegister: "business" },
  ]);
  expect(maxActiveRequests).toBe(1);
  expectNoBrowserErrors(browserErrors);
});

test("conversation surfaces Gateway budget errors in an accessible modal", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  const failedAssistant = {
    ...message(ASSISTANT_MESSAGE, "assistant", "", "failed"),
    errorCode: "AI_GATEWAY_BUDGET_EXCEEDED",
    errorMessage:
      "Vercel AI Gateway 余额或预算额度已用完，请在 Vercel 中充值或调整预算后再试。",
  };
  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ session: session(NEW_SESSION, "新对话") }),
    });
  });
  await page.route("**/api/conversations/*/messages", async (route) => {
    const events = [
      {
        type: "assistant_created",
        userMessage: message(USER_MESSAGE, "user", "额度测试"),
        assistantMessage: message(ASSISTANT_MESSAGE, "assistant", "", "streaming"),
      },
      {
        type: "error",
        code: "AI_GATEWAY_BUDGET_EXCEEDED",
        message: failedAssistant.errorMessage,
        retryable: true,
        assistantMessage: failedAssistant,
      },
    ];
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "text/event-stream; charset=utf-8" },
      body: events
        .map((event) => `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`)
        .join(""),
    });
  });

  await page.goto("/conversation");
  await page.getByLabel("对话消息").fill("额度测试");
  await page.getByLabel("对话消息").press("Enter");
  const dialog = page.getByRole("dialog", {
    name: "Vercel AI Gateway 额度不足",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "我知道了" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(page.getByLabel("对话消息")).toBeFocused();
  await expect(page.getByRole("button", { name: "重试" })).toBeVisible();
  await expect(page.getByText(failedAssistant.errorMessage, { exact: true })).toHaveCount(1);
  expectNoBrowserErrors(browserErrors);
});

test("conversation session drawer works on mobile without overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const browserErrors = createBrowserErrorCollector(page);
  await mockBootstrap(page);
  await page.goto("/conversation");

  await page.getByLabel("打开对话列表").click();
  const sidebar = page.locator('aside[aria-label="对话列表"]');
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole("button", { name: "新对话" })).toBeFocused();
  await expect(page.getByRole("link", { name: "医院预约" })).toBeVisible();
  await expect(page.getByLabel("重命名 医院预约")).toBeVisible();
  await page.keyboard.press("Shift+Tab");
  await expect(sidebar).toContainText("工作邮件");
  expect(
    await sidebar.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true);
  await expectNoHorizontalOverflow(page);
  await page.keyboard.press("Escape");
  await expect(sidebar).toHaveAttribute("aria-hidden", "true");
  await expect(page.getByLabel("打开对话列表")).toBeFocused();

  await page.getByLabel("打开偏好与记忆").click();
  const settings = page.getByRole("dialog", { name: "对话偏好与记忆" });
  await expect(page.getByLabel("关闭设置")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  expect(
    await settings.evaluate((element) => element.contains(document.activeElement))
  ).toBe(true);
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("关闭设置")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(settings).toBeHidden();
  await expect(page.getByLabel("打开偏好与记忆")).toBeFocused();

  const composer = page.getByLabel("对话消息");
  await composer.fill("第一行\n第二行\n第三行");
  expect(await composer.evaluate((element) => element.getBoundingClientRect().height)).toBeGreaterThan(44);
  await expectNoHorizontalOverflow(page);
  await expectNoBrowserErrors(browserErrors);
});

test("review inbox binds an unmatched conversation grammar sense", async ({ page }) => {
  const browserErrors = createBrowserErrorCollector(page);
  const grammarItem = {
    ...vocabularyItem,
    id: "88888888-8888-4888-8888-888888888888",
    kind: "grammar",
    surfaceForm: "〜ていただけますか",
    reading: null,
    status: "needs_review",
    grammarCandidates: [],
  };
  await page.route("**/api/conversation/review-inbox", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({ items: [grammarItem] }),
    });
  });
  await page.route("**/api/grammar?query=**", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        items: [
          {
            id: GRAMMAR_POINT,
            grammarPoint: "〜ていただけますか",
            canonicalForm: "〜ていただけますか",
            senseKey: "request_te_itadakemasu_ka",
            coreMeaning: "礼貌请求对方做某事",
          },
        ],
      }),
    });
  });
  await page.route("**/api/conversation/learning-items/*/promote", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        item: { ...grammarItem, status: "saved", grammarPointId: GRAMMAR_POINT },
      }),
    });
  });

  await page.goto("/review");
  await expect(page.getByRole("heading", { name: "对话待整理" })).toBeVisible();
  await page.getByRole("button", { name: "重新匹配" }).click();
  await expect(page.getByLabel("选择 〜ていただけますか 的文法义项")).toBeVisible();
  await page.getByRole("button", { name: "加入复习" }).click();
  await expect(page.getByRole("heading", { name: "对话待整理" })).toBeHidden();
  expectNoBrowserErrors(browserErrors);
});
