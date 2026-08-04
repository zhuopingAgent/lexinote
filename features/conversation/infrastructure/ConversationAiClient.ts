import {
  requestAiGatewayStructuredText,
  requestAiGatewayTextStream,
  resolveAiGatewayRequest,
  type AiGatewayInputMessage,
} from "@/shared/ai/gateway";
import {
  CONVERSATION_ANALYSIS_SCHEMA,
  buildConversationAnalysisPrompt,
} from "@/features/conversation/prompts/conversation";
import {
  parseConversationAnalysisOutput,
  reconcileConversationGrammarLearningItems,
  validateConversationAnalysisReferences,
} from "@/features/conversation/domain/conversation";
import type {
  ConversationAnalysisOutput,
} from "@/features/conversation/domain/conversation";
import type {
  ConversationMessage,
  ConversationSession,
} from "@/shared/types/conversation";

type StreamRequester = typeof requestAiGatewayTextStream;
type StructuredRequester = typeof requestAiGatewayStructuredText;

export const CONVERSATION_AI_MODEL_FALLBACKS = {
  reply: ["google/gemini-2.5-flash", "anthropic/claude-haiku-4.5"],
  analysis: ["google/gemini-2.5-flash-lite", "openai/gpt-4.1-nano"],
} as const;

export class ConversationAiClient {
  constructor(
    private readonly streamRequester: StreamRequester = requestAiGatewayTextStream,
    private readonly structuredRequester: StructuredRequester = requestAiGatewayStructuredText
  ) {}

  async streamReply(messages: AiGatewayInputMessage[], signal?: AbortSignal) {
    const request = resolveAiGatewayRequest();
    if (!request) {
      return null;
    }

    return this.streamRequester(request, {
      role: "defaultTeacher",
      maxOutputTokens: 1_800,
      fallbackModels: [...CONVERSATION_AI_MODEL_FALLBACKS.reply],
      messages,
      signal,
    });
  }

  async analyze(input: {
    session: ConversationSession;
    messages: ConversationMessage[];
    signal?: AbortSignal;
  }): Promise<ConversationAnalysisOutput | null> {
    const request = resolveAiGatewayRequest();
    if (!request) {
      return null;
    }

    const text = await this.structuredRequester(request, {
      role: "cheap",
      maxOutputTokens: 1_500,
      fallbackModels: [...CONVERSATION_AI_MODEL_FALLBACKS.analysis],
      messages: [
        {
          role: "system",
          content:
            "你是中日学习对话的结构化分析器。只返回符合 JSON Schema 的结果。",
        },
        {
          role: "user",
          content: buildConversationAnalysisPrompt({
            sessionTitle: input.session.title,
            titleIsManual: input.session.titleIsManual,
            previousSummary: input.session.summary,
            messages: input.messages,
          }),
        },
      ],
      schemaName: "lexinote_conversation_analysis",
      schema: CONVERSATION_ANALYSIS_SCHEMA,
      signal: input.signal,
    });

    const parsed = text ? parseConversationAnalysisOutput(text) : null;
    if (!parsed) {
      console.warn("Conversation analysis returned invalid structured output", {
        outputLength: text?.length ?? 0,
      });
      return null;
    }

    const validated = validateConversationAnalysisReferences(
      parsed,
      input.messages
    );
    return reconcileConversationGrammarLearningItems(validated, input.messages);
  }
}
