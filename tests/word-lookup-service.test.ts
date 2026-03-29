import { describe, expect, it, vi } from "vitest";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";
import type { DictionaryEntry } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

describe("WordLookupService", () => {
  const entry: DictionaryEntry = {
    word: "食べる",
    pronunciation: "たべる",
    meaningZh: "吃；进食",
    partOfSpeech: "动词",
  };

  it("returns the dictionary entry when the word exists locally", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(entry),
    };
    const aiWordLookupService = {
      inferEntry: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("  食べる  ")).resolves.toEqual({
      word: "食べる",
      source: "dictionary",
      entry,
    });
    expect(dictionaryService.findEntry).toHaveBeenCalledWith("食べる");
    expect(aiWordLookupService.inferEntry).not.toHaveBeenCalled();
  });

  it("falls back to AI inference when the dictionary misses", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(null),
    };
    const aiWordLookupService = {
      inferEntry: vi.fn().mockResolvedValue({
        word: "未知词",
        pronunciation: "みちご",
        meaningZh: "未知词",
        partOfSpeech: "名词",
      }),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("未知词")).resolves.toEqual({
      word: "未知词",
      source: "ai",
      entry: {
        word: "未知词",
        pronunciation: "みちご",
        meaningZh: "未知词",
        partOfSpeech: "名词",
      },
    });
    expect(aiWordLookupService.inferEntry).toHaveBeenCalledWith("未知词");
  });

  it("rejects empty input", async () => {
    const service = new WordLookupService({} as never, {} as never);

    await expect(service.lookupWord("   ")).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
