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
      return null;
    }

    const validated = validateConversationAnalysisReferences(
      parsed,
      input.messages
    );
    return reconcileConversationGrammarLearningItems(validated, input.messages);
  }
}
