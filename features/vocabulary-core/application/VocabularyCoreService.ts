import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import type {
  DictionaryEntry,
  DictionaryEntryCandidate,
  DictionaryEntryDetail,
  DictionaryOverviewItem,
  SavedDictionaryEntry,
} from "@/shared/types/dictionary";

export type ListVocabularyEntriesPageOptions = {
  query?: string;
  cursor?: string;
  limit?: number;
};

export class VocabularyCoreService {
  constructor(private readonly dictionaryService: JapaneseDictionaryService) {}

  async findEntriesByWord(word: string): Promise<DictionaryEntry[]> {
    return this.dictionaryService.findEntries(word);
  }

  async findEntries(word: string): Promise<DictionaryEntry[]> {
    return this.findEntriesByWord(word);
  }

  async findEntryCandidates(
    word: string
  ): Promise<DictionaryEntryCandidate[]> {
    return this.dictionaryService.findEntryCandidates(word);
  }

  async listEntryCandidates(): Promise<DictionaryEntryCandidate[]> {
    return this.dictionaryService.listEntryCandidates();
  }

  async listOverviewEntries(): Promise<DictionaryOverviewItem[]> {
    return this.dictionaryService.listOverviewEntries();
  }

  async listWordsPage(
    options?: ListVocabularyEntriesPageOptions
  ): Promise<{ words: DictionaryOverviewItem[]; nextCursor: string | null }> {
    return this.dictionaryService.listWordsPage(options);
  }

  async searchEntriesPage(
    options?: ListVocabularyEntriesPageOptions
  ): Promise<{ words: DictionaryOverviewItem[]; nextCursor: string | null }> {
    return this.listWordsPage(options);
  }

  async getEntryDetail(wordId: number): Promise<DictionaryEntryDetail | null> {
    return this.dictionaryService.getEntryDetail(wordId);
  }

  async findEntryByKey(
    word: string,
    pronunciation: string
  ): Promise<DictionaryEntry | null> {
    return this.dictionaryService.findEntry(word, pronunciation);
  }

  async findEntry(
    word: string,
    pronunciation?: string
  ): Promise<DictionaryEntry | null> {
    return this.dictionaryService.findEntry(word, pronunciation);
  }

  async saveEntry(entry: DictionaryEntry): Promise<SavedDictionaryEntry> {
    return this.dictionaryService.saveEntry(entry);
  }
}
