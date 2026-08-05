import {
  assertConversationCursorPosition,
  decodeConversationCursor,
  encodeConversationCursor,
} from "@/features/conversation/application/pagination";
import type {
  ConversationAnalysisStore,
  ConversationCollectionPort,
  ConversationLearningItemStore,
  ConversationMemoryStore,
  ConversationMessageStore,
  ConversationSessionStore,
  ConversationAiPort,
} from "@/features/conversation/application/ports";
import {
  normalizeConversationMode,
  normalizeConversationRegister,
} from "@/features/conversation/application/request-validation";
import { assertUuid } from "@/features/conversation/domain/validation";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  ConversationBootstrapResponse,
  ConversationSessionResponse,
  CreateConversationMemoryRequest,
  UpdateConversationMemoryRequest,
  UpdateConversationPreferencesRequest,
  UpdateConversationSessionRequest,
} from "@/shared/types/conversation";
import {
  DependencyError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/errors";

export const CONVERSATION_SESSION_PAGE_SIZE = 30;
export const CONVERSATION_MESSAGE_PAGE_SIZE = 50;

type ConversationSessionReadStore = ConversationSessionStore &
  ConversationMessageStore &
  ConversationMemoryStore &
  ConversationAnalysisStore &
  ConversationLearningItemStore;

export class ConversationSessionService {
  constructor(
    private readonly store: ConversationSessionReadStore,
    private readonly ai: ConversationAiPort,
    private readonly collections: ConversationCollectionPort
  ) {}

  async bootstrap(
    options?: { query?: string; cursor?: string | null },
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationBootstrapResponse> {
    const cursor = decodeConversationCursor<{ updatedAt: string; id: string }>(
      options?.cursor
    );
    assertConversationCursorPosition(cursor);
    const [sessionRows, preferences, globalMemories, collections] =
      await Promise.all([
        this.store.listSessions({
          userId,
          query: options?.query?.trim(),
          cursor,
          limit: CONVERSATION_SESSION_PAGE_SIZE + 1,
        }),
        this.store.getPreferences(userId),
        this.store.listMemories(userId, null),
        this.collections.listCollections(),
      ]);
    const hasMore = sessionRows.length > CONVERSATION_SESSION_PAGE_SIZE;
    const sessions = sessionRows.slice(0, CONVERSATION_SESSION_PAGE_SIZE);
    const lastSession = sessions.at(-1);

    return {
      aiAvailable: this.ai.isAvailable(),
      sessions,
      nextCursor:
        hasMore && lastSession
          ? encodeConversationCursor({
              updatedAt: lastSession.updatedAt,
              id: lastSession.id,
            })
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
    const preferences = await this.store.getPreferences(userId);
    const session = await this.store.createSession(
      userId,
      normalizeConversationMode(requestedMode, preferences.defaultMode)
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
    const session = await this.store.findSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError("未找到这个对话。");
    }
    const decodedCursor = decodeConversationCursor<{
      createdAt: string;
      id: string;
    }>(cursor);
    assertConversationCursorPosition(decodedCursor);
    const [messageRows, memories, analyses, learningItems] = await Promise.all([
      this.store.listMessages({
        sessionId,
        userId,
        cursor: decodedCursor,
        limit: CONVERSATION_MESSAGE_PAGE_SIZE + 1,
      }),
      this.store.listMemories(userId, sessionId),
      this.store.listAnalyses(sessionId, userId),
      this.store.listLearningItems(sessionId, userId),
    ]);
    const hasOlder = messageRows.length > CONVERSATION_MESSAGE_PAGE_SIZE;
    const messages = hasOlder ? messageRows.slice(1) : messageRows;
    const firstMessage = messages[0];

    return {
      session,
      messages,
      memories,
      analyses,
      learningItems,
      olderMessagesCursor:
        hasOlder && firstMessage
          ? encodeConversationCursor({
              createdAt: firstMessage.createdAt,
              id: firstMessage.id,
            })
          : null,
    };
  }

  async updateSession(
    sessionId: string,
    input: UpdateConversationSessionRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    assertUuid(sessionId, "sessionId");
    const current = await this.store.findSession(sessionId, userId);
    if (!current) {
      throw new NotFoundError("未找到这个对话。");
    }
    const title = input.title === undefined ? current.title : input.title.trim();
    if (!title || title.length > 80) {
      throw new ValidationError("标题长度应为 1 到 80 个字符。");
    }
    const next = await this.store.updateSession({
      sessionId,
      userId,
      title,
      mode: normalizeConversationMode(input.mode, current.mode),
      titleIsManual: input.title === undefined ? current.titleIsManual : true,
    });
    if (!next) {
      throw new NotFoundError("未找到这个对话。");
    }
    return next;
  }

  async deleteSession(sessionId: string, userId = DEFAULT_GRAMMAR_USER_ID) {
    assertUuid(sessionId, "sessionId");
    if (!(await this.store.deleteSession(sessionId, userId))) {
      throw new NotFoundError("未找到这个对话。");
    }
  }

  async updatePreferences(
    input: UpdateConversationPreferencesRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    const next: UpdateConversationPreferencesRequest = {};
    if (input.defaultMode !== undefined) {
      next.defaultMode = normalizeConversationMode(input.defaultMode, "chat");
    }
    if (input.defaultRegister !== undefined) {
      next.defaultRegister = normalizeConversationRegister(input.defaultRegister);
    }
    if (
      input.translationStyle !== undefined &&
      input.translationStyle !== "natural_first"
    ) {
      throw new ValidationError("translationStyle is invalid");
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
        await this.collections.getCollectionDetail(defaultCollectionId);
      }
      next.defaultCollectionId = defaultCollectionId;
    }
    return this.store.updatePreferences(userId, next);
  }

  async createMemory(
    input: Partial<CreateConversationMemoryRequest>,
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
      if (!(await this.store.findSession(sessionId, userId))) {
        throw new NotFoundError("未找到这个对话。");
      }
    }
    return this.store.insertMemory({
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
    const current = await this.store.findMemory(memoryId, userId);
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
    const updated = await this.store.updateMemory(
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
    if (!(await this.store.deleteMemory(memoryId, userId))) {
      throw new NotFoundError("未找到这条记忆。");
    }
  }
}
