import type { DictionaryEntry } from "@/shared/types/api";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";

export class JapaneseDictionaryService {
  constructor(private readonly repository: JapaneseDictionaryRepository) {}

  async findEntry(word: string): Promise<DictionaryEntry | null> {
    return this.repository.findByWord(word);
  }
}
