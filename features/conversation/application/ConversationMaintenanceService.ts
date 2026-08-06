import type {
  ConversationAiPort,
  ConversationMemoryStore,
  ConversationMessageStore,
  ConversationSessionStore,
} from "@/features/conversation/application/ports";
import {
  MAX_CONTEXT_MESSAGES,
  buildConversationFallbackTitle,
  trimConversationContextMessages,
} from "@/features/conversation/domain/conversation";
import { assertUuid } from "@/features/conversation/domain/validation";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  ConversationMaintenanceResponse,
  ConversationSession,
} from "@/shared/types/conversation";
import {
  ConfigurationError,
  DependencyError,
  NotFoundError,
} from "@/shared/utils/errors";

type ConversationMaintenanceStore = ConversationSessionStore &
  ConversationMessageStore &
  ConversationMemoryStore;

export function resolveConversationMaintenanceTitle(input: {
  session: Pick<ConversationSession, "title" | "summary" | "titleIsManual">;
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

export class ConversationMaintenanceService {
  constructor(
    private readonly store: ConversationMaintenanceStore,
    private readonly ai: ConversationAiPort
  ) {}

  async maintainSession(
    sessionId: string,
    messageId: string,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationMaintenanceResponse> {
    assertUuid(sessionId, "sessionId");
    assertUuid(messageId, "messageId");
    if (!this.ai.isAvailable()) {
      throw new ConfigurationError("AI Gateway credentials are not configured");
    }
    const [session, message] = await Promise.all([
      this.store.findSession(sessionId, userId),
      this.store.findMessage(messageId, userId),
    ]);
    if (
      !session ||
      !message ||
      message.sessionId !== sessionId ||
      message.role !== "assistant" ||
      message.status !== "completed"
    ) {
      throw new NotFoundError("未找到要维护的回答。");
    }

    if (this.isAlreadyMaintained(session, message.createdAt)) {
      return this.loadMaintainedResult(session, messageId, userId);
    }

    const [parentMessage, contextMessages] = await Promise.all([
      message.parentMessageId
        ? this.store.findMessage(message.parentMessageId, userId)
        : Promise.resolve(null),
      this.store.listContextMessages(
        sessionId,
        userId,
        MAX_CONTEXT_MESSAGES,
        message.id
      ),
    ]);
    const turnMessages =
      parentMessage?.sessionId === sessionId && parentMessage.role === "user"
        ? [parentMessage, message]
        : [message];
    const summaryThroughTime = session.summaryThroughAt
      ? Date.parse(session.summaryThroughAt)
      : Number.NEGATIVE_INFINITY;
    const targetMessageTime = Date.parse(message.createdAt);
    const unmaintainedMessages = trimConversationContextMessages(
      contextMessages.filter((contextMessage) => {
        const createdAt = Date.parse(contextMessage.createdAt);
        return createdAt > summaryThroughTime && createdAt <= targetMessageTime;
      })
    );
    const firstUnmaintainedUserMessage = unmaintainedMessages.find(
      (contextMessage) => contextMessage.role === "user"
    );
    const maintenance = await this.ai.maintainSession({
      session,
      messages:
        unmaintainedMessages.length > 0 ? unmaintainedMessages : turnMessages,
    });
    if (!maintenance) {
      throw new DependencyError("conversation maintenance failed");
    }

    const saved = await this.store.saveMaintenance({
      sessionId,
      userId,
      summary: maintenance.summary,
      title: resolveConversationMaintenanceTitle({
        session,
        suggestedTitle: maintenance.title,
        firstUserMessage:
          firstUnmaintainedUserMessage?.content ?? parentMessage?.content ?? null,
      }),
      throughAt: message.createdAt,
      sourceMessageId: messageId,
      memories: maintenance.memories,
    });
    if (saved) return saved;

    const concurrentSession = await this.store.findSession(sessionId, userId);
    if (
      concurrentSession &&
      this.isAlreadyMaintained(concurrentSession, message.createdAt)
    ) {
      return this.loadMaintainedResult(concurrentSession, messageId, userId);
    }
    throw new DependencyError("conversation maintenance could not be saved");
  }

  private isAlreadyMaintained(
    session: ConversationSession,
    messageCreatedAt: string
  ) {
    return (
      session.summaryThroughAt !== null &&
      Date.parse(session.summaryThroughAt) >= Date.parse(messageCreatedAt)
    );
  }

  private async loadMaintainedResult(
    session: ConversationSession,
    messageId: string,
    userId: string
  ) {
    const [globalMemories, sessionMemories] = await Promise.all([
      this.store.listMemories(userId, null),
      this.store.listMemories(userId, session.id),
    ]);
    return {
      session,
      memories: [...globalMemories, ...sessionMemories].filter(
        (memory) => memory.sourceMessageId === messageId
      ),
    };
  }
}
