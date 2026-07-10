import { beforeEach, describe, expect, it, vi } from "vitest";

const getTaxonomyMock = vi.fn();
const searchGrammarPointsMock = vi.fn();
const getGrammarPointDetailMock = vi.fn();
const getProgressMock = vi.fn();

vi.mock("@/features/grammar-learning/application/GrammarLearningService", () => ({
  GrammarLearningService: class {
    getTaxonomy = getTaxonomyMock;
    searchGrammarPoints = searchGrammarPointsMock;
    getGrammarPointDetail = getGrammarPointDetailMock;
    getProgress = getProgressMock;
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
  });

  it("returns the 9-major-group taxonomy with Chinese labels and examples", async () => {
    const categoryGroups = Array.from({ length: 9 }, (_, index) => ({
      id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, "0")}`,
      slug:
        index === 1
          ? "morphology_conjugation_tense_aspect"
          : index === 0
            ? "expressive_functions"
            : `group_${index + 1}`,
      nameZh:
        index === 1
          ? "形态、活用与时间体系统"
          : index === 0
            ? "表达功能"
            : `大类 ${index + 1}`,
      nameEn:
        index === 1
          ? "Morphology, conjugation, tense, and aspect"
          : index === 0
            ? "Expressive functions"
            : `Group ${index + 1}`,
      description: index === 1 ? "系统学习词形变化、时态、否定、持续、完成和派生形。" : "大类说明。",
      priority: index + 1,
      isMvp: true,
    }));
    const categories = Array.from({ length: 56 }, (_, index) => ({
      id: `22222222-2222-4222-8222-${String(index + 1).padStart(12, "0")}`,
      slug:
        index === 0
          ? "basic_sentence_patterns"
          : index === 18
            ? "tense_and_negation"
            : `category_${index + 1}`,
      groupSlug: index < 18 ? "expressive_functions" : "morphology_conjugation_tense_aspect",
      groupNameZh: index < 18 ? "表达功能" : "形态、活用与时间体系统",
      nameZh:
        index === 0 ? "基础句型" : index === 18 ? "时态与否定" : `分类 ${index + 1}`,
      nameEn:
        index === 0
          ? "Basic sentence patterns"
          : index === 18
            ? "Tense and negation"
            : `Category ${index + 1}`,
      description:
        index === 0
          ? "用于构建最基本的日语句子。"
          : index === 18
            ? "非过去、过去、否定、过去否定及礼貌体对应关系。"
            : "分类说明。",
      exampleExpressions: index === 0 ? ["AはBです", "Aがあります / います"] : [],
      priority: index + 1,
      isMvp: true,
    }));
    getTaxonomyMock.mockResolvedValue({
      categoryGroups,
      categories,
      sceneTags: [{ nameEn: "daily_life", nameZh: "日常生活" }],
      registerTags: [{ nameEn: "polite", nameZh: "一般礼貌" }],
    });

    const { GET } = await import("@/app/api/grammar/taxonomy/route");
    const response = await GET();

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.categoryGroups).toHaveLength(9);
    expect(body.categoryGroups[1]).toMatchObject({
      slug: "morphology_conjugation_tense_aspect",
      nameZh: "形态、活用与时间体系统",
    });
    expect(body.categories).toHaveLength(56);
    expect(body.categories[0]).toMatchObject({
      slug: "basic_sentence_patterns",
      groupSlug: "expressive_functions",
      nameZh: "基础句型",
      exampleExpressions: ["AはBです", "Aがあります / います"],
    });
  });

  it("forwards grammar list search with group and category filtering", async () => {
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
        "http://localhost/api/grammar?query=%E3%81%86%E3%81%A1%E3%81%AB&group=expressive_functions&category=time_and_sequence&limit=12"
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
      limit: "12",
      userId: undefined,
    });
  });

  it("returns grammar learning progress grouped by major category", async () => {
    getProgressMock.mockResolvedValue({
      totalGrammarPoints: 155,
      startedCount: 12,
      masteredCount: 4,
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
