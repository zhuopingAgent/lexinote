import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";

const AUTO_FILTER_BATCH_SIZE = 24;

export class AutoFilterRuleChangedError extends Error {
  constructor() {
    super("AI 自动筛选规则已变更，请按最新条件重新同步。");
    this.name = "AutoFilterRuleChangedError";
  }
}

function chunkEntries<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export class CollectionAutoFilterService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly dictionaryService: JapaneseDictionaryService,
    private readonly llmClient: LlmClient
  ) {}

  async syncCollection(collectionId: number, expectedRuleVersion?: number): Promise<number> {
    const collection = await this.collectionRepository.findDetailById(collectionId);
    if (
      !collection ||
      !collection.autoFilterEnabled ||
      !collection.autoFilterCriteria.trim()
    ) {
      return 0;
    }

    if (
      expectedRuleVersion !== undefined &&
      collection.autoFilterRuleVersion !== expectedRuleVersion
    ) {
      throw new AutoFilterRuleChangedError();
    }

    const manualWordIds = new Set(
      collection.words
        .filter((word) => word.source === "manual")
        .map((word) => word.wordId)
    );
    const candidates = (await this.dictionaryService.listEntryCandidates())
      .filter((entry) => !manualWordIds.has(entry.wordId))
      .map((entry) => ({
        ...entry,
        examples: [],
      }));

    const matchedWordIds = new Set<number>();
    for (const batch of chunkEntries(candidates, AUTO_FILTER_BATCH_SIZE)) {
      const matchingWordIds = await this.llmClient.matchEntriesToCollection(
        {
          collectionId: collection.collectionId,
          name: collection.name,
          autoFilterCriteria: collection.autoFilterCriteria,
          autoFilterRuleVersion: collection.autoFilterRuleVersion,
        },
        batch
      );

      for (const wordId of matchingWordIds) {
        matchedWordIds.add(wordId);
      }
    }

    const latestCollection = await this.collectionRepository.findById(collection.collectionId);
    if (
      !latestCollection ||
      !latestCollection.autoFilterEnabled ||
      !latestCollection.autoFilterCriteria.trim() ||
      (expectedRuleVersion !== undefined &&
        latestCollection.autoFilterRuleVersion !== expectedRuleVersion)
    ) {
      throw new AutoFilterRuleChangedError();
    }

    return this.collectionRepository.replaceAutoWords(
      collection.collectionId,
      collection.autoFilterRuleVersion,
      Array.from(matchedWordIds)
    );
  }

  async classifyWordById(wordId: number): Promise<number> {
    const entry = await this.dictionaryService.getEntryDetail(wordId);
    if (!entry) {
      return 0;
    }

    const collections = await this.collectionRepository.listAutoFilterCollections();
    if (collections.length === 0) {
      return 0;
    }

    const matchingCollectionIds = await this.llmClient.matchEntryToCollections(
      entry,
      collections
    );

    if (matchingCollectionIds.length === 0) {
      return 0;
    }

    return this.collectionRepository.addWordToCollections(entry.wordId, matchingCollectionIds);
  }
}
