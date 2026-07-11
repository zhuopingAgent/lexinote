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
  parseFeedbackOutput,
  parsePracticeOutput,
  type EvaluatedSentence,
  type GeneratedPractice,
} from "@/features/grammar-learning/infrastructure/GrammarAiOutput";
import {
  buildFallbackFeedback,
  buildFallbackPractice,
  buildPracticeVariation,
} from "@/features/grammar-learning/infrastructure/GrammarFallback";

export type {
  EvaluatedSentence,
  GeneratedPractice,
} from "@/features/grammar-learning/infrastructure/GrammarAiOutput";

const PRACTICE_MAX_OUTPUT_TOKENS = 820;
const FEEDBACK_MAX_OUTPUT_TOKENS = 760;

export class GrammarAiClient {
  async generatePlannedExercise(input: PlannedTextExerciseInput): Promise<GeneratedPractice> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallback = buildPlannedExerciseFallback(input);

    if (!aiGatewayRequest) {
      return fallback;
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "defaultTeacher",
      maxOutputTokens: PRACTICE_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你只负责把确定的教学规格实现成自然日语练习。只返回严格 JSON。",
      userPrompt: buildPlannedExerciseGenerationPrompt(input),
    });
    const parsed = responseText
      ? parsePracticeOutput(extractJsonObject(responseText))
      : null;

    return parsed && isPlannedExerciseSafe(parsed)
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

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
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

    return parsed
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
  }): Promise<EvaluatedSentence> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallback = buildFallbackFeedback(input);

    if (!aiGatewayRequest) {
      return fallback;
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "premiumTeacher",
      maxOutputTokens: FEEDBACK_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语语法反馈教练。你只返回严格 JSON，不返回 Markdown。",
      userPrompt: buildSentenceFeedbackPrompt(input),
    });
    const parsed = responseText
      ? parseFeedbackOutput(extractJsonObject(responseText), input.grammarPoint.id)
      : null;

    return parsed
      ? {
          ...parsed,
          source: "ai",
          modelName: resolveAiModel("premiumTeacher"),
        }
      : fallback;
  }
}
