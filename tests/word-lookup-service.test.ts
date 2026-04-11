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
      findEntries: vi.fn().mockResolvedValue([entry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(completedEntry),
      reconcileEntries: vi.fn(),
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
    expect(dictionaryService.findEntries).toHaveBeenCalledWith("食べる");
    expect(aiWordLookupService.resolveLookupWord).not.toHaveBeenCalled();
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "食べる",
      entry,
      undefined
    );
    expect(dictionaryService.saveEntry).toHaveBeenCalledWith(completedEntry);
  });

  it("uses context to regenerate the result without persisting it", async () => {
    const contextualEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "怀有；抱有",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "彼は将来に不安を抱いている。",
          reading: "かれ は しょうらい に ふあん を だいて いる。",
          translationZh: "他对未来怀有不安。",
        },
        {
          japanese: "大きな責任感を抱いて行動した。",
          reading: "おおきな せきにんかん を だいて こうどう した。",
          translationZh: "怀着强烈的责任感行动了。",
        },
        {
          japanese: "疑問を抱いたまま返事を保留した。",
          reading: "ぎもん を いだいた まま へんじ を ほりゅう した。",
          translationZh: "带着疑问暂时没有回复。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([
        {
          word: "抱く",
          pronunciation: "だく",
          meaningZh: "抱；拥抱；怀有",
          partOfSpeech: "动词",
          examples: completedEntry.examples,
        },
      ]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(contextualEntry),
      reconcileEntries: vi.fn().mockResolvedValue(null),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "不安を抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: contextualEntry,
    });
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "抱く",
      {
        word: "抱く",
        pronunciation: "だく",
        meaningZh: "抱；拥抱；怀有",
        partOfSpeech: "动词",
        examples: completedEntry.examples,
      },
      "不安を抱く"
    );
    expect(aiWordLookupService.reconcileEntries).toHaveBeenCalledWith(
      "抱く",
      {
        word: "抱く",
        pronunciation: "だく",
        meaningZh: "抱；拥抱；怀有",
        partOfSpeech: "动词",
        examples: completedEntry.examples,
      },
      contextualEntry,
      "不安を抱く"
    );
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
  });

  it("persists a contextual entry as an additional pronunciation when context changes the reading", async () => {
    const genericEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱；怀有",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "子どもを抱いて眠る。",
          reading: "こども を だいて ねむる。",
          translationZh: "抱着孩子睡觉。",
        },
        {
          japanese: "花束を胸に抱く。",
          reading: "はなたば を むね に だく。",
          translationZh: "把花束抱在胸前。",
        },
        {
          japanese: "夢を抱いて上京した。",
          reading: "ゆめ を いだいて じょうきょう した。",
          translationZh: "怀着梦想去了东京。",
        },
      ],
    };
    const contextualEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "彼は将来に不安を抱いている。",
          reading: "かれ は しょうらい に ふあん を いだいて いる。",
          translationZh: "他对未来怀有不安。",
        },
        {
          japanese: "住民は計画に疑念を抱いた。",
          reading: "じゅうみん は けいかく に ぎねん を いだいた。",
          translationZh: "居民对计划产生了疑虑。",
        },
        {
          japanese: "彼女は強い期待を抱いていた。",
          reading: "かのじょ は つよい きたい を いだいて いた。",
          translationZh: "她怀有很强的期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([genericEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(contextualEntry),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "不安を抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: contextualEntry,
    });
    expect(dictionaryService.saveEntry).toHaveBeenCalledWith(contextualEntry);
    expect(aiWordLookupService.reconcileEntries).not.toHaveBeenCalled();
  });

  it("reconciles generic and contextual entries when the reading stays the same but the meaning diverges clearly", async () => {
    const genericEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱；怀有",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "子どもを抱いて眠る。",
          reading: "こども を だいて ねむる。",
          translationZh: "抱着孩子睡觉。",
        },
        {
          japanese: "花束を胸に抱く。",
          reading: "はなたば を むね に だく。",
          translationZh: "把花束抱在胸前。",
        },
        {
          japanese: "夢を抱いて上京した。",
          reading: "ゆめ を だいて じょうきょう した。",
          translationZh: "怀着梦想去了东京。",
        },
      ],
    };
    const contextualEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "怀有；抱有",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "彼は不安を抱いている。",
          reading: "かれ は ふあん を だいて いる。",
          translationZh: "他正怀着不安。",
        },
        {
          japanese: "疑問を抱いたまま帰宅した。",
          reading: "ぎもん を だいた まま きたく した。",
          translationZh: "带着疑问回家了。",
        },
        {
          japanese: "期待を抱いて結果を待つ。",
          reading: "きたい を だいて けっか を まつ。",
          translationZh: "怀着期待等待结果。",
        },
      ],
    };
    const reconciledEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱；也表示心中怀有某种感情、想法或不安",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊をそっと抱く。",
          reading: "あかんぼう を そっと だく。",
          translationZh: "轻轻抱起婴儿。",
        },
        {
          japanese: "将来に不安を抱いている。",
          reading: "しょうらい に ふあん を だいて いる。",
          translationZh: "正对未来怀有不安。",
        },
        {
          japanese: "新しい仕事に期待を抱く。",
          reading: "あたらしい しごと に きたい を だく。",
          translationZh: "对新工作抱有期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([genericEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(contextualEntry),
      reconcileEntries: vi.fn().mockResolvedValue(reconciledEntry),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "不安を抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: reconciledEntry,
    });
    expect(dictionaryService.saveEntry).toHaveBeenCalledWith(reconciledEntry);
  });

  it("reuses persisted examples without calling AI again", async () => {
    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([completedEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn(),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("食べる")).resolves.toEqual({
      word: "食べる",
      lookupWord: "食べる",
      source: "dictionary",
      entry: completedEntry,
    });
    expect(aiWordLookupService.resolveLookupWord).not.toHaveBeenCalled();
    expect(aiWordLookupService.completeEntry).not.toHaveBeenCalled();
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
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
      findEntries: vi
        .fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([resolvedEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn().mockResolvedValue({
        lookupWord: "見通せる",
        lookupReason: "输入是否定形，查词时通常还原为对应的词典形。",
      }),
      completeEntry: vi.fn().mockResolvedValue(completedResolvedEntry),
      reconcileEntries: vi.fn(),
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
    expect(dictionaryService.findEntries).toHaveBeenNthCalledWith(1, "見通せない");
    expect(aiWordLookupService.resolveLookupWord).toHaveBeenCalledWith(
      "見通せない",
      undefined
    );
    expect(dictionaryService.findEntries).toHaveBeenNthCalledWith(2, "見通せる");
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "見通せる",
      resolvedEntry,
      undefined
    );
    expect(dictionaryService.saveEntry).toHaveBeenCalledWith(completedResolvedEntry);
  });

  it("falls back to AI inference when the dictionary still misses after base-form resolution", async () => {
    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([]),
      saveEntry: vi.fn(),
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
      reconcileEntries: vi.fn(),
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
    expect(aiWordLookupService.resolveLookupWord).toHaveBeenCalledWith(
      "未知词",
      undefined
    );
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "未知词",
      undefined,
      undefined
    );
    expect(dictionaryService.saveEntry).toHaveBeenCalledWith({
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
    });
  });

  it("does not persist placeholder fallback entries", async () => {
    const fallbackEntry: DictionaryEntry = {
      word: "未知词",
      pronunciation: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      examples: [],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn().mockResolvedValue(null),
      completeEntry: vi.fn().mockResolvedValue(fallbackEntry),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("未知词")).resolves.toEqual({
      word: "未知词",
      lookupWord: "未知词",
      source: "ai",
      entry: fallbackEntry,
    });
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
  });

  it("returns all local entries when the same word has multiple persisted results", async () => {
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱；也可泛指抱有某种想法",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊をそっと抱く。",
          reading: "あかんぼう を そっと だく。",
          translationZh: "轻轻抱起婴儿。",
        },
        {
          japanese: "花束を胸に抱いて歩く。",
          reading: "はなたば を むね に だいて あるく。",
          translationZh: "怀抱着花束走路。",
        },
        {
          japanese: "夢を抱いて上京した。",
          reading: "ゆめ を だいて じょうきょう した。",
          translationZh: "怀着梦想去了东京。",
        },
      ],
    };
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "将来に不安を抱く。",
          reading: "しょうらい に ふあん を いだく。",
          translationZh: "对未来怀有不安。",
        },
        {
          japanese: "住民は計画に疑念を抱いた。",
          reading: "じゅうみん は けいかく に ぎねん を いだいた。",
          translationZh: "居民对计划产生了疑虑。",
        },
        {
          japanese: "新しい仕事に期待を抱いている。",
          reading: "あたらしい しごと に きたい を いだいて いる。",
          translationZh: "正对新工作怀有期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([physicalEntry, abstractEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn(),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: physicalEntry,
      entries: [physicalEntry, abstractEntry],
    });
    expect(aiWordLookupService.completeEntry).not.toHaveBeenCalled();
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
  });

  it("reuses the best-matching local entry for context when one entry is clearly matched", async () => {
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊をそっと抱く。",
          reading: "あかんぼう を そっと だく。",
          translationZh: "轻轻抱起婴儿。",
        },
        {
          japanese: "花束を胸に抱いて歩く。",
          reading: "はなたば を むね に だいて あるく。",
          translationZh: "怀抱着花束走路。",
        },
        {
          japanese: "子どもを抱いて眠る。",
          reading: "こども を だいて ねむる。",
          translationZh: "抱着孩子睡觉。",
        },
      ],
    };
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "将来に不安を抱く。",
          reading: "しょうらい に ふあん を いだく。",
          translationZh: "对未来怀有不安。",
        },
        {
          japanese: "住民は計画に疑念を抱いた。",
          reading: "じゅうみん は けいかく に ぎねん を いだいた。",
          translationZh: "居民对计划产生了疑虑。",
        },
        {
          japanese: "新しい仕事に期待を抱いている。",
          reading: "あたらしい しごと に きたい を いだいて いる。",
          translationZh: "正对新工作怀有期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([physicalEntry, abstractEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn(),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "不安を抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: abstractEntry,
      entries: [abstractEntry, physicalEntry],
    });
    expect(aiWordLookupService.completeEntry).not.toHaveBeenCalled();
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
  });

  it("does not mistake a real context like 希望を抱く for an instructional request", async () => {
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊を抱く。",
          reading: "あかんぼう を だく。",
          translationZh: "抱起婴儿。",
        },
        {
          japanese: "花束を抱いて歩く。",
          reading: "はなたば を だいて あるく。",
          translationZh: "抱着花束走路。",
        },
        {
          japanese: "荷物を抱いて立つ。",
          reading: "にもつ を だいて たつ。",
          translationZh: "抱着行李站着。",
        },
      ],
    };
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "希望を抱く。",
          reading: "きぼう を いだく。",
          translationZh: "怀有希望。",
        },
        {
          japanese: "将来に期待を抱く。",
          reading: "しょうらい に きたい を いだく。",
          translationZh: "对未来怀有期待。",
        },
        {
          japanese: "夢を抱いて進む。",
          reading: "ゆめ を いだいて すすむ。",
          translationZh: "怀着梦想前进。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([physicalEntry, abstractEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn(),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "希望を抱く")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: abstractEntry,
      entries: [abstractEntry, physicalEntry],
    });
    expect(aiWordLookupService.completeEntry).not.toHaveBeenCalled();
  });

  it("treats explicit rewrite instructions as instructional after a local entry is confidently matched", async () => {
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊を抱く。",
          reading: "あかんぼう を だく。",
          translationZh: "抱起婴儿。",
        },
        {
          japanese: "花束を抱いて歩く。",
          reading: "はなたば を だいて あるく。",
          translationZh: "抱着花束走路。",
        },
        {
          japanese: "荷物を抱いて立つ。",
          reading: "にもつ を だいて たつ。",
          translationZh: "抱着行李站着。",
        },
      ],
    };
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "不安を抱く。",
          reading: "ふあん を いだく。",
          translationZh: "怀有不安。",
        },
        {
          japanese: "希望を抱く。",
          reading: "きぼう を いだく。",
          translationZh: "怀有希望。",
        },
        {
          japanese: "期待を抱いている。",
          reading: "きたい を いだいて いる。",
          translationZh: "怀有期待。",
        },
      ],
    };
    const contextualEntry: DictionaryEntry = {
      ...abstractEntry,
      meaningZh: "怀有；心存（释义更简单）",
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([physicalEntry, abstractEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(contextualEntry),
      reconcileEntries: vi.fn().mockResolvedValue(null),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(
      service.lookupWord("抱く", "不安を抱く，希望例句偏日常会话，解释简单一点")
    ).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: contextualEntry,
      entries: [contextualEntry, physicalEntry],
    });
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "抱く",
      abstractEntry,
      "不安を抱く，希望例句偏日常会话，解释简单一点"
    );
  });

  it("returns multiple local entries instead of calling AI when context is still ambiguous", async () => {
    const abstractEntryA: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "怀有；抱有",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "不安を抱いている。",
          reading: "ふあん を だいて いる。",
          translationZh: "怀有不安。",
        },
        {
          japanese: "疑問を抱いた。",
          reading: "ぎもん を だいた。",
          translationZh: "产生了疑问。",
        },
        {
          japanese: "期待を抱いて待つ。",
          reading: "きたい を だいて まつ。",
          translationZh: "怀着期待等待。",
        },
      ],
    };
    const abstractEntryB: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "不安を抱く。",
          reading: "ふあん を いだく。",
          translationZh: "怀有不安。",
        },
        {
          japanese: "疑念を抱いた。",
          reading: "ぎねん を いだいた。",
          translationZh: "心存疑虑。",
        },
        {
          japanese: "期待を抱いている。",
          reading: "きたい を いだいて いる。",
          translationZh: "怀有期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([abstractEntryA, abstractEntryB]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn(),
      reconcileEntries: vi.fn(),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(service.lookupWord("抱く", "解释简单一点")).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: abstractEntryA,
      lookupReason: "参考语境后仍有多个可能词条，请先选择更符合的一项。",
      entries: [abstractEntryA, abstractEntryB],
    });
    expect(aiWordLookupService.completeEntry).not.toHaveBeenCalled();
    expect(dictionaryService.saveEntry).not.toHaveBeenCalled();
  });

  it("uses the selected pronunciation when retrying a word with multiple local entries", async () => {
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱；拥抱",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "子どもを抱く。",
          reading: "こども を だく。",
          translationZh: "抱起孩子。",
        },
        {
          japanese: "花束を抱いて走る。",
          reading: "はなたば を だいて はしる。",
          translationZh: "抱着花束跑。",
        },
        {
          japanese: "荷物を抱いて立つ。",
          reading: "にもつ を だいて たつ。",
          translationZh: "抱着行李站着。",
        },
      ],
    };
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "不安を抱く。",
          reading: "ふあん を いだく。",
          translationZh: "怀有不安。",
        },
        {
          japanese: "疑念を抱く。",
          reading: "ぎねん を いだく。",
          translationZh: "心存疑虑。",
        },
        {
          japanese: "期待を抱く。",
          reading: "きたい を いだく。",
          translationZh: "怀有期待。",
        },
      ],
    };
    const contextualEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "在“不安を抱く”这类语境里表示怀有、心存",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "彼は将来に不安を抱いている。",
          reading: "かれ は しょうらい に ふあん を いだいて いる。",
          translationZh: "他对未来怀有不安。",
        },
        {
          japanese: "住民は計画に疑念を抱いた。",
          reading: "じゅうみん は けいかく に ぎねん を いだいた。",
          translationZh: "居民对计划产生了疑虑。",
        },
        {
          japanese: "彼女は新生活に期待を抱いていた。",
          reading: "かのじょ は しんせいかつ に きたい を いだいて いた。",
          translationZh: "她对新生活怀有期待。",
        },
      ],
    };

    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([physicalEntry, abstractEntry]),
      saveEntry: vi.fn(),
    };
    const aiWordLookupService = {
      resolveLookupWord: vi.fn(),
      completeEntry: vi.fn().mockResolvedValue(contextualEntry),
      reconcileEntries: vi.fn().mockResolvedValue(null),
    };

    const service = new WordLookupService(
      dictionaryService as never,
      aiWordLookupService as never
    );

    await expect(
      service.lookupWord("抱く", "不安を抱く", "いだく")
    ).resolves.toEqual({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: contextualEntry,
      entries: [contextualEntry, physicalEntry],
    });
    expect(aiWordLookupService.completeEntry).toHaveBeenCalledWith(
      "抱く",
      abstractEntry,
      "不安を抱く"
    );
  });

  it("rejects empty input", async () => {
    const service = new WordLookupService({} as never, {} as never);

    await expect(service.lookupWord("   ")).rejects.toBeInstanceOf(
      ValidationError
    );
  });
});
