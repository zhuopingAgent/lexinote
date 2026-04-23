import type {
  DictionaryEntry,
  DictionaryEntryCandidate,
  DictionaryEntryDetail,
  DictionaryOverviewItem,
  SavedDictionaryEntry,
} from "@/shared/types/api";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";

export class JapaneseDictionaryService {
  constructor(private readonly repository: JapaneseDictionaryRepository) {}

  async findEntries(word: string): Promise<DictionaryEntry[]> {
    return this.repository.findAllByWord(word);
  }

  async findEntryCandidates(word: string): Promise<DictionaryEntryCandidate[]> {
    return this.repository.findEntryCandidatesByWord(word);
  }

  async listEntryCandidates(): Promise<DictionaryEntryCandidate[]> {
    return this.repository.listEntryCandidates();
  }

  async listOverviewEntries(): Promise<DictionaryOverviewItem[]> {
    return this.repository.listOverviewEntries();
  }

  async listWordsPage(options?: {
    query?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ words: DictionaryOverviewItem[]; nextCursor: string | null }> {
    return this.repository.listWordsPage(options);
  }

  async getEntryDetail(wordId: number): Promise<DictionaryEntryDetail | null> {
    return this.repository.findEntryDetailById(wordId);
  }

  async findEntry(
    word: string,
    pronunciation?: string
  ): Promise<DictionaryEntry | null> {
    if (pronunciation) {
      return this.repository.findByKey(word, pronunciation);
    }

    return this.repository.findByWord(word);
  }

  async saveEntry(entry: DictionaryEntry): Promise<SavedDictionaryEntry> {
    return this.repository.upsertEntry(entry);
  }
}
