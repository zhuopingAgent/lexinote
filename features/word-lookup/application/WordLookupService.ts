import { AIWordLookupService } from "@/features/ai-lookup/application/AIWordLookupService";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import type { WordLookupResponse } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export class WordLookupService {
  constructor(
    private readonly dictionaryService: JapaneseDictionaryService,
    private readonly aiWordLookupService: AIWordLookupService
  ) {}

  async lookupWord(rawWord: string): Promise<WordLookupResponse> {
    const word = rawWord.trim();
    if (!word) {
      throw new ValidationError("word is required");
    }

    const entry = await this.dictionaryService.findEntry(word);
    if (entry) {
      return {
        word,
        source: "dictionary",
        entry,
      };
    }

    return {
      word,
      source: "ai",
      entry: await this.aiWordLookupService.inferEntry(word),
    };
  }
}
