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

let autoFilterJobPoller: ReturnType<typeof setInterval> | null = null;
let aiWordLookupService: AIWordLookupService | null = null;
let autoFilterJobService: CollectionAutoFilterJobService | null = null;
let collectionAutoFilterService: CollectionAutoFilterService | null = null;
let collectionRepository: CollectionRepository | null = null;
let collectionService: CollectionService | null = null;
let collectionWordService: CollectionWordService | null = null;
let dictionaryService: JapaneseDictionaryService | null = null;
let grammarAiClient: GrammarAiClient | null = null;
let grammarLearningService: GrammarLearningService | null = null;
let grammarRepository: GrammarRepository | null = null;
let llmClient: LlmClient | null = null;
let practiceRepository: PracticeRepository | null = null;
let practiceSessionService: PracticeSessionService | null = null;
let vocabularyCoreService: VocabularyCoreService | null = null;
let wordLookupService: WordLookupService | null = null;

function getLlmClient() {
  llmClient ??= new LlmClient();
  return llmClient;
}

function getCollectionRepository() {
  collectionRepository ??= new CollectionRepository();
  return collectionRepository;
}

function getCollectionAutoFilterService() {
  collectionAutoFilterService ??= new CollectionAutoFilterService(
    getCollectionRepository(),
    getVocabularyCoreService(),
    getLlmClient()
  );
  return collectionAutoFilterService;
}

function getAutoFilterJobService() {
  autoFilterJobService ??= new CollectionAutoFilterJobService(
    new CollectionAutoFilterJobRepository(),
    getCollectionRepository(),
    getCollectionAutoFilterService()
  );
  return autoFilterJobService;
}

function getAiWordLookupService() {
  aiWordLookupService ??= new AIWordLookupService(getLlmClient());
  return aiWordLookupService;
}

function getGrammarRepository() {
  grammarRepository ??= new GrammarRepository();
  return grammarRepository;
}

function getGrammarAiClient() {
  grammarAiClient ??= new GrammarAiClient();
  return grammarAiClient;
}

function getPracticeRepository() {
  practiceRepository ??= new PracticeRepository();
  return practiceRepository;
}

export function getCollectionService() {
  collectionService ??= new CollectionService(
    getCollectionRepository(),
    getAutoFilterJobService()
  );
  return collectionService;
}

export function getCollectionWordService() {
  collectionWordService ??= new CollectionWordService(
    getCollectionRepository(),
    getVocabularyCoreService()
  );
  return collectionWordService;
}

export function getVocabularyCoreService() {
  vocabularyCoreService ??= new VocabularyCoreService(getDictionaryService());
  return vocabularyCoreService;
}

export function getDictionaryService() {
  dictionaryService ??= new JapaneseDictionaryService(
    new JapaneseDictionaryRepository()
  );
  return dictionaryService;
}

export function getWordLookupService() {
  wordLookupService ??= new WordLookupService(
    getVocabularyCoreService(),
    getAiWordLookupService(),
    getAutoFilterJobService()
  );
  return wordLookupService;
}

export function getGrammarLearningService() {
  grammarLearningService ??= new GrammarLearningService(
    getGrammarRepository(),
    getGrammarAiClient()
  );
  return grammarLearningService;
}

export function getPracticeSessionService() {
  practiceSessionService ??= new PracticeSessionService(
    getPracticeRepository(),
    getGrammarRepository(),
    getGrammarAiClient(),
    getGrammarLearningService()
  );
  return practiceSessionService;
}

export function ensureAutoFilterJobRunnerStarted() {
  if (process.env.NODE_ENV === "test" || autoFilterJobPoller) {
    return;
  }

  const jobService = getAutoFilterJobService();
  void jobService.kickOff();
  autoFilterJobPoller = setInterval(() => {
    void jobService.kickOff();
  }, AUTO_FILTER_JOB_POLL_INTERVAL_MS);
  autoFilterJobPoller.unref?.();
}
