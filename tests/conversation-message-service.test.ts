import { describe, expect, it, vi } from "vitest";
import { consumeConversationEventStream } from "@/app/lib/conversation-stream";
import { ConversationMessageService } from "@/features/conversation/application/ConversationMessageService";
import type { ConversationStreamEvent } from "@/shared/types/conversation";
import {
  AiGatewayBudgetExceededError,
  AiGatewayRateLimitedError,
} from "@/shared/utils/errors";
import {
  TEST_ASSISTANT_MESSAGE_ID,
  TEST_SESSION_ID,
  TEST_USER_MESSAGE_ID,
  createConversationAi,
  createConversationGrammar,
  createConversationStore,
  makeConversationMessage,
} from "@/tests/conversation-test-doubles";

async function readEvents(stream: ReadableStream<Uint8Array>) {
  const events: ConversationStreamEvent[] = [];
  await consumeConversationEventStream(new Response(stream), (event) => {
    events.push(event);
  });
  return events;
}

describe("ConversationMessageService", () => {
  it("streams and persists a reply with confirmed context", async () => {
    const streamReply = vi.fn().mockResolvedValue(
      (async function* () {
        yield "我会";
        yield "试试看。";
      })()
    );
    const completeAssistantMessage = vi
      .fn()
      .mockImplementation(async (_id, _userId, content) =>
        makeConversationMessage({
          id: TEST_ASSISTANT_MESSAGE_ID,
          role: "assistant",
          parentMessageId: TEST_USER_MESSAGE_ID,
          content,
        })
      );
    const listContextMessages = vi.fn().mockResolvedValue([
      makeConversationMessage({ id: TEST_USER_MESSAGE_ID }),
    ]);
    const service = new ConversationMessageService(
      createConversationStore({
        completeAssistantMessage,
        listContextMessages,
      }),
      createConversationAi({ streamReply }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-1",
        content: "試してみます",
        mode: "chat",
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "text_delta",
      "text_delta",
      "completed",
    ]);
    expect(completeAssistantMessage).toHaveBeenCalledWith(
      TEST_ASSISTANT_MESSAGE_ID,
      expect.any(String),
      "我会试试看。"
    );
    expect(listContextMessages).toHaveBeenCalledWith(
      TEST_SESSION_ID,
      expect.any(String),
      expect.any(Number),
      TEST_USER_MESSAGE_ID
    );
  });

  it("replays an identical idempotent request without calling AI", async () => {
    const user = makeConversationMessage();
    const assistant = makeConversationMessage({
      id: TEST_ASSISTANT_MESSAGE_ID,
      role: "assistant",
      parentMessageId: user.id,
      content: "我会试试看。",
    });
    const findMessageByClientId = vi
      .fn()
      .mockResolvedValueOnce(user)
      .mockResolvedValueOnce(assistant);
    const streamReply = vi.fn();
    const service = new ConversationMessageService(
      createConversationStore({ findMessageByClientId }),
      createConversationAi({ streamReply }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-1",
        content: "試してみます",
        mode: "chat",
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "completed",
    ]);
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("rejects reuse of a client id with changed content", async () => {
    const service = new ConversationMessageService(
      createConversationStore({
        findMessageByClientId: vi
          .fn()
          .mockResolvedValue(makeConversationMessage({ content: "原始消息" })),
      }),
      createConversationAi(),
      createConversationGrammar()
    );

    await expect(
      service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-1",
        content: "不同消息",
        mode: "chat",
      })
    ).rejects.toThrow("clientMessageId 的消息参数不一致");
  });

  it("does not complete an empty upstream response", async () => {
    const completeAssistantMessage = vi.fn();
    const failAssistantMessage = vi.fn().mockResolvedValue(
      makeConversationMessage({
        id: TEST_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        parentMessageId: TEST_USER_MESSAGE_ID,
        status: "failed",
        errorCode: "DEPENDENCY_ERROR",
        errorMessage: "回答生成失败，请重试。",
      })
    );
    const service = new ConversationMessageService(
      createConversationStore({
        completeAssistantMessage,
        failAssistantMessage,
      }),
      createConversationAi({
        streamReply: vi.fn().mockResolvedValue(
          (async function* () {
            yield "   ";
          })()
        ),
      }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-empty",
        content: "你好",
      })
    );

    expect(events.at(-1)).toEqual(
      expect.objectContaining({ type: "error", retryable: true })
    );
    expect(completeAssistantMessage).not.toHaveBeenCalled();
    expect(failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", content: "   " })
    );
  });

  it("bounds an oversized upstream response before persistence", async () => {
    const failAssistantMessage = vi.fn().mockImplementation(async (input) =>
      makeConversationMessage({
        id: TEST_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        parentMessageId: TEST_USER_MESSAGE_ID,
        content: input.content,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      })
    );
    const service = new ConversationMessageService(
      createConversationStore({ failAssistantMessage }),
      createConversationAi({
        streamReply: vi.fn().mockResolvedValue(
          (async function* () {
            yield "x".repeat(8_001);
          })()
        ),
      }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-oversized",
        content: "写一篇长文",
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "text_delta",
      "error",
    ]);
    expect(failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ content: "x".repeat(8_000), status: "failed" })
    );
  });

  it.each([
    {
      name: "budget exhaustion",
      error: new AiGatewayBudgetExceededError("额度不足"),
      code: "AI_GATEWAY_BUDGET_EXCEEDED",
      message: "额度不足",
    },
    {
      name: "rate limiting",
      error: new AiGatewayRateLimitedError(),
      code: "AI_GATEWAY_RATE_LIMITED",
      message: "AI 服务请求过于频繁，请稍后重试。",
    },
  ])("persists $name and emits a retryable SSE error", async ({ error, code, message }) => {
    const failAssistantMessage = vi.fn().mockImplementation(async (input) =>
      makeConversationMessage({
        id: TEST_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        parentMessageId: TEST_USER_MESSAGE_ID,
        status: input.status,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      })
    );
    const service = new ConversationMessageService(
      createConversationStore({ failAssistantMessage }),
      createConversationAi({ streamReply: vi.fn().mockRejectedValue(error) }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: `client-${code}`,
        content: "请翻译这句话",
      })
    );

    expect(events.at(-1)).toMatchObject({
      type: "error",
      code,
      message,
      retryable: true,
    });
    expect(failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ status: "failed", errorCode: code })
    );
  });

  it("restarts a failed assistant response in place", async () => {
    const user = makeConversationMessage({ mode: "zh_to_ja", content: "请改时间" });
    const failed = makeConversationMessage({
      id: TEST_ASSISTANT_MESSAGE_ID,
      role: "assistant",
      parentMessageId: user.id,
      mode: "zh_to_ja",
      status: "failed",
      content: "予約時間を",
    });
    const streaming = { ...failed, status: "streaming" as const, content: "" };
    const restartAssistantMessage = vi.fn().mockResolvedValue(streaming);
    const insertAssistantMessage = vi.fn();
    const service = new ConversationMessageService(
      createConversationStore({
        findMessage: vi.fn().mockImplementation(async (id) =>
          id === user.id ? user : failed
        ),
        restartAssistantMessage,
        insertAssistantMessage,
      }),
      createConversationAi({
        streamReply: vi.fn().mockResolvedValue(
          (async function* () {
            yield "予約時間を変更していただけますか。";
          })()
        ),
      }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "retry-client",
        content: user.content,
        mode: "zh_to_ja",
        retryParentMessageId: user.id,
        retryAssistantMessageId: failed.id,
      })
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "text_delta",
      "completed",
    ]);
    expect(restartAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ messageId: failed.id, mode: "zh_to_ja" })
    );
    expect(insertAssistantMessage).not.toHaveBeenCalled();
  });

  it("marks an aborted response as cancelled without emitting a retry error", async () => {
    const failAssistantMessage = vi.fn();
    const streamReply = vi.fn().mockImplementation(async (_messages, signal) => {
      expect(signal?.aborted).toBe(true);
      throw new DOMException("Aborted", "AbortError");
    });
    const service = new ConversationMessageService(
      createConversationStore({ failAssistantMessage }),
      createConversationAi({ streamReply }),
      createConversationGrammar()
    );
    const controller = new AbortController();
    controller.abort();

    const events = await readEvents(
      await service.streamMessage(
        TEST_SESSION_ID,
        { clientMessageId: "cancel-client", content: "继续" },
        controller.signal
      )
    );

    expect(events.map((event) => event.type)).toEqual(["assistant_created"]);
    expect(failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        errorCode: "GENERATION_CANCELLED",
      })
    );
  });

  it("persists cancellation after the consumer stops a partial stream", async () => {
    const failAssistantMessage = vi.fn();
    const streamReply = vi.fn().mockImplementation(async (_messages, signal) =>
      (async function* () {
        yield "部分回答";
        await new Promise<void>((resolve) =>
          signal?.addEventListener("abort", () => resolve(), { once: true })
        );
        throw new DOMException("Aborted", "AbortError");
      })()
    );
    const service = new ConversationMessageService(
      createConversationStore({ failAssistantMessage }),
      createConversationAi({ streamReply }),
      createConversationGrammar()
    );

    const stream = await service.streamMessage(TEST_SESSION_ID, {
      clientMessageId: "consumer-cancel-client",
      content: "继续",
    });
    const reader = stream.getReader();
    await reader.read();
    await reader.read();
    await reader.cancel();

    await vi.waitFor(() => {
      expect(failAssistantMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "部分回答",
          status: "cancelled",
          errorCode: "GENERATION_CANCELLED",
        })
      );
    });
  });

  it("does not start a second stream after losing the assistant insert race", async () => {
    const user = makeConversationMessage();
    const assistant = makeConversationMessage({
      id: TEST_ASSISTANT_MESSAGE_ID,
      role: "assistant",
      parentMessageId: user.id,
      status: "streaming",
      content: "",
    });
    const findMessageByClientId = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(assistant);
    const streamReply = vi.fn();
    const service = new ConversationMessageService(
      createConversationStore({
        insertAssistantMessage: vi.fn().mockResolvedValue(null),
        findMessageByClientId,
      }),
      createConversationAi({ streamReply }),
      createConversationGrammar()
    );

    const events = await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-race",
        content: "試してみます",
      })
    );

    expect(events.at(-1)).toEqual(
      expect.objectContaining({ type: "error", code: "MESSAGE_IN_PROGRESS" })
    );
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("grounds explicit grammar explanations with the existing concrete sense", async () => {
    const streamReply = vi.fn().mockResolvedValue(
      (async function* () {
        yield "并不是完全如此。";
      })()
    );
    const service = new ConversationMessageService(
      createConversationStore(),
      createConversationAi({ streamReply }),
      createConversationGrammar({
        searchGrammarPoints: vi.fn().mockResolvedValue({
          items: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              grammarPoint: "〜わけではない",
              canonicalForm: "〜わけではない",
              senseKey: "partial_negation",
              coreMeaning: "并非完全如此",
            },
          ],
        }),
        getGrammarPointDetail: vi.fn().mockResolvedValue({
          grammarPoint: {
            grammarPoint: "〜わけではない",
            canonicalForm: "〜わけではない",
            coreMeaning: "并非完全如此",
            naturalTranslation: "并不是……",
            structure: "普通形 + わけではない",
            usage: "否定过度结论",
            examples: [{ jp: "嫌いなわけではない。", zh: "并不是讨厌。" }],
          },
        }),
      })
    );

    await readEvents(
      await service.streamMessage(TEST_SESSION_ID, {
        clientMessageId: "client-grammar",
        content: "请解释「〜わけではない」",
        mode: "explain_ja",
      })
    );

    const messages = streamReply.mock.calls[0][0];
    expect(messages[0].content).toContain("嫌いなわけではない");
  });
});
