import {
  requestAiGatewayStructuredText,
  requestAiGatewayTextStream,
  resolveAiGatewayRequest,
  type AiGatewayInputMessage,
} from "@/shared/ai/gateway";
import {
  CONVERSATION_ANALYSIS_SCHEMA,
  CONVERSATION_MAINTENANCE_SCHEMA,
  buildConversationAnalysisPrompt,
  buildConversationMaintenancePrompt,
} from "@/features/conversation/prompts/conversation";
import {
  parseConversationLearningAnalysisOutput,
  parseConversationMaintenanceOutput,
  reconcileConversationGrammarLearningItems,
  validateConversationAnalysisReferences,
} from "@/features/conversation/domain/conversation";
import type {
  ConversationLearningAnalysisOutput,
  ConversationMaintenanceOutput,
} from "@/features/conversation/domain/conversation";
import type {
  ConversationAnalysisFocus,
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
    focus: ConversationAnalysisFocus;
    instruction: string;
    signal?: AbortSignal;
  }): Promise<ConversationLearningAnalysisOutput | null> {
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
            "你是按用户意图工作的日语学习分析器。只分析提供的当前一轮，只返回符合 JSON Schema 的结果。",
        },
        {
          role: "user",
          content: buildConversationAnalysisPrompt({
            messages: input.messages,
            focus: input.focus,
            instruction: input.instruction,
          }),
        },
      ],
      schemaName: "lexinote_conversation_analysis",
      schema: CONVERSATION_ANALYSIS_SCHEMA,
      signal: input.signal,
    });

    const parsed = text ? parseConversationLearningAnalysisOutput(text) : null;
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

  async maintainSession(input: {
    session: ConversationSession;
    messages: ConversationMessage[];
    signal?: AbortSignal;
  }): Promise<ConversationMaintenanceOutput | null> {
    const request = resolveAiGatewayRequest();
    if (!request) return null;

    const text = await this.structuredRequester(request, {
      role: "cheap",
      maxOutputTokens: 1_000,
      fallbackModels: [...CONVERSATION_AI_MODEL_FALLBACKS.analysis],
      messages: [
        {
          role: "system",
          content:
            "你是通用对话的上下文维护器。只返回符合 JSON Schema 的结果，不提取词汇或语法学习项。",
        },
        {
          role: "user",
          content: buildConversationMaintenancePrompt({
            sessionTitle: input.session.title,
            titleIsManual: input.session.titleIsManual,
            previousSummary: input.session.summary,
            messages: input.messages,
          }),
        },
      ],
      schemaName: "lexinote_conversation_maintenance",
      schema: CONVERSATION_MAINTENANCE_SCHEMA,
      signal: input.signal,
    });
    const parsed = text ? parseConversationMaintenanceOutput(text) : null;
    if (!parsed) {
      console.warn("Conversation maintenance returned invalid structured output", {
        outputLength: text?.length ?? 0,
      });
    }
    return parsed;
  }
}
