import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";

const AUTO_FILTER_BATCH_SIZE = 24;
const DEFAULT_AUTO_FILTER_MAX_SYNC_CANDIDATES = 240;

export class AutoFilterRuleChangedError extends Error {
  constructor() {
    super("AI 自动筛选规则已变更，请按最新条件重新同步。");
    this.name = "AutoFilterRuleChangedError";
  }
}

export class AutoFilterBudgetExceededError extends Error {
  constructor(candidateCount: number, maxCandidates: number) {
    super(
      `本次 AI 重新同步需要评估 ${candidateCount} 个候选词，超过当前上限 ${maxCandidates}。请先缩小词库范围，或调整 AUTO_FILTER_MAX_SYNC_CANDIDATES 后再同步。`
    );
    this.name = "AutoFilterBudgetExceededError";
  }
}

function getAutoFilterMaxSyncCandidates() {
  const configuredLimit = Number(process.env.AUTO_FILTER_MAX_SYNC_CANDIDATES);

  if (Number.isInteger(configuredLimit) && configuredLimit > 0) {
    return configuredLimit;
  }

  return DEFAULT_AUTO_FILTER_MAX_SYNC_CANDIDATES;
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
    const maxSyncCandidates = getAutoFilterMaxSyncCandidates();

    if (candidates.length > maxSyncCandidates) {
      throw new AutoFilterBudgetExceededError(candidates.length, maxSyncCandidates);
    }

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
