import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import type { GrammarPointDetail } from "@/shared/types/grammar";
import { AI_GATEWAY_BUDGET_EXCEEDED_CODE } from "@/shared/utils/errors";

const GRAMMAR_POINT_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

function expectStructuredFeedbackSchema(value: Record<string, unknown>) {
  expect(value).toEqual(
    expect.objectContaining({
      grammarScore: expect.any(Number),
      meaningScore: expect.any(Number),
      registerScore: expect.any(Number),
      naturalnessScore: expect.any(Number),
      issues: expect.any(Array),
      explanation: expect.any(String),
      nextHint: expect.any(String),
    })
  );
  expect(Object.hasOwn(value, "correctedSentence")).toBe(true);
}

const grammarPoint: GrammarPointDetail = {
  id: GRAMMAR_POINT_ID,
  grammarPoint: "〜てもらえますか",
  pointType: "grammar_pattern",
  canonicalForm: "〜てもらえますか",
  senseKey: "gp_te_moraemasu_ka",
  formGroupSlug: "te_morau",
  status: "active",
  primaryCategory: {
    id: "22222222-2222-4222-8222-222222222222",
    slug: "requests_permission_advice",
    dimensionId: "12121212-1212-4212-8212-121212121212",
    dimensionSlug: "expression_function",
    dimensionNameZh: "表达功能",
    dimensionNameEn: "Expression function",
    nameZh: "请求、许可与建议",
    nameEn: "Requests, permission, and advice",
    displayOrder: 7,
  },
  taxonomyTags: [
    {
      id: "22222222-2222-4222-8222-222222222222",
      slug: "requests_permission_advice",
      dimensionId: "12121212-1212-4212-8212-121212121212",
      dimensionSlug: "expression_function",
      dimensionNameZh: "表达功能",
      dimensionNameEn: "Expression function",
      nameZh: "请求、许可与建议",
      nameEn: "Requests, permission, and advice",
      displayOrder: 7,
    },
  ],
  curriculum: null,
  reading: "〜てもらえますか",
  categoryId: "22222222-2222-4222-8222-222222222222",
  categorySlug: "requests_permission_advice",
  categoryNameZh: "请求、许可与建议",
  categoryNameEn: "Requests, permission, and advice",
  categoryGroupSlug: "expressive_functions",
  categoryGroupNameZh: "表达功能",
  categoryGroupNameEn: "Expressive functions",
  subCategory: "礼貌请求",
  coreMeaning: "请求对方为自己做某事。",
  naturalTranslation: "可以请你……吗？",
  structure: "Vて + もらえますか",
  practicality: "S",
  spokenOrWritten: "spoken",
  sceneTags: [
    {
      nameEn: "hospital",
      nameZh: "医院",
    },
  ],
  registerTags: [
    {
      nameEn: "polite",
      nameZh: "一般礼貌",
    },
  ],
  isFavorite: false,
  learningStatus: null,
  notes: "日常礼貌请求非常实用。",
  jlptLevel: "N4",
  commonMistakes: ["句尾变成〜てもらえる？会明显变随便"],
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
      id: "33333333-3333-4333-8333-333333333333",
      jp: "すみません、もう一度説明してもらえますか。",
      zh: "不好意思，可以请您再说明一遍吗？",
      sceneTag: {
        nameEn: "hospital",
        nameZh: "医院",
      },
      registerTag: {
        nameEn: "polite",
        nameZh: "一般礼貌",
      },
      difficulty: 1,
      naturalnessScore: 5,
      notes: "医院里对医生可用。",
    },
  ],
  similarGrammar: [],
};

const genericGrammarPoint: GrammarPointDetail = {
  ...grammarPoint,
  id: "66666666-6666-4666-8666-666666666666",
  grammarPoint: "〜うちに",
  reading: "〜うちに",
  categorySlug: "time_and_sequence",
  categoryNameZh: "时间与顺序",
  categoryNameEn: "Time and sequence",
  subCategory: "趁还在",
  coreMeaning: "趁某状态还持续时做某事。",
  naturalTranslation: "趁着……",
  structure: "普通形/名词の + うちに",
  notes: "常用于机会、状态变化前。",
  examples: [
    {
      id: "77777777-7777-4777-8777-777777777777",
      jp: "日本にいるうちに、いろいろな場所へ行きたいです。",
      zh: "趁在日本期间，我想去各种地方。",
      sceneTag: {
        nameEn: "daily_life",
        nameZh: "日常生活",
      },
      registerTag: {
        nameEn: "polite",
        nameZh: "一般礼貌",
      },
      difficulty: 2,
      naturalnessScore: 5,
      notes: "趁状态还持续。",
    },
  ],
  sceneTags: [
    {
      nameEn: "daily_life",
      nameZh: "日常生活",
    },
  ],
  registerTags: [
    {
      nameEn: "polite",
      nameZh: "一般礼貌",
    },
  ],
};

const teKudasaiGrammarPoint: GrammarPointDetail = {
  ...grammarPoint,
  id: "88888888-8888-4888-8888-888888888888",
  grammarPoint: "〜てください",
  reading: "〜てください",
  categorySlug: "requests_permission_advice",
  categoryNameZh: "请求、许可与建议",
  categoryNameEn: "Requests, permission, and advice",
  subCategory: "基本请求",
  coreMeaning: "请对方做某事。",
  naturalTranslation: "请……",
  structure: "Vて + ください",
  notes: "常用但比较直接。",
  commonMistakes: ["需要用て形连接，不要直接接ます形。"],
  examples: [
    {
      id: "99999999-9999-4999-8999-999999999999",
      jp: "ここに名前を書いてください。",
      zh: "请在这里写名字。",
      sceneTag: {
        nameEn: "daily_life",
        nameZh: "日常生活",
      },
      registerTag: {
        nameEn: "polite",
        nameZh: "一般礼貌",
      },
      difficulty: 1,
      naturalnessScore: 5,
      notes: "基本请求。",
    },
  ],
};

const tenseGrammarPoint: GrammarPointDetail = {
  ...grammarPoint,
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  grammarPoint: "时态错误",
  canonicalForm: "时态错误",
  senseKey: "gp_tense_error_past",
  formGroupSlug: null,
  status: "migrated",
  primaryCategory: null,
  taxonomyTags: [],
  migrationTarget: {
    kind: "error_type",
    slug: "tense_mismatch",
    nameZh: "时态错误",
  },
  reading: "时态错误",
  categorySlug: "tense_errors",
  categoryNameZh: "时态错误",
  categoryNameEn: "Tense errors",
  categoryGroupSlug: "error_diagnosis_correction",
  categoryGroupNameZh: "错误诊断与纠错",
  categoryGroupNameEn: "Error diagnosis and correction",
  subCategory: "时态诊断",
  coreMeaning: "识别过去时间却使用非过去形式的错误。",
  naturalTranslation: "时态不匹配",
  structure: "过去时间 + 过去形",
  notes: "昨日、先週、さっき等时间词常要求过去形。",
  commonMistakes: ["昨日等过去时间词后仍使用非过去句尾。"],
  examples: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      jp: "昨日、学校へ行きました。",
      zh: "昨天去了学校。",
      sceneTag: {
        nameEn: "daily_life",
        nameZh: "日常生活",
      },
      registerTag: {
        nameEn: "polite",
        nameZh: "一般礼貌",
      },
      difficulty: 1,
      naturalnessScore: 5,
      notes: "过去时间要配过去形。",
    },
  ],
};

const existenceGrammarPoint: GrammarPointDetail = {
  ...grammarPoint,
  id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  grammarPoint: "Aがあります",
  pointType: "sentence_pattern",
  canonicalForm: "Aがあります",
  senseKey: "gp_a_ga_arimasu",
  formGroupSlug: "existence_arimasu",
  reading: "Aがあります",
  coreMeaning: "表示某处存在无生命事物。",
  naturalTranslation: "有 A。",
  structure: "地点に + 名词が + あります",
  commonMistakes: ["把存在地点的「に」误写成动作地点的「で」。"],
  connections: [
    {
      baseType: "noun",
      requiredForm: "plain_form",
      pattern: "地点に + 名词が + あります",
      notes: "存在地点用「に」。",
      sortOrder: 1,
    },
  ],
  examples: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      jp: "駅の近くに駐車場があります。",
      zh: "车站附近有停车场。",
      sceneTag: { nameEn: "daily_life", nameZh: "日常生活" },
      registerTag: { nameEn: "polite", nameZh: "一般礼貌" },
      difficulty: 1,
      naturalnessScore: 5,
      notes: "用「の近く」说明相对位置。",
    },
  ],
};

function createRepositoryMock(point: GrammarPointDetail = grammarPoint) {
  const tagLabels: Record<string, string> = {
    daily_life: "日常生活",
    hospital: "医院",
    polite: "一般礼貌",
  };

  return {
    listKnowledgeDimensions: vi.fn().mockResolvedValue([]),
    listTaxonomyNodes: vi.fn().mockResolvedValue([]),
    listLearningStages: vi.fn().mockResolvedValue([]),
    listLearningModules: vi.fn().mockResolvedValue([]),
    listComparisonSets: vi.fn().mockResolvedValue([]),
    listErrorTypes: vi.fn().mockResolvedValue([]),
    listCategoryGroups: vi.fn().mockResolvedValue([]),
    listCategories: vi.fn().mockResolvedValue([]),
    listSceneTags: vi.fn().mockResolvedValue([]),
    listRegisterTags: vi.fn().mockResolvedValue([]),
    findTag: vi.fn().mockImplementation((_kind: string, nameEn?: string) =>
      Promise.resolve(
        nameEn
          ? {
              nameEn,
              nameZh: tagLabels[nameEn] ?? nameEn,
            }
          : null
      )
    ),
    searchGrammarPoints: vi.fn().mockResolvedValue([point]),
    findGrammarPointById: vi.fn().mockResolvedValue(point),
    insertUserSentence: vi.fn().mockResolvedValue("44444444-4444-4444-8444-444444444444"),
    insertFeedback: vi.fn().mockResolvedValue("55555555-5555-4555-8555-555555555555"),
    updateReviewRecord: vi.fn().mockResolvedValue(undefined),
    logLearningHistory: vi.fn().mockResolvedValue(undefined),
    addFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    listFavorites: vi.fn().mockResolvedValue([grammarPoint]),
    listReviewItems: vi.fn().mockResolvedValue([]),
    getProgressTotals: vi.fn().mockResolvedValue({
      totalGrammarPoints: 1,
      startedCount: 0,
      masteredCount: 0,
      pendingCompletionCount: 0,
      dueReviewCount: 0,
      reviewCount: 0,
      favoriteCount: 0,
    }),
    getProgress: vi.fn().mockResolvedValue([]),
    getReviewAggregations: vi.fn().mockResolvedValue({
      grammarPoints: [],
      errorTypes: [],
      scenarios: [],
      registers: [],
    }),
    listObjectiveRecommendations: vi.fn().mockResolvedValue([]),
  };
}

describe("GrammarLearningService", () => {
  beforeEach(() => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  function getLastFetchBody() {
    const calls = vi.mocked(fetch).mock.calls;
    const lastCall = calls.at(-1);

    expect(lastCall).toBeDefined();

    return JSON.parse(String(lastCall?.[1]?.body)) as Record<string, unknown>;
  }

  it("returns seven knowledge dimensions separately from comparisons and errors", async () => {
    const repository = createRepositoryMock();
    repository.listKnowledgeDimensions.mockResolvedValue(
      [
        "expression_function",
        "form_tense_aspect",
        "sentence_structure",
        "particle_system",
        "register_social",
        "discourse_organization",
        "collocation_construction",
      ].map((slug, index) => ({
        id: `${index}`,
        slug,
        nameZh: `维度 ${index + 1}`,
        nameEn: `Dimension ${index + 1}`,
        description: "",
        displayOrder: index + 1,
        status: "active",
      }))
    );
    repository.listComparisonSets.mockResolvedValue([
      {
        id: "comparison",
        slug: "wa_vs_ga",
        nameZh: "は与が",
        summary: "",
        commonMeaning: "",
        decisionRules: [],
        connectionDifferences: [],
        registerDifferences: [],
        interchangeableCases: [],
        nonInterchangeableCases: [],
        minimalPairExamples: [],
        learnerMistakes: [],
        status: "active",
        members: [],
      },
    ]);
    repository.listErrorTypes.mockResolvedValue([
      {
        id: "error",
        code: "particle_error",
        nameZh: "助词错误",
        description: "",
        defaultSeverity: "high",
        status: "active",
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.getTaxonomy();

    expect(result.knowledgeDimensions).toHaveLength(7);
    expect(result.knowledgeDimensions.map((item) => item.slug)).not.toContain(
      "confusing_grammar_contrasts"
    );
    expect(result.comparisonSets).toHaveLength(1);
    expect(result.errorTypes).toHaveLength(1);
  });

  it("caches taxonomy data within one service instance", async () => {
    const repository = createRepositoryMock();
    repository.listKnowledgeDimensions.mockResolvedValue([
      {
        id: "dimension",
        slug: "expression_function",
        nameZh: "表达功能",
        nameEn: "Expression function",
        description: "",
        displayOrder: 1,
        status: "active",
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    await service.getTaxonomy();
    await service.getTaxonomy();

    expect(repository.listKnowledgeDimensions).toHaveBeenCalledTimes(1);
    expect(repository.listTaxonomyNodes).toHaveBeenCalledTimes(1);
    expect(repository.listLearningStages).toHaveBeenCalledTimes(1);
    expect(repository.listLearningModules).toHaveBeenCalledTimes(1);
  });

  it("uses a lightweight taxonomy payload for bootstrap", async () => {
    const repository = createRepositoryMock();
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    await service.getBootstrap({ limit: 37 });

    expect(repository.listKnowledgeDimensions).toHaveBeenCalledTimes(1);
    expect(repository.listTaxonomyNodes).toHaveBeenCalledTimes(1);
    expect(repository.listLearningStages).toHaveBeenCalledTimes(1);
    expect(repository.listLearningModules).toHaveBeenCalledTimes(1);
    expect(repository.listComparisonSets).not.toHaveBeenCalled();
    expect(repository.listErrorTypes).not.toHaveBeenCalled();
    expect(repository.listCategoryGroups).not.toHaveBeenCalled();
    expect(repository.listCategories).not.toHaveBeenCalled();
    expect(repository.listSceneTags).not.toHaveBeenCalled();
    expect(repository.listRegisterTags).not.toHaveBeenCalled();
  });

  it("maps legacy category groups to the new dimension filter with AND semantics", async () => {
    const repository = createRepositoryMock(genericGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    await service.searchGrammarPoints({
      query: "うちに",
      categorySlug: "time_and_sequence",
      groupSlug: "expressive_functions",
      stageSlug: "functional_patterns",
      moduleSlug: undefined,
      practicality: "A",
      learningStatus: "learning",
      limit: 12,
      offset: 36,
    });

    expect(repository.searchGrammarPoints).toHaveBeenCalledWith({
      query: "うちに",
      categorySlug: "time_and_sequence",
      dimensionSlug: "expression_function",
      stageSlug: "functional_patterns",
      practicality: "A",
      learningStatus: "learning",
      limit: 12,
      offset: 36,
      userId: DEFAULT_USER_ID,
    });
  });

  it("keeps migrated grammar point IDs readable for favorites and review", async () => {
    const repository = createRepositoryMock(tenseGrammarPoint);
    repository.listFavorites.mockResolvedValue([tenseGrammarPoint]);
    repository.listReviewItems.mockResolvedValue([
      {
        reviewRecordId: "review-1",
        grammarPoint: tenseGrammarPoint,
        status: "learning",
        mistakeCount: 1,
        nextReviewAt: null,
        lastReviewedAt: null,
        mistakeTypes: ["tense_mismatch"],
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    await service.addFavorite({ grammarPointId: tenseGrammarPoint.id });
    const favorites = await service.listFavorites();
    const review = await service.listReviewItems();

    expect(repository.addFavorite).toHaveBeenCalledWith(
      DEFAULT_USER_ID,
      tenseGrammarPoint.id
    );
    expect(favorites.items[0]).toMatchObject({
      id: tenseGrammarPoint.id,
      status: "migrated",
    });
    expect(review.items[0].grammarPoint.id).toBe(tenseGrammarPoint.id);
  });

  it("consolidates objective states into one progress record per grammar point", async () => {
    const repository = createRepositoryMock(grammarPoint);
    repository.listReviewItems.mockResolvedValue([
      {
        reviewRecordId: "review-1",
        grammarPoint,
        status: "reviewing",
        mistakeCount: 2,
        nextReviewAt: null,
        lastReviewedAt: null,
        mistakeTypes: ["connection_error"],
        issues: [],
      },
    ]);
    repository.listObjectiveRecommendations.mockResolvedValue([
      {
        grammarPointId: grammarPoint.id,
        grammarPoint: grammarPoint.grammarPoint,
        coreMeaning: grammarPoint.coreMeaning,
        senseKey: grammarPoint.senseKey,
        learningObjective: "form_connection",
        estimate: 0.2,
        confidence: 0.5,
        attempts: 3,
        assistedAttempts: 1,
        exposureCount: 0,
        recentErrorCodes: ["connection_error"],
        nextReviewAt: null,
        overallEstimate: 0.4,
        overallConfidence: 0.5,
        objectives: [
          {
            learningObjective: "form_connection",
            estimate: 0.2,
            confidence: 0.5,
            attempts: 3,
            assistedAttempts: 1,
            exposureCount: 0,
            recentErrorCodes: ["connection_error"],
            nextReviewAt: null,
          },
          {
            learningObjective: "meaning",
            estimate: 0.6,
            confidence: 0.5,
            attempts: 2,
            assistedAttempts: 0,
            exposureCount: 0,
            recentErrorCodes: [],
            nextReviewAt: null,
          },
        ],
        reasonZh: "当前接续仍需复习。",
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.listReviewItems();

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      reviewRecordId: "review-1",
      overallEstimate: 0.4,
      objectiveProgress: [
        { learningObjective: "form_connection" },
        { learningObjective: "meaning" },
      ],
    });
    expect(result.objectiveRecommendations).toEqual([]);
    expect(result.pendingCompletionCount).toBe(1);
    expect(result.dueReviewCount).toBe(0);
  });

  it("counts only mastered grammar whose review time has arrived", async () => {
    const repository = createRepositoryMock(grammarPoint);
    repository.listReviewItems.mockResolvedValue([
      {
        reviewRecordId: "review-future",
        grammarPoint,
        status: "mastered",
        mistakeCount: 0,
        nextReviewAt: "2999-01-01T00:00:00.000Z",
        lastReviewedAt: null,
        mistakeTypes: [],
        issues: [],
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.listReviewItems();

    expect(result.pendingCompletionCount).toBe(0);
    expect(result.dueReviewCount).toBe(0);
  });

  it("keeps the overall progress total distinct when knowledge dimension tags overlap", async () => {
    const repository = createRepositoryMock();
    repository.getProgressTotals.mockResolvedValue({
      totalGrammarPoints: 340,
      startedCount: 10,
      masteredCount: 4,
      pendingCompletionCount: 2,
      dueReviewCount: 1,
      reviewCount: 3,
      favoriteCount: 5,
    });
    repository.getProgress.mockResolvedValue([
      {
        id: "dimension-expression",
        slug: "expression_function",
        nameZh: "表达功能",
        nameEn: "Expression function",
        description: "",
        priority: 1,
        totalCount: 340,
        startedCount: 10,
        masteredCount: 4,
        pendingCompletionCount: 2,
        dueReviewCount: 1,
        reviewCount: 3,
        favoriteCount: 5,
      },
      {
        id: "dimension-particles",
        slug: "particle_system",
        nameZh: "助词系统",
        nameEn: "Particle system",
        description: "",
        priority: 4,
        totalCount: 24,
        startedCount: 1,
        masteredCount: 0,
        pendingCompletionCount: 1,
        dueReviewCount: 0,
        reviewCount: 1,
        favoriteCount: 0,
      },
    ]);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.getProgress();

    expect(result.totalGrammarPoints).toBe(340);
    expect(result.masteredCount).toBe(4);
    expect(result.reviewCount).toBe(3);
    expect(result.groupProgress).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          slug: "particle_system",
          totalCount: 24,
          masteredCount: 0,
        }),
      ])
    );
    expect(repository.getProgress).toHaveBeenCalledWith(DEFAULT_USER_ID);
    expect(repository.getProgressTotals).toHaveBeenCalledWith(DEFAULT_USER_ID);
  });

  it("resolves grammar details by stable sense key and logs the canonical ID", async () => {
    const repository = createRepositoryMock(genericGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.getGrammarPointDetail("gp_sou_da_hearsay");

    expect(result.grammarPoint.id).toBe(genericGrammarPoint.id);
    expect(repository.findGrammarPointById).toHaveBeenCalledWith(
      "gp_sou_da_hearsay",
      DEFAULT_USER_ID
    );
    expect(repository.logLearningHistory).toHaveBeenCalledWith({
      userId: DEFAULT_USER_ID,
      grammarPointId: genericGrammarPoint.id,
      activityType: "view_grammar",
    });
  });

  it("generates the hospital polite practice fallback for 〜てもらえますか", async () => {
    const repository = createRepositoryMock();
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.generatePractice({
      grammarPointId: GRAMMAR_POINT_ID,
      sceneTag: "hospital",
      registerTag: "polite",
      level: 2,
    });

    expect(result.source).toBe("fallback");
    expect(result.prompt).toContain("医院");
    expect(result.prompt).toContain("〜てもらえますか");
    expect(result.referenceAnswers.map((answer) => answer.jp)).toContain(
      "すみません、もう一度説明していただけますか。"
    );
  });

  it("uses Chinese tag labels in generic fallback practice prompts", async () => {
    const repository = createRepositoryMock(genericGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.generatePractice({
      grammarPointId: genericGrammarPoint.id,
      sceneTag: "daily_life",
      registerTag: "polite",
      level: 2,
    });

    expect(result.prompt).toContain("日常生活");
    expect(result.prompt).toContain("一般礼貌");
    expect(result.prompt).toContain("请把下面这句中文翻译");
    expect(result.prompt).toContain("2 接续应用");
    expect(result.prompt).not.toContain("daily_life");
    expect(result.prompt).not.toContain("polite");

    const advancedResult = await service.generatePractice({
      grammarPointId: genericGrammarPoint.id,
      sceneTag: "daily_life",
      registerTag: "polite",
      level: 5,
    });

    expect(advancedResult.prompt).toContain("5 易混辨析");
    expect(advancedResult.prompt).not.toBe(result.prompt);
  });

  it("propagates AI Gateway budget errors during practice generation", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    const budgetResponse = {
      ok: false,
      status: 402,
      clone() {
        return budgetResponse;
      },
      json: async () => ({
        error: {
          type: "insufficient_funds",
          message: "AI Gateway budget exceeded.",
        },
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(budgetResponse));

    const repository = createRepositoryMock(genericGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    await expect(
      service.generatePractice({
        grammarPointId: genericGrammarPoint.id,
        sceneTag: "daily_life",
        registerTag: "polite",
        level: 3,
      })
    ).rejects.toMatchObject({
      code: AI_GATEWAY_BUDGET_EXCEEDED_CODE,
    });
  });

  it("falls back when AI puts a Japanese candidate answer in a translation task", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            task_zh:
              "请确认车站附近是否有车，并用一般礼貌体表达：駅近くに車がありますか？",
            reference_answers: [
              {
                jp: "駅の近くに車がありますか。",
                zh: "车站附近有车吗？",
                note_zh: "一般礼貌的存在句。",
              },
            ],
            hints: ["先确定地点和存在的物品。"],
          }),
        }),
      })
    );

    const result = await new GrammarAiClient().generatePlannedExercise({
      grammarPoint: existenceGrammarPoint,
      skillDimension: "contextual_production",
      exerciseType: "guided_translation",
      difficulty: 2,
      context: {
        sceneSlug: "daily_life",
        sceneLabel: "日常生活",
        speakerRole: "学习者",
        listenerRole: "不熟悉的人",
        socialDistance: "unfamiliar",
        hierarchy: "equal",
        requestBurden: "low",
        medium: "spoken",
        communicativeGoal: "确认信息",
        knownContext: "双方已经知道当前话题",
        requiredDetail: "车站附近",
        registerPreset: "polite",
        registerLabel: "一般礼貌",
      },
      generationSeed: "answer-leak-regression",
    });

    expect(result.source).toBe("fallback");
    expect(result.prompt).not.toContain("駅近くに車がありますか");
    expect(result.prompt).toContain("车站附近有一家便利店。");
    expect(result.prompt).not.toContain("确认信息，并提到");
  });

  it("uses low reasoning for premium teacher sentence feedback", async () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            is_correct: true,
            grammar_score: 5,
            meaning_score: 5,
            register_score: 5,
            naturalness_score: 5,
            scene_fit_score: 5,
            issues: [],
            explanation_zh: "表达自然，意思和语体都符合场景。",
            next_hint_zh: "换一个对象再练习一次。",
            corrected_sentence: "",
            better_versions: [],
          }),
        }),
      })
    );

    const result = await new GrammarAiClient().evaluateSentence({
      grammarPoint,
      sentence: "すみません、もう一度説明していただけますか。",
      sceneTag: "hospital",
      sceneTagLabel: "医院",
      registerTag: "polite",
      registerTagLabel: "一般礼貌",
      promptText: "你在医院听不懂医生说明，想请医生再说明一遍。",
    });

    expect(result.source).toBe("ai");
    expectStructuredFeedbackSchema(result as unknown as Record<string, unknown>);
    expect(result).toMatchObject({
      grammarScore: 5,
      meaningScore: 5,
      registerScore: 5,
      naturalnessScore: 5,
      issues: [],
      explanation: "表达自然，意思和语体都符合场景。",
      nextHint: "换一个对象再练习一次。",
    });
    expect(getLastFetchBody()).toEqual(
      expect.objectContaining({
        model: "openai/gpt-5-mini",
        reasoning: {
          effort: "low",
        },
      })
    );
  });

  it("flags a too-casual hospital sentence and schedules review", async () => {
    const repository = createRepositoryMock();
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.submitSentence({
      grammarPointId: GRAMMAR_POINT_ID,
      sentence: "先生、もう一度説明してもらえる？",
      sceneTag: "hospital",
      registerTag: "polite",
      promptText: "你在医院听不懂医生说明，想请医生再说明一遍。",
    });

    expect(result.isCorrect).toBe(false);
    expectStructuredFeedbackSchema(result as unknown as Record<string, unknown>);
    expect(result.grammarScore).toBe(4);
    expect(result.registerScore).toBe(2);
    expect(result.meaningScore).toBe(4);
    expect(result.issues).toEqual([
      expect.objectContaining({
        errorTypeCode: "register_mismatch",
        relatedGrammarPointId: GRAMMAR_POINT_ID,
      }),
    ]);
    expect(result.feedbackText).toContain("太随便");
    expect(result.correctedSentence).toBe(
      "すみません、もう一度説明してもらえますか。"
    );
    expect(result.betterVersions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sentence: "すみません、もう一度説明していただけますか。",
      }),
    ]));
    expect(repository.updateReviewRecord).toHaveBeenCalledWith({
      userId: DEFAULT_USER_ID,
      grammarPointId: GRAMMAR_POINT_ID,
      hasMistake: true,
    });
    expect(repository.insertFeedback).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      expect.objectContaining({
        mistakeTypes: ["register_mismatch"],
        issues: [
          expect.objectContaining({ errorTypeCode: "register_mismatch" }),
        ],
      })
    );
  });

  it("recognizes placeholder existence patterns without reporting a false error", async () => {
    const repository = createRepositoryMock(existenceGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.submitSentence({
      grammarPointId: existenceGrammarPoint.id,
      sentence: "駅近くに車がありますか？",
      sceneTag: "daily_life",
      registerTag: "polite",
      promptText: "请用日语确认车站附近是否有车。",
    });

    expect(result.isCorrect).toBe(true);
    expect(result.feedbackText).toContain("这句可以");
    expect(result.issues).toEqual([]);
    expect(result.correctedSentence).toBeNull();
    expect(repository.insertFeedback).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      expect.objectContaining({
        feedbackText: expect.stringContaining("这句可以"),
        correctedSentence: null,
      })
    );
  });

  it("detects te-form connection errors in fallback feedback", async () => {
    const repository = createRepositoryMock(teKudasaiGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.submitSentence({
      grammarPointId: teKudasaiGrammarPoint.id,
      sentence: "ここに名前を書きください。",
      sceneTag: "daily_life",
      registerTag: "polite",
      promptText: "请用「〜てください」造句。",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.feedbackText).toContain("接续");
    expect(result.mistakeTypes).toContain("connection_error");
    expect(repository.updateReviewRecord).toHaveBeenCalledWith({
      userId: DEFAULT_USER_ID,
      grammarPointId: teKudasaiGrammarPoint.id,
      hasMistake: true,
    });
  });

  it("detects tense mismatch errors in fallback feedback", async () => {
    const repository = createRepositoryMock(tenseGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.submitSentence({
      grammarPointId: tenseGrammarPoint.id,
      sentence: "昨日、学校へ行きます。",
      sceneTag: "daily_life",
      registerTag: "polite",
      promptText: "请修正时态错误。",
    });

    expect(result.isCorrect).toBe(false);
    expect(result.feedbackText).toContain("时态");
    expect(result.mistakeTypes).toContain("tense_aspect_error");
  });

  it("returns multiple stable error types for one fallback submission", async () => {
    const repository = createRepositoryMock(teKudasaiGrammarPoint);
    const service = new GrammarLearningService(
      repository as never,
      new GrammarAiClient()
    );

    const result = await service.submitSentence({
      grammarPointId: teKudasaiGrammarPoint.id,
      sentence: "ここに名前を書きくださいだよ。",
      sceneTag: "daily_life",
      registerTag: "polite",
    });

    expect(result.issues.map((issue) => issue.errorTypeCode)).toEqual(
      expect.arrayContaining(["connection_error", "register_mismatch"])
    );
    expect(result.mistakeTypes).toEqual(
      result.issues.map((issue) => issue.errorTypeCode)
    );
  });
});
