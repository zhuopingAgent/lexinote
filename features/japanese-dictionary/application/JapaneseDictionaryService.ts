import type { DictionaryEntry } from "@/shared/types/api";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";

export class JapaneseDictionaryService {
  constructor(private readonly repository: JapaneseDictionaryRepository) {}

  async findEntries(word: string): Promise<DictionaryEntry[]> {
    return this.repository.findAllByWord(word);
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
