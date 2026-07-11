import { describe, expect, it } from "vitest";
import {
  assertAnswerContract,
  assertPracticeIntent,
  isPracticeGenerationV2Enabled,
  resolveMasteryEvidence,
  passesAnswerContract,
  toPracticeRubricScores,
  type AnswerContract,
} from "@/features/grammar-learning/domain/practiceV2";
import { buildPracticeSessionPlan } from "@/features/grammar-learning/domain/practiceSessionPlanner";
import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { PracticeContext, PracticeSkillState } from "@/shared/types/practice";

const grammarPoint = {
  id: "11111111-1111-4111-8111-111111111111",
  grammarPoint: "〜てもらえますか",
  senseKey: "te_moraemasu_request",
  pointType: "grammar_pattern",
  comparisonSets: [],
} as unknown as GrammarPointDetail;

const context: PracticeContext = {
  sceneSlug: "hospital",
  sceneLabel: "医院",
  speakerRole: "患者",
  listenerRole: "医生",
  socialDistance: "unfamiliar",
  hierarchy: "listener_higher",
  requestBurden: "medium",
  medium: "spoken",
  communicativeGoal: "请求再次说明",
  knownContext: "医生刚说明了检查结果",
  requiredDetail: "再说明一次",
  registerPreset: "polite",
  registerLabel: "一般礼貌",
};

const source = {
  now: () => new Date("2026-07-11T00:00:00.000Z"),
  next: () => 0.25,
};

describe("practice V2 contracts", () => {
  it("uses an explicit feature flag", () => {
    expect(isPracticeGenerationV2Enabled({ PRACTICE_GENERATION_V2: "true" })).toBe(true);
    expect(isPracticeGenerationV2Enabled({})).toBe(false);
  });

  it("validates answer contracts and intents", () => {
    const contract: AnswerContract = {
      requiredMeaningSlots: ["再次说明"],
      requiredGrammarFeatures: ["te_moraemasu_request"],
      allowedVariants: [],
      allowedRegisterRange: ["polite", "business"],
      prohibitedPatterns: [],
      acceptableAlternativePolicy: "natural_variants",
      assessedDimensions: ["grammar", "meaning", "register"],
      passCriteria: {
        minimumDimensionScore: 2,
        requiredDimensions: ["grammar", "meaning", "register"],
        fatalErrorCodes: ["connection_error"],
      },
    };
    expect(assertAnswerContract(contract)).toBe(contract);
    const [intent] = buildPracticeSessionPlan({
      grammarPoint,
      context,
      skillStates: [],
      history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
      source,
    });
    expect(assertPracticeIntent(intent)).toBe(intent);
    const scores = toPracticeRubricScores({
      contract,
      legacyScores: { grammar: 5, meaning: 4, naturalness: 5, register: 2, contextFit: 5 },
    });
    expect(scores).toEqual({
      grammar: 3,
      meaning: 2,
      naturalness: "not_assessed",
      register: 1,
      contextFit: "not_assessed",
    });
    expect(passesAnswerContract(contract, scores)).toBe(false);
  });

  it("weights recognition, assisted work, independent transfer, and exposure differently", () => {
    expect(resolveMasteryEvidence({ isCorrect: true, responseMode: "choice", transferLevel: "reproduction", hintCount: 0, attemptNumber: 1 })).toEqual({ kind: "recognition", weight: 0.45 });
    expect(resolveMasteryEvidence({ isCorrect: true, responseMode: "text", transferLevel: "near_transfer", hintCount: 1, attemptNumber: 1 }).kind).toBe("assisted");
    expect(resolveMasteryEvidence({ isCorrect: true, responseMode: "text", transferLevel: "far_transfer", hintCount: 0, attemptNumber: 1 })).toEqual({ kind: "independent", weight: 1 });
    expect(resolveMasteryEvidence({ isCorrect: false, responseMode: "text", transferLevel: "reproduction", hintCount: 0, attemptNumber: 0, revealed: true })).toEqual({ kind: "exposure", weight: 0 });
  });
});

describe("PracticeSessionPlanner", () => {
  it("schedules hospital request register control without depending on prior history", () => {
    const plan = buildPracticeSessionPlan({
      grammarPoint,
      context,
      skillStates: [],
      history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
      source,
    });
    expect(plan[1]).toEqual(expect.objectContaining({
      exerciseType: "register_rewrite",
      learningObjective: "register_control",
    }));
    expect(new Set(plan.map((item) => item.learningObjective))).toEqual(
      new Set(["meaning", "register_control"])
    );
  });

  it("creates a deterministic five-item weak sequence with one or two objectives", () => {
    const plan = buildPracticeSessionPlan({
      grammarPoint,
      context,
      skillStates: [],
      history: { consecutiveFailures: 0, recentErrorCodes: ["connection_error"], prerequisiteReady: true },
      source,
    });
    expect(plan).toHaveLength(5);
    expect(new Set(plan.map((item) => item.learningObjective)).size).toBeLessThanOrEqual(2);
    expect(plan.some((item) => item.targetMisconceptionCode === "connection_error")).toBe(true);
    for (let index = 2; index < plan.length; index += 1) {
      expect([
        plan[index - 2].exerciseType,
        plan[index - 1].exerciseType,
        plan[index].exerciseType,
      ]).not.toEqual([plan[index].exerciseType, plan[index].exerciseType, plan[index].exerciseType]);
    }
  });

  it("removes far transfer after repeated failure", () => {
    const states: PracticeSkillState[] = [
      {
        grammarPointId: grammarPoint.id,
        skillDimension: "meaning_discrimination",
        estimate: 0.9,
        confidence: 0.8,
        attempts: 5,
        lastPracticedAt: null,
        nextReviewAt: null,
        recentErrorCodes: ["register_mismatch"],
      },
    ];
    const plan = buildPracticeSessionPlan({
      grammarPoint,
      context,
      skillStates: states,
      history: { consecutiveFailures: 3, recentErrorCodes: ["register_mismatch"], prerequisiteReady: true },
      source,
    });
    expect(plan.every((item) => item.transferLevel !== "far_transfer")).toBe(true);
  });

  it("degrades open production when prerequisites are not ready", () => {
    const states = [
      {
        grammarPointId: grammarPoint.id,
        skillDimension: "meaning_discrimination" as const,
        estimate: 0.9,
        confidence: 0.8,
        attempts: 5,
        lastPracticedAt: null,
        nextReviewAt: null,
        recentErrorCodes: [],
      },
    ];
    const plan = buildPracticeSessionPlan({
      grammarPoint,
      context,
      skillStates: states,
      history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: false },
      source,
    });
    expect(plan.some((item) => item.exerciseType === "contextual_response")).toBe(false);
    expect(plan.filter((item) => item.cognitiveOperation === "constrained_produce").every(
      (item) => item.scaffoldLevel !== "none"
    )).toBe(true);
  });
});
