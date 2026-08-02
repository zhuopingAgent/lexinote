import { describe, expect, it } from "vitest";
import { parseAppView } from "@/app/lib/app-view";
import {
  buildLookupStatusBadges,
  getLookupEntryCollectionState,
} from "@/app/lib/lookup-view";
import type { DictionaryEntry, WordLookupResponse } from "@/shared/types/api";

function createEntry(overrides?: Partial<DictionaryEntry>): DictionaryEntry {
  return {
    word: "抱く",
    pronunciation: "いだく",
    meaningZh: "怀有",
    partOfSpeech: "动词",
    examples: [],
    ...overrides,
  };
}

function createLookupResponse(
  overrides?: Partial<WordLookupResponse>
): WordLookupResponse {
  return {
    word: "抱く",
    lookupWord: "抱く",
    source: "dictionary",
    entry: createEntry(),
    ...overrides,
  };
}

describe("app view helpers", () => {
  it("accepts known views and falls back to dictionary", () => {
    expect(parseAppView("collections")).toBe("collections");
    expect(parseAppView("unknown")).toBe("dictionary");
    expect(parseAppView(null)).toBe("dictionary");
  });
});

describe("lookup view helpers", () => {
  it("builds status badges from lookup metadata", () => {
    const result = createLookupResponse({
      source: "ai",
      metadata: {
        resolutionType: "ai_generated",
        isContextual: true,
        persistenceStatus: "not_saved",
        selectedPronunciation: "いだく",
        exampleStatus: "missing",
      },
    });

    expect(buildLookupStatusBadges(result)).toEqual([
      "AI 生成",
      "AI 补全词条",
      "按语境处理",
      "未保存",
      "例句待生成",
    ]);
  });

  it("blocks unsaved primary contextual entries from collection actions", () => {
    const entry = createEntry();
    const result = createLookupResponse({
      entry,
      metadata: {
        resolutionType: "exact",
        isContextual: true,
        persistenceStatus: "not_saved",
        selectedPronunciation: "いだく",
        exampleStatus: "ready",
      },
    });

    expect(getLookupEntryCollectionState(entry, result)).toEqual({
      canAddToCollection: false,
      addDisabledReason: "当前语境结果尚未保存，暂不能加入单词本。",
    });
  });

  it("allows dictionary entries even when metadata is absent", () => {
    const entry = createEntry();

    expect(getLookupEntryCollectionState(entry, createLookupResponse({ entry }))).toEqual({
      canAddToCollection: true,
      addDisabledReason: "请先保存或生成完整词条后再加入单词本。",
    });
  });
});
