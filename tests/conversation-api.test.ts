import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createConversationSession,
  deleteConversationMemory,
  fetchConversationBootstrap,
  streamConversationMessage,
  updateConversationPreferences,
} from "@/app/lib/conversation-api";
import { ApiClientError } from "@/app/lib/api-client";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("conversation API client", () => {
  it("encodes bootstrap filters and forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        aiAvailable: true,
        sessions: [],
        nextCursor: null,
        preferences: {},
        globalMemories: [],
        collections: [],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    await fetchConversationBootstrap({
      query: "敬语 会话",
      cursor: "2026-08-02T10:00:00Z|session-1",
      signal: controller.signal,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/conversation/bootstrap?query=%E6%95%AC%E8%AF%AD+%E4%BC%9A%E8%AF%9D&cursor=2026-08-02T10%3A00%3A00Z%7Csession-1",
      { signal: controller.signal }
    );
  });

  it("serializes session creation through the typed endpoint", async () => {
    const session = { id: "session-1", mode: "ja_to_zh" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ session }, 201));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createConversationSession("ja_to_zh")).resolves.toEqual(session);
    expect(fetchMock).toHaveBeenCalledWith("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "ja_to_zh" }),
      signal: undefined,
    });
  });

  it("returns successful message streams without consuming the response", async () => {
    const controller = new AbortController();
    const response = new Response("data: [DONE]\n\n");
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      clientMessageId: "client-1",
      content: "こんにちは",
      mode: "auto" as const,
    };

    await expect(
      streamConversationMessage("session-1", input, controller.signal)
    ).resolves.toBe(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/conversations/session-1/messages",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
        signal: controller.signal,
      }
    );
  });

  it("accepts successful no-content deletes", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteConversationMemory("memory-1")).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/conversation/memories/memory-1",
      { method: "DELETE" }
    );
  });

  it("preserves structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "INVALID_PREFERENCES", message: "偏好无效" } },
          400
        )
      )
    );

    const error = await updateConversationPreferences({ defaultMode: "auto" }).catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "INVALID_PREFERENCES",
      message: "偏好无效",
      statusCode: 400,
    });
  });
});
