import { describe, expect, it } from "vitest";
import { ruleTextMatchesEntry } from "@/features/collections/domain/auto-filter-rule";
import type { AutoFilterDictionaryEntry } from "@/shared/types/collections";

const entry: AutoFilterDictionaryEntry = {
  wordId: 7,
  word: "申し込む",
  pronunciation: "もうしこむ",
  meaningZh: "申请；报名",
  partOfSpeech: "动词",
  examples: [],
};

describe("auto-filter rule matching", () => {
  it.each(["收录申请相关表达", "报名 用语", "动词", "もうしこむ"])(
    "matches an explicit entry token in %s",
    (ruleText) => {
      expect(ruleTextMatchesEntry(ruleText, entry)).toBe(true);
    }
  );

  it("normalizes whitespace and letter case", () => {
    expect(
      ruleTextMatchesEntry("学习 APPLICATION WORDS", {
        ...entry,
        meaningZh: "Application vocabulary",
      })
    ).toBe(true);
  });

  it.each(["", "   ", "旅行相关名词", "申"])(
    "does not infer a match from %j",
    (ruleText) => {
      expect(ruleTextMatchesEntry(ruleText, entry)).toBe(false);
    }
  );
});
