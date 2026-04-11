import { describe, expect, it } from "vitest";
import {
  buildResultDifferenceNotes,
  buildResultDifferenceOverview,
} from "@/app/lib/word-data";
import type { DictionaryEntry } from "@/shared/types/api";

describe("word-data difference helpers", () => {
  it("hides the difference section when entries do not differ in a reliable way", () => {
    const entryA: DictionaryEntry = {
      word: "食べる",
      pronunciation: "たべる",
      meaningZh: "吃；进食",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "家で食べる。",
          reading: "いえ で たべる。",
          translationZh: "在家吃。",
        },
      ],
    };
    const entryB: DictionaryEntry = {
      word: "食べる",
      pronunciation: "たべる",
      meaningZh: "吃；进食",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "外で食べる。",
          reading: "そと で たべる。",
          translationZh: "在外面吃。",
        },
      ],
    };

    expect(buildResultDifferenceOverview([entryA, entryB])).toBeNull();
    expect(buildResultDifferenceNotes([entryA, entryB])).toEqual([]);
  });

  it("does not classify abstract usages like 抱有希望 as physical meaning", () => {
    const abstractEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "抱有希望；怀有期待",
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
      ],
    };
    const physicalEntry: DictionaryEntry = {
      word: "抱く",
      pronunciation: "だく",
      meaningZh: "抱住；拥抱",
      partOfSpeech: "动词",
      examples: [
        {
          japanese: "赤ん坊を抱く。",
          reading: "あかんぼう を だく。",
          translationZh: "抱起婴儿。",
        },
        {
          japanese: "花束を胸に抱く。",
          reading: "はなたば を むね に だく。",
          translationZh: "把花束抱在胸前。",
        },
      ],
    };

    const notes = buildResultDifferenceNotes([abstractEntry, physicalEntry]);
    const abstractNote = notes.find((note) => note.title.includes("いだく"));

    expect(abstractNote?.description).toContain("抽象对象");
    expect(abstractNote?.description).not.toContain("具体对象");
    expect(abstractNote?.description).not.toContain("动作义");
  });
});
