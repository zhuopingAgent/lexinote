import type { PracticeReferenceAnswer } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeDifficulty,
  PracticeExerciseOption,
  PracticeExerciseType,
  PracticeResponseMode,
  PracticeSkillDimension,
} from "@/shared/types/practice";

export const PRACTICE_V2_SCHEMA_VERSION = 2;

export const LEARNING_OBJECTIVES = [
  "meaning",
  "form_connection",
  "grammar_selection",
  "register_control",
  "collocation_naturalness",
  "discourse_function",
] as const;

export type LearningObjective = (typeof LEARNING_OBJECTIVES)[number];

export const COGNITIVE_OPERATIONS = [
  "recognize",
  "select",
  "repair",
  "transform",
  "constrained_produce",
  "respond",
] as const;

export type CognitiveOperation = (typeof COGNITIVE_OPERATIONS)[number];
export type TransferLevel = "reproduction" | "near_transfer" | "far_transfer";
export type ScaffoldLevel =
  | "options"
  | "semantic_hint"
  | "form_hint"
  | "partial_sentence"
  | "none";

export type PracticeIntentContext = PracticeContext & {
  scenario: string;
  participants: string[];
  relationship: string;
  register: string;
  previousTurn: string | null;
};

export type AnswerPolicy = {
  responseMode: PracticeResponseMode;
  allowEquivalentAnswers: boolean;
  requireExactChoice: boolean;
  maxAttempts: number;
};

export type AnswerContract = {
  requiredMeaningSlots: string[];
  requiredGrammarFeatures: string[];
  allowedVariants: string[];
  allowedRegisterRange: Array<"casual" | "polite" | "business">;
  prohibitedPatterns: string[];
  acceptableAlternativePolicy: "exact" | "equivalent_meaning" | "natural_variants";
  assessedDimensions: Array<
    "grammar" | "meaning" | "naturalness" | "register" | "contextFit"
  >;
  passCriteria: {
    minimumDimensionScore: 0 | 1 | 2 | 3;
    requiredDimensions: Array<
      "grammar" | "meaning" | "naturalness" | "register" | "contextFit"
    >;
    fatalErrorCodes: string[];
  };
};

export type PracticeIntent = {
  targetGrammarPointId: string;
  targetSenseKey: string;
  blueprintId: string;
  blueprintVersion: number;
  exerciseType: PracticeExerciseType;
  legacySkillDimension: PracticeSkillDimension;
  learningObjective: LearningObjective;
  cognitiveOperation: CognitiveOperation;
  transferLevel: TransferLevel;
  scaffoldLevel: ScaffoldLevel;
  targetMisconceptionCode: string | null;
  comparisonGrammarPointIds: string[];
  communicativeGoal: string;
  context: PracticeIntentContext;
  difficulty: PracticeDifficulty;
  difficultyDrivers: string[];
  vocabularyBudget: {
    maxNewWords: number;
    maximumLevel: "basic" | "intermediate" | "advanced";
  };
  requiredEvidence: string[];
  answerPolicy: AnswerPolicy;
  planMetadata?: {
    plannedAt: string;
    randomTieBreak: number;
  };
};

export type PracticeRubric = {
  primaryDimension: AnswerContract["assessedDimensions"][number];
  assessedDimensions: AnswerContract["assessedDimensions"];
  scoringNotes: string[];
};

export type PracticeHint = {
  level: ScaffoldLevel;
  content: string;
  revealsForm: boolean;
  revealsAnswer: boolean;
};

export type PracticeGenerationMetadata = {
  promptId: string;
  promptVersion: number;
  schemaVersion: number;
  grammarContentVersion: string;
  model: string | null;
  generationSource: "ai" | "fallback" | "deterministic";
  validationResults: GenerationValidationResult[];
  reviewerResult: PracticeReviewerResult | null;
  generationRetryCount: number;
  networkRetryCount: number;
  fallbackReason: string | null;
  degradationReason: string | null;
  latencyMs: number;
};

type PracticeItemBase = {
  id: string;
  intent: PracticeIntent;
  instructionZh: string;
  prompt: string;
  context: PracticeIntentContext;
  referenceAnswers: PracticeReferenceAnswer[];
  answerContract: AnswerContract;
  rubric: PracticeRubric;
  hints: PracticeHint[];
  generationMetadata: PracticeGenerationMetadata;
};

export type MeaningChoiceItem = PracticeItemBase & {
  exerciseType: "meaning_choice";
  choices: PracticeExerciseOption[];
  correctChoiceId: string;
  distractorReasons: Record<string, string>;
};

export type FormRepairItem = PracticeItemBase & {
  exerciseType: "form_repair";
  incorrectSentence: string;
  targetErrorType: string;
  errorSpan: string;
  correctedSentence: string;
};

export type ContrastChoiceItem = PracticeItemBase & {
  exerciseType: "contrast_choice";
  choices: PracticeExerciseOption[];
  correctChoiceId: string;
  distractorReasons: Record<string, string>;
};

export type RegisterRewriteItem = PracticeItemBase & {
  exerciseType: "register_rewrite";
  sourceSentence: string;
  targetRegister: "casual" | "polite" | "business";
};

export type ConstrainedTranslationItem = PracticeItemBase & {
  exerciseType: "guided_translation";
  chineseSentence: string;
};

export type ScenarioResponseItem = PracticeItemBase & {
  exerciseType: "contextual_response";
  previousTurn: string;
  speakerRelationship: string;
  communicativeGoal: string;
  requiredInformation: string[];
};

export type PracticeItemV2 =
  | MeaningChoiceItem
  | FormRepairItem
  | ContrastChoiceItem
  | RegisterRewriteItem
  | ConstrainedTranslationItem
  | ScenarioResponseItem;

export type PracticeBlueprintV2 = {
  id: string;
  slug: string;
  grammarPointId: string | null;
  senseKey: string | null;
  exerciseType: PracticeExerciseType;
  learningObjective: LearningObjective;
  cognitiveOperation: CognitiveOperation;
  supportedTransferLevels: TransferLevel[];
  supportedRegisters: Array<"casual" | "polite" | "business">;
  supportedScenarios: string[];
  misconceptionCodes: string[];
  contextRequirements: string[];
  difficultyRules: Record<string, unknown>;
  answerPolicy: AnswerPolicy;
  rubric: PracticeRubric;
  hintPlan: ScaffoldLevel[];
  version: number;
  active: boolean;
};

export const GENERATION_ERROR_CODES = [
  "SCHEMA_INVALID",
  "TARGET_SENSE_MISMATCH",
  "TARGET_FORM_MISSING",
  "CONNECTION_INVALID",
  "UNNATURAL_REFERENCE",
  "REGISTER_MISMATCH",
  "CONTEXT_MISMATCH",
  "ANSWER_LEAK",
  "AMBIGUOUS_CHOICES",
  "DUPLICATE_CHOICES",
  "INCOMPLETE_CHINESE_PROMPT",
  "FAKE_CONTEXT_VARIATION",
  "MULTIPLE_PRIMARY_ERRORS",
  "DIFFICULTY_MISMATCH",
  "INTERNAL_LABEL_EXPOSED",
  "MARKDOWN_NOT_ALLOWED",
] as const;

export type GenerationErrorCode = (typeof GENERATION_ERROR_CODES)[number];

export type GenerationValidationResult = {
  valid: boolean;
  errorCodes: GenerationErrorCode[];
  details: string[];
  stage: "schema" | "static" | "contract";
};

export type PracticeReviewerResult = {
  valid: boolean;
  errorCodes: GenerationErrorCode[];
  repairInstructions: string[];
  confidence: number;
};

export type PracticeDimensionScore = 0 | 1 | 2 | 3 | "not_assessed";

export type PracticeRubricScores = {
  grammar: PracticeDimensionScore;
  meaning: PracticeDimensionScore;
  naturalness: PracticeDimensionScore;
  register: PracticeDimensionScore;
  contextFit: PracticeDimensionScore;
};

export type MasteryEvidenceKind =
  | "independent"
  | "assisted"
  | "exposure"
  | "recognition";

export function isPracticeGenerationV2Enabled(
  env: Record<string, string | undefined> = process.env
) {
  return /^(1|true|yes|on)$/i.test(env.PRACTICE_GENERATION_V2?.trim() ?? "");
}

export function legacySkillForObjective(
  objective: LearningObjective,
  operation: CognitiveOperation,
  transferLevel: TransferLevel
): PracticeSkillDimension {
  if (transferLevel === "far_transfer") return "transfer_naturalness";
  if (operation === "constrained_produce" || operation === "respond") {
    return "contextual_production";
  }
  if (objective === "form_connection") return "form_connection";
  if (objective === "grammar_selection") return "contrast_selection";
  if (objective === "register_control") return "register_control";
  return "meaning_discrimination";
}

export function assertPracticeIntent(value: PracticeIntent): PracticeIntent {
  if (!value.targetGrammarPointId || !value.targetSenseKey || !value.blueprintId) {
    throw new Error("PracticeIntent requires a target grammar sense and blueprint.");
  }
  if (!LEARNING_OBJECTIVES.includes(value.learningObjective)) {
    throw new Error("PracticeIntent has an invalid learning objective.");
  }
  if (!COGNITIVE_OPERATIONS.includes(value.cognitiveOperation)) {
    throw new Error("PracticeIntent has an invalid cognitive operation.");
  }
  if (value.requiredEvidence.length === 0) {
    throw new Error("PracticeIntent requires observable evidence.");
  }
  return value;
}

export function assertAnswerContract(value: AnswerContract): AnswerContract {
  if (value.requiredGrammarFeatures.length === 0) {
    throw new Error("AnswerContract requires at least one grammar feature.");
  }
  if (value.assessedDimensions.length === 0) {
    throw new Error("AnswerContract requires assessed dimensions.");
  }
  if (
    value.passCriteria.requiredDimensions.some(
      (dimension) => !value.assessedDimensions.includes(dimension)
    )
  ) {
    throw new Error("AnswerContract cannot require an unassessed dimension.");
  }
  return value;
}

export function toPracticeRubricScores(input: {
  contract: AnswerContract;
  legacyScores: {
    grammar: number;
    meaning: number;
    naturalness: number;
    register: number;
    contextFit: number;
  };
}): PracticeRubricScores {
  const assessed = new Set(input.contract.assessedDimensions);
  const convert = (
    dimension: AnswerContract["assessedDimensions"][number],
    value: number
  ): PracticeDimensionScore => {
    if (!assessed.has(dimension)) return "not_assessed";
    if (value <= 1) return 0;
    if (value === 2) return 1;
    if (value <= 4) return 2;
    return 3;
  };
  return {
    grammar: convert("grammar", input.legacyScores.grammar),
    meaning: convert("meaning", input.legacyScores.meaning),
    naturalness: convert("naturalness", input.legacyScores.naturalness),
    register: convert("register", input.legacyScores.register),
    contextFit: convert("contextFit", input.legacyScores.contextFit),
  };
}

export function resolveMasteryEvidence(input: {
  isCorrect: boolean;
  responseMode: PracticeResponseMode;
  transferLevel: TransferLevel;
  hintCount: number;
  attemptNumber: number;
  revealed?: boolean;
}) {
  if (input.revealed) {
    return { kind: "exposure" as const, weight: 0 };
  }
  if (!input.isCorrect) {
    return {
      kind: input.hintCount > 0 || input.attemptNumber > 1 ? "assisted" as const : "independent" as const,
      weight: 0,
    };
  }
  if (input.responseMode === "choice") {
    return { kind: "recognition" as const, weight: 0.45 };
  }
  if (input.hintCount > 0 || input.attemptNumber > 1) {
    return { kind: "assisted" as const, weight: Math.max(0.35, 0.68 - input.hintCount * 0.1) };
  }
  return {
    kind: "independent" as const,
    weight: input.transferLevel === "far_transfer" ? 1 : input.transferLevel === "near_transfer" ? 0.9 : 0.78,
  };
}

export function passesAnswerContract(
  contract: AnswerContract,
  scores: PracticeRubricScores
) {
  return contract.passCriteria.requiredDimensions.every((dimension) => {
    const score = scores[dimension];
    return score !== "not_assessed" && score >= contract.passCriteria.minimumDimensionScore;
  });
}
