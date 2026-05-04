import { describe, expect, it, vi } from "vitest";
import { VocabularyCoreService } from "@/features/vocabulary-core/application/VocabularyCoreService";
import {
  buildVocabularyEntryKeyId,
  normalizeVocabularyEntryKey,
} from "@/features/vocabulary-core/domain/VocabularyEntryKey";

describe("VocabularyCoreService", () => {
  it("delegates entry reads and writes to the current dictionary backend", async () => {
    const entry = {
      word: "抱く",
      pronunciation: "いだく",
      meaningZh: "怀有；心存",
      partOfSpeech: "动词",
      examples: [],
    };
    const dictionaryService = {
      findEntries: vi.fn().mockResolvedValue([entry]),
      findEntryCandidates: vi.fn().mockResolvedValue([]),
      listEntryCandidates: vi.fn().mockResolvedValue([]),
      listOverviewEntries: vi.fn().mockResolvedValue([]),
      listWordsPage: vi.fn().mockResolvedValue({ words: [], nextCursor: null }),
      getEntryDetail: vi.fn().mockResolvedValue(null),
      findEntry: vi.fn().mockResolvedValue(entry),
      saveEntry: vi.fn().mockResolvedValue({ wordId: 7, isNewEntry: false }),
    };
    const service = new VocabularyCoreService(dictionaryService as never);

    await expect(service.findEntries("抱く")).resolves.toEqual([entry]);
    await expect(service.findEntriesByWord("抱く")).resolves.toEqual([entry]);
    await expect(service.findEntryCandidates("抱く")).resolves.toEqual([]);
    await expect(service.listEntryCandidates()).resolves.toEqual([]);
    await expect(service.listOverviewEntries()).resolves.toEqual([]);
    await expect(service.listWordsPage({ query: "抱く" })).resolves.toEqual({
      words: [],
      nextCursor: null,
    });
    await expect(service.searchEntriesPage({ query: "抱く" })).resolves.toEqual({
      words: [],
      nextCursor: null,
    });
    await expect(service.getEntryDetail(7)).resolves.toBeNull();
    await expect(service.findEntry("抱く")).resolves.toEqual(entry);
    await expect(service.findEntryByKey("抱く", "いだく")).resolves.toEqual(entry);
    await expect(service.saveEntry(entry)).resolves.toEqual({
      wordId: 7,
      isNewEntry: false,
    });
  });
});

describe("VocabularyEntryKey", () => {
  it("normalizes the word and pronunciation pair used as the storage key", () => {
    expect(
      normalizeVocabularyEntryKey({ word: " 抱く ", pronunciation: " いだく " })
    ).toEqual({
      word: "抱く",
      pronunciation: "いだく",
    });
    expect(
      buildVocabularyEntryKeyId({ word: "抱く", pronunciation: "いだく" })
    ).toBe("抱く\u0000いだく");
  });
});
