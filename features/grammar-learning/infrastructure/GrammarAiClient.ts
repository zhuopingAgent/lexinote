import { buildPracticeGenerationPrompt } from "@/features/grammar-learning/prompts/practiceGeneration";
import { buildSentenceFeedbackPrompt } from "@/features/grammar-learning/prompts/sentenceFeedback";
import {
  buildPlannedExerciseFallback,
  buildPlannedExerciseGenerationPrompt,
  isPlannedExerciseSafe,
  type PlannedTextExerciseInput,
} from "@/features/grammar-learning/prompts/exerciseGeneration";
import type {
  GrammarPointDetail,
  PracticeLevel,
} from "@/shared/types/grammar";
import {
  requestAiGatewayText,
  resolveAiGatewayRequest,
  resolveAiModel,
} from "@/shared/ai/gateway";
import {
  extractJsonObject,
  parseStrictJsonObject,
  parseFeedbackOutput,
  parsePracticeOutput,
  type EvaluatedSentence,
  type GeneratedPractice,
} from "@/features/grammar-learning/infrastructure/GrammarAiOutput";
import {
  buildFallbackFeedback,
  applyAnswerContractEquivalence,
  buildFallbackPractice,
  buildPracticeVariation,
} from "@/features/grammar-learning/infrastructure/GrammarFallback";
import { makeFeedbackConversational } from "@/features/grammar-learning/domain/practiceFeedback";
import {
  buildAnswerContract,
  buildEmptyGenerationMetadata,
  parsePracticeItemV2,
  parseReviewerResult,
  reviewPracticeItemLocally,
  validatePracticeItemV2,
} from "@/features/grammar-learning/domain/practiceGenerationV2";
import type {
  GenerationErrorCode,
  GenerationValidationResult,
  PracticeIntent,
  PracticeItemV2,
  AnswerContract,
  PracticeRubric,
} from "@/features/grammar-learning/domain/practiceV2";
import {
  buildPracticeGenerationPromptV2,
  buildRepairExercisePrompt,
  buildReviewGeneratedExercisePrompt,
} from "@/features/grammar-learning/prompts/practiceV2";
import { buildLocalFallbackV2 } from "@/features/grammar-learning/infrastructure/PracticeFallbackV2";
import { toActivePracticeIntent } from "@/features/grammar-learning/domain/practiceFormats";

export type {
  EvaluatedSentence,
  GeneratedPractice,
} from "@/features/grammar-learning/infrastructure/GrammarAiOutput";

const PRACTICE_MAX_OUTPUT_TOKENS = 820;
const FEEDBACK_MAX_OUTPUT_TOKENS = 760;
const PRACTICE_V2_MAX_NETWORK_RETRIES = 1;
const PRACTICE_V2_MAX_CONTENT_REPAIRS = 2;
const SEMANTIC_REVIEW_TYPES = new Set([
  "contrast_choice",
  "guided_translation",
]);

type AiTextRequester = typeof requestAiGatewayText;

export class GrammarAiClient {
  constructor(private readonly requestText: AiTextRequester = requestAiGatewayText) {}

  async generatePracticeItemV2(input: {
    grammarPoint: GrammarPointDetail;
    intent: PracticeIntent;
    generationSeed: string;
  }): Promise<PracticeItemV2> {
    const generationInput = {
      ...input,
      intent: toActivePracticeIntent(
        input.intent,
        input.grammarPoint.comparisonSets.some((set) => set.members.length >= 2)
      ),
    };
    const startedAt = Date.now();
    const answerContract = buildAnswerContract(generationInput);
    const aiGatewayRequest = resolveAiGatewayRequest();
    let generationRetryCount = 0;
    let networkRetryCount = 0;
    const accumulatedValidationResults: GenerationValidationResult[] = [];
    const finalizeFallback = (fallbackReason: string) => {
      const fallback = buildLocalFallbackV2({ ...generationInput, fallbackReason });
      fallback.generationMetadata.validationResults = [
        ...accumulatedValidationResults,
        ...fallback.generationMetadata.validationResults,
      ];
      fallback.generationMetadata.generationRetryCount = generationRetryCount;
      fallback.generationMetadata.networkRetryCount = networkRetryCount;
      fallback.generationMetadata.latencyMs = Date.now() - startedAt;
      return fallback;
    };
    if (!aiGatewayRequest) {
      return finalizeFallback("AI_GATEWAY_UNAVAILABLE");
    }
    const safeRequest: AiTextRequester = async (request, prompt) => {
      try {
        return await this.requestText(request, prompt);
      } catch {
        return null;
      }
    };

    const generationPrompt = buildPracticeGenerationPromptV2({
      ...generationInput,
      answerContract,
    });
    let raw: unknown = null;
    let responseText: string | null = null;

    for (let attempt = 0; attempt <= PRACTICE_V2_MAX_NETWORK_RETRIES; attempt += 1) {
      responseText = await safeRequest(aiGatewayRequest, {
        role: "defaultTeacher",
        maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
        systemPrompt: generationPrompt.systemPrompt,
        userPrompt: generationPrompt.userPrompt,
      });
      if (responseText) break;
      if (attempt < PRACTICE_V2_MAX_NETWORK_RETRIES) networkRetryCount += 1;
    }

    if (!responseText) {
      return finalizeFallback("NETWORK_RETRY_EXHAUSTED");
    }
    raw = parseStrictJsonObject(responseText);
    let lastErrorCodes: GenerationErrorCode[] = [];
    let lastRepairInstructions: string[] = [];

    while (generationRetryCount <= PRACTICE_V2_MAX_CONTENT_REPAIRS) {
      const metadata = buildEmptyGenerationMetadata({
        promptId: generationRetryCount === 0 ? generationPrompt.promptId : "practice.repair_exercise",
        promptVersion: 3,
        model: resolveAiModel("defaultTeacher"),
        generationSource: "ai",
        generationRetryCount,
        networkRetryCount,
        latencyMs: Date.now() - startedAt,
      });
      const item = parsePracticeItemV2(raw, {
        intent: generationInput.intent,
        grammarPoint: generationInput.grammarPoint,
        answerContract,
        metadata,
      });

      if (item) {
        const validation = validatePracticeItemV2(item, generationInput.grammarPoint);
        accumulatedValidationResults.push(...validation.results);
        item.generationMetadata.validationResults = [...accumulatedValidationResults];
        const localReviewer = SEMANTIC_REVIEW_TYPES.has(item.exerciseType)
          ? reviewPracticeItemLocally(item)
          : { valid: true, errorCodes: [], repairInstructions: [], confidence: 1 };
        let reviewer = localReviewer;

        if (validation.valid && localReviewer.valid && SEMANTIC_REVIEW_TYPES.has(item.exerciseType)) {
          const reviewPrompt = buildReviewGeneratedExercisePrompt({
            intent: generationInput.intent,
            answerContract,
            item,
          });
          const reviewText = await safeRequest(aiGatewayRequest, {
            role: "cheap",
            maxOutputTokens: 300,
            systemPrompt: reviewPrompt.systemPrompt,
            userPrompt: reviewPrompt.userPrompt,
          });
          reviewer = (reviewText && parseReviewerResult(parseStrictJsonObject(reviewText))) || localReviewer;
        }
        item.generationMetadata.reviewerResult = reviewer;

        if (validation.valid && reviewer.valid) {
          item.generationMetadata.latencyMs = Date.now() - startedAt;
          return item;
        }
        lastErrorCodes = Array.from(new Set([...validation.errorCodes, ...reviewer.errorCodes]));
        lastRepairInstructions = reviewer.repairInstructions.length
          ? reviewer.repairInstructions
          : lastErrorCodes.map((code) => `修复 ${code}，不得改变题型和目标用法。`);
      } else {
        lastErrorCodes = ["SCHEMA_INVALID"];
        lastRepairInstructions = ["按题型 schema 补齐缺失字段，只返回 JSON。"];
        accumulatedValidationResults.push({
          valid: false,
          errorCodes: ["SCHEMA_INVALID"],
          details: ["AI 输出不符合题型 schema。"],
          stage: "schema",
        });
      }

      if (generationRetryCount >= PRACTICE_V2_MAX_CONTENT_REPAIRS) break;
      generationRetryCount += 1;
      const repairPrompt = buildRepairExercisePrompt({
        intent: generationInput.intent,
        answerContract,
        item: raw,
        errorCodes: lastErrorCodes,
        repairInstructions: lastRepairInstructions,
      });
      const repairedText = await safeRequest(aiGatewayRequest, {
        role: "defaultTeacher",
        maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
        systemPrompt: repairPrompt.systemPrompt,
        userPrompt: repairPrompt.userPrompt,
      });
      if (!repairedText) {
        networkRetryCount += 1;
        break;
      }
      raw = parseStrictJsonObject(repairedText);
    }

    return finalizeFallback(
      lastErrorCodes.length
        ? `CONTENT_REPAIR_EXHAUSTED:${lastErrorCodes.join(",")}`
        : "CONTENT_REPAIR_EXHAUSTED"
    );
  }

  async generatePlannedExercise(input: PlannedTextExerciseInput): Promise<GeneratedPractice> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallback = buildPlannedExerciseFallback(input);

    if (!aiGatewayRequest) {
      return fallback;
    }

    const responseText = await this.requestText(aiGatewayRequest, {
      role: "defaultTeacher",
      maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你只负责把确定的教学规格实现成自然日语练习。只返回严格 JSON。",
      userPrompt: buildPlannedExerciseGenerationPrompt(input),
    });
    const parsed = responseText
      ? parsePracticeOutput(extractJsonObject(responseText))
      : null;

    return parsed &&
      isPlannedExerciseSafe({
        ...parsed,
        exerciseType: input.exerciseType,
        grammarPoint: input.grammarPoint.grammarPoint,
      })
      ? { ...parsed, source: "ai" }
      : fallback;
  }

  async generatePractice(input: {
    grammarPoint: GrammarPointDetail;
    sceneTag?: string;
    sceneTagLabel?: string;
    registerTag?: string;
    registerTagLabel?: string;
    level: PracticeLevel;
  }): Promise<GeneratedPractice> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const variation = buildPracticeVariation();
    const fallback = buildFallbackPractice({
      ...input,
      variation,
    });

    if (!aiGatewayRequest) {
      return fallback;
    }

    const responseText = await this.requestText(aiGatewayRequest, {
      role: "defaultTeacher",
      maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语语法练习生成器。你只返回严格 JSON，不返回 Markdown。",
      userPrompt: buildPracticeGenerationPrompt({
        ...input,
        variation,
      }),
    });
    const parsed = responseText
      ? parsePracticeOutput(extractJsonObject(responseText))
      : null;

    return parsed &&
      isPlannedExerciseSafe({
        ...parsed,
        exerciseType: "guided_translation",
        grammarPoint: input.grammarPoint.grammarPoint,
      })
      ? {
          ...parsed,
          source: "ai",
        }
      : fallback;
  }

  async evaluateSentence(input: {
    grammarPoint: GrammarPointDetail;
    sentence: string;
    sceneTag?: string;
    sceneTagLabel?: string;
    registerTag?: string;
    registerTagLabel?: string;
    promptText?: string;
    answerContract?: AnswerContract;
    rubric?: PracticeRubric;
  }): Promise<EvaluatedSentence> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallback = applyAnswerContractEquivalence(
      input,
      buildFallbackFeedback(input)
    );

    if (!aiGatewayRequest) {
      return makeFeedbackConversational(fallback);
    }

    const responseText = await this.requestText(aiGatewayRequest, {
      role: "premiumTeacher",
      maxOutputTokens: FEEDBACK_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语语法反馈教练。你只返回严格 JSON，不返回 Markdown。",
      userPrompt: buildSentenceFeedbackPrompt(input),
    });
    const parsed = responseText
      ? parseFeedbackOutput(extractJsonObject(responseText), input.grammarPoint.id)
      : null;

    const evaluated = parsed
      ? applyAnswerContractEquivalence(input, {
          ...parsed,
          source: "ai" as const,
          modelName: resolveAiModel("premiumTeacher"),
        })
      : fallback;
    return makeFeedbackConversational(evaluated);
  }
}
