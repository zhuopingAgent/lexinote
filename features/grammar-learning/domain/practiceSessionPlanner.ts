import type { GrammarPointDetail } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeExerciseType,
  PracticeObjectiveState,
  PracticeSkillState,
} from "@/shared/types/practice";
import {
  legacySkillForObjective,
  type CognitiveOperation,
  type LearningObjective,
  type PracticeIntent,
  type ScaffoldLevel,
  type TransferLevel,
} from "@/features/grammar-learning/domain/practiceV2";
import {
  findPracticeSpecialization,
  resolvePracticeSpecialization,
  type PracticeSpecialization,
} from "@/features/grammar-learning/domain/practiceSpecializations";

export type PracticePlannerSource = {
  now(): Date;
  next(): number;
};

export type PracticePlannerHistory = {
  consecutiveFailures: number;
  recentErrorCodes: string[];
  prerequisiteReady: boolean;
  lastPracticedAt?: string | null;
  prerequisiteLevel?: "not_started" | "exposed" | "assisted" | "independent";
  recentHintCount?: number;
  assistedAttemptRate?: number;
  exposureCount?: number;
};

type PlanStep = {
  exerciseType: PracticeExerciseType;
  objective: LearningObjective;
  operation: CognitiveOperation;
  transfer: TransferLevel;
  scaffold: ScaffoldLevel;
};

const WEAK_SEQUENCE: PlanStep[] = [
  { exerciseType: "meaning_choice", objective: "meaning", operation: "recognize", transfer: "reproduction", scaffold: "options" },
  { exerciseType: "form_repair", objective: "form_connection", operation: "repair", transfer: "reproduction", scaffold: "form_hint" },
  { exerciseType: "form_repair", objective: "form_connection", operation: "repair", transfer: "near_transfer", scaffold: "semantic_hint" },
  { exerciseType: "guided_translation", objective: "form_connection", operation: "constrained_produce", transfer: "near_transfer", scaffold: "partial_sentence" },
  { exerciseType: "guided_translation", objective: "form_connection", operation: "constrained_produce", transfer: "near_transfer", scaffold: "semantic_hint" },
];

const DEVELOPING_SEQUENCE: PlanStep[] = [
  { exerciseType: "meaning_choice", objective: "meaning", operation: "recognize", transfer: "reproduction", scaffold: "options" },
  { exerciseType: "contrast_choice", objective: "grammar_selection", operation: "select", transfer: "near_transfer", scaffold: "options" },
  { exerciseType: "register_rewrite", objective: "register_control", operation: "transform", transfer: "near_transfer", scaffold: "semantic_hint" },
  { exerciseType: "guided_translation", objective: "register_control", operation: "constrained_produce", transfer: "near_transfer", scaffold: "none" },
  { exerciseType: "contextual_response", objective: "register_control", operation: "respond", transfer: "far_transfer", scaffold: "none" },
];

const FAILURE_SEQUENCE: PlanStep[] = [
  { exerciseType: "meaning_choice", objective: "meaning", operation: "recognize", transfer: "reproduction", scaffold: "options" },
  { exerciseType: "contrast_choice", objective: "meaning", operation: "select", transfer: "reproduction", scaffold: "options" },
  { exerciseType: "form_repair", objective: "form_connection", operation: "repair", transfer: "reproduction", scaffold: "form_hint" },
  { exerciseType: "guided_translation", objective: "form_connection", operation: "constrained_produce", transfer: "near_transfer", scaffold: "partial_sentence" },
  { exerciseType: "form_repair", objective: "form_connection", operation: "repair", transfer: "near_transfer", scaffold: "semantic_hint" },
];

const POLITE_REQUEST_SEQUENCE: PlanStep[] = [
  { exerciseType: "meaning_choice", objective: "meaning", operation: "recognize", transfer: "reproduction", scaffold: "options" },
  { exerciseType: "register_rewrite", objective: "register_control", operation: "transform", transfer: "reproduction", scaffold: "semantic_hint" },
  { exerciseType: "register_rewrite", objective: "register_control", operation: "repair", transfer: "near_transfer", scaffold: "form_hint" },
  { exerciseType: "guided_translation", objective: "register_control", operation: "constrained_produce", transfer: "near_transfer", scaffold: "partial_sentence" },
  { exerciseType: "contextual_response", objective: "register_control", operation: "respond", transfer: "near_transfer", scaffold: "semantic_hint" },
];

function meanEstimate(
  objectiveStates: PracticeObjectiveState[],
  legacyStates: PracticeSkillState[]
) {
  const states = objectiveStates.length > 0 ? objectiveStates : legacyStates;
  if (states.length === 0) return 0.35;
  return states.reduce((sum, state) => sum + state.estimate, 0) / states.length;
}

function supportsContrast(grammarPoint: GrammarPointDetail) {
  return (grammarPoint.comparisonSets ?? []).some((set) => set.members.length >= 2);
}

function reliableType(
  step: PlanStep,
  grammarPoint: GrammarPointDetail,
  history: PracticePlannerHistory
): PlanStep {
  if (step.exerciseType === "contrast_choice" && !supportsContrast(grammarPoint)) {
    return { ...step, exerciseType: "meaning_choice", operation: "select", objective: "meaning" };
  }
  const prerequisiteLevel = history.prerequisiteLevel ??
    (history.prerequisiteReady ? "independent" : "not_started");
  if (prerequisiteLevel !== "independent" && step.transfer === "far_transfer") {
    return {
      ...step,
      exerciseType: "guided_translation",
      operation: "constrained_produce",
      transfer: "near_transfer",
      scaffold: "partial_sentence",
    };
  }
  return step;
}

function supportedObjectives(grammarPoint: GrammarPointDetail) {
  const objectives = new Set<LearningObjective>(["meaning"]);
  if ((grammarPoint.connections ?? []).length > 0) objectives.add("form_connection");
  if (supportsContrast(grammarPoint)) objectives.add("grammar_selection");
  if (
    grammarPoint.pointType === "register_concept" ||
    /て(?:もらえ|いただけ)ますか/.test(grammarPoint.grammarPoint) ||
    /honorific|register|politeness/.test(
      `${grammarPoint.categoryGroupSlug ?? ""} ${grammarPoint.categorySlug ?? ""}`
    )
  ) objectives.add("register_control");
  if (grammarPoint.pointType === "collocation") objectives.add("collocation_naturalness");
  if (grammarPoint.pointType === "discourse_marker") objectives.add("discourse_function");
  return Array.from(objectives);
}

const ERROR_OBJECTIVES: Record<string, LearningObjective> = {
  conjugation_error: "form_connection",
  connection_error: "form_connection",
  tense_aspect_error: "form_connection",
  particle_error: "grammar_selection",
  giving_receiving_direction_error: "grammar_selection",
  register_mismatch: "register_control",
  collocation_error: "collocation_naturalness",
  literal_translation: "collocation_naturalness",
  unnatural_expression: "collocation_naturalness",
  semantic_error: "meaning",
};

const ERROR_LABELS: Record<string, string> = {
  conjugation_error: "活用错误",
  connection_error: "接续错误",
  particle_error: "助词选择",
  tense_aspect_error: "时态与体",
  giving_receiving_direction_error: "授受方向",
  semantic_error: "意义偏差",
  register_mismatch: "语体不匹配",
  collocation_error: "搭配错误",
  literal_translation: "直译表达",
  unnatural_expression: "表达不自然",
};

function objectiveNeedScore(
  objective: LearningObjective,
  states: PracticeObjectiveState[]
) {
  const state = states.find((item) => item.learningObjective === objective);
  if (!state) return -1;
  const assistedRatio = state.attempts > 0
    ? state.assistedAttempts / state.attempts
    : 0;
  return state.estimate + state.confidence * 0.12 - assistedRatio * 0.2 - Math.min(0.2, state.exposureCount * 0.04);
}

function adaptStepToObjective(
  step: PlanStep,
  objective: LearningObjective,
  grammarPoint: GrammarPointDetail
): PlanStep {
  if (objective === "meaning") {
    return step.operation === "constrained_produce" || step.operation === "respond"
      ? { ...step, objective, exerciseType: "guided_translation", operation: "constrained_produce" }
      : { ...step, objective, exerciseType: "meaning_choice", operation: "recognize", scaffold: "options" };
  }
  if (objective === "form_connection") {
    return step.transfer === "reproduction"
      ? { ...step, objective, exerciseType: "form_repair", operation: "repair" }
      : { ...step, objective, exerciseType: "guided_translation", operation: "constrained_produce" };
  }
  if (objective === "grammar_selection") {
    return supportsContrast(grammarPoint)
      ? { ...step, objective, exerciseType: "contrast_choice", operation: "select", scaffold: "options" }
      : { ...step, objective: "meaning", exerciseType: "meaning_choice", operation: "select", scaffold: "options" };
  }
  if (objective === "register_control") {
    return step.operation === "respond" || step.transfer === "far_transfer"
      ? { ...step, objective, exerciseType: "contextual_response", operation: "respond" }
      : step.operation === "constrained_produce"
        ? { ...step, objective, exerciseType: "guided_translation", operation: "constrained_produce" }
        : { ...step, objective, exerciseType: "register_rewrite", operation: "transform" };
  }
  if (objective === "collocation_naturalness") {
    return step.transfer === "far_transfer"
      ? { ...step, objective, exerciseType: "contextual_response", operation: "respond" }
      : { ...step, objective, exerciseType: "guided_translation", operation: "constrained_produce" };
  }
  return step.transfer === "far_transfer"
    ? { ...step, objective, exerciseType: "contextual_response", operation: "respond" }
    : supportsContrast(grammarPoint)
      ? { ...step, objective, exerciseType: "contrast_choice", operation: "select", scaffold: "options" }
      : { ...step, objective, exerciseType: "guided_translation", operation: "constrained_produce" };
}

function resolvePrimaryObjectives(
  grammarPoint: GrammarPointDetail,
  states: PracticeSkillState[],
  objectiveStates: PracticeObjectiveState[],
  history: PracticePlannerHistory,
  specialization: PracticeSpecialization | null
) {
  const errors = new Set([
    ...history.recentErrorCodes,
    ...states.flatMap((state) => state.recentErrorCodes),
    ...objectiveStates.flatMap((state) => state.recentErrorCodes),
  ]);
  const supported = supportedObjectives(grammarPoint);
  const errorObjective = Array.from(errors)
    .map((code) => ERROR_OBJECTIVES[code])
    .find((objective) => objective && supported.includes(objective));
  const ranked = [...supported].sort((left, right) => {
    const leftPriority = specialization?.priorityObjectives.indexOf(left) ?? -1;
    const rightPriority = specialization?.priorityObjectives.indexOf(right) ?? -1;
    const leftBias = leftPriority >= 0 ? (specialization!.priorityObjectives.length - leftPriority) * 0.08 : 0;
    const rightBias = rightPriority >= 0 ? (specialization!.priorityObjectives.length - rightPriority) * 0.08 : 0;
    return objectiveNeedScore(left, objectiveStates) - leftBias -
      (objectiveNeedScore(right, objectiveStates) - rightBias);
  });
  const selected = [errorObjective, ...ranked].filter(
    (objective, index, items): objective is LearningObjective =>
      Boolean(objective) && items.indexOf(objective) === index
  ).slice(0, 2);
  if (
    /て(?:もらえ|いただけ)ますか/.test(grammarPoint.grammarPoint) &&
    !selected.includes("register_control")
  ) {
    selected.splice(Math.min(1, selected.length), 0, "register_control");
  }
  return new Set(selected.slice(0, 2));
}

function selectionReason(input: {
  objective: LearningObjective;
  history: PracticePlannerHistory;
  objectiveState?: PracticeObjectiveState;
  targetMisconceptionCode: string | null;
  transfer: TransferLevel;
  isRecentMisconception: boolean;
  specializationNameZh?: string | null;
  daysSinceLastPractice?: number | null;
}) {
  if (
    input.daysSinceLastPractice !== null &&
    input.daysSinceLastPractice !== undefined &&
    input.daysSinceLastPractice >= 3 &&
    input.transfer === "reproduction"
  ) {
    return `距离上次练习已有${input.daysSinceLastPractice}天，本题用无提示回忆确认是否仍能独立完成。`;
  }
  if (input.targetMisconceptionCode && input.isRecentMisconception) {
    return `最近出现了${ERROR_LABELS[input.targetMisconceptionCode] ?? "同类问题"}，本题会集中检查这一点。`;
  }
  if (input.targetMisconceptionCode) {
    return `${input.specializationNameZh ?? "这一语法"}中常见${ERROR_LABELS[input.targetMisconceptionCode] ?? "同类问题"}，本题会提前检查。`;
  }
  if ((input.history.exposureCount ?? 0) > 0 && (input.objectiveState?.attempts ?? 0) === 0) {
    return "上次查看过参考答案，本题用于确认是否已经能够自行完成。";
  }
  if ((input.history.recentHintCount ?? 0) > 0 || (input.history.assistedAttemptRate ?? 0) >= 0.5) {
    return "最近需要提示才能完成，本题会保留适量支架并重新检查。";
  }
  if (input.transfer === "far_transfer") {
    return "基础表现已经稳定，本题检查能否迁移到新的沟通场景。";
  }
  if (input.objectiveState && input.objectiveState.estimate < 0.55) {
    return "这一学习目标目前相对薄弱，本组会优先加强。";
  }
  return "根据当前学习顺序安排，用于巩固这一具体语法用法。";
}

function alternateIntentType(intent: PracticeIntent): PracticeIntent {
  const candidates: Record<LearningObjective, PracticeExerciseType[]> = {
    meaning: ["meaning_choice", "guided_translation"],
    form_connection: ["form_repair", "guided_translation"],
    grammar_selection: ["contrast_choice", "meaning_choice", "guided_translation"],
    register_control: ["register_rewrite", "guided_translation", "contextual_response"],
    collocation_naturalness: ["form_repair", "guided_translation", "contextual_response"],
    discourse_function: ["contrast_choice", "guided_translation", "contextual_response"],
  };
  const specialization = findPracticeSpecialization(intent.specializationId);
  const exerciseType = candidates[intent.learningObjective].find(
    (candidate) =>
      candidate !== intent.exerciseType &&
      (!specialization || specialization.supportedExerciseTypes.includes(candidate))
  ) ?? intent.exerciseType;
  const responseMode =
    exerciseType === "contrast_choice"
      ? "choice" as const
      : "text" as const;
  const cognitiveOperation: CognitiveOperation =
    exerciseType === "meaning_choice"
      ? "recognize"
      : exerciseType === "contrast_choice"
      ? "select"
      : exerciseType === "form_repair"
        ? "repair"
      : exerciseType === "register_rewrite"
        ? "transform"
        : exerciseType === "contextual_response"
          ? "respond"
          : "constrained_produce";
  return {
    ...intent,
    blueprintId: exerciseType,
    exerciseType,
    cognitiveOperation,
    scaffoldLevel: responseMode === "choice" ? "options" : "semantic_hint",
    legacySkillDimension: legacySkillForObjective(
      intent.learningObjective,
      cognitiveOperation,
      intent.transferLevel
    ),
    answerPolicy: {
      ...intent.answerPolicy,
      responseMode,
      requireExactChoice: responseMode === "choice",
      allowEquivalentAnswers: responseMode === "text",
    },
  };
}

export function buildPracticeSessionPlan(input: {
  grammarPoint: GrammarPointDetail;
  context: PracticeContext;
  skillStates: PracticeSkillState[];
  objectiveStates?: PracticeObjectiveState[];
  history: PracticePlannerHistory;
  count?: number;
  source: PracticePlannerSource;
}): PracticeIntent[] {
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const objectiveStates = input.objectiveStates ?? [];
  const specialization = resolvePracticeSpecialization(input.grammarPoint);
  const estimate = meanEstimate(objectiveStates, input.skillStates);
  const base =
    input.history.consecutiveFailures >= 2
      ? FAILURE_SEQUENCE
      : /て(?:もらえ|いただけ)ますか/.test(input.grammarPoint.grammarPoint)
        ? POLITE_REQUEST_SEQUENCE
      : estimate >= 0.62
        ? DEVELOPING_SEQUENCE
        : WEAK_SEQUENCE;
  const objectives = resolvePrimaryObjectives(
    input.grammarPoint,
    input.skillStates,
    objectiveStates,
    input.history,
    specialization
  );
  const recentError = input.history.recentErrorCodes[0] ??
    objectiveStates.flatMap((state) => state.recentErrorCodes)[0] ??
    input.skillStates.flatMap((state) => state.recentErrorCodes)[0] ?? null;
  const now = input.source.now();
  const plannedAt = now.toISOString();
  const lastPracticedAt = input.history.lastPracticedAt
    ? new Date(input.history.lastPracticedAt)
    : null;
  const daysSinceLastPractice = lastPracticedAt && !Number.isNaN(lastPracticedAt.valueOf())
    ? Math.max(0, Math.floor((now.valueOf() - lastPracticedAt.valueOf()) / 86_400_000))
    : null;
  const prerequisiteLevel = input.history.prerequisiteLevel ??
    (input.history.prerequisiteReady ? "independent" : "not_started");
  const shouldStartWithDelayedRecall =
    estimate >= 0.62 &&
    input.history.consecutiveFailures < 2 &&
    prerequisiteLevel === "independent" &&
    (input.history.recentHintCount ?? 0) === 0 &&
    (input.history.assistedAttemptRate ?? 0) < 0.5 &&
    (input.history.exposureCount ?? 0) === 0 &&
    (daysSinceLastPractice ?? 0) >= 3;

  const plan: PracticeIntent[] = Array.from({ length: count }, (_, index) => {
    let step = reliableType(base[index % base.length], input.grammarPoint, input.history);
    const objectiveList = Array.from(objectives);
    const objective = objectives.has(step.objective)
      ? step.objective
      : objectiveList[index % objectiveList.length];
    if (index === 0 && shouldStartWithDelayedRecall) {
      step = {
        exerciseType: "guided_translation",
        objective,
        operation: "constrained_produce",
        transfer: "reproduction",
        scaffold: "none",
      };
    }
    step = adaptStepToObjective(step, objective, input.grammarPoint);
    if (
      specialization &&
      !specialization.supportedExerciseTypes.includes(step.exerciseType)
    ) {
      const replacement = specialization.supportedExerciseTypes.find((type) =>
        step.objective === "grammar_selection"
          ? type === "contrast_choice"
          : step.objective === "register_control"
            ? type === "register_rewrite" || type === "guided_translation"
            : step.objective === "form_connection"
              ? type === "form_repair" || type === "guided_translation"
              : type === "meaning_choice" || type === "guided_translation"
      ) ?? specialization.supportedExerciseTypes[0];
      step = {
        ...step,
        exerciseType: replacement,
        operation:
          replacement === "meaning_choice" ? "recognize"
            : replacement === "contrast_choice" ? "select"
              : replacement === "form_repair" ? "repair"
                : replacement === "register_rewrite" ? "transform"
                  : replacement === "contextual_response" ? "respond"
                    : "constrained_produce",
        scaffold:
          replacement === "meaning_choice" || replacement === "contrast_choice"
            ? "options"
            : step.scaffold,
      };
    }
    if (input.history.consecutiveFailures >= 2 && step.transfer === "far_transfer") {
      step = { ...step, transfer: "near_transfer", scaffold: "semantic_hint" };
    }
    const targetMisconceptionCode = index === 2
      ? recentError ?? specialization?.misconceptionCodes[0] ?? null
      : null;
    const comparisonGrammarPointIds = input.grammarPoint.comparisonSets
      .flatMap((set) => set.members.map((member) => member.grammarPointId))
      .filter((id) => id !== input.grammarPoint.id)
      .slice(0, 3);
    const objectiveState = objectiveStates.find(
      (state) => state.learningObjective === step.objective
    );
    const objectiveEstimate = objectiveState?.estimate ?? estimate;
    const difficulty = (objectiveEstimate < 0.35 ? 1 : objectiveEstimate < 0.58 ? 2 : objectiveEstimate < 0.8 ? 3 : 4) as 1 | 2 | 3 | 4;
    if (
      (input.history.prerequisiteLevel ??
        (input.history.prerequisiteReady ? "independent" : "not_started")) !== "independent" ||
      (input.history.recentHintCount ?? 0) >= 2 ||
      (input.history.assistedAttemptRate ?? 0) >= 0.6
    ) {
      step = {
        ...step,
        exerciseType:
          step.exerciseType === "contextual_response"
            ? "guided_translation"
            : step.exerciseType,
        operation:
          step.exerciseType === "contextual_response"
            ? "constrained_produce"
            : step.operation,
        transfer: step.transfer === "far_transfer" ? "near_transfer" : step.transfer,
        scaffold: step.scaffold === "none" ? "partial_sentence" : step.scaffold,
      };
    }
    const legacySkillDimension = legacySkillForObjective(
      step.objective,
      step.operation,
      step.transfer
    );

    return {
      targetGrammarPointId: input.grammarPoint.id,
      targetSenseKey: input.grammarPoint.senseKey,
      blueprintId: step.exerciseType,
      blueprintVersion: 2,
      exerciseType: step.exerciseType,
      legacySkillDimension,
      learningObjective: step.objective,
      cognitiveOperation: step.operation,
      transferLevel: step.transfer,
      scaffoldLevel: step.scaffold,
      targetMisconceptionCode,
      comparisonGrammarPointIds,
      communicativeGoal: input.context.communicativeGoal,
      context: {
        ...input.context,
        scenario: input.context.sceneLabel,
        participants: [input.context.speakerRole, input.context.listenerRole],
        relationship: `${input.context.socialDistance}/${input.context.hierarchy}`,
        register: input.context.registerLabel,
        previousTurn: input.context.knownContext,
      },
      difficulty,
      difficultyDrivers: [
        `transfer:${step.transfer}`,
        `scaffold:${step.scaffold}`,
        targetMisconceptionCode ? `misconception:${targetMisconceptionCode}` : "single_target",
      ],
      vocabularyBudget: {
        maxNewWords: input.history.consecutiveFailures >= 2 ? 1 : difficulty <= 2 ? 2 : 4,
        maximumLevel: difficulty <= 2 ? "basic" : difficulty === 3 ? "intermediate" : "advanced",
      },
      requiredEvidence: [
        `uses:${input.grammarPoint.senseKey}`,
        `observes:${step.objective}`,
      ],
      answerPolicy: {
        responseMode:
          step.exerciseType === "meaning_choice" || step.exerciseType === "contrast_choice"
            ? "choice"
            : "text",
        allowEquivalentAnswers:
          step.exerciseType !== "meaning_choice" && step.exerciseType !== "contrast_choice",
        requireExactChoice:
          step.exerciseType === "meaning_choice" || step.exerciseType === "contrast_choice",
        maxAttempts: 2,
      },
      selectionReasonZh: selectionReason({
        objective: step.objective,
        history: input.history,
        objectiveState,
        targetMisconceptionCode,
        transfer: step.transfer,
        isRecentMisconception: Boolean(
          targetMisconceptionCode && recentError === targetMisconceptionCode
        ),
        specializationNameZh: specialization?.nameZh,
        daysSinceLastPractice:
          index === 0 && shouldStartWithDelayedRecall
            ? daysSinceLastPractice
            : null,
      }),
      specializationId: specialization?.id ?? null,
      specializationVersion: specialization?.version ?? null,
      planMetadata: { plannedAt, randomTieBreak: input.source.next() },
    } satisfies PracticeIntent;
  });
  for (let index = 2; index < plan.length; index += 1) {
    if (
      plan[index].exerciseType === plan[index - 1].exerciseType &&
      plan[index].exerciseType === plan[index - 2].exerciseType
    ) {
      plan[index] = alternateIntentType(plan[index]);
    }
  }
  return plan;
}

export const defaultPracticePlannerSource: PracticePlannerSource = {
  now: () => new Date(),
  next: () => Math.random(),
};
