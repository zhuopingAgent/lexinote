import { beforeEach, describe, expect, it, vi } from "vitest";

const getTaxonomyMock = vi.fn();
const searchGrammarPointsMock = vi.fn();
const getGrammarPointDetailMock = vi.fn();
const getProgressMock = vi.fn();
const getBootstrapMock = vi.fn();

vi.mock("@/features/grammar-learning/application/GrammarLearningService", () => ({
  GrammarLearningService: class {
    getTaxonomy = getTaxonomyMock;
    searchGrammarPoints = searchGrammarPointsMock;
    getGrammarPointDetail = getGrammarPointDetailMock;
    getProgress = getProgressMock;
    getBootstrap = getBootstrapMock;
  },
}));

vi.mock("@/features/grammar-learning/infrastructure/GrammarRepository", () => ({
  GrammarRepository: class {},
}));

vi.mock("@/features/grammar-learning/infrastructure/GrammarAiClient", () => ({
  GrammarAiClient: class {},
}));

const grammarPointId = "11111111-1111-4111-8111-111111111111";

describe("grammar API routes", () => {
  beforeEach(() => {
    getTaxonomyMock.mockReset();
    searchGrammarPointsMock.mockReset();
    getGrammarPointDetailMock.mockReset();
    getProgressMock.mockReset();
    getBootstrapMock.mockReset();
  });

  it("returns seven knowledge dimensions with comparisons and errors separated", async () => {
    const knowledgeDimensions = [
      ["expression_function", "表达功能"],
      ["form_tense_aspect", "形态、活用与时间体"],
      ["sentence_structure", "句子结构与成分"],
      ["particle_system", "助词系统"],
      ["register_social", "语体、敬语与社会关系"],
      ["discourse_organization", "连接与篇章组织"],
      ["collocation_construction", "词汇搭配与构式"],
    ].map(([slug, nameZh], index) => ({
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      slug,
      nameZh,
      nameEn: `Dimension ${index + 1}`,
      description: "知识维度说明。",
      displayOrder: index + 1,
      status: "active",
    }));
    const taxonomyNodes = Array.from({ length: 46 }, (_, index) => ({
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      slug: index === 0 ? "basic_sentence_patterns" : `node_${index + 1}`,
      dimensionId: knowledgeDimensions[index < 18 ? 0 : 1].id,
      dimensionSlug: index < 18 ? "expression_function" : "form_tense_aspect",
      dimensionNameZh: index < 18 ? "表达功能" : "形态、活用与时间体",
      dimensionNameEn: `Dimension ${index < 18 ? 1 : 2}`,
      nameZh: index === 0 ? "基础句型" : `分类 ${index + 1}`,
      nameEn: index === 0 ? "Basic sentence patterns" : `Node ${index + 1}`,
      description: "分类说明。",
      exampleExpressions: index === 0 ? ["AはBです", "Aがあります / います"] : [],
      displayOrder: index + 1,
      status: "active",
    }));
    const categories = taxonomyNodes.slice(0, 18).map((node, index) => ({
      id: node.id,
      slug: node.slug,
      groupSlug: "expressive_functions",
      groupNameZh: "表达功能",
      nameZh: node.nameZh,
      nameEn: node.nameEn,
      description: node.description,
      exampleExpressions: node.exampleExpressions,
      priority: index + 1,
      isMvp: true,
    }));
    getTaxonomyMock.mockResolvedValue({
      knowledgeDimensions,
      taxonomyNodes,
      learningStages: Array.from({ length: 5 }, (_, index) => ({
        id: `55555555-5555-4555-8555-${String(index + 1).padStart(12, "0")}`,
        slug: `stage_${index + 1}`,
        nameZh: `阶段 ${index + 1}`,
        description: "阶段说明。",
        displayOrder: index + 1,
        status: "active",
      })),
      learningModules: Array.from({ length: 19 }, (_, index) => ({
        id: `66666666-6666-4666-8666-${String(index + 1).padStart(12, "0")}`,
        stageId: `55555555-5555-4555-8555-${String(Math.min(Math.floor(index / 4) + 1, 5)).padStart(12, "0")}`,
        stageSlug: `stage_${Math.min(Math.floor(index / 4) + 1, 5)}`,
        stageNameZh: `阶段 ${Math.min(Math.floor(index / 4) + 1, 5)}`,
        slug: `module_${index + 1}`,
        nameZh: `模块 ${index + 1}`,
        description: "模块说明。",
        displayOrder: (index % 4) + 1,
        status: "active",
      })),
      comparisonSets: Array.from({ length: 27 }, (_, index) => ({
        id: `33333333-3333-4333-8333-${String(index + 1).padStart(12, "0")}`,
        slug: `comparison_${index + 1}`,
        nameZh: `对比 ${index + 1}`,
        summary: "对比说明。",
        commonMeaning: "共同含义。",
        decisionRules: [],
        connectionDifferences: [],
        registerDifferences: [],
        interchangeableCases: [],
        nonInterchangeableCases: [],
        minimalPairExamples: [],
        learnerMistakes: [],
        status: "active",
        members: [],
      })),
      errorTypes: Array.from({ length: 10 }, (_, index) => ({
        id: `44444444-4444-4444-8444-${String(index + 1).padStart(12, "0")}`,
        code: `error_${index + 1}`,
        nameZh: `错误 ${index + 1}`,
        description: "错误说明。",
        defaultSeverity: "medium",
        status: "active",
      })),
      categoryGroups: [],
      categories,
      sceneTags: [{ nameEn: "daily_life", nameZh: "日常生活" }],
      registerTags: [{ nameEn: "polite", nameZh: "一般礼貌" }],
    });

    const { GET } = await import("@/app/api/grammar/taxonomy/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.knowledgeDimensions).toHaveLength(7);
    expect(body.knowledgeDimensions[1]).toMatchObject({
      slug: "form_tense_aspect",
      nameZh: "形态、活用与时间体",
    });
    expect(body.knowledgeDimensions).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slug: "confusing_grammar_contrasts" }),
        expect.objectContaining({ slug: "error_diagnosis_correction" }),
      ])
    );
    expect(body.taxonomyNodes).toHaveLength(46);
    expect(body.learningStages).toHaveLength(5);
    expect(body.learningModules).toHaveLength(19);
    expect(body.comparisonSets).toHaveLength(27);
    expect(body.errorTypes).toHaveLength(10);
    expect(body.categories).toHaveLength(18);
    expect(body.categories[0]).toMatchObject({
      slug: "basic_sentence_patterns",
      groupSlug: "expressive_functions",
      nameZh: "基础句型",
      exampleExpressions: ["AはBです", "Aがあります / います"],
    });
  });

  it("keeps legacy group and category filters compatible", async () => {
    searchGrammarPointsMock.mockResolvedValue({
      items: [
        {
          id: grammarPointId,
          grammarPoint: "〜うちに",
          reading: "〜うちに",
          categoryId: "33333333-3333-4333-8333-333333333333",
          categorySlug: "time_and_sequence",
          categoryNameZh: "时间与顺序",
          categoryNameEn: "Time and sequence",
          categoryGroupSlug: "expressive_functions",
          categoryGroupNameZh: "表达功能",
          categoryGroupNameEn: "Expressive functions",
          subCategory: "趁还在",
          coreMeaning: "趁某状态还持续时做某事。",
          naturalTranslation: "趁着……",
          structure: "普通形/名词の + うちに",
          practicality: "A",
          spokenOrWritten: "both",
          sceneTags: [],
          registerTags: [],
          isFavorite: false,
        },
      ],
    });

    const { GET } = await import("@/app/api/grammar/route");
    const response = await GET(
      new Request(
        "http://localhost/api/grammar?query=%E3%81%86%E3%81%A1%E3%81%AB&group=expressive_functions&category=time_and_sequence&practicality=A&learningStatus=learning&limit=12&offset=36"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      items: [
        expect.objectContaining({
          grammarPoint: "〜うちに",
          categoryNameZh: "时间与顺序",
        }),
      ],
    });
    expect(searchGrammarPointsMock).toHaveBeenCalledWith({
      query: "うちに",
      categorySlug: "time_and_sequence",
      groupSlug: "expressive_functions",
      dimensionSlug: undefined,
      stageSlug: undefined,
      moduleSlug: undefined,
      practicality: "A",
      learningStatus: "learning",
      limit: "12",
      offset: "36",
      userId: undefined,
    });
  });

  it("returns grammar learning progress grouped by major category", async () => {
    getProgressMock.mockResolvedValue({
      totalGrammarPoints: 155,
      startedCount: 12,
      masteredCount: 4,
      pendingCompletionCount: 2,
      dueReviewCount: 1,
      reviewCount: 3,
      favoriteCount: 8,
      groupProgress: [
        {
          id: "11111111-1111-4111-8111-000000000001",
          slug: "expressive_functions",
          nameZh: "表达功能",
          nameEn: "Expressive functions",
          description: "按交际目的学习表达。",
          priority: 1,
          totalCount: 90,
          startedCount: 8,
          masteredCount: 3,
          pendingCompletionCount: 1,
          dueReviewCount: 1,
          reviewCount: 2,
          favoriteCount: 5,
        },
      ],
    });

    const { GET } = await import("@/app/api/grammar/progress/route");
    const response = await GET(
      new Request("http://localhost/api/grammar/progress?userId=00000000-0000-0000-0000-000000000001")
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      totalGrammarPoints: 155,
      startedCount: 12,
      masteredCount: 4,
      pendingCompletionCount: 2,
      dueReviewCount: 1,
      reviewCount: 3,
      favoriteCount: 8,
      groupProgress: [
        expect.objectContaining({
          slug: "expressive_functions",
          nameZh: "表达功能",
          totalCount: 90,
          startedCount: 8,
        }),
      ],
    });
    expect(getProgressMock).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001"
    );
  });

  it("returns grammar homepage bootstrap data in one request", async () => {
    getBootstrapMock.mockResolvedValue({
      taxonomy: {
        knowledgeDimensions: [{ slug: "expression_function", nameZh: "表达功能" }],
        taxonomyNodes: [],
        learningStages: [],
        learningModules: [],
      },
      progress: {
        totalGrammarPoints: 340,
        startedCount: 12,
        masteredCount: 4,
        pendingCompletionCount: 2,
        dueReviewCount: 1,
        reviewCount: 3,
        favoriteCount: 8,
        groupProgress: [],
      },
      search: {
        items: [
          {
            id: grammarPointId,
            grammarPoint: "〜てもらえますか",
            coreMeaning: "请求对方为自己做某事。",
          },
        ],
      },
    });

    const { GET } = await import("@/app/api/grammar/bootstrap/route");
    const response = await GET(
      new Request(
        "http://localhost/api/grammar/bootstrap?dimension=expression_function&limit=37"
      )
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      progress: { totalGrammarPoints: 340 },
      search: {
        items: [
          {
            grammarPoint: "〜てもらえますか",
          },
        ],
      },
      taxonomy: {
        knowledgeDimensions: [
          {
            slug: "expression_function",
          },
        ],
      },
    });
    expect(getBootstrapMock).toHaveBeenCalledWith({
      query: undefined,
      categorySlug: undefined,
      groupSlug: undefined,
      dimensionSlug: "expression_function",
      stageSlug: undefined,
      moduleSlug: undefined,
      practicality: undefined,
      learningStatus: undefined,
      limit: "37",
      offset: undefined,
      userId: undefined,
    });
  });

  it("returns grammar detail with examples, mistakes, and similar grammar", async () => {
    getGrammarPointDetailMock.mockResolvedValue({
      grammarPoint: {
        id: grammarPointId,
        grammarPoint: "〜てもらえますか",
        reading: "〜てもらえますか",
        categoryId: "44444444-4444-4444-8444-444444444444",
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
        sceneTags: [{ nameEn: "hospital", nameZh: "医院" }],
        registerTags: [{ nameEn: "polite", nameZh: "一般礼貌" }],
        isFavorite: false,
        notes: "日常礼貌请求非常实用。",
        jlptLevel: "N4",
        commonMistakes: ["句尾变成「〜てもらえる？」会明显变随便。"],
        examples: [
          {
            id: "55555555-5555-4555-8555-555555555555",
            jp: "すみません、もう一度説明してもらえますか。",
            zh: "不好意思，可以请您再说明一遍吗？",
            sceneTag: { nameEn: "hospital", nameZh: "医院" },
            registerTag: { nameEn: "polite", nameZh: "一般礼貌" },
            difficulty: 1,
            naturalnessScore: 5,
            notes: "医院里对医生可用。",
          },
        ],
        similarGrammar: [
          {
            id: "66666666-6666-4666-8666-666666666666",
            grammarPointId,
            similarGrammarPointId: "77777777-7777-4777-8777-777777777777",
            similarGrammarPointText: "〜ていただけますか",
            differenceSummary: "更郑重。",
            exampleA: "説明してもらえますか。",
            exampleB: "説明していただけますか。",
            notes: "正式场景更适合いただく。",
          },
        ],
      },
    });

    const { GET } = await import("@/app/api/grammar/[grammarPointId]/route");
    const response = await GET(new Request(`http://localhost/api/grammar/${grammarPointId}`), {
      params: Promise.resolve({ grammarPointId }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      grammarPoint: expect.objectContaining({
        grammarPoint: "〜てもらえますか",
        categoryNameZh: "请求、许可与建议",
        commonMistakes: ["句尾变成「〜てもらえる？」会明显变随便。"],
        examples: [expect.objectContaining({ jp: "すみません、もう一度説明してもらえますか。" })],
        similarGrammar: [expect.objectContaining({ similarGrammarPointText: "〜ていただけますか" })],
      }),
    });
    expect(getGrammarPointDetailMock).toHaveBeenCalledWith(grammarPointId, undefined);
  });
});
