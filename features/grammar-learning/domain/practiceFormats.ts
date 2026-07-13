import type { PracticeExerciseType } from "@/shared/types/practice";
import type { PracticeIntent } from "@/features/grammar-learning/domain/practiceV2";

export const ACTIVE_PRACTICE_GENERATION_TYPES = [
  "meaning_choice",
  "contrast_choice",
  "guided_translation",
] as const satisfies readonly PracticeExerciseType[];

export type ActivePracticeGenerationType =
  (typeof ACTIVE_PRACTICE_GENERATION_TYPES)[number];

export function isActivePracticeGenerationType(
  value: PracticeExerciseType
): value is ActivePracticeGenerationType {
  return ACTIVE_PRACTICE_GENERATION_TYPES.includes(
    value as ActivePracticeGenerationType
  );
}

export function toActivePracticeIntent(
  intent: PracticeIntent,
  hasComparison: boolean
): PracticeIntent {
  const exerciseType: ActivePracticeGenerationType =
    intent.exerciseType === "guided_translation"
      ? "guided_translation"
      : intent.exerciseType === "form_repair" ||
          intent.exerciseType === "register_rewrite" ||
          intent.exerciseType === "contextual_response"
        ? "guided_translation"
      : intent.exerciseType === "contrast_choice" && hasComparison
        ? "contrast_choice"
        : intent.exerciseType === "meaning_choice"
          ? "meaning_choice"
          : intent.learningObjective === "grammar_selection" && hasComparison
            ? "contrast_choice"
            : intent.learningObjective === "meaning"
              ? "meaning_choice"
              : "guided_translation";
  const isChoice =
    exerciseType === "meaning_choice" || exerciseType === "contrast_choice";

  return {
    ...intent,
    blueprintId: exerciseType,
    exerciseType,
    cognitiveOperation: isChoice
      ? exerciseType === "contrast_choice"
        ? "select"
        : "recognize"
      : "constrained_produce",
    scaffoldLevel: isChoice
      ? "options"
      : intent.scaffoldLevel === "options"
        ? "semantic_hint"
        : intent.scaffoldLevel,
    answerPolicy: {
      ...intent.answerPolicy,
      responseMode: isChoice ? "choice" : "text",
      requireExactChoice: isChoice,
      allowEquivalentAnswers: !isChoice,
    },
  };
}
