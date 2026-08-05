import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { consumeConversationEventStream } from "@/app/lib/conversation-stream";
import { ConversationService } from "@/features/conversation/application/ConversationService";
import type {
  ConversationMemory,
  ConversationMessage,
  ConversationSession,
  ConversationStreamEvent,
} from "@/shared/types/conversation";
import {
  AiGatewayBudgetExceededError,
  AiGatewayRateLimitedError,
  DependencyError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/errors";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
const ASSISTANT_MESSAGE_ID = "33333333-3333-4333-8333-333333333333";

const session: ConversationSession = {
  id: SESSION_ID,
  title: "新对话",
  mode: "zh_to_ja",
  summary: "用户正在准备预约改期。",
  summaryThroughAt: null,
  titleIsManual: false,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function message(
  overrides: Partial<ConversationMessage> & Pick<ConversationMessage, "id" | "role">
): ConversationMessage {
  const { id, role, ...rest } = overrides;
  return {
    id,
    sessionId: SESSION_ID,
    role,
    content: "",
    mode: "zh_to_ja",
    status: "completed",
    parentMessageId: null,
    modelName: null,
    errorCode: null,
    errorMessage: null,
    details: { nuanceNotes: [], keyPoints: [] },
    analysisStatus: "not_requested",
    createdAt: "2026-01-01T00:00:01.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
    completedAt: "2026-01-01T00:00:01.000Z",
    ...rest,
  };
}

const userMessage = message({
  id: USER_MESSAGE_ID,
  role: "user",
  content: "请问可以帮我改一下预约时间吗？",
});
const streamingAssistant = message({
  id: ASSISTANT_MESSAGE_ID,
  role: "assistant",
  status: "streaming",
  parentMessageId: USER_MESSAGE_ID,
  modelName: "openai/gpt-4.1-mini",
  completedAt: null,
});
const completedAssistant = message({
  ...streamingAssistant,
  id: ASSISTANT_MESSAGE_ID,
  role: "assistant",
  content: "予約時間を変更していただけますか。",
  status: "completed",
  analysisStatus: "not_requested",
});

const preferences = {
  defaultMode: "auto" as const,
  translationStyle: "natural_first" as const,
  defaultRegister: "polite" as const,
  defaultCollectionId: null,
};

function activeMemory(
  id: string,
  scope: ConversationMemory["scope"],
  content: string
): ConversationMemory {
  return {
    id,
    sessionId: scope === "session" ? SESSION_ID : null,
    scope,
    kind: "preference",
    content,
    status: "active",
    sourceMessageId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

function makeService(repository: Record<string, unknown>, aiClient: object) {
  return new ConversationService(
    repository as never,
    aiClient as never,
    {} as never,
    {} as never
  );
}

describe("ConversationService", () => {
  const originalApiKey = process.env.AI_GATEWAY_API_KEY;

  beforeEach(() => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
  });

  afterEach(() => {
    if (originalApiKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
    else process.env.AI_GATEWAY_API_KEY = originalApiKey;
  });

  it("streams a reply with confirmed global and session context", async () => {
    const completeAssistantMessage = vi.fn().mockResolvedValue(completedAssistant);
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockResolvedValue(null),
      insertUserMessage: vi.fn().mockResolvedValue(userMessage),
      insertAssistantMessage: vi.fn().mockResolvedValue(streamingAssistant),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([
        activeMemory("global", "global", "优先使用自然表达"),
        activeMemory("session", "session", "对方是医院前台"),
      ]),
      listContextMessages: vi.fn().mockResolvedValue([userMessage]),
      completeAssistantMessage,
      touchSession: vi.fn().mockResolvedValue(undefined),
      failAssistantMessage: vi.fn(),
    };
    const streamReply = vi.fn().mockImplementation(async () =>
      (async function* () {
        yield "予約時間を";
        yield "変更していただけますか。";
      })()
    );
    const service = makeService(repository, { streamReply });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "client-1",
      content: userMessage.content,
      mode: "zh_to_ja",
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "text_delta",
      "text_delta",
      "completed",
    ]);
    expect(completeAssistantMessage).toHaveBeenCalledWith(
      ASSISTANT_MESSAGE_ID,
      USER_ID,
      completedAssistant.content
    );
    const gatewayMessages = streamReply.mock.calls[0][0];
    expect(gatewayMessages[0].content).toContain("优先使用自然表达");
    expect(gatewayMessages[0].content).toContain("对方是医院前台");
    expect(gatewayMessages.at(-1)).toMatchObject({
      role: "user",
      content: userMessage.content,
    });
    expect(repository.insertAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({ clientMessageId: "assistant:client-1" })
    );
  });

  it("grounds explicit grammar explanations with the existing grammar detail", async () => {
    const explicitUser = {
      ...userMessage,
      content: "「〜わけではない」の使い方を説明してください。",
      mode: "explain_ja" as const,
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue({
        ...session,
        mode: "explain_ja" as const,
      }),
      findMessageByClientId: vi.fn().mockResolvedValue(null),
      insertUserMessage: vi.fn().mockResolvedValue(explicitUser),
      insertAssistantMessage: vi.fn().mockResolvedValue({
        ...streamingAssistant,
        mode: "explain_ja" as const,
      }),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([]),
      listContextMessages: vi.fn().mockResolvedValue([explicitUser]),
      completeAssistantMessage: vi.fn().mockResolvedValue(completedAssistant),
      touchSession: vi.fn().mockResolvedValue(undefined),
      failAssistantMessage: vi.fn(),
    };
    const streamReply = vi.fn().mockImplementation(async () =>
      (async function* () {
        yield "并不是完全如此。";
      })()
    );
    const grammarLearningService = {
      searchGrammarPoints: vi.fn().mockResolvedValue({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            grammarPoint: "〜わけではない",
            canonicalForm: "〜わけではない",
            senseKey: "wake_dewa_nai_partial_negation",
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
          examples: [
            {
              jp: "甘いものが嫌いなわけではありません。",
              zh: "并不是讨厌甜食。",
            },
          ],
        },
      }),
    };
    const service = new ConversationService(
      repository as never,
      { streamReply } as never,
      {} as never,
      grammarLearningService as never
    );

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "grammar-grounding",
      content: explicitUser.content,
      mode: "explain_ja",
    });
    await consumeConversationEventStream(new Response(stream), () => undefined);

    expect(grammarLearningService.searchGrammarPoints).toHaveBeenCalledWith(
      expect.objectContaining({ query: "わけではない" })
    );
    expect(grammarLearningService.getGrammarPointDetail).toHaveBeenCalledWith(
      "55555555-5555-4555-8555-555555555555",
      USER_ID
    );
    expect(streamReply.mock.calls[0][0][0].content).toContain(
      "甘いものが嫌いなわけではありません。"
    );
  });

  it("replays a completed idempotent request without calling AI again", async () => {
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockImplementation(
        (_sessionId: string, _userId: string, clientMessageId: string) =>
          Promise.resolve(
            clientMessageId === "client-1" ? userMessage : completedAssistant
          )
      ),
      insertUserMessage: vi.fn(),
      insertAssistantMessage: vi.fn(),
    };
    const streamReply = vi.fn();
    const service = makeService(repository, { streamReply });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "client-1",
      content: userMessage.content,
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "completed",
    ]);
    expect(streamReply).not.toHaveBeenCalled();
    expect(repository.insertUserMessage).not.toHaveBeenCalled();
    expect(repository.insertAssistantMessage).not.toHaveBeenCalled();
  });

  it("does not start a second stream after losing the assistant insert race", async () => {
    let assistantReads = 0;
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockImplementation(
        (_sessionId: string, _userId: string, clientMessageId: string) => {
          if (clientMessageId === "client-race") return Promise.resolve(userMessage);
          assistantReads += 1;
          return Promise.resolve(
            assistantReads === 1 ? null : completedAssistant
          );
        }
      ),
      insertUserMessage: vi.fn(),
      insertAssistantMessage: vi.fn().mockResolvedValue(null),
    };
    const streamReply = vi.fn();
    const service = makeService(repository, { streamReply });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "client-race",
      content: userMessage.content,
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "completed",
    ]);
    expect(repository.insertAssistantMessage).toHaveBeenCalledTimes(1);
    expect(streamReply).not.toHaveBeenCalled();
  });

  it("persists a Gateway budget failure and emits a retryable SSE error", async () => {
    const failedAssistant = {
      ...streamingAssistant,
      status: "failed" as const,
      errorCode: "AI_GATEWAY_BUDGET_EXCEEDED",
      errorMessage: "额度不足",
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockResolvedValue(null),
      insertUserMessage: vi.fn().mockResolvedValue(userMessage),
      insertAssistantMessage: vi.fn().mockResolvedValue(streamingAssistant),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([]),
      listContextMessages: vi.fn().mockResolvedValue([userMessage]),
      failAssistantMessage: vi.fn().mockResolvedValue(failedAssistant),
    };
    const service = makeService(repository, {
      streamReply: vi
        .fn()
        .mockRejectedValue(new AiGatewayBudgetExceededError("额度不足")),
    });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "budget-client",
      content: userMessage.content,
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "error",
    ]);
    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "AI_GATEWAY_BUDGET_EXCEEDED",
      retryable: true,
    });
    expect(repository.failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        errorCode: "AI_GATEWAY_BUDGET_EXCEEDED",
      })
    );
  });

  it("surfaces a Gateway rate limit as a retryable SSE error", async () => {
    const failedAssistant = {
      ...streamingAssistant,
      status: "failed" as const,
      errorCode: "AI_GATEWAY_RATE_LIMITED",
      errorMessage: "AI 服务请求过于频繁，请稍后重试。",
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockResolvedValue(null),
      insertUserMessage: vi.fn().mockResolvedValue(userMessage),
      insertAssistantMessage: vi.fn().mockResolvedValue(streamingAssistant),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([]),
      listContextMessages: vi.fn().mockResolvedValue([userMessage]),
      failAssistantMessage: vi.fn().mockResolvedValue(failedAssistant),
    };
    const service = makeService(repository, {
      streamReply: vi.fn().mockRejectedValue(new AiGatewayRateLimitedError()),
    });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "rate-limit-client",
      content: userMessage.content,
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.at(-1)).toMatchObject({
      type: "error",
      code: "AI_GATEWAY_RATE_LIMITED",
      message: "AI 服务请求过于频繁，请稍后重试。",
      retryable: true,
    });
  });

  it("restarts a failed assistant message in place", async () => {
    const failedAssistant = {
      ...streamingAssistant,
      status: "failed" as const,
      content: "予約時間を",
      errorCode: "AI_RESPONSE_FAILED",
      errorMessage: "回答生成失败，请重试。",
    };
    const restartAssistantMessage = vi
      .fn()
      .mockResolvedValue(streamingAssistant);
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : failedAssistant
        )
      ),
      restartAssistantMessage,
      insertAssistantMessage: vi.fn(),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([]),
      listContextMessages: vi.fn().mockResolvedValue([userMessage]),
      completeAssistantMessage: vi.fn().mockResolvedValue(completedAssistant),
      touchSession: vi.fn().mockResolvedValue(undefined),
      failAssistantMessage: vi.fn(),
    };
    const service = makeService(repository, {
      streamReply: vi.fn().mockImplementation(async () =>
        (async function* () {
          yield completedAssistant.content;
        })()
      ),
    });

    const stream = await service.streamMessage(SESSION_ID, {
      clientMessageId: "retry-client",
      content: userMessage.content,
      retryParentMessageId: USER_MESSAGE_ID,
      retryAssistantMessageId: ASSISTANT_MESSAGE_ID,
    });
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "text_delta",
      "completed",
    ]);
    expect(
      events.find((event) => event.type === "assistant_created")
    ).toMatchObject({
      assistantMessage: { id: ASSISTANT_MESSAGE_ID, status: "streaming" },
    });
    expect(restartAssistantMessage).toHaveBeenCalledWith({
      messageId: ASSISTANT_MESSAGE_ID,
      userId: USER_ID,
      mode: "zh_to_ja",
      modelName: expect.any(String),
    });
    expect(repository.insertAssistantMessage).not.toHaveBeenCalled();
  });

  it("marks an aborted generation as cancelled without starting analysis", async () => {
    const cancelledAssistant = {
      ...streamingAssistant,
      status: "cancelled" as const,
      errorCode: "GENERATION_CANCELLED",
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessageByClientId: vi.fn().mockResolvedValue(null),
      insertUserMessage: vi.fn().mockResolvedValue(userMessage),
      insertAssistantMessage: vi.fn().mockResolvedValue(streamingAssistant),
      getPreferences: vi.fn().mockResolvedValue(preferences),
      listActiveMemories: vi.fn().mockResolvedValue([]),
      listContextMessages: vi.fn().mockResolvedValue([userMessage]),
      failAssistantMessage: vi.fn().mockResolvedValue(cancelledAssistant),
    };
    const streamReply = vi.fn().mockImplementation(async (_messages, signal) => {
      expect(signal.aborted).toBe(true);
      throw new DOMException("Aborted", "AbortError");
    });
    const service = makeService(repository, { streamReply });
    const requestController = new AbortController();
    requestController.abort();

    const stream = await service.streamMessage(
      SESSION_ID,
      { clientMessageId: "cancel-client", content: userMessage.content },
      requestController.signal
    );
    const events: ConversationStreamEvent[] = [];
    await consumeConversationEventStream(new Response(stream), (event) =>
      events.push(event)
    );

    expect(events.map((event) => event.type)).toEqual(["assistant_created"]);
    expect(repository.failAssistantMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "cancelled",
        errorCode: "GENERATION_CANCELLED",
      })
    );
  });

  it("does not load messages when a session is outside the current user scope", async () => {
    const repository = {
      findSession: vi.fn().mockResolvedValue(null),
      listMessages: vi.fn(),
      listMemories: vi.fn(),
      listLearningItems: vi.fn(),
    };
    const service = makeService(repository, {});

    await expect(service.getSession(SESSION_ID)).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(repository.findSession).toHaveBeenCalledWith(SESSION_ID, USER_ID);
    expect(repository.listMessages).not.toHaveBeenCalled();
  });

  it("passes only supplied preference fields to an atomic repository update", async () => {
    const repository = {
      updatePreferences: vi.fn().mockResolvedValue({
        ...preferences,
        defaultMode: "ja_to_zh",
      }),
    };
    const service = makeService(repository, {});

    await service.updatePreferences({ defaultMode: "ja_to_zh" });

    expect(repository.updatePreferences).toHaveBeenCalledWith(USER_ID, {
      defaultMode: "ja_to_zh",
    });
  });

  it("rejects malformed message cursors before querying paginated rows", async () => {
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      listMessages: vi.fn(),
      listMemories: vi.fn(),
      listLearningItems: vi.fn(),
    };
    const service = makeService(repository, {});
    const malformedCursor = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", id: "not-a-uuid" })
    ).toString("base64url");

    await expect(
      service.getSession(SESSION_ID, malformedCursor)
    ).rejects.toBeInstanceOf(ValidationError);
    expect(repository.listMessages).not.toHaveBeenCalled();
  });

  it("creates an on-demand analysis and resolves grammar candidates", async () => {
    const analysisRecord = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MESSAGE_ID,
      revision: 12,
      status: "running" as const,
      focus: "grammar" as const,
      instruction: "只看请求语法",
      overview: "",
      isCurrent: false,
      modelName: "openai/gpt-4.1-nano",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:02.000Z",
      updatedAt: "2026-01-01T00:00:02.000Z",
      completedAt: null,
    };
    const learningItem = {
      id: "44444444-4444-4444-8444-444444444444",
      sessionId: SESSION_ID,
      sourceMessageId: ASSISTANT_MESSAGE_ID,
      analysisId: analysisRecord.id,
      kind: "grammar" as const,
      surfaceForm: "〜ていただけますか",
      reading: null,
      meaningZh: "可以请您……吗",
      explanationZh: "礼貌请求",
      sourceExcerpt: "変更していただけますか",
      status: "suggested" as const,
      grammarCandidates: [],
      wordId: null,
      grammarPointId: null,
      collectionId: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : completedAssistant
        )
      ),
      findAnalysisByClientId: vi.fn().mockResolvedValue(null),
      createAnalysis: vi.fn().mockResolvedValue(analysisRecord),
      listLearningItems: vi.fn().mockResolvedValue([]),
      insertLearningItem: vi.fn().mockImplementation((input) =>
        Promise.resolve({ ...learningItem, grammarCandidates: input.grammarCandidates })
      ),
      completeAnalysisRecord: vi.fn().mockResolvedValue({
        ...analysisRecord,
        status: "completed",
        overview: "这是礼貌请求表达。",
        isCurrent: true,
      }),
      failAnalysisRecord: vi.fn(),
    };
    const aiClient = {
      analyze: vi.fn().mockResolvedValue({
        overview: "这是礼貌请求表达。",
        learningItems: [
          {
            kind: "grammar",
            surfaceForm: "〜ていただけますか",
            reading: null,
            meaningZh: "可以请您……吗",
            explanationZh: "礼貌请求",
            sourceExcerpt: "変更していただけますか",
          },
          {
            kind: "vocabulary",
            surfaceForm: "変更する",
            reading: "へんこうする",
            meaningZh: "更改",
            explanationZh: "常用动词",
            sourceExcerpt: "変更して",
          },
        ],
      }),
    };
    const grammarLearningService = {
      searchGrammarPoints: vi.fn().mockResolvedValue({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            grammarPoint: "〜ていただけますか",
            canonicalForm: "〜ていただけますか",
            senseKey: "request_te_itadakemasu_ka",
            coreMeaning: "礼貌请求对方做某事",
          },
          {
            id: "66666666-6666-4666-8666-666666666666",
            grammarPoint: "〜ていただけないでしょうか",
            canonicalForm: "〜ていただけないでしょうか",
            senseKey: "request_te_itadakenai_deshou_ka",
            coreMeaning: "更郑重地请求对方做某事",
          },
        ],
      }),
    };
    const service = new ConversationService(
      repository as never,
      aiClient as never,
      {} as never,
      grammarLearningService as never
    );

    const result = await service.analyzeMessage(
      SESSION_ID,
      ASSISTANT_MESSAGE_ID,
      {
        clientAnalysisId: "analysis-client-1",
        focus: "grammar",
        instruction: "只看请求语法",
      }
    );

    expect(result.analysis).toMatchObject({
      status: "completed",
      overview: "这是礼貌请求表达。",
    });
    expect(aiClient.analyze).toHaveBeenCalledWith({
      session,
      messages: [userMessage, completedAssistant],
      focus: "grammar",
      instruction: "只看请求语法",
    });
    expect(grammarLearningService.searchGrammarPoints).toHaveBeenCalledWith(
      expect.objectContaining({ query: "ていただけますか" })
    );
    expect(repository.insertLearningItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "suggested",
        analysisId: analysisRecord.id,
        grammarCandidates: [
          expect.objectContaining({
            senseKey: "request_te_itadakemasu_ka",
          }),
        ],
      })
    );
    expect(repository.insertLearningItem).toHaveBeenCalledTimes(1);
    expect(repository.failAnalysisRecord).not.toHaveBeenCalled();
  });

  it("allows a new analysis version to replace an undecided earlier candidate", async () => {
    const historicalAssistant = message({
      id: "77777777-7777-4777-8777-777777777777",
      role: "assistant",
      content: "予約時間を変更していただけますか。",
      parentMessageId: "88888888-8888-4888-8888-888888888888",
      analysisStatus: "completed",
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    const historicalItem = {
      id: "99999999-9999-4999-8999-999999999999",
      sessionId: SESSION_ID,
      sourceMessageId: historicalAssistant.id,
      analysisId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
      kind: "grammar" as const,
      surfaceForm: "〜ていただけますか",
      reading: null,
      meaningZh: "可以请您……吗",
      explanationZh: "礼貌请求",
      sourceExcerpt: "変更していただけますか",
      status: "suggested" as const,
      grammarCandidates: [
        {
          grammarPointId: "55555555-5555-4555-8555-555555555555",
          grammarPoint: "〜ていただけますか",
          canonicalForm: "〜ていただけますか",
          senseKey: "request_te_itadakemasu_ka",
          coreMeaning: "礼貌请求对方做某事",
        },
      ],
      wordId: null,
      grammarPointId: null,
      collectionId: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const analysisRecord = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MESSAGE_ID,
      revision: 13,
      status: "running" as const,
      focus: "all" as const,
      instruction: "换个角度分析",
      overview: "",
      isCurrent: false,
      modelName: "openai/gpt-4.1-nano",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:02.000Z",
      updatedAt: "2026-01-01T00:00:02.000Z",
      completedAt: null,
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : completedAssistant
        )
      ),
      findAnalysisByClientId: vi.fn().mockResolvedValue(null),
      createAnalysis: vi.fn().mockResolvedValue(analysisRecord),
      listLearningItems: vi.fn().mockResolvedValue([historicalItem]),
      insertLearningItem: vi.fn().mockImplementation((input) =>
        Promise.resolve({ ...historicalItem, id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", ...input })
      ),
      completeAnalysisRecord: vi.fn().mockResolvedValue({
        ...analysisRecord,
        status: "completed",
        overview: "重新分析完成。",
        isCurrent: true,
      }),
      failAnalysisRecord: vi.fn(),
    };
    const aiClient = {
      analyze: vi.fn().mockResolvedValue({
        overview: "重新分析完成。",
        learningItems: [
          {
            kind: "grammar",
            surfaceForm: "～ていただけますか",
            reading: null,
            meaningZh: "礼貌地请求对方做某事",
            explanationZh: "礼貌请求",
            sourceExcerpt: "変更していただけますか",
          },
        ],
      }),
    };
    const grammarLearningService = {
      searchGrammarPoints: vi.fn().mockResolvedValue({
        items: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            grammarPoint: "〜ていただけますか",
            canonicalForm: "〜ていただけますか",
            senseKey: "request_te_itadakemasu_ka",
            coreMeaning: "礼貌请求对方做某事",
          },
        ],
      }),
    };
    const service = new ConversationService(
      repository as never,
      aiClient as never,
      {} as never,
      grammarLearningService as never
    );

    const result = await service.analyzeMessage(
      SESSION_ID,
      ASSISTANT_MESSAGE_ID,
      {
        clientAnalysisId: "analysis-client-2",
        instruction: "换个角度分析",
      }
    );

    expect(result.learningItems).toHaveLength(1);
    expect(repository.insertLearningItem).toHaveBeenCalledWith(
      expect.objectContaining({ analysisId: analysisRecord.id })
    );
    expect(grammarLearningService.searchGrammarPoints).toHaveBeenCalledTimes(1);
    expect(aiClient.analyze).toHaveBeenCalledWith({
      session,
      messages: [userMessage, completedAssistant],
      focus: "all",
      instruction: "换个角度分析",
    });
  });

  it("maintains title and summary while catching up missed recent turns", async () => {
    const initialSession = { ...session, summary: "" };
    const missedUser = message({
      id: "12121212-1212-4212-8212-121212121212",
      role: "user",
      content: "先确认一下时间。",
      createdAt: "2026-01-01T00:00:00.200Z",
    });
    const missedAssistant = message({
      id: "13131313-1313-4313-8313-131313131313",
      role: "assistant",
      content: "好的，请告诉我希望的时间。",
      parentMessageId: missedUser.id,
      createdAt: "2026-01-01T00:00:00.500Z",
    });
    const repository = {
      findSession: vi.fn().mockResolvedValue(initialSession),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : completedAssistant
        )
      ),
      listContextMessages: vi
        .fn()
        .mockResolvedValue([
          missedUser,
          missedAssistant,
          userMessage,
          completedAssistant,
        ]),
      listMemories: vi.fn().mockResolvedValue([]),
      insertMemory: vi.fn(),
      updateSummary: vi.fn().mockResolvedValue({
        ...initialSession,
        title: userMessage.content,
        summary: "已给出预约改期表达。",
      }),
    };
    const aiClient = {
      maintainSession: vi.fn().mockResolvedValue({
        title: "新对话",
        summary: "已给出预约改期表达。",
        memories: [],
      }),
    };
    const service = makeService(repository, aiClient);

    await service.maintainSession(SESSION_ID, ASSISTANT_MESSAGE_ID);

    expect(repository.updateSummary).toHaveBeenCalledWith(
      expect.objectContaining({ title: missedUser.content })
    );
    expect(aiClient.maintainSession).toHaveBeenCalledWith({
      session: initialSession,
      messages: [
        missedUser,
        missedAssistant,
        userMessage,
        completedAssistant,
      ],
    });
    expect(repository.insertMemory).not.toHaveBeenCalled();
  });

  it("replays completed maintenance with both global and session suggestions", async () => {
    const maintainedSession = {
      ...session,
      summaryThroughAt: completedAssistant.createdAt,
    };
    const globalSuggestion = {
      ...activeMemory("global-suggestion", "global", "偏好商务表达"),
      status: "suggested" as const,
      sourceMessageId: ASSISTANT_MESSAGE_ID,
    };
    const sessionSuggestion = {
      ...activeMemory("session-suggestion", "session", "对方是医院前台"),
      status: "suggested" as const,
      sourceMessageId: ASSISTANT_MESSAGE_ID,
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(maintainedSession),
      findMessage: vi.fn().mockResolvedValue(completedAssistant),
      listMemories: vi.fn().mockImplementation(
        (_userId: string, sessionId: string | null) =>
          Promise.resolve(
            sessionId === null ? [globalSuggestion] : [sessionSuggestion]
          )
      ),
    };
    const aiClient = { maintainSession: vi.fn() };
    const service = makeService(repository, aiClient);

    const result = await service.maintainSession(
      SESSION_ID,
      ASSISTANT_MESSAGE_ID
    );

    expect(result.memories).toEqual([globalSuggestion, sessionSuggestion]);
    expect(repository.listMemories).toHaveBeenCalledWith(USER_ID, null);
    expect(repository.listMemories).toHaveBeenCalledWith(USER_ID, SESSION_ID);
    expect(aiClient.maintainSession).not.toHaveBeenCalled();
  });

  it("reclaims a failed analysis with the same idempotency key", async () => {
    const failedAnalysis = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa04",
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MESSAGE_ID,
      revision: 15,
      status: "failed" as const,
      focus: "grammar" as const,
      instruction: "只看尝试表达",
      overview: "",
      isCurrent: false,
      modelName: "openai/gpt-4.1-nano",
      errorCode: "ANALYSIS_FAILED",
      errorMessage: "学习分析失败，请重试。",
      createdAt: "2026-01-01T00:00:02.000Z",
      updatedAt: "2026-01-01T00:00:03.000Z",
      completedAt: "2026-01-01T00:00:03.000Z",
    };
    const runningAnalysis = {
      ...failedAnalysis,
      status: "running" as const,
      errorCode: null,
      errorMessage: null,
      completedAt: null,
    };
    const repository = {
      findAnalysisByClientId: vi.fn().mockResolvedValue(failedAnalysis),
      reclaimAnalysis: vi.fn().mockResolvedValue(runningAnalysis),
      findSession: vi.fn().mockResolvedValue(session),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : completedAssistant
        )
      ),
      createAnalysis: vi.fn(),
      listLearningItems: vi.fn().mockResolvedValue([]),
      completeAnalysisRecord: vi.fn().mockResolvedValue({
        ...runningAnalysis,
        status: "completed",
        overview: "重点是礼貌请求。",
        isCurrent: true,
      }),
      failAnalysisRecord: vi.fn(),
    };
    const aiClient = {
      analyze: vi.fn().mockResolvedValue({
        overview: "重点是礼貌请求。",
        learningItems: [],
      }),
    };
    const service = makeService(repository, aiClient);

    const result = await service.analyzeMessage(
      SESSION_ID,
      ASSISTANT_MESSAGE_ID,
      {
        clientAnalysisId: "analysis-client-retry",
        focus: "grammar",
        instruction: "只看尝试表达",
      }
    );

    expect(result.analysis.status).toBe("completed");
    expect(repository.reclaimAnalysis).toHaveBeenCalledWith({
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MESSAGE_ID,
      userId: USER_ID,
      clientAnalysisId: "analysis-client-retry",
    });
    expect(repository.createAnalysis).not.toHaveBeenCalled();
  });

  it("marks a failed on-demand analysis and removes its partial candidates", async () => {
    const analysisRecord = {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa03",
      sessionId: SESSION_ID,
      messageId: ASSISTANT_MESSAGE_ID,
      revision: 14,
      status: "running" as const,
      focus: "all" as const,
      instruction: "",
      overview: "",
      isCurrent: false,
      modelName: "openai/gpt-4.1-nano",
      errorCode: null,
      errorMessage: null,
      createdAt: "2026-01-01T00:00:02.000Z",
      updatedAt: "2026-01-01T00:00:02.000Z",
      completedAt: null,
    };
    const repository = {
      findSession: vi.fn().mockResolvedValue(session),
      findMessage: vi.fn().mockImplementation((messageId: string) =>
        Promise.resolve(
          messageId === USER_MESSAGE_ID ? userMessage : completedAssistant
        )
      ),
      findAnalysisByClientId: vi.fn().mockResolvedValue(null),
      createAnalysis: vi.fn().mockResolvedValue(analysisRecord),
      failAnalysisRecord: vi.fn().mockResolvedValue({
        ...analysisRecord,
        status: "failed",
      }),
    };
    const service = makeService(repository, {
      analyze: vi.fn().mockResolvedValue(null),
    });

    await expect(
      service.analyzeMessage(SESSION_ID, ASSISTANT_MESSAGE_ID, {
        clientAnalysisId: "analysis-client-3",
      })
    ).rejects.toBeInstanceOf(DependencyError);
    expect(repository.failAnalysisRecord).toHaveBeenCalledWith(
      analysisRecord.id,
      USER_ID,
      "ANALYSIS_FAILED",
      "学习分析失败，请重试。"
    );
  });
});
