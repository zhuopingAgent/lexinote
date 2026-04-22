import type { DictionaryEntry, DictionaryEntryCandidate } from "@/shared/types/api";
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

  async findEntry(
    word: string,
    pronunciation?: string
  ): Promise<DictionaryEntry | null> {
    if (pronunciation) {
      return this.repository.findByKey(word, pronunciation);
    }

    return this.repository.findByWord(word);
  }

  async saveEntry(entry: DictionaryEntry): Promise<void> {
    await this.repository.upsertEntry(entry);
  }
}
