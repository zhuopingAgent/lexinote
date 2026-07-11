import { AIWordLookupService } from "@/features/ai-lookup/application/AIWordLookupService";
import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";
import { CollectionAutoFilterService } from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import { CollectionAutoFilterJobRepository } from "@/features/collections/infrastructure/CollectionAutoFilterJobRepository";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import { PracticeSessionService } from "@/features/grammar-learning/application/PracticeSessionService";
import { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import { GrammarRepository } from "@/features/grammar-learning/infrastructure/GrammarRepository";
import { PracticeRepository } from "@/features/grammar-learning/infrastructure/PracticeRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { VocabularyCoreService } from "@/features/vocabulary-core/application/VocabularyCoreService";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";

const AUTO_FILTER_JOB_POLL_INTERVAL_MS = 60_000;

const llmClient = new LlmClient();
const collectionRepository = new CollectionRepository();
const dictionaryService = new JapaneseDictionaryService(
  new JapaneseDictionaryRepository()
);
const vocabularyCoreService = new VocabularyCoreService(dictionaryService);
const autoFilterJobService = new CollectionAutoFilterJobService(
  new CollectionAutoFilterJobRepository(),
  collectionRepository,
  new CollectionAutoFilterService(
    collectionRepository,
    vocabularyCoreService,
    llmClient
  )
);
const collectionService = new CollectionService(
  collectionRepository,
  autoFilterJobService
);
const collectionWordService = new CollectionWordService(
  collectionRepository,
  vocabularyCoreService
);
const wordLookupService = new WordLookupService(
  vocabularyCoreService,
  new AIWordLookupService(llmClient),
  autoFilterJobService
);
const grammarRepository = new GrammarRepository();
const grammarAiClient = new GrammarAiClient();
const grammarLearningService = new GrammarLearningService(
  grammarRepository,
  grammarAiClient
);
const practiceSessionService = new PracticeSessionService(
  new PracticeRepository(),
  grammarRepository,
  grammarAiClient,
  grammarLearningService
);

let autoFilterJobPoller: ReturnType<typeof setInterval> | null = null;

export function getCollectionService() {
  return collectionService;
}

export function getCollectionWordService() {
  return collectionWordService;
}

export function getVocabularyCoreService() {
  return vocabularyCoreService;
}

export function getDictionaryService() {
  return dictionaryService;
}

export function getWordLookupService() {
  return wordLookupService;
}

export function getGrammarLearningService() {
  return grammarLearningService;
}

export function getPracticeSessionService() {
  return practiceSessionService;
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
