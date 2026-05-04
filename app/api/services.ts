import { AIWordLookupService } from "@/features/ai-lookup/application/AIWordLookupService";
import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";
import { CollectionAutoFilterService } from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import { CollectionAutoFilterJobRepository } from "@/features/collections/infrastructure/CollectionAutoFilterJobRepository";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";

const AUTO_FILTER_JOB_POLL_INTERVAL_MS = 60_000;

const llmClient = new LlmClient();
const collectionRepository = new CollectionRepository();
const dictionaryService = new JapaneseDictionaryService(
  new JapaneseDictionaryRepository()
);
const autoFilterJobService = new CollectionAutoFilterJobService(
  new CollectionAutoFilterJobRepository(),
  collectionRepository,
  new CollectionAutoFilterService(collectionRepository, dictionaryService, llmClient)
);
const collectionService = new CollectionService(
  collectionRepository,
  autoFilterJobService
);
const collectionWordService = new CollectionWordService(
  collectionRepository,
  dictionaryService
);
const wordLookupService = new WordLookupService(
  dictionaryService,
  new AIWordLookupService(llmClient),
  autoFilterJobService
);

let autoFilterJobPoller: ReturnType<typeof setInterval> | null = null;

export function getCollectionService() {
  return collectionService;
}

export function getCollectionWordService() {
  return collectionWordService;
}

export function getDictionaryService() {
  return dictionaryService;
}

export function getWordLookupService() {
  return wordLookupService;
}

export function ensureAutoFilterJobRunnerStarted() {
  if (process.env.NODE_ENV === "test" || autoFilterJobPoller) {
    return;
  }

  void autoFilterJobService.kickOff();
  autoFilterJobPoller = setInterval(() => {
    void autoFilterJobService.kickOff();
  }, AUTO_FILTER_JOB_POLL_INTERVAL_MS);
  autoFilterJobPoller.unref?.();
}
