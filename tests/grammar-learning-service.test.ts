import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import type { GrammarPointDetail } from "@/shared/types/api";

const GRAMMAR_POINT_ID = "11111111-1111-4111-8111-111111111111";
const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

const grammarPoint: GrammarPointDetail = {
  id: GRAMMAR_POINT_ID,
  grammarPoint: "〜てもらえますか",
  reading: "〜てもらえますか",
  categoryId: "22222222-2222-4222-8222-222222222222",
  categorySlug: "requests-permission-advice",
  categoryNameZh: "请求、许可与建议",
  categoryNameEn: "Requests, permission, and advice",
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
  notes: "日常礼貌请求非常实用。",
  jlptLevel: "N4",
  commonMistakes: ["句尾变成〜てもらえる？会明显变随便"],
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

function createRepositoryMock() {
  return {
    listCategories: vi.fn(),
    listSceneTags: vi.fn(),
    listRegisterTags: vi.fn(),
    findTag: vi.fn().mockImplementation((_kind: string, nameEn?: string) =>
      Promise.resolve(
        nameEn
          ? {
              nameEn,
              nameZh: nameEn === "hospital" ? "医院" : "一般礼貌",
            }
          : null
      )
    ),
    searchGrammarPoints: vi.fn().mockResolvedValue([grammarPoint]),
    findGrammarPointById: vi.fn().mockResolvedValue(grammarPoint),
    insertUserSentence: vi.fn().mockResolvedValue("44444444-4444-4444-8444-444444444444"),
    insertFeedback: vi.fn().mockResolvedValue("55555555-5555-4555-8555-555555555555"),
    updateReviewRecord: vi.fn().mockResolvedValue(undefined),
    logLearningHistory: vi.fn().mockResolvedValue(undefined),
    addFavorite: vi.fn().mockResolvedValue(undefined),
    removeFavorite: vi.fn().mockResolvedValue(undefined),
    listFavorites: vi.fn().mockResolvedValue([grammarPoint]),
    listReviewItems: vi.fn().mockResolvedValue([]),
  };
}

describe("GrammarLearningService", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    expect(result.grammarScore).toBe(4);
    expect(result.registerScore).toBe(2);
    expect(result.feedbackText).toContain("太随便");
    expect(result.correctedSentence).toBe(
      "すみません、もう一度説明していただけますか。"
    );
    expect(repository.updateReviewRecord).toHaveBeenCalledWith({
      userId: DEFAULT_USER_ID,
      grammarPointId: GRAMMAR_POINT_ID,
      hasMistake: true,
    });
    expect(repository.insertFeedback).toHaveBeenCalledWith(
      "44444444-4444-4444-8444-444444444444",
      expect.objectContaining({
        mistakeTypes: ["wrong_register"],
      })
    );
  });
});
