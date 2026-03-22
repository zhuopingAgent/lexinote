import { describe, expect, it, vi } from "vitest";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";
import type {
  AIExplanationResult,
  DictionaryEntry,
} from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

describe("WordLookupService", () => {
  const entry: DictionaryEntry = {
    word: "食べる",
    pronunciation: "たべる",
    meaningZh: "吃；进食",
    partOfSpeech: "动词",
  };

  const explanation: AIExplanationResult = {
    explanationSource: "openai",
    explanation: {
      actualUsage: "描述吃东西这个动作。",
      commonScenarios: "日常吃饭、点餐、描述饮食习惯。",
      nuanceDifferences: "比中文“吃”更依赖句子里的搭配和语境。",
      commonMistakes: "容易忽略动词变形和固定搭配。",
    },
  };

  it("trims input and combines dictionary plus explanation", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(entry),
    };
    const aiExplanationService = {
      explain: vi.fn().mockResolvedValue(explanation),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiExplanationService as never
    );

    await expect(service.explainWord("  食べる  ")).resolves.toEqual({
      word: "食べる",
      source: "dictionary",
      entry,
      ...explanation,
    });
    expect(dictionaryService.findEntry).toHaveBeenCalledWith("食べる");
    expect(aiExplanationService.explain).toHaveBeenCalledWith(
      entry,
      undefined,
      undefined,
      undefined
    );
  });

  it("rejects empty input", async () => {
    const service = new WordLookupService({} as never, {} as never);

    await expect(service.explainWord("   ")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("falls back to ai-only explanation when dictionary entry is missing", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(null),
    };
    const aiExplanationService = {
      explainWordOnly: vi.fn().mockResolvedValue(explanation),
    };
    const service = new WordLookupService(
      dictionaryService as never,
      aiExplanationService as never
    );

    await expect(service.explainWord("未知词")).resolves.toEqual({
      word: "未知词",
      source: "ai-only",
      entry: null,
      ...explanation,
    });
    expect(aiExplanationService.explainWordOnly).toHaveBeenCalledWith(
      "未知词",
      undefined,
      undefined,
      undefined
    );
  });

  it("prepares dictionary preview before generating explanation", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(entry),
    };
    const service = new WordLookupService(dictionaryService as never, {} as never);

    await expect(service.prepareLookup("食べる")).resolves.toEqual({
      word: "食べる",
      source: "dictionary",
      entry,
    });
  });

  it("completes ai-only preview with explanation", async () => {
    const aiExplanationService = {
      explainWordOnly: vi.fn().mockResolvedValue(explanation),
    };
    const service = new WordLookupService({} as never, aiExplanationService as never);

    await expect(
      service.completeLookup(
        {
          word: "未知词",
          source: "ai-only",
          entry: null,
        },
        "gpt-5.4"
      )
    ).resolves.toEqual({
      word: "未知词",
      source: "ai-only",
      entry: null,
      ...explanation,
    });
    expect(aiExplanationService.explainWordOnly).toHaveBeenCalledWith(
      "未知词",
      "gpt-5.4",
      undefined,
      undefined
    );
  });
});
