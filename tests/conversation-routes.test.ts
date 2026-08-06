import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigurationError, ValidationError } from "@/shared/utils/errors";

const mocks = vi.hoisted(() => ({
  bootstrap: vi.fn(),
  createSession: vi.fn(),
  getSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  streamMessage: vi.fn(),
  analyzeMessage: vi.fn(),
  maintainSession: vi.fn(),
  updatePreferences: vi.fn(),
  createMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
  promote: vi.fn(),
  dismiss: vi.fn(),
  listGrammarInbox: vi.fn(),
}));

vi.mock("@/app/api/services", () => ({
  getConversationSessionService: () => ({
    bootstrap: mocks.bootstrap,
    createSession: mocks.createSession,
    getSession: mocks.getSession,
    updateSession: mocks.updateSession,
    deleteSession: mocks.deleteSession,
    updatePreferences: mocks.updatePreferences,
    createMemory: mocks.createMemory,
    updateMemory: mocks.updateMemory,
    deleteMemory: mocks.deleteMemory,
  }),
  getConversationMessageService: () => ({
    streamMessage: mocks.streamMessage,
  }),
  getConversationAnalysisService: () => ({
    analyzeMessage: mocks.analyzeMessage,
  }),
  getConversationMaintenanceService: () => ({
    maintainSession: mocks.maintainSession,
  }),
  getConversationLearningService: () => ({
    promote: mocks.promote,
    dismiss: mocks.dismiss,
    listGrammarInbox: mocks.listGrammarInbox,
  }),
}));

const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ITEM_ID = "33333333-3333-4333-8333-333333333333";

function jsonRequest(url: string, method: string, body: unknown) {
  return new Request(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function sseStream(events: object[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      events.forEach((event) => {
        const type = (event as { type: string }).type;
        controller.enqueue(
          encoder.encode(`event: ${type}\ndata: ${JSON.stringify(event)}\n\n`)
        );
      });
      controller.close();
    },
  });
}

describe("conversation API routes", () => {
  beforeEach(() => {
    Object.values(mocks).forEach((mock) => mock.mockReset());
  });

  it("creates, loads, updates, and deletes sessions through the service", async () => {
    const session = { id: SESSION_ID, title: "新对话", mode: "auto" };
    mocks.createSession.mockResolvedValue(session);
    mocks.getSession.mockResolvedValue({ session, messages: [] });
    mocks.updateSession.mockResolvedValue({ ...session, title: "预约改期" });
    mocks.deleteSession.mockResolvedValue(undefined);
    const sessionsRoute = await import("@/app/api/conversations/route");
    const sessionRoute = await import("@/app/api/conversations/[sessionId]/route");
    const context = { params: Promise.resolve({ sessionId: SESSION_ID }) };

    const created = await sessionsRoute.POST(
      jsonRequest("http://localhost/api/conversations", "POST", {
        mode: "zh_to_ja",
      })
    );
    const loaded = await sessionRoute.GET(
      new Request(`http://localhost/api/conversations/${SESSION_ID}`),
      context
    );
    const updated = await sessionRoute.PATCH(
      jsonRequest(
        `http://localhost/api/conversations/${SESSION_ID}`,
        "PATCH",
        { title: "预约改期" }
      ),
      context
    );
    const deleted = await sessionRoute.DELETE(
      new Request(`http://localhost/api/conversations/${SESSION_ID}`, {
        method: "DELETE",
      }),
      context
    );

    expect(created.status).toBe(201);
    expect(loaded.status).toBe(200);
    expect(updated.status).toBe(200);
    expect(deleted.status).toBe(204);
    expect(mocks.createSession).toHaveBeenCalledWith("zh_to_ja");
    expect(mocks.getSession).toHaveBeenCalledWith(SESSION_ID, null);
    expect(mocks.updateSession).toHaveBeenCalledWith(SESSION_ID, {
      title: "预约改期",
    });
    expect(mocks.deleteSession).toHaveBeenCalledWith(SESSION_ID);
  });

  it("returns the ordered SSE protocol and streaming headers", async () => {
    mocks.streamMessage.mockResolvedValue(
      sseStream([
        {
          type: "assistant_created",
          userMessage: { id: "user" },
          assistantMessage: { id: "assistant" },
        },
        { type: "text_delta", delta: "こんにちは" },
        { type: "completed", message: { id: "assistant", status: "completed" } },
      ])
    );
    const { POST } = await import(
      "@/app/api/conversations/[sessionId]/messages/route"
    );
    const body = {
      clientMessageId: "client-1",
      content: "你好",
      mode: "zh_to_ja",
    };

    const response = await POST(
      jsonRequest(
        `http://localhost/api/conversations/${SESSION_ID}/messages`,
        "POST",
        body
      ),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    expect(response.headers.get("cache-control")).toContain("no-transform");
    expect(await response.text()).toMatch(
      /assistant_created[\s\S]*text_delta[\s\S]*completed/
    );
    expect(mocks.streamMessage).toHaveBeenCalledWith(
      SESSION_ID,
      body,
      expect.any(AbortSignal)
    );
  });

  it("keeps user-directed analysis as an independent idempotent endpoint", async () => {
    const requestBody = {
      clientAnalysisId: "analysis-client-1",
      focus: "grammar",
      instruction: "只看原句中的尝试表达",
    };
    const result = {
      analysis: {
        id: "44444444-4444-4444-8444-444444444444",
        messageId: MESSAGE_ID,
        status: "completed",
      },
      learningItems: [],
    };
    mocks.analyzeMessage.mockResolvedValue(result);
    const { POST } = await import(
      "@/app/api/conversations/[sessionId]/messages/[messageId]/analysis/route"
    );

    const response = await POST(
      jsonRequest("http://localhost/analysis", "POST", requestBody),
      { params: Promise.resolve({ sessionId: SESSION_ID, messageId: MESSAGE_ID }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(mocks.analyzeMessage).toHaveBeenCalledWith(
      SESSION_ID,
      MESSAGE_ID,
      requestBody
    );
  });

  it("routes automatic title and summary maintenance separately", async () => {
    const result = {
      session: { id: SESSION_ID, title: "预约改期" },
      memories: [],
    };
    mocks.maintainSession.mockResolvedValue(result);
    const { POST } = await import(
      "@/app/api/conversations/[sessionId]/messages/[messageId]/maintenance/route"
    );
    const response = await POST(
      new Request("http://localhost/maintenance", { method: "POST" }),
      { params: Promise.resolve({ sessionId: SESSION_ID, messageId: MESSAGE_ID }) }
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(result);
    expect(mocks.maintainSession).toHaveBeenCalledWith(SESSION_ID, MESSAGE_ID);
  });

  it("routes learning promotion and exposes validation failures", async () => {
    mocks.promote
      .mockResolvedValueOnce({ item: { id: ITEM_ID, status: "saved" } })
      .mockRejectedValueOnce(new ValidationError("请选择具体读音。"));
    const { POST } = await import(
      "@/app/api/conversation/learning-items/[itemId]/promote/route"
    );
    const context = { params: Promise.resolve({ itemId: ITEM_ID }) };

    const saved = await POST(
      jsonRequest("http://localhost/promote", "POST", {
        pronunciation: "いだく",
        collectionId: 7,
      }),
      context
    );
    const invalid = await POST(
      jsonRequest("http://localhost/promote", "POST", {}),
      context
    );

    expect(saved.status).toBe(200);
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      error: { code: "VALIDATION_ERROR", message: "请选择具体读音。" },
    });
  });

  it("returns a clear unavailable response before an SSE stream is created", async () => {
    mocks.streamMessage.mockRejectedValue(
      new ConfigurationError("AI Gateway credentials are not configured")
    );
    const { POST } = await import(
      "@/app/api/conversations/[sessionId]/messages/route"
    );

    const response = await POST(
      jsonRequest("http://localhost/messages", "POST", {
        clientMessageId: "client-1",
        content: "你好",
      }),
      { params: Promise.resolve({ sessionId: SESSION_ID }) }
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "Service temporarily unavailable",
      },
    });
  });

  it("rejects non-object JSON before it reaches a conversation service", async () => {
    const { POST } = await import("@/app/api/conversations/route");
    const response = await POST(
      new Request("http://localhost/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "null",
      })
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "request body must be a JSON object",
      },
    });
    expect(mocks.createSession).not.toHaveBeenCalled();
  });
});
