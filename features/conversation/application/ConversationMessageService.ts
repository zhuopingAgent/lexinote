import type {
  ConversationAiPort,
  ConversationGrammarPort,
  ConversationMemoryStore,
  ConversationMessageStore,
  ConversationSessionStore,
} from "@/features/conversation/application/ports";
import { normalizeConversationMode } from "@/features/conversation/application/request-validation";
import {
  MAX_CONTEXT_MESSAGES,
  MAX_CONVERSATION_INPUT_LENGTH,
  MAX_CONVERSATION_RESPONSE_LENGTH,
  buildConversationGrammarSearchQuery,
  extractExplicitConversationGrammarForms,
  selectConversationGrammarCandidates,
  trimConversationContextMessages,
} from "@/features/conversation/domain/conversation";
import { assertUuid } from "@/features/conversation/domain/validation";
import {
  buildConversationSystemPrompt,
  type ConversationGrammarPromptReference,
} from "@/features/conversation/prompts/conversation";
import type { AiGatewayInputMessage } from "@/shared/ai/gateway";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  ConversationMessage,
  ConversationMode,
  ConversationStreamEvent,
  SendConversationMessageRequest,
} from "@/shared/types/conversation";
import {
  AppError,
  ConfigurationError,
  DependencyError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/errors";

type ConversationGenerationStore = ConversationSessionStore &
  ConversationMessageStore &
  ConversationMemoryStore;

function toSse(event: ConversationStreamEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

function assertAssistantReplayMatches(
  assistantMessage: ConversationMessage,
  userMessage: ConversationMessage
) {
  if (
    assistantMessage.role !== "assistant" ||
    assistantMessage.parentMessageId !== userMessage.id
  ) {
    throw new ValidationError("clientMessageId conflicts with another message");
  }
}

function assertIdempotentUserMessageMatches(
  message: ConversationMessage,
  input: { content: string; mode: ConversationMode }
) {
  if (
    message.role !== "user" ||
    message.content !== input.content ||
    message.mode !== input.mode
  ) {
    throw new ValidationError("clientMessageId 的消息参数不一致。");
  }
}

export function replayConversationMessageStream(
  userMessage: ConversationMessage,
  assistantMessage: ConversationMessage
) {
  assertAssistantReplayMatches(assistantMessage, userMessage);
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
  grammar: ConversationGrammarPort,
  content: string,
  mode: ConversationMode,
  userId: string
): Promise<ConversationGrammarPromptReference[]> {
  if (mode !== "explain_ja") return [];

  const requests = extractExplicitConversationGrammarForms(content).slice(0, 2);
  const references = await Promise.all(
    requests.map(async (request) => {
      try {
        const search = await grammar.searchGrammarPoints({
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
        if (candidates.length !== 1) return null;

        const { grammarPoint } = await grammar.getGrammarPointDetail(
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

export class ConversationMessageService {
  constructor(
    private readonly store: ConversationGenerationStore,
    private readonly ai: ConversationAiPort,
    private readonly grammar: ConversationGrammarPort
  ) {}

  async streamMessage(
    sessionId: string,
    input: Partial<SendConversationMessageRequest>,
    requestSignal?: AbortSignal,
    userId = DEFAULT_GRAMMAR_USER_ID
  ) {
    assertUuid(sessionId, "sessionId");
    if (!this.ai.isAvailable()) {
      throw new ConfigurationError("AI Gateway credentials are not configured");
    }
    const session = await this.store.findSession(sessionId, userId);
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
    const mode = normalizeConversationMode(input.mode, session.mode);

    let userMessage: ConversationMessage | null = null;
    let assistantMessage: ConversationMessage | null = null;
    let retryAssistantMessageId: string | null = null;
    if (input.retryParentMessageId) {
      assertUuid(input.retryParentMessageId, "retryParentMessageId");
      const retryParent = await this.store.findMessage(
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
      const retryAssistant = await this.store.findMessage(
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
      }
    } else {
      userMessage = await this.store.findMessageByClientId(
        sessionId,
        userId,
        clientMessageId
      );
      if (userMessage) {
        assertIdempotentUserMessageMatches(userMessage, { content, mode });
        assistantMessage = await this.store.findMessageByClientId(
          sessionId,
          userId,
          `assistant:${clientMessageId}`
        );
      }
    }

    if (!userMessage) {
      userMessage = await this.store.insertUserMessage({
        sessionId,
        userId,
        content,
        mode,
        clientMessageId,
      });
      if (!userMessage) {
        userMessage = await this.store.findMessageByClientId(
          sessionId,
          userId,
          clientMessageId
        );
        if (userMessage) {
          assertIdempotentUserMessageMatches(userMessage, { content, mode });
        }
      }
      if (!userMessage) {
        throw new DependencyError("user message could not be created");
      }
    }
    if (assistantMessage) {
      return replayConversationMessageStream(userMessage, assistantMessage);
    }

    const assistantClientMessageId = `assistant:${clientMessageId}`;
    const modelName = this.ai.modelName("reply");
    assistantMessage = retryAssistantMessageId
      ? await this.store.restartAssistantMessage({
          messageId: retryAssistantMessageId,
          userId,
          mode,
          modelName,
        })
      : await this.store.insertAssistantMessage({
          sessionId,
          userId,
          mode,
          parentMessageId: userMessage.id,
          modelName,
          clientMessageId: assistantClientMessageId,
        });
    if (!assistantMessage) {
      const concurrentAssistant = retryAssistantMessageId
        ? await this.store.findMessage(retryAssistantMessageId, userId)
        : await this.store.findMessageByClientId(
            sessionId,
            userId,
            assistantClientMessageId
          );
      if (!concurrentAssistant) {
        throw new DependencyError("assistant message could not be created");
      }
      return replayConversationMessageStream(userMessage, concurrentAssistant);
    }

    const [preferences, memories, contextMessages, grammarReferences] =
      await Promise.all([
        this.store.getPreferences(userId),
        this.store.listActiveMemories(userId, sessionId),
        this.store.listContextMessages(
          sessionId,
          userId,
          MAX_CONTEXT_MESSAGES,
          userMessage.id
        ),
        loadConversationGrammarReferences(
          this.grammar,
          content,
          mode,
          userId
        ),
      ]);
    const globalMemories = memories.filter((memory) => memory.scope === "global");
    const sessionMemories = memories.filter(
      (memory) => memory.scope === "session"
    );
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
          currentUserContent: content,
        }),
      },
      ...trimConversationContextMessages(contextMessages).map((message) => ({
        role: message.role,
        content: message.content,
      })),
    ];
    return this.createLiveStream({
      sessionId,
      userId,
      userMessage,
      assistantMessage,
      gatewayMessages,
      requestSignal,
    });
  }

  private createLiveStream(input: {
    sessionId: string;
    userId: string;
    userMessage: ConversationMessage;
    assistantMessage: ConversationMessage;
    gatewayMessages: AiGatewayInputMessage[];
    requestSignal?: AbortSignal;
  }) {
    const encoder = new TextEncoder();
    const abortController = new AbortController();
    let cancelledByConsumer = false;
    const onRequestAbort = () => abortController.abort();
    if (input.requestSignal?.aborted) {
      abortController.abort();
    } else {
      input.requestSignal?.addEventListener("abort", onRequestAbort, {
        once: true,
      });
    }

    return new ReadableStream<Uint8Array>({
      start: async (controller) => {
        let accumulated = "";
        controller.enqueue(
          encoder.encode(
            toSse({
              type: "assistant_created",
              userMessage: input.userMessage,
              assistantMessage: input.assistantMessage,
            })
          )
        );

        try {
          const stream = await this.ai.streamReply(
            input.gatewayMessages,
            abortController.signal
          );
          if (!stream) {
            throw new DependencyError("AI Gateway did not return a response");
          }
          for await (const delta of stream) {
            const remaining = MAX_CONVERSATION_RESPONSE_LENGTH - accumulated.length;
            if (delta.length > remaining) {
              const boundedDelta = delta.slice(0, Math.max(remaining, 0));
              if (boundedDelta) {
                accumulated += boundedDelta;
                controller.enqueue(
                  encoder.encode(toSse({ type: "text_delta", delta: boundedDelta }))
                );
              }
              throw new DependencyError("AI Gateway response exceeded the output limit");
            }
            accumulated += delta;
            if (delta) {
              controller.enqueue(
                encoder.encode(toSse({ type: "text_delta", delta }))
              );
            }
          }
          if (abortController.signal.aborted) {
            throw new DOMException("Generation cancelled", "AbortError");
          }
          if (!accumulated.trim()) {
            throw new DependencyError("AI Gateway returned an empty response");
          }
          const completed = await this.store.completeAssistantMessage(
            input.assistantMessage.id,
            input.userId,
            accumulated
          );
          if (!completed) {
            throw new DependencyError("assistant message could not be completed");
          }
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
          const failed = await this.store.failAssistantMessage({
            messageId: input.assistantMessage.id,
            userId: input.userId,
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
          input.requestSignal?.removeEventListener("abort", onRequestAbort);
          if (!cancelledByConsumer) {
            controller.close();
          }
        }
      },
      cancel: () => {
        cancelledByConsumer = true;
        abortController.abort();
      },
    });
  }
}
