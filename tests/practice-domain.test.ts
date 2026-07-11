import { describe, expect, it } from "vitest";
import {
  calculateEvidenceScore,
  difficultyFromSkillState,
  planPracticeExercise,
} from "@/features/grammar-learning/domain/practice";
import { makeFeedbackConversational } from "@/features/grammar-learning/domain/practiceFeedback";
import {
  buildPlannedExerciseFallback,
  isPlannedExerciseSafe,
} from "@/features/grammar-learning/prompts/exerciseGeneration";
import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { PracticeContext, PracticeSkillState } from "@/shared/types/practice";

const grammarPoint = {
  id: "11111111-1111-4111-8111-111111111111",
  grammarPoint: "〜てもらえますか",
  pointType: "grammar_pattern",
  canonicalForm: "〜てもらえますか",
  senseKey: "gp_te_moraemasu_ka",
  status: "active",
  primaryCategory: {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "requests_permission_advice",
    dimensionId: "33333333-3333-4333-8333-333333333333",
    dimensionSlug: "expression_function",
    dimensionNameZh: "表达功能",
    dimensionNameEn: "Expression function",
    nameZh: "请求、许可与建议",
    nameEn: "Requests, permission, and advice",
    displayOrder: 7,
  },
  taxonomyTags: [],
  curriculum: null,
  categoryId: null,
  coreMeaning: "请求对方为自己做某事。",
  naturalTranslation: "可以请你……吗？",
  structure: "Vて + もらえますか",
  practicality: "S",
  spokenOrWritten: "spoken",
  sceneTags: [{ nameEn: "hospital", nameZh: "医院" }],
  registerTags: [{ nameEn: "polite", nameZh: "一般礼貌" }],
  commonMistakes: ["对医生说成〜てもらえる？会显得太随便。"],
  connections: [
    {
      baseType: "verb",
      requiredForm: "te_form",
      pattern: "动词て形 + もらえますか",
      notes: "一般礼貌请求。",
      sortOrder: 1,
    },
  ],
  prerequisites: [],
  formSiblings: [],
  comparisonSets: [],
  examples: [
    {
      id: "44444444-4444-4444-8444-444444444444",
      jp: "すみません、もう一度説明してもらえますか。",
      zh: "不好意思，可以请您再说明一遍吗？",
      difficulty: 1,
      naturalnessScore: 5,
      notes: "一般礼貌请求。",
    },
  ],
  similarGrammar: [],
} satisfies GrammarPointDetail;

const context: PracticeContext = {
  sceneSlug: "hospital",
  sceneLabel: "医院",
  speakerRole: "患者",
  listenerRole: "医生",
  socialDistance: "unfamiliar",
  hierarchy: "listener_higher",
  requestBurden: "medium",
  medium: "spoken",
  communicativeGoal: "请求重复说明",
  knownContext: "医生刚说明了检查结果",
  requiredDetail: "再说明一次",
  registerPreset: "polite",
  registerLabel: "一般礼貌",
};

const existenceGrammarPoint = {
  ...grammarPoint,
  id: "99999999-9999-4999-8999-999999999999",
  grammarPoint: "Aがあります",
  pointType: "sentence_pattern",
  canonicalForm: "Aがあります",
  senseKey: "gp_a_ga_arimasu",
  coreMeaning: "表示有某物或无生命事物存在。",
  naturalTranslation: "有 A。",
  structure: "地点に + 名词が + あります",
  commonMistakes: ["存在地点应使用「に」，不要误用「で」。"],
  connections: [
    {
      baseType: "noun",
      requiredForm: "plain_form",
      pattern: "地点に + 名词が + あります",
      notes: "存在地点使用「に」。",
      sortOrder: 1,
    },
  ],
  examples: [
    {
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      jp: "机の上に資料があります。",
      zh: "桌子上有资料。",
      difficulty: 1,
      naturalnessScore: 5,
      notes: "说明物品存在。",
    },
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      jp: "近くに駅があります。",
      zh: "附近有车站。",
      difficulty: 1,
      naturalnessScore: 5,
      notes: "说明设施存在。",
    },
  ],
} satisfies GrammarPointDetail;

const dailyLifePlanContext: PracticeContext = {
  sceneSlug: "daily_life",
  sceneLabel: "日常生活",
  speakerRole: "学习者",
  listenerRole: "不熟悉的人",
  socialDistance: "unfamiliar",
  hierarchy: "equal",
  requestBurden: "low",
  medium: "spoken",
  communicativeGoal: "表达计划",
  knownContext: "双方已经知道当前话题",
  requiredDetail: "两次",
  registerPreset: "polite",
  registerLabel: "一般礼貌",
};

function skillState(
  skillDimension: PracticeSkillState["skillDimension"],
  estimate: number
): PracticeSkillState {
  return {
    grammarPointId: grammarPoint.id,
    skillDimension,
    estimate,
    confidence: 0.4,
    attempts: 2,
    lastPracticedAt: null,
    nextReviewAt: null,
    recentErrorCodes: [],
  };
}

describe("redesigned practice domain", () => {
  it("plans a progressive skill sequence instead of treating a menu choice as difficulty", () => {
    expect(
      planPracticeExercise({ grammarPoint, sequenceNumber: 1, skillStates: [] })
    ).toMatchObject({
      skillDimension: "meaning_discrimination",
      exerciseType: "meaning_choice",
      responseMode: "choice",
      difficulty: 2,
    });
    expect(
      planPracticeExercise({ grammarPoint, sequenceNumber: 2, skillStates: [] })
    ).toMatchObject({
      skillDimension: "form_connection",
      exerciseType: "form_repair",
      responseMode: "text",
    });
    expect(
      planPracticeExercise({ grammarPoint, sequenceNumber: 3, skillStates: [] })
    ).toMatchObject({
      skillDimension: "register_control",
      exerciseType: "register_rewrite",
    });
  });

  it("starts with the weakest relevant skill when prior evidence exists", () => {
    const result = planPracticeExercise({
      grammarPoint,
      sequenceNumber: 1,
      skillStates: [
        skillState("meaning_discrimination", 0.8),
        skillState("form_connection", 0.7),
        skillState("register_control", 0.65),
        skillState("contextual_production", 0.22),
        skillState("transfer_naturalness", 0.55),
      ],
    });

    expect(result.skillDimension).toBe("contextual_production");
    expect(result.exerciseType).toBe("guided_translation");
    expect(result.difficulty).toBe(1);
  });

  it("adds comparison practice and prioritizes an unpracticed skill next time", () => {
    const comparisonGrammarPoint: GrammarPointDetail = {
      ...grammarPoint,
      comparisonSets: [
        {
          id: "77777777-7777-4777-8777-777777777777",
          slug: "request_politeness",
          nameZh: "请求礼貌度",
          summary: "按对象选择请求表达。",
          commonMeaning: "都用于请求对方行动。",
          decisionRules: [],
          connectionDifferences: [],
          registerDifferences: [],
          interchangeableCases: [],
          nonInterchangeableCases: [],
          minimalPairExamples: [],
          learnerMistakes: [],
          status: "active",
          members: [
            {
              grammarPointId: grammarPoint.id,
              grammarPoint: grammarPoint.grammarPoint,
              canonicalForm: grammarPoint.canonicalForm,
              senseKey: grammarPoint.senseKey,
              sortOrder: 1,
            },
            {
              grammarPointId: "88888888-8888-4888-8888-888888888888",
              grammarPoint: "〜ていただけますか",
              canonicalForm: "〜ていただけますか",
              senseKey: "gp_te_itadakemasu_ka",
              sortOrder: 2,
            },
          ],
        },
      ],
    };

    expect(
      planPracticeExercise({
        grammarPoint: comparisonGrammarPoint,
        sequenceNumber: 3,
        skillStates: [],
      })
    ).toMatchObject({
      skillDimension: "contrast_selection",
      exerciseType: "contrast_choice",
    });

    const result = planPracticeExercise({
      grammarPoint: comparisonGrammarPoint,
      sequenceNumber: 1,
      skillStates: [
        skillState("meaning_discrimination", 0.8),
        skillState("form_connection", 0.7),
        skillState("contrast_selection", 0.6),
        skillState("register_control", 0.5),
        skillState("contextual_production", 0.4),
      ],
    });
    expect(result.skillDimension).toBe("transfer_naturalness");
    expect(result.exerciseType).toBe("contextual_response");
  });

  it("uses independent correctness, retry, and hints as mastery evidence", () => {
    expect(
      calculateEvidenceScore({
        isCorrect: true,
        attemptNumber: 1,
        hintCount: 0,
        skillDimension: "contextual_production",
      })
    ).toBe(1);
    expect(
      calculateEvidenceScore({
        isCorrect: true,
        attemptNumber: 2,
        hintCount: 1,
        skillDimension: "contextual_production",
      })
    ).toBeCloseTo(0.533);
    expect(
      calculateEvidenceScore({
        isCorrect: false,
        attemptNumber: 1,
        hintCount: 0,
        skillDimension: "contextual_production",
      })
    ).toBe(0);
    expect(
      difficultyFromSkillState(
        skillState("meaning_discrimination", 0.9),
        "choice"
      )
    ).toBe(3);
  });

  it("keeps fallback repair and register tasks targeted without exposing the answer", () => {
    const repair = buildPlannedExerciseFallback({
      grammarPoint,
      skillDimension: "form_connection",
      exerciseType: "form_repair",
      difficulty: 2,
      context,
      generationSeed: "repair",
    });
    const register = buildPlannedExerciseFallback({
      grammarPoint,
      skillDimension: "register_control",
      exerciseType: "register_rewrite",
      difficulty: 2,
      context,
      generationSeed: "register",
    });

    expect(repair.prompt).toContain("接续或活用问题");
    expect(repair.prompt).toContain("読むてもらえますか");
    expect(repair.prompt).not.toContain(grammarPoint.examples[0].jp);
    expect(register.prompt).toContain("不符合人物关系");
    expect(register.prompt).toContain("説明してもらえる？");
    expect(register.prompt).not.toContain(grammarPoint.examples[0].jp);
    expect(register.prompt).not.toContain("hospital");
    expect(register.prompt).not.toContain("polite");
  });

  it("turns fallback translation metadata into one concrete Chinese sentence", () => {
    const exercise = buildPlannedExerciseFallback({
      grammarPoint: existenceGrammarPoint,
      skillDimension: "contextual_production",
      exerciseType: "guided_translation",
      difficulty: 2,
      context: dailyLifePlanContext,
      generationSeed: "clear-existence-task",
    });

    expect(exercise.prompt).toContain("请把下面这句中文翻译成自然日语");
    expect(exercise.prompt).toContain("这周还有两次会议。");
    expect(exercise.prompt).toContain("一般礼貌");
    expect(exercise.prompt).not.toContain("表达计划，并提到");
    expect(exercise.prompt).not.toContain("双方已经知道当前话题");
    expect(exercise.referenceAnswers).toEqual([
      expect.objectContaining({
        jp: "今週は会議があと二回あります。",
        zh: "这周还有两次会议。",
      }),
      expect.objectContaining({
        jp: "今週はまだ会議が二回あります。",
        zh: "这周还有两次会议。",
      }),
    ]);
    expect(
      isPlannedExerciseSafe({
        ...exercise,
        exerciseType: "guided_translation",
        grammarPoint: existenceGrammarPoint.grammarPoint,
      })
    ).toBe(true);
  });

  it("builds a real repair sentence for placeholder existence patterns", () => {
    const exercise = buildPlannedExerciseFallback({
      grammarPoint: existenceGrammarPoint,
      skillDimension: "form_connection",
      exerciseType: "form_repair",
      difficulty: 2,
      context: dailyLifePlanContext,
      generationSeed: "clear-existence-repair",
    });

    expect(
      ["机の上で資料があります。", "近くで駅があります。"].some((sentence) =>
        exercise.prompt.includes(sentence)
      )
    ).toBe(true);
    expect(exercise.prompt).toContain("请保留原意");
    expect(exercise.prompt).not.toContain("読みますAがあります");
    expect(exercise.prompt).not.toContain("表达计划");
    expect(exercise.referenceAnswers).toHaveLength(1);
    expect(exercise.referenceAnswers[0]?.jp).toBe(
      exercise.prompt.includes("机の上で資料があります。")
        ? "机の上に資料があります。"
        : "近くに駅があります。"
    );
  });

  it("rejects generated translation tasks that contain a candidate Japanese answer", () => {
    const referenceAnswers = [
      {
        jp: "駅の近くに車がありますか。",
        zh: "车站附近有车吗？",
        noteZh: "用存在句确认是否有车。",
      },
    ];

    expect(
      isPlannedExerciseSafe({
        prompt: "请确认车站附近是否有车，并用一般礼貌体表达：駅近くに車がありますか？",
        referenceAnswers,
        hints: [],
        exerciseType: "guided_translation",
        grammarPoint: "Aがあります",
      })
    ).toBe(false);
    expect(
      isPlannedExerciseSafe({
        prompt:
          "请把这个中文意图表达成自然日语：表达计划，并提到“两次”。必须使用「Aがあります」。",
        referenceAnswers,
        hints: [],
        exerciseType: "guided_translation",
        grammarPoint: "Aがあります",
      })
    ).toBe(false);
    expect(
      isPlannedExerciseSafe({
        prompt: "请介绍目的地，并用一般礼貌体表达：東京です。",
        referenceAnswers: [
          { jp: "大阪です。", zh: "是大阪。", noteZh: "礼貌判断句。" },
        ],
        hints: [],
        exerciseType: "contextual_response",
        grammarPoint: "〜です",
      })
    ).toBe(false);
    expect(
      isPlannedExerciseSafe({
        prompt:
          "请把下面这句中文翻译成自然日语：“车站附近有车吗？”要求使用「Aがあります」并保持一般礼貌。",
        referenceAnswers,
        hints: ["先确定存在的地点和物品。"],
        exerciseType: "guided_translation",
        grammarPoint: "Aがあります",
      })
    ).toBe(true);
  });

  it("keeps failed feedback specific, direct, and ready to persist", () => {
    const result = makeFeedbackConversational({
      userSentenceId: "55555555-5555-4555-8555-555555555555",
      feedbackId: "66666666-6666-4666-8666-666666666666",
      source: "fallback",
      isCorrect: false,
      grammarScore: 4,
      meaningScore: 4,
      naturalnessScore: 3,
      registerScore: 2,
      sceneFitScore: 3,
      issues: [
        {
          errorTypeCode: "register_mismatch",
          severity: "high",
          explanation: "建议改成いただけますか。",
          correction: "すみません、もう一度説明していただけますか。",
          relatedGrammarPointId: grammarPoint.id,
        },
      ],
      explanation: "请改成すみません、もう一度説明していただけますか。",
      nextHint: "使用いただけますか。",
      feedbackText: "完整答案在这里。",
      correctedSentence: "すみません、もう一度説明していただけますか。",
      betterVersions: [
        {
          sentence: "すみません、もう一度説明していただけますか。",
          registerTag: "business",
          explanationZh: "更礼貌。",
        },
      ],
      mistakeTypes: ["register_mismatch"],
      nextPracticePrompt: "再写一次。",
    });

    expect(result.feedbackText).toContain("语体");
    expect(result.correctedSentence).toBe(
      "すみません、もう一度説明していただけますか。"
    );
    expect(result.issues[0]?.correction).toBe(
      "すみません、もう一度説明していただけますか。"
    );
    expect(result.issues[0]).toEqual(expect.objectContaining({
      role: "root",
      confidence: 0.8,
      affectedDimensions: ["register", "contextFit"],
    }));
    expect(result.explanation).toContain("いただけますか");
    expect(result.betterVersions).toHaveLength(1);
  });
});
