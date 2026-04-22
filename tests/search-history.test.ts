import { describe, expect, it } from "vitest";
import {
  createSearchHistoryItem,
  upsertSearchHistoryItems,
} from "@/app/lib/search-history";
import type { WordLookupResponse } from "@/shared/types/api";

function createLookupResult(
  word: string,
  overrides?: Partial<WordLookupResponse>
): WordLookupResponse {
  return {
    word,
    lookupWord: word,
    source: "dictionary",
    entry: {
      word,
      pronunciation: "たべる",
      meaningZh: "吃；进食",
      partOfSpeech: "动词",
      examples: [],
    },
    ...overrides,
  };
}

describe("search history helpers", () => {
  it("puts the latest successful lookup at the top", () => {
    const firstItem = createSearchHistoryItem({
      searchedWord: "食べる",
      result: createLookupResult("食べる"),
      searchedAt: "2026-04-12T10:00:00.000Z",
    });
    const secondItem = createSearchHistoryItem({
      searchedWord: "静か",
      result: createLookupResult("静か", {
        entry: {
          word: "静か",
          pronunciation: "しずか",
          meaningZh: "安静；安稳",
          partOfSpeech: "形容动词",
          examples: [],
        },
      }),
      searchedAt: "2026-04-12T11:00:00.000Z",
    });

    const items = upsertSearchHistoryItems([firstItem], secondItem);

    expect(items).toEqual([secondItem, firstItem]);
  });

  it("deduplicates the same lookup signature and keeps the newest item", () => {
    const initialItem = createSearchHistoryItem({
      searchedWord: "見通せない",
      result: createLookupResult("見通せない", {
        lookupWord: "見通せる",
        lookupReason: "「見通せない」是否定形，所以改查词典形。",
        entry: {
          word: "見通せる",
          pronunciation: "みとおせる",
          meaningZh: "能看透；能预见",
          partOfSpeech: "动词",
          examples: [],
        },
      }),
      searchedAt: "2026-04-12T10:00:00.000Z",
    });
    const refreshedItem = createSearchHistoryItem({
      searchedWord: "見通せない",
      result: createLookupResult("見通せない", {
        lookupWord: "見通せる",
        lookupReason: "「見通せない」是否定形，所以改查词典形。",
        entry: {
          word: "見通せる",
          pronunciation: "みとおせる",
          meaningZh: "能看透；能预见",
          partOfSpeech: "动词",
          examples: [],
        },
      }),
      searchedAt: "2026-04-12T12:00:00.000Z",
    });

    const items = upsertSearchHistoryItems([initialItem], refreshedItem);

    expect(items).toHaveLength(1);
    expect(items[0].searchedAt).toBe("2026-04-12T12:00:00.000Z");
  });

  it("keeps only the configured maximum number of items", () => {
    const initialItems = Array.from({ length: 3 }, (_, index) =>
      createSearchHistoryItem({
        searchedWord: `単語${index}`,
        result: createLookupResult(`単語${index}`, {
          entry: {
            word: `単語${index}`,
            pronunciation: `たんご${index}`,
            meaningZh: `释义${index}`,
            partOfSpeech: "名词",
            examples: [],
          },
        }),
        searchedAt: `2026-04-12T0${index}:00:00.000Z`,
      })
    );
    const nextItem = createSearchHistoryItem({
      searchedWord: "最新",
      result: createLookupResult("最新", {
        entry: {
          word: "最新",
          pronunciation: "さいしん",
          meaningZh: "最新",
          partOfSpeech: "名词",
          examples: [],
        },
      }),
      searchedAt: "2026-04-12T09:00:00.000Z",
    });

    const items = upsertSearchHistoryItems(initialItems, nextItem, 2);

    expect(items).toHaveLength(2);
    expect(items[0].searchedWord).toBe("最新");
    expect(items[1].searchedWord).toBe("単語0");
  });
});
