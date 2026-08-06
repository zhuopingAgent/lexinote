import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_AI_MODEL_FALLBACKS,
  ConversationAiClient,
} from "@/features/conversation/infrastructure/ConversationAiClient";
import type {
  ConversationMessage,
  ConversationSession,
} from "@/shared/types/conversation";

const session: ConversationSession = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "新对话",
  mode: "auto",
  summary: "",
  summaryThroughAt: null,
  titleIsManual: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const message: ConversationMessage = {
  id: "22222222-2222-4222-8222-222222222222",
  sessionId: session.id,
  role: "user",
  content: "試してみます",
  mode: "auto",
  status: "completed",
  parentMessageId: null,
  modelName: null,
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  completedAt: "2026-01-01T00:00:00.000Z",
};

describe("conversation AI model fallbacks", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses cross-provider fallbacks for streamed replies", async () => {
    const streamRequester = vi.fn().mockResolvedValue(
      (async function* () {
        yield "回答";
      })()
    );
    const client = new ConversationAiClient(
      streamRequester as never,
      vi.fn() as never
    );

    await client.streamReply([{ role: "user", content: "你好" }]);

    expect(streamRequester).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        role: "defaultTeacher",
        fallbackModels: [...CONVERSATION_AI_MODEL_FALLBACKS.reply],
      })
    );
  });

  it("uses inexpensive fallbacks for structured analysis", async () => {
    const structuredRequester = vi.fn().mockResolvedValue(
      JSON.stringify({
        overview: "重点是尝试表达。",
        learning_items: [],
      })
    );
    const client = new ConversationAiClient(
      vi.fn() as never,
      structuredRequester as never
    );

    await client.analyze({
      messages: [message],
      focus: "grammar",
      instruction: "只看尝试表达",
    });

    expect(structuredRequester).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        role: "cheap",
        fallbackModels: [...CONVERSATION_AI_MODEL_FALLBACKS.analysis],
      })
    );
  });
});
