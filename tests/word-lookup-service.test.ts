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
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(completedEntry),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("  食べる  ")).resolves.toEqual({
      word: "食べる",
      lookupWord: "食べる",
      source: "dictionary",
      entry: completedEntry,
    });
    expect(dictionaryService.findEntry).toHaveBeenCalledWith("食べる");
    expect(aiWordLookupService.resolveLookupWord).not.toHaveBeenCalled();
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith("食べる", entry);
  });

  it("resolves the base form and retries the dictionary lookup", async () => {
    const resolvedEntry: DictionaryEntry = {
      word: "見通せる",
      pronunciation: "みとおせる",
      meaningZh: "能看透；能预见",
      partOfSpeech: "动词",
      examples: [],
    };
    const completedResolvedEntry: DictionaryEntry = {
      ...resolvedEntry,
      examples: [
        {
          japanese: "先の展開はまだ見通せない。",
          reading: "さき の てんかい は まだ みとおせない。",
          translationZh: "后面的发展还看不清。",
        },
        {
          japanese: "状況が少しずつ見通せるようになった。",
          reading: "じょうきょう が すこしずつ みとおせる よう に なった。",
          translationZh: "情况渐渐变得能够看清了。",
        },
        {
          japanese: "今後の計画を見通せる材料が足りない。",
          reading: "こんご の けいかく を みとおせる ざいりょう が たりない。",
          translationZh: "还缺少能够看清今后计划的材料。",
        },
      ],
    };

    const dictionaryService = {
      findEntry: vi
        .fn()
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(resolvedEntry),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn().mockResolvedValue({
        lookupWord: "見通せる",
        lookupReason: "输入是否定形，查词时通常还原为对应的词典形。",
      }),
      completeEntry: vi.fn().mockResolvedValue(completedResolvedEntry),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("見通せない")).resolves.toEqual({
      word: "見通せない",
      lookupWord: "見通せる",
      lookupReason: "输入是否定形，查词时通常还原为对应的词典形。",
      source: "dictionary",
      entry: completedResolvedEntry,
    });
    expect(dictionaryService.findEntry).toHaveBeenNthCalledWith(1, "見通せない");
    expect(aiWordLookupService.resolveLookupWord).toHaveBeenCalledWith("見通せない");
    expect(dictionaryService.findEntry).toHaveBeenNthCalledWith(2, "見通せる");
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "見通せる",
      resolvedEntry
    );
  });

  it("falls back to AI inference when the dictionary still misses after base-form resolution", async () => {
    const dictionaryService = {
      findEntry: vi.fn().mockResolvedValue(null),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn().mockResolvedValue({
        lookupWord: "未知词",
        lookupReason: "输入本身已经适合直接查词。",
      }),
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
      lookupWord: "未知词",
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
    expect(aiWordLookupService.resolveLookupWord).toHaveBeenCalledWith("未知词");
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith("未知词");
  });

  it("rejects empty input", async () => {
    const service = new WordLookupService({} as never, {} as never);

    await expect(service.lookupWord("   ")).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
