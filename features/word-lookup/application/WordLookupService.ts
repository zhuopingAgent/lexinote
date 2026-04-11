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
        lookupWord: word,
        source: "dictionary",
        entry: await this.aiWordLookupService.completeEntry(word, entry),
      };
    }

    const resolved = await this.aiWordLookupService.resolveLookupWord(word);
    const resolvedLookupWord = resolved?.lookupWord.trim() || word;
    const lookupReason =
      resolved && resolvedLookupWord !== word ? resolved.lookupReason : undefined;

    if (resolvedLookupWord !== word) {
      const resolvedEntry = await this.dictionaryService.findEntry(resolvedLookupWord);
      if (resolvedEntry) {
        return {
          word,
          lookupWord: resolvedLookupWord,
          lookupReason,
          source: "dictionary",
          entry: await this.aiWordLookupService.completeEntry(
            resolvedLookupWord,
            resolvedEntry
          ),
        };
      }
    }

    return {
      word,
      lookupWord: resolvedLookupWord,
      lookupReason,
      source: "ai",
      entry: await this.aiWordLookupService.completeEntry(resolvedLookupWord),
    };
  }
}
