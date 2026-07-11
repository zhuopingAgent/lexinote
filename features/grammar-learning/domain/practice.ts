import type { GrammarPointDetail, GrammarPointType } from "@/shared/types/grammar";
import type {
  PracticeDifficulty,
  PracticeExerciseType,
  PracticeResponseMode,
  PracticeSkillDimension,
  PracticeSkillState,
} from "@/shared/types/practice";
import type {
  LearningObjective,
  TransferLevel,
} from "@/features/grammar-learning/domain/practiceV2";

export const PRACTICE_SKILL_DIMENSIONS: readonly PracticeSkillDimension[] = [
  "meaning_discrimination",
  "form_connection",
  "contrast_selection",
  "register_control",
  "contextual_production",
  "transfer_naturalness",
];

export const PRACTICE_SKILL_LABELS: Record<PracticeSkillDimension, string> = {
  meaning_discrimination: "意义辨析",
  form_connection: "形式与接续",
  contrast_selection: "易混选择",
  register_control: "语体控制",
  contextual_production: "场景表达",
  transfer_naturalness: "迁移与自然度",
};

export const PRACTICE_EXERCISE_LABELS: Record<PracticeExerciseType, string> = {
  meaning_choice: "意义选择",
  form_repair: "形式修复",
  contrast_choice: "易混辨析",
  register_rewrite: "语体转换",
  guided_translation: "受限中译日",
  contextual_response: "场景回应",
};

export const PRACTICE_OBJECTIVE_LABELS: Record<LearningObjective, string> = {
  meaning: "意义理解",
  form_connection: "接续与形式",
  grammar_selection: "语法选择",
  register_control: "语体控制",
  collocation_naturalness: "搭配与自然度",
  discourse_function: "篇章功能",
};

export const PRACTICE_TRANSFER_LABELS: Record<TransferLevel, string> = {
  reproduction: "复现",
  near_transfer: "近迁移",
  far_transfer: "新场景迁移",
};

export type PracticePlan = {
  blueprintSlug: string;
  skillDimension: PracticeSkillDimension;
  exerciseType: PracticeExerciseType;
  responseMode: PracticeResponseMode;
  difficulty: PracticeDifficulty;
};

const SKILL_SEQUENCE_BY_POINT_TYPE: Record<
  GrammarPointType,
  readonly PracticeSkillDimension[]
> = {
  conjugation: [
    "form_connection",
    "meaning_discrimination",
    "contextual_production",
    "form_connection",
    "transfer_naturalness",
  ],
  particle: [
    "meaning_discrimination",
    "contrast_selection",
    "form_connection",
    "contextual_production",
    "transfer_naturalness",
  ],
  grammar_pattern: [
    "meaning_discrimination",
    "form_connection",
    "register_control",
    "contextual_production",
    "transfer_naturalness",
  ],
  sentence_pattern: [
    "meaning_discrimination",
    "form_connection",
    "contextual_production",
    "register_control",
    "transfer_naturalness",
  ],
  syntax_concept: [
    "meaning_discrimination",
    "contrast_selection",
    "form_connection",
    "contextual_production",
    "transfer_naturalness",
  ],
  collocation: [
    "meaning_discrimination",
    "form_connection",
    "contextual_production",
    "register_control",
    "transfer_naturalness",
  ],
  register_concept: [
    "meaning_discrimination",
    "register_control",
    "contrast_selection",
    "contextual_production",
    "transfer_naturalness",
  ],
  discourse_marker: [
    "meaning_discrimination",
    "contrast_selection",
    "form_connection",
    "contextual_production",
    "transfer_naturalness",
  ],
};

function exerciseForSkill(
  skillDimension: PracticeSkillDimension,
  hasComparison: boolean
): Pick<PracticePlan, "blueprintSlug" | "exerciseType" | "responseMode"> {
  switch (skillDimension) {
    case "meaning_discrimination":
      return {
        blueprintSlug: "meaning_choice",
        exerciseType: "meaning_choice",
        responseMode: "choice",
      };
    case "form_connection":
      return {
        blueprintSlug: "form_repair",
        exerciseType: "form_repair",
        responseMode: "text",
      };
    case "contrast_selection":
      return hasComparison
        ? {
            blueprintSlug: "contrast_choice",
            exerciseType: "contrast_choice",
            responseMode: "choice",
          }
        : {
            blueprintSlug: "meaning_choice",
            exerciseType: "meaning_choice",
            responseMode: "choice",
          };
    case "register_control":
      return {
        blueprintSlug: "register_rewrite",
        exerciseType: "register_rewrite",
        responseMode: "text",
      };
    case "contextual_production":
      return {
        blueprintSlug: "guided_translation",
        exerciseType: "guided_translation",
        responseMode: "text",
      };
    case "transfer_naturalness":
      return {
        blueprintSlug: "contextual_response",
        exerciseType: "contextual_response",
        responseMode: "text",
      };
  }
}

export function difficultyFromSkillState(
  skillState: PracticeSkillState | undefined,
  responseMode: PracticeResponseMode
): PracticeDifficulty {
  const estimate = skillState?.estimate ?? 0.35;
  const difficulty: PracticeDifficulty =
    estimate < 0.35 ? 1 : estimate < 0.55 ? 2 : estimate < 0.78 ? 3 : 4;

  return responseMode === "choice" ? Math.min(difficulty, 3) as PracticeDifficulty : difficulty;
}

export function planPracticeExercise(input: {
  grammarPoint: GrammarPointDetail;
  sequenceNumber: number;
  skillStates: PracticeSkillState[];
}): PracticePlan {
  const baseSequence = SKILL_SEQUENCE_BY_POINT_TYPE[input.grammarPoint.pointType];
  const sequence =
    input.grammarPoint.comparisonSets.length > 0 &&
    !baseSequence.includes("contrast_selection")
      ? [
          ...baseSequence.slice(0, 2),
          "contrast_selection" as const,
          ...baseSequence.slice(2),
        ]
      : baseSequence;
  const scheduledSkill = sequence[(input.sequenceNumber - 1) % sequence.length];
  const unpracticedSkill = sequence.find(
    (skill) =>
      !input.skillStates.some((state) => state.skillDimension === skill)
  );
  const weakestSkill = input.skillStates
    .filter((state) => sequence.includes(state.skillDimension))
    .sort((left, right) => left.estimate - right.estimate)[0];
  const skillDimension =
    input.sequenceNumber === 1 && (unpracticedSkill || weakestSkill)
      ? unpracticedSkill ?? weakestSkill?.skillDimension ?? scheduledSkill
      : scheduledSkill;
  const exercise = exerciseForSkill(
    skillDimension,
    input.grammarPoint.comparisonSets.length > 0
  );
  const skillState = input.skillStates.find(
    (state) => state.skillDimension === skillDimension
  );

  return {
    ...exercise,
    skillDimension,
    difficulty: difficultyFromSkillState(skillState, exercise.responseMode),
  };
}

export function calculateEvidenceScore(input: {
  isCorrect: boolean;
  attemptNumber: number;
  hintCount: number;
  skillDimension: PracticeSkillDimension;
  revealed?: boolean;
}) {
  if (input.revealed) {
    return 0.2;
  }
  if (!input.isCorrect) {
    return 0;
  }

  const attemptWeight = input.attemptNumber === 1 ? 1 : 0.65;
  const hintWeight = Math.max(0.35, 1 - input.hintCount * 0.18);
  const transferWeight = input.skillDimension === "transfer_naturalness" ? 1.15 : 1;

  return Math.min(1, attemptWeight * hintWeight * transferWeight);
}

export function normalizeRegisterPreset(value?: string | null) {
  if (value === "casual" || value === "rough") {
    return "casual" as const;
  }
  if (
    value === "business" ||
    value === "formal" ||
    value === "written" ||
    value === "customer" ||
    value === "academic" ||
    value === "news"
  ) {
    return "business" as const;
  }
  return "polite" as const;
}
