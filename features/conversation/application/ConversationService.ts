import {
  MAX_CONTEXT_MESSAGES,
  MAX_CONVERSATION_INPUT_LENGTH,
  buildConversationFallbackTitle,
  buildConversationGrammarSearchQuery,
  conversationLearningItemKey,
  extractExplicitConversationGrammarForms,
  isConversationMode,
  selectConversationGrammarCandidates,
  trimConversationContextMessages,
} from "@/features/conversation/domain/conversation";
import { assertUuid, isUuid } from "@/features/conversation/domain/validation";
import type { ConversationAiClient } from "@/features/conversation/infrastructure/ConversationAiClient";
import type { ConversationRepository } from "@/features/conversation/infrastructure/ConversationRepository";
import {
  buildConversationSystemPrompt,
  type ConversationGrammarPromptReference,
} from "@/features/conversation/prompts/conversation";
import {
  hasAiGatewayCredentials,
  resolveAiTextModel,
  type AiGatewayInputMessage,
} from "@/shared/ai/gateway";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type { CollectionService } from "@/features/collections/application/CollectionService";
import type { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import type {
  ConversationAnalysisResponse,
  ConversationBootstrapResponse,
  ConversationGrammarCandidate,
  ConversationMessage,
  ConversationMode,
  ConversationRegister,
  ConversationSessionResponse,
  ConversationStreamEvent,
  CreateConversationMemoryRequest,
  SendConversationMessageRequest,
  UpdateConversationMemoryRequest,
  UpdateConversationPreferencesRequest,
  UpdateConversationSessionRequest,
} from "@/shared/types/conversation";
import {
  AppError,
  ConfigurationError,
  DependencyError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/errors";

const SESSION_PAGE_SIZE = 30;
const MESSAGE_PAGE_SIZE = 50;

function encodeCursor(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function decodeCursor<T extends object>(cursor?: string | null): T | null {
  if (!cursor?.trim()) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as T;
  } catch {
    throw new ValidationError("cursor is invalid");
  }
}

function assertCursorPosition(
  cursor: { id?: unknown; updatedAt?: unknown; createdAt?: unknown } | null
) {
  if (!cursor) return;
  const timestamp = cursor.updatedAt ?? cursor.createdAt;
  if (
    typeof cursor.id !== "string" ||
    !isUuid(cursor.id) ||
    typeof timestamp !== "string" ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new ValidationError("cursor is invalid");
  }
}

function normalizeMode(value: unknown, fallback: ConversationMode): ConversationMode {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (!isConversationMode(value)) {
    throw new ValidationError("mode is invalid");
  }
  return value;
}

function normalizeRegister(value: unknown): ConversationRegister {
  if (
    value === "auto" ||
    value === "casual" ||
    value === "polite" ||
    value === "business"
  ) {
    return value;
  }
  throw new ValidationError("defaultRegister is invalid");
}

function toSse(event: ConversationStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function replayMessageStream(
  userMessage: ConversationMessage,
  assistantMessage: ConversationMessage
) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          toSse({ type: "assistant_created", userMessage, assistantMessage })
        )
      );
      if (assistantMessage.status === "completed") {
        controller.enqueue(
          encoder.encode(toSse({ type: "completed", message: assistantMessage }))
        );
      } else {
        controller.enqueue(
          encoder.encode(
            toSse({
              type: "error",
              code:
                assistantMessage.status === "streaming"
                  ? "MESSAGE_IN_PROGRESS"
                  : assistantMessage.errorCode ?? "AI_RESPONSE_FAILED",
              message:
                assistantMessage.status === "streaming"
                  ? "这条消息仍在生成中。"
                  : assistantMessage.errorMessage ?? "回答生成失败，请重试。",
              retryable: assistantMessage.status !== "streaming",
              assistantMessage,
            })
          )
        );
      }
      controller.close();
    },
  });
}

async function loadConversationGrammarReferences(
  grammarLearningService: GrammarLearningService,
  content: string,
  mode: ConversationMode,
  userId: string
): Promise<ConversationGrammarPromptReference[]> {
  if (mode !== "explain_ja") {
    return [];
  }
  const requests = extractExplicitConversationGrammarForms(content).slice(0, 2);
  const references = await Promise.all(
    requests.map(async (request) => {
      try {
        const search = await grammarLearningService.searchGrammarPoints({
          query: buildConversationGrammarSearchQuery(request.surfaceForm),
          limit: 5,
          userId,
        });
        const candidates = selectConversationGrammarCandidates(
          request.surfaceForm,
          search.items.map((candidate) => ({
            grammarPointId: candidate.id,
            grammarPoint: candidate.grammarPoint,
            canonicalForm: candidate.canonicalForm,
            senseKey: candidate.senseKey,
            coreMeaning: candidate.coreMeaning,
          }))
        );
        if (candidates.length !== 1) {
          return null;
        }
        const { grammarPoint } =
          await grammarLearningService.getGrammarPointDetail(
            candidates[0].grammarPointId,
            userId
          );
        return {
          grammarPoint: grammarPoint.grammarPoint,
          canonicalForm: grammarPoint.canonicalForm,
          coreMeaning: grammarPoint.coreMeaning,
          naturalTranslation: grammarPoint.naturalTranslation ?? null,
          structure: grammarPoint.structure ?? null,
          usage: grammarPoint.usage ?? null,
          examples: grammarPoint.examples.slice(0, 3).map((example) => ({
            jp: example.jp,
            zh: example.zh ?? null,
          })),
        } satisfies ConversationGrammarPromptReference;
      } catch {
        return null;
      }
    })
  );
  return references.filter(
    (reference): reference is ConversationGrammarPromptReference =>
      reference !== null
  );
}

function resolveConversationAnalysisTitle(input: {
  session: { title: string; summary: string; titleIsManual: boolean };
  suggestedTitle: string | null;
  firstUserMessage: string | null;
}) {
  if (
    input.session.titleIsManual ||
    input.session.summary.trim() ||
    !input.firstUserMessage
  ) {
    return input.suggestedTitle;
  }
  const suggestedTitle = input.suggestedTitle?.trim() ?? "";
  if (
    !suggestedTitle ||
    suggestedTitle === "新对话" ||
    suggestedTitle === input.session.title
  ) {
    return buildConversationFallbackTitle(input.firstUserMessage);
  }
  return suggestedTitle;
}

export class ConversationService {
  constructor(
    private readonly repository: ConversationRepository,
    private readonly aiClient: ConversationAiClient,
    private readonly collectionService: CollectionService,
    private readonly grammarLearningService: GrammarLearningService
  ) {}

  async bootstrap(
    options?: { query?: string; cursor?: string | null },
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationBootstrapResponse> {
    const cursor = decodeCursor<{ updatedAt: string; id: string }>(options?.cursor);
    assertCursorPosition(cursor);
    const [sessionRows, preferences, globalMemories, collections] = await Promise.all([
      this.repository.listSessions({
        userId,
        query: options?.query?.trim(),
        cursor,
        limit: SESSION_PAGE_SIZE + 1,
      }),
      this.repository.getPreferences(userId),
      this.repository.listMemories(userId, null),
      this.collectionService.listCollections(),
    ]);
    const hasMore = sessionRows.length > SESSION_PAGE_SIZE;
    const sessions = sessionRows.slice(0, SESSION_PAGE_SIZE);
    const lastSession = sessions.at(-1);

    return {
      aiAvailable: hasAiGatewayCredentials(),
      sessions,
      nextCursor:
        hasMore && lastSession
          ? encodeCursor({ updatedAt: lastSession.updatedAt, id: lastSession.id })
          : null,
      preferences,
      globalMemories,
      collections,
    };
  }

  async createSession(
    requestedMode?: unknown,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    const preferences = await this.repository.getPreferences(userId);
    const session = await this.repository.createSession(
      userId,
      normalizeMode(requestedMode, preferences.defaultMode)
    );
    if (!session) {
      throw new DependencyError("failed to create conversation session");
    }
    return session;
  }

  async getSession(
    sessionId: string,
    cursor?: string | null,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationSessionResponse> {
    assertUuid(sessionId, "sessionId");
    const session = await this.repository.findSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError("未找到这个对话。");
    }
    const decodedCursor = decodeCursor<{ createdAt: string; id: string }>(cursor);
    assertCursorPosition(decodedCursor);
    const [messageRows, memories, learningItems] = await Promise.all([
      this.repository.listMessages({
        sessionId,
        userId,
        cursor: decodedCursor,
        limit: MESSAGE_PAGE_SIZE + 1,
      }),
      this.repository.listMemories(userId, sessionId),
      this.repository.listLearningItems(sessionId, userId),
    ]);
    const hasOlder = messageRows.length > MESSAGE_PAGE_SIZE;
    const messages = hasOlder ? messageRows.slice(1) : messageRows;
    const firstMessage = messages[0];

    return {
      session,
      messages,
      memories,
      learningItems,
      olderMessagesCursor:
        hasOlder && firstMessage
          ? encodeCursor({ createdAt: firstMessage.createdAt, id: firstMessage.id })
          : null,
    };
  }

  async updateSession(
    sessionId: string,
    input: UpdateConversationSessionRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    assertUuid(sessionId, "sessionId");
    const current = await this.repository.findSession(sessionId, userId);
    if (!current) {
      throw new NotFoundError("未找到这个对话。");
    }
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title || title.length > 80) {
      throw new ValidationError("标题长度应为 1 到 80 个字符。");
    }
    const next = await this.repository.updateSession({
      sessionId,
      userId,
      title,
      mode: normalizeMode(input.mode, current.mode),
      titleIsManual: input.title === undefined ? current.titleIsManual : true,
    });
    if (!next) {
      throw new NotFoundError("未找到这个对话。");
    }
    return next;
  }

  async deleteSession(sessionId: string, userId = DEFAULT_GRAMMAR_USER_ID) {
    assertUuid(sessionId, "sessionId");
    if (!(await this.repository.deleteSession(sessionId, userId))) {
      throw new NotFoundError("未找到这个对话。");
    }
  }

  async updatePreferences(
    input: UpdateConversationPreferencesRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    const next: UpdateConversationPreferencesRequest = {};
    if (input.defaultMode !== undefined) {
      next.defaultMode = normalizeMode(input.defaultMode, "auto");
    }
    if (input.defaultRegister !== undefined) {
      next.defaultRegister = normalizeRegister(input.defaultRegister);
    }
    if (input.defaultCollectionId !== undefined) {
      const defaultCollectionId = input.defaultCollectionId;
      if (
        defaultCollectionId !== null &&
        (!Number.isInteger(defaultCollectionId) || defaultCollectionId <= 0)
      ) {
        throw new ValidationError("defaultCollectionId is invalid");
      }
      if (defaultCollectionId !== null) {
        await this.collectionService.getCollectionDetail(defaultCollectionId);
      }
      next.defaultCollectionId = defaultCollectionId;
    }
    return this.repository.updatePreferences(userId, next);
  }

  async createMemory(
    input: CreateConversationMemoryRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    const content = input.content?.trim();
    if (!content || content.length > 300) {
      throw new ValidationError("记忆长度应为 1 到 300 个字符。");
    }
    if (input.scope !== "global" && input.scope !== "session") {
      throw new ValidationError("memory scope is invalid");
    }
    if (
      input.kind !== "preference" &&
      input.kind !== "context" &&
      input.kind !== "goal"
    ) {
      throw new ValidationError("memory kind is invalid");
    }
    const sessionId = input.scope === "session" ? input.sessionId?.trim() : null;
    if (input.scope === "session") {
      if (!sessionId) {
        throw new ValidationError("sessionId is required for session memory");
      }
      assertUuid(sessionId, "sessionId");
      if (!(await this.repository.findSession(sessionId, userId))) {
        throw new NotFoundError("未找到这个对话。");
      }
    }
    return this.repository.insertMemory({
      userId,
      sessionId: sessionId ?? null,
      scope: input.scope,
      kind: input.kind,
      content,
      status: "active",
      sourceMessageId: null,
    });
  }

  async updateMemory(
    memoryId: string,
    input: UpdateConversationMemoryRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    assertUuid(memoryId, "memoryId");
    const current = await this.repository.findMemory(memoryId, userId);
    if (!current) {
      throw new NotFoundError("未找到这条记忆。");
    }
    const content = input.content?.trim() ?? current.content;
    if (!content || content.length > 300) {
      throw new ValidationError("记忆长度应为 1 到 300 个字符。");
    }
    const status = input.status ?? current.status;
    if (status !== "suggested" && status !== "active" && status !== "dismissed") {
      throw new ValidationError("memory status is invalid");
    }
    const updated = await this.repository.updateMemory(
      memoryId,
      userId,
      content,
      status
    );
    if (!updated) {
      throw new NotFoundError("未找到这条记忆。");
    }
    return updated;
  }

  async deleteMemory(memoryId: string, userId = DEFAULT_GRAMMAR_USER_ID) {
    assertUuid(memoryId, "memoryId");
    if (!(await this.repository.deleteMemory(memoryId, userId))) {
      throw new NotFoundError("未找到这条记忆。");
    }
  }

  async streamMessage(
    sessionId: string,
    input: SendConversationMessageRequest,
    requestSignal?: AbortSignal,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    assertUuid(sessionId, "sessionId");
    if (!hasAiGatewayCredentials()) {
      throw new ConfigurationError("AI Gateway credentials are not configured");
    }
    const session = await this.repository.findSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError("未找到这个对话。");
    }
    let content = input.content?.trim();
    if (!content || content.length > MAX_CONVERSATION_INPUT_LENGTH) {
      throw new ValidationError("消息长度应为 1 到 8000 个字符。");
    }
    const clientMessageId = input.clientMessageId?.trim();
    if (!clientMessageId || clientMessageId.length > 128) {
      throw new ValidationError("clientMessageId is required");
    }
    const mode = normalizeMode(input.mode, session.mode);
    let userMessage = null;
    let assistantMessage = null;
    let retryAssistantMessageId: string | null = null;
    if (input.retryParentMessageId) {
      assertUuid(input.retryParentMessageId, "retryParentMessageId");
      const retryParent = await this.repository.findMessage(
        input.retryParentMessageId,
        userId
      );
      if (
        !retryParent ||
        retryParent.sessionId !== sessionId ||
        retryParent.role !== "user"
      ) {
        throw new NotFoundError("未找到要重试的用户消息。");
      }
      userMessage = retryParent;
      content = retryParent.content;
      if (!input.retryAssistantMessageId) {
        throw new ValidationError("retryAssistantMessageId is required");
      }
      assertUuid(input.retryAssistantMessageId, "retryAssistantMessageId");
      const retryAssistant = await this.repository.findMessage(
        input.retryAssistantMessageId,
        userId
      );
      if (
        !retryAssistant ||
        retryAssistant.sessionId !== sessionId ||
        retryAssistant.role !== "assistant" ||
        retryAssistant.parentMessageId !== retryParent.id
      ) {
        throw new NotFoundError("未找到要重试的助手消息。");
      }
      if (
        retryAssistant.status === "completed" ||
        retryAssistant.status === "streaming"
      ) {
        assistantMessage = retryAssistant;
      } else if (
        retryAssistant.status === "failed" ||
        retryAssistant.status === "cancelled"
      ) {
        retryAssistantMessageId = retryAssistant.id;
      } else {
        throw new ValidationError("这条助手消息不能重试。");
      }
    } else {
      userMessage = await this.repository.findMessageByClientId(
        sessionId,
        userId,
        clientMessageId
      );
      assistantMessage = userMessage
        ? await this.repository.findMessageByClientId(
            sessionId,
            userId,
            `assistant:${clientMessageId}`
          )
        : null;
    }
    if (!userMessage) {
      userMessage = await this.repository.insertUserMessage({
        sessionId,
        userId,
        content,
        mode,
        clientMessageId,
      });
      if (!userMessage) {
        userMessage = await this.repository.findMessageByClientId(
          sessionId,
          userId,
          clientMessageId
        );
      }
      if (!userMessage) {
        throw new DependencyError("user message could not be created");
      }
    }
    if (assistantMessage) {
      return replayMessageStream(userMessage, assistantMessage);
    }
    const assistantClientMessageId = `assistant:${clientMessageId}`;
    assistantMessage = retryAssistantMessageId
      ? await this.repository.restartAssistantMessage({
          messageId: retryAssistantMessageId,
          userId,
          mode,
          modelName: resolveAiTextModel("defaultTeacher"),
        })
      : await this.repository.insertAssistantMessage({
          sessionId,
          userId,
          mode,
          parentMessageId: userMessage.id,
          modelName: resolveAiTextModel("defaultTeacher"),
          clientMessageId: assistantClientMessageId,
        });
    if (!assistantMessage) {
      const concurrentAssistant = retryAssistantMessageId
        ? await this.repository.findMessage(retryAssistantMessageId, userId)
        : await this.repository.findMessageByClientId(
            sessionId,
            userId,
            assistantClientMessageId
          );
      if (!concurrentAssistant) {
        throw new DependencyError("assistant message could not be created");
      }
      return replayMessageStream(userMessage, concurrentAssistant);
    }
    const [preferences, memories, contextMessages, grammarReferences] =
      await Promise.all([
        this.repository.getPreferences(userId),
        this.repository.listActiveMemories(userId, sessionId),
        this.repository.listContextMessages(
          sessionId,
          userId,
          MAX_CONTEXT_MESSAGES
        ),
        loadConversationGrammarReferences(
          this.grammarLearningService,
          content,
          mode,
          userId
        ),
      ]);
    const globalMemories = memories.filter((memory) => memory.scope === "global");
    const sessionMemories = memories.filter((memory) => memory.scope === "session");
    const gatewayMessages: AiGatewayInputMessage[] = [
      {
        role: "system",
        content: buildConversationSystemPrompt({
          mode,
          preferences,
          globalMemories,
          sessionMemories,
          summary: session.summary,
          grammarReferences,
        }),
      },
      ...trimConversationContextMessages(contextMessages).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    const onRequestAbort = () => abortController.abort();
    if (requestSignal?.aborted) {
      abortController.abort();
    } else {
      requestSignal?.addEventListener("abort", onRequestAbort, { once: true });
    }
    const initialUserMessage = userMessage;
    const initialAssistantMessage = assistantMessage;

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let accumulated = "";
        controller.enqueue(
          encoder.encode(
            toSse({
              type: "assistant_created",
              userMessage: initialUserMessage,
              assistantMessage: initialAssistantMessage,
            })
          )
        );

        try {
          const stream = await this.aiClient.streamReply(
            gatewayMessages,
            abortController.signal
          );
          if (!stream) {
            throw new DependencyError("AI Gateway did not return a response");
          }
          for await (const delta of stream) {
            accumulated += delta;
            controller.enqueue(encoder.encode(toSse({ type: "text_delta", delta })));
          }
          const completed = await this.repository.completeAssistantMessage(
            initialAssistantMessage.id,
            userId,
            accumulated
          );
          if (!completed) {
            throw new DependencyError("assistant message could not be completed");
          }
          await this.repository.touchSession(sessionId, userId);
          controller.enqueue(
            encoder.encode(toSse({ type: "completed", message: completed }))
          );
        } catch (error) {
          const isCancelled =
            abortController.signal.aborted ||
            (error instanceof DOMException && error.name === "AbortError");
          const appError = error instanceof AppError ? error : null;
          const errorCode = isCancelled
            ? "GENERATION_CANCELLED"
            : appError?.code ?? "AI_RESPONSE_FAILED";
          const errorMessage = isCancelled
            ? "回答已停止。"
            : appError?.exposeMessage
              ? appError.message
              : "回答生成失败，请重试。";
          const failed = await this.repository.failAssistantMessage({
            messageId: initialAssistantMessage.id,
            userId,
            content: accumulated,
            status: isCancelled ? "cancelled" : "failed",
            errorCode,
            errorMessage,
          });
          if (!isCancelled) {
            controller.enqueue(
              encoder.encode(
                toSse({
                  type: "error",
                  code: errorCode,
                  message: errorMessage,
                  retryable: true,
                  assistantMessage: failed ?? undefined,
                })
              )
            );
          }
        } finally {
          requestSignal?.removeEventListener("abort", onRequestAbort);
          controller.close();
        }
      },
      cancel: () => {
        abortController.abort();
      },
    });
  }

  async analyzeMessage(
    sessionId: string,
    messageId: string,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationAnalysisResponse> {
    assertUuid(sessionId, "sessionId");
    assertUuid(messageId, "messageId");
    const [session, existingMessage] = await Promise.all([
      this.repository.findSession(sessionId, userId),
      this.repository.findMessage(messageId, userId),
    ]);
    if (!session || !existingMessage || existingMessage.sessionId !== sessionId) {
      throw new NotFoundError("未找到要分析的回答。");
    }
    if (existingMessage.analysisStatus === "completed") {
      const [globalMemories, sessionMemories, learningItems] = await Promise.all([
        this.repository.listMemories(userId, null),
        this.repository.listMemories(userId, sessionId),
        this.repository.listLearningItems(sessionId, userId),
      ]);
      return {
        message: existingMessage,
        session,
        memories: [...globalMemories, ...sessionMemories].filter(
          (memory) => memory.sourceMessageId === messageId
        ),
        learningItems: learningItems.filter(
          (item) => item.sourceMessageId === messageId
        ),
      };
    }
    const claimed = await this.repository.claimAnalysis(messageId, userId);
    if (!claimed) {
      throw new ValidationError("这条回答正在分析，请稍后再试。");
    }

    try {
      const parentMessage = existingMessage.parentMessageId
        ? await this.repository.findMessage(existingMessage.parentMessageId, userId)
        : null;
      const turnMessages =
        parentMessage?.sessionId === sessionId && parentMessage.role === "user"
          ? [parentMessage, existingMessage]
          : [existingMessage];
      const analysis = await this.aiClient.analyze({
        session,
        messages: turnMessages,
      });
      if (!analysis) {
        throw new DependencyError("conversation analysis failed");
      }

      await this.repository.clearAnalysisSuggestions(messageId, userId);
      const [globalMemories, sessionMemories, existingLearningItems] =
        await Promise.all([
          this.repository.listMemories(userId, null),
          this.repository.listMemories(userId, sessionId),
          this.repository.listLearningItems(sessionId, userId),
        ]);
      const existingMemories = [...globalMemories, ...sessionMemories];
      const memoryKeys = new Set(
        existingMemories.map((memory) => memory.content.trim().toLowerCase())
      );
      const learningItemKeys = new Set(
        existingLearningItems.map((item) =>
          conversationLearningItemKey(item.kind, item.surfaceForm, item.meaningZh)
        )
      );
      const memories = [];
      for (const memory of analysis.memories) {
        const key = memory.content.trim().toLowerCase();
        if (!key || memoryKeys.has(key)) continue;
        memoryKeys.add(key);
        memories.push(
          await this.repository.insertMemory({
            userId,
            sessionId: memory.scope === "session" ? sessionId : null,
            scope: memory.scope,
            kind: memory.kind,
            content: memory.content,
            status: "suggested",
            sourceMessageId: messageId,
          })
        );
      }

      const learningItems = [];
      for (const item of analysis.learningItems) {
        const learningItemKey = conversationLearningItemKey(
          item.kind,
          item.surfaceForm,
          item.meaningZh
        );
        if (learningItemKeys.has(learningItemKey)) continue;
        learningItemKeys.add(learningItemKey);
        let grammarCandidates: ConversationGrammarCandidate[] = [];
        if (item.kind === "grammar") {
          const search = await this.grammarLearningService.searchGrammarPoints({
            query: buildConversationGrammarSearchQuery(item.surfaceForm),
            limit: 5,
            userId,
          });
          grammarCandidates = selectConversationGrammarCandidates(
            item.surfaceForm,
            search.items.map((candidate) => ({
              grammarPointId: candidate.id,
              grammarPoint: candidate.grammarPoint,
              canonicalForm: candidate.canonicalForm,
              senseKey: candidate.senseKey,
              coreMeaning: candidate.coreMeaning,
            }))
          );
        }
        learningItems.push(
          await this.repository.insertLearningItem({
            userId,
            sessionId,
            sourceMessageId: messageId,
            kind: item.kind,
            surfaceForm: item.surfaceForm,
            reading: item.reading,
            meaningZh: item.meaningZh,
            explanationZh: item.explanationZh,
            sourceExcerpt: item.sourceExcerpt,
            status:
              item.kind === "grammar" && grammarCandidates.length !== 1
                ? "needs_review"
                : "suggested",
            grammarCandidates,
          })
        );
      }

      const [updatedSession, completedMessage] = await Promise.all([
        this.repository.updateSummary({
          sessionId,
          userId,
          summary: analysis.summary,
          title: resolveConversationAnalysisTitle({
            session,
            suggestedTitle: analysis.title,
            firstUserMessage: parentMessage?.content ?? null,
          }),
          throughAt: existingMessage.createdAt,
        }),
        this.repository.completeAnalysis(messageId, userId, analysis.details),
      ]);
      if (!updatedSession || !completedMessage) {
        throw new DependencyError("conversation analysis could not be saved");
      }
      return {
        message: completedMessage,
        session: updatedSession,
        memories,
        learningItems,
      };
    } catch (error) {
      await this.repository.failAnalysis(
        messageId,
        userId,
        "ANALYSIS_FAILED",
        "学习项提取失败，请重试。"
      );
      throw error;
    }
  }
}
