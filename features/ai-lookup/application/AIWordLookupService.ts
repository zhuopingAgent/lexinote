import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import type { DictionaryEntry } from "@/shared/types/api";

export class AIWordLookupService {
  constructor(private readonly llmClient: LlmClient) {}

  async resolveLookupWord(
    word: string
  ): Promise<{ lookupWord: string; lookupReason: string } | null> {
    return this.llmClient.resolveLookupWord(word);
  }

  async completeEntry(
    word: string,
    baseEntry?: Pick<DictionaryEntry, "pronunciation" | "partOfSpeech" | "meaningZh">
  ): Promise<DictionaryEntry> {
    return this.llmClient.completeWordEntry(word, baseEntry);
  }
}
