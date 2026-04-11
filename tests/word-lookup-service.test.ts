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
    examples: [],
  };

  const completedEntry: DictionaryEntry = {
    ...entry,
    examples: [
      {
        japanese: "毎日よく食べる。",
        reading: "まいにち よく たべる。",
        translationZh: "每天都常常吃。",
      },
      {
        japanese: "野菜を先に食べる。",
        reading: "やさい を さき に たべる。",
        translationZh: "先吃蔬菜。",
      },
      {
        japanese: "外で昼ご飯を食べる。",
        reading: "そと で ひるごはん を たべる。",
        translationZh: "在外面吃午饭。",
      },
    ],
  };

  it("returns the dictionary entry when the word exists locally", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(entry),
    };
    const aiWordLookupService = {
      completeEntry: vi.fn().mockResolvedValue(completedEntry),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("  食べる  ")).resolves.toEqual({
      word: "食べる",
      source: "dictionary",
      entry: completedEntry,
    });
    expect(dictionaryService.findEntry).toHaveBeenCalledWith("食べる");
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith("食べる", entry);
  });

  it("falls back to AI inference when the dictionary misses", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(null),
    };
    const aiWordLookupService = {
      completeEntry: vi.fn().mockResolvedValue({
        word: "未知词",
        pronunciation: "みちご",
        meaningZh: "未知词",
        partOfSpeech: "名词",
        examples: [
          {
            japanese: "未知词の例文です。",
            reading: "みちご の れいぶん です。",
            translationZh: "这是未知词的例句。",
          },
          {
            japanese: "未知词を確認します。",
            reading: "みちご を かくにん します。",
            translationZh: "确认这个未知词。",
          },
          {
            japanese: "未知词を使ってみます。",
            reading: "みちご を つかって みます。",
            translationZh: "试着使用这个未知词。",
          },
        ],
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
        examples: [
          {
            japanese: "未知词の例文です。",
            reading: "みちご の れいぶん です。",
            translationZh: "这是未知词的例句。",
          },
          {
            japanese: "未知词を確認します。",
            reading: "みちご を かくにん します。",
            translationZh: "确认这个未知词。",
          },
          {
            japanese: "未知词を使ってみます。",
            reading: "みちご を つかって みます。",
            translationZh: "试着使用这个未知词。",
          },
        ],
      },
    });
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith("未知词");
  });

  it("rejects empty input", async () => {
    const service = new WordLookupService({} as never, {} as never);

    await expect(service.lookupWord("   ")).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
