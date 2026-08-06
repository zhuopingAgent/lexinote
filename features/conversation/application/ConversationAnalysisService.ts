import { randomUUID } from "node:crypto";
import type {
  ConversationAiPort,
  ConversationAnalysisLease,
  ConversationAnalysisStore,
  ConversationGrammarSearchPort,
  ConversationLearningItemStore,
  ConversationMessageStore,
  ConversationSessionStore,
} from "@/features/conversation/application/ports";
import {
  conversationLearningItemMatchesFocus,
  normalizeConversationAnalysisFocus,
} from "@/features/conversation/domain/analysis-request";
import {
  buildConversationGrammarSearchQuery,
  conversationLearningItemKey,
  selectConversationGrammarCandidates,
} from "@/features/conversation/domain/conversation";
import { assertUuid } from "@/features/conversation/domain/validation";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  AnalyzeConversationMessageRequest,
  ConversationAnalysis,
  ConversationAnalysisFocus,
  ConversationAnalysisResponse,
  ConversationGrammarCandidate,
  ConversationLearningItem,
  ConversationMessage,
} from "@/shared/types/conversation";
import {
  ConfigurationError,
  DependencyError,
  NotFoundError,
  ValidationError,
} from "@/shared/utils/errors";

type ConversationAnalysisWorkflowStore = ConversationSessionStore &
  ConversationMessageStore &
  ConversationAnalysisStore &
  ConversationLearningItemStore;

class ConversationAnalysisLeaseLostError extends DependencyError {
  constructor() {
    super("conversation analysis lease was lost");
  }
}

export class ConversationAnalysisService {
  constructor(
    private readonly store: ConversationAnalysisWorkflowStore,
    private readonly ai: ConversationAiPort,
    private readonly grammar: ConversationGrammarSearchPort,
    private readonly createLeaseToken: () => string = randomUUID
  ) {}

  async analyzeMessage(
    sessionId: string,
    messageId: string,
    input: Partial<AnalyzeConversationMessageRequest>,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<ConversationAnalysisResponse> {
    assertUuid(sessionId, "sessionId");
    assertUuid(messageId, "messageId");
    if (!this.ai.isAvailable()) {
      throw new ConfigurationError("AI Gateway credentials are not configured");
    }
    const clientAnalysisId = input.clientAnalysisId?.trim();
    if (!clientAnalysisId || clientAnalysisId.length > 128) {
      throw new ValidationError("clientAnalysisId is required");
    }
    const focus = normalizeConversationAnalysisFocus(input.focus);
    const instruction = input.instruction?.trim() ?? "";
    if (instruction.length > 1_000) {
      throw new ValidationError("分析意图不能超过 1000 个字符。");
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
      throw new NotFoundError("未找到要分析的回答。");
    }

    const acquired = await this.acquireLease({
      sessionId,
      messageId,
      userId,
      clientAnalysisId,
      focus,
      instruction,
    });
    if ("response" in acquired) return acquired.response;

    return this.runAnalysis({
      lease: acquired.lease,
      sessionId,
      message,
      focus,
      instruction,
      userId,
    });
  }

  private async acquireLease(input: {
    sessionId: string;
    messageId: string;
    userId: string;
    clientAnalysisId: string;
    focus: ConversationAnalysisFocus;
    instruction: string;
  }): Promise<
    | { lease: ConversationAnalysisLease }
    | { response: ConversationAnalysisResponse }
  > {
    const existing = await this.store.findAnalysisByClientId(
      input.sessionId,
      input.userId,
      input.clientAnalysisId
    );
    if (existing) {
      this.assertIdempotentAnalysisMatches(existing, input);
      if (existing.status === "completed") {
        return {
          response: await this.loadCompletedAnalysis(existing, input.userId),
        };
      }
      const lease = await this.store.reclaimAnalysisLease({
        sessionId: input.sessionId,
        messageId: input.messageId,
        userId: input.userId,
        clientAnalysisId: input.clientAnalysisId,
        leaseToken: this.createLeaseToken(),
      });
      if (!lease) {
        throw new ValidationError("这次分析正在进行，请稍后再试。");
      }
      return { lease };
    }

    const lease = await this.store.createAnalysisLease({
      ...input,
      modelName: this.ai.modelName("analysis"),
      leaseToken: this.createLeaseToken(),
    });
    if (lease) return { lease };

    const concurrent = await this.store.findAnalysisByClientId(
      input.sessionId,
      input.userId,
      input.clientAnalysisId
    );
    if (concurrent) {
      this.assertIdempotentAnalysisMatches(concurrent, input);
      if (concurrent.status === "completed") {
        return {
          response: await this.loadCompletedAnalysis(concurrent, input.userId),
        };
      }
    }
    throw new ValidationError("这次分析正在进行，请稍后再试。");
  }

  private assertIdempotentAnalysisMatches(
    analysis: ConversationAnalysis,
    input: {
      messageId: string;
      focus: ConversationAnalysisFocus;
      instruction: string;
    }
  ) {
    if (analysis.messageId !== input.messageId) {
      throw new ValidationError("clientAnalysisId 已用于另一条回答。");
    }
    if (
      analysis.focus !== input.focus ||
      analysis.instruction !== input.instruction
    ) {
      throw new ValidationError("clientAnalysisId 的分析参数不一致。");
    }
  }

  private async loadCompletedAnalysis(
    analysis: ConversationAnalysis,
    userId: string
  ): Promise<ConversationAnalysisResponse> {
    return {
      analysis,
      learningItems: await this.store.listLearningItemsByAnalysis(
        analysis.id,
        userId
      ),
    };
  }

  private async runAnalysis(input: {
    lease: ConversationAnalysisLease;
    sessionId: string;
    message: ConversationMessage;
    focus: ConversationAnalysisFocus;
    instruction: string;
    userId: string;
  }): Promise<ConversationAnalysisResponse> {
    try {
      const parentMessage = input.message.parentMessageId
        ? await this.store.findMessage(
            input.message.parentMessageId,
            input.userId
          )
        : null;
      const turnMessages =
        parentMessage?.sessionId === input.sessionId &&
        parentMessage.role === "user"
          ? [parentMessage, input.message]
          : [input.message];
      const output = await this.ai.analyze({
        messages: turnMessages,
        focus: input.focus,
        instruction: input.instruction,
      });
      if (!output) {
        throw new DependencyError("conversation analysis failed");
      }

      const existingItems = await this.store.listLearningItems(
        input.sessionId,
        input.userId
      );
      const deduplicationItems = existingItems.filter(
        (item) =>
          item.status === "saved" ||
          (item.sourceMessageId !== input.message.id &&
            (item.status === "suggested" || item.status === "needs_review"))
      );
      const learningItemKeys = new Set(
        deduplicationItems.map((item) =>
          conversationLearningItemKey(
            item.kind,
            item.surfaceForm,
            item.meaningZh
          )
        )
      );
      const grammarPointIds = this.collectResolvedGrammarPointIds(
        deduplicationItems
      );
      const learningItems: ConversationLearningItem[] = [];

      for (const item of output.learningItems.filter((candidate) =>
        conversationLearningItemMatchesFocus(candidate.kind, input.focus)
      )) {
        const key = conversationLearningItemKey(
          item.kind,
          item.surfaceForm,
          item.meaningZh
        );
        if (learningItemKeys.has(key)) continue;

        let grammarCandidates: ConversationGrammarCandidate[] = [];
        if (item.kind === "grammar") {
          const search = await this.grammar.searchGrammarPoints({
            query: buildConversationGrammarSearchQuery(item.surfaceForm),
            limit: 5,
            userId: input.userId,
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
          const resolvedGrammarPointId =
            grammarCandidates.length === 1
              ? grammarCandidates[0].grammarPointId
              : null;
          if (
            resolvedGrammarPointId &&
            grammarPointIds.has(resolvedGrammarPointId)
          ) {
            continue;
          }
          if (resolvedGrammarPointId) {
            grammarPointIds.add(resolvedGrammarPointId);
          }
        }

        learningItemKeys.add(key);
        const saved = await this.store.insertLearningItem({
          userId: input.userId,
          sessionId: input.sessionId,
          sourceMessageId: input.message.id,
          analysisId: input.lease.analysis.id,
          leaseToken: input.lease.leaseToken,
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
        });
        if (!saved) throw new ConversationAnalysisLeaseLostError();
        learningItems.push(saved);
      }

      const completed = await this.store.completeAnalysisRecord({
        analysisId: input.lease.analysis.id,
        userId: input.userId,
        leaseToken: input.lease.leaseToken,
        overview: output.overview,
      });
      if (!completed) throw new ConversationAnalysisLeaseLostError();
      return {
        analysis: completed,
        learningItems: completed.isCurrent
          ? learningItems
          : await this.store.listLearningItemsByAnalysis(
              completed.id,
              input.userId
            ),
      };
    } catch (error) {
      await this.store.failAnalysisRecord({
        analysisId: input.lease.analysis.id,
        userId: input.userId,
        leaseToken: input.lease.leaseToken,
        errorCode: "ANALYSIS_FAILED",
        errorMessage: "学习分析失败，请重试。",
      });
      throw error;
    }
  }

  private collectResolvedGrammarPointIds(items: ConversationLearningItem[]) {
    return new Set(
      items.flatMap((item) => {
        if (item.kind !== "grammar") return [];
        if (item.grammarPointId) return [item.grammarPointId];
        return item.grammarCandidates.length === 1
          ? [item.grammarCandidates[0].grammarPointId]
          : [];
      })
    );
  }
}
