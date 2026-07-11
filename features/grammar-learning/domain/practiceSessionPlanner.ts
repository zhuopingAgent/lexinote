import type { GrammarPointDetail } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeExerciseType,
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

export type PracticePlannerSource = {
  now(): Date;
  next(): number;
};

export type PracticePlannerHistory = {
  consecutiveFailures: number;
  recentErrorCodes: string[];
  prerequisiteReady: boolean;
  lastPracticedAt?: string | null;
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

function meanEstimate(states: PracticeSkillState[]) {
  if (states.length === 0) return 0.35;
  return states.reduce((sum, state) => sum + state.estimate, 0) / states.length;
}

function supportsContrast(grammarPoint: GrammarPointDetail) {
  return grammarPoint.comparisonSets.some((set) => set.members.length >= 2);
}

function reliableType(
  step: PlanStep,
  grammarPoint: GrammarPointDetail,
  history: PracticePlannerHistory
): PlanStep {
  if (step.exerciseType === "contrast_choice" && !supportsContrast(grammarPoint)) {
    return { ...step, exerciseType: "meaning_choice", operation: "select", objective: "meaning" };
  }
  if (
    !history.prerequisiteReady &&
    (step.exerciseType === "contextual_response" || step.scaffold === "none")
  ) {
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

function resolvePrimaryObjectives(
  grammarPoint: GrammarPointDetail,
  states: PracticeSkillState[],
  history: PracticePlannerHistory
) {
  const errors = new Set([
    ...history.recentErrorCodes,
    ...states.flatMap((state) => state.recentErrorCodes),
  ]);
  if (errors.has("register_mismatch")) {
    return new Set<LearningObjective>(["meaning", "register_control"]);
  }
  if (errors.has("connection_error") || errors.has("conjugation_error")) {
    return new Set<LearningObjective>(["meaning", "form_connection"]);
  }
  if (/て(?:もらえ|いただけ)ますか/.test(grammarPoint.grammarPoint)) {
    return new Set<LearningObjective>(["meaning", "register_control"]);
  }
  return new Set<LearningObjective>(["meaning", "form_connection"]);
}

export function buildPracticeSessionPlan(input: {
  grammarPoint: GrammarPointDetail;
  context: PracticeContext;
  skillStates: PracticeSkillState[];
  history: PracticePlannerHistory;
  count?: number;
  source: PracticePlannerSource;
}): PracticeIntent[] {
  const count = Math.min(Math.max(input.count ?? 5, 1), 10);
  const estimate = meanEstimate(input.skillStates);
  const base =
    input.history.consecutiveFailures >= 2
      ? FAILURE_SEQUENCE
      : /て(?:もらえ|いただけ)ますか/.test(input.grammarPoint.grammarPoint)
        ? POLITE_REQUEST_SEQUENCE
      : estimate >= 0.62
        ? DEVELOPING_SEQUENCE
        : WEAK_SEQUENCE;
  const objectives = resolvePrimaryObjectives(input.grammarPoint, input.skillStates, input.history);
  const recentError = input.history.recentErrorCodes[0] ??
    input.skillStates.flatMap((state) => state.recentErrorCodes)[0] ?? null;
  const plannedAt = input.source.now().toISOString();

  return Array.from({ length: count }, (_, index) => {
    let step = reliableType(base[index % base.length], input.grammarPoint, input.history);
    if (!objectives.has(step.objective)) {
      step = { ...step, objective: Array.from(objectives)[index % objectives.size] };
    }
    if (input.history.consecutiveFailures >= 2 && step.transfer === "far_transfer") {
      step = { ...step, transfer: "near_transfer", scaffold: "semantic_hint" };
    }
    const targetMisconceptionCode = index === 2 && recentError ? recentError : null;
    const comparisonGrammarPointIds = input.grammarPoint.comparisonSets
      .flatMap((set) => set.members.map((member) => member.grammarPointId))
      .filter((id) => id !== input.grammarPoint.id)
      .slice(0, 3);
    const legacySkillDimension = legacySkillForObjective(
      step.objective,
      step.operation,
      step.transfer
    );
    const difficulty = (estimate < 0.35 ? 1 : estimate < 0.58 ? 2 : estimate < 0.8 ? 3 : 4) as 1 | 2 | 3 | 4;

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
      planMetadata: { plannedAt, randomTieBreak: input.source.next() },
    } satisfies PracticeIntent;
  });
}

export const defaultPracticePlannerSource: PracticePlannerSource = {
  now: () => new Date(),
  next: () => Math.random(),
};
