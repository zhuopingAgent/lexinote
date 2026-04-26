import { describe, expect, it, vi } from "vitest";
import { CollectionAutoFilterService } from "@/features/collections/application/CollectionAutoFilterService";

describe("CollectionAutoFilterService", () => {
  it("backfills matching existing words into a collection", async () => {
    const collectionRepository = {
      findDetailById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 1,
        createdAt: "2026-04-22T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "running",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 4,
        words: [
          {
            wordId: 8,
            word: "巡る",
            pronunciation: "めぐる",
            meaningZh: "围绕；巡回",
            partOfSpeech: "动词",
            source: "manual",
            matchedRuleVersion: null,
          },
        ],
      }),
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 1,
        createdAt: "2026-04-22T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "running",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 4,
        autoFilterLastSyncedRuleVersion: null,
      }),
      replaceAutoWords: vi.fn().mockResolvedValue(2),
    };
    const dictionaryService = {
      listEntryCandidates: vi.fn().mockResolvedValue([
        {
          wordId: 8,
          word: "巡る",
          pronunciation: "めぐる",
          meaningZh: "围绕；巡回",
          partOfSpeech: "动词",
        },
        {
          wordId: 12,
          word: "確かめる",
          pronunciation: "たしかめる",
          meaningZh: "确认；查明",
          partOfSpeech: "动词",
        },
        {
          wordId: 15,
          word: "整う",
          pronunciation: "ととのう",
          meaningZh: "齐备；整齐",
          partOfSpeech: "动词",
        },
      ]),
    };
    const llmClient = {
      matchEntriesToCollection: vi.fn().mockResolvedValue([12, 15]),
    };

    const service = new CollectionAutoFilterService(
      collectionRepository as never,
      dictionaryService as never,
      llmClient as never
    );

    await expect(service.syncCollection(3)).resolves.toBe(2);
    expect(llmClient.matchEntriesToCollection).toHaveBeenCalledWith(
      {
        collectionId: 3,
        name: "JLPT N3",
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterRuleVersion: 4,
      },
      [
        {
          wordId: 12,
          word: "確かめる",
          pronunciation: "たしかめる",
          meaningZh: "确认；查明",
          partOfSpeech: "动词",
          examples: [],
        },
        {
          wordId: 15,
          word: "整う",
          pronunciation: "ととのう",
          meaningZh: "齐备；整齐",
          partOfSpeech: "动词",
          examples: [],
        },
      ]
    );
    expect(collectionRepository.replaceAutoWords).toHaveBeenCalledWith(3, 4, [12, 15]);
  });

  it("classifies a newly saved word into matching collections", async () => {
    const collectionRepository = {
      listAutoFilterCollections: vi.fn().mockResolvedValue([
        {
          collectionId: 3,
          name: "JLPT N3",
          autoFilterCriteria: "收录 JLPT N3 常见词",
          autoFilterRuleVersion: 4,
        },
        {
          collectionId: 4,
          name: "商务表达",
          autoFilterCriteria: "偏商务沟通的常见表达",
          autoFilterRuleVersion: 2,
        },
      ]),
      addWordToCollections: vi.fn().mockResolvedValue(1),
    };
    const dictionaryService = {
      getEntryDetail: vi.fn().mockResolvedValue({
        wordId: 22,
        word: "共有する",
        pronunciation: "きょうゆうする",
        meaningZh: "共享；共享信息",
        partOfSpeech: "动词",
        examples: [],
        createdAt: "2026-04-22T10:00:00.000Z",
      }),
    };
    const llmClient = {
      matchEntryToCollections: vi.fn().mockResolvedValue([4]),
    };

    const service = new CollectionAutoFilterService(
      collectionRepository as never,
      dictionaryService as never,
      llmClient as never
    );

    await expect(service.classifyWordById(22)).resolves.toBe(1);

    expect(collectionRepository.addWordToCollections).toHaveBeenCalledWith(22, [4]);
  });
});
