import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import type { DictionaryEntry } from "@/shared/types/api";

export class AIWordLookupService {
  constructor(private readonly llmClient: LlmClient) {}

  async completeEntry(
    word: string,
    baseEntry?: Pick<DictionaryEntry, "pronunciation" | "partOfSpeech" | "meaningZh">
  ): Promise<DictionaryEntry> {
    return this.llmClient.completeWordEntry(word, baseEntry);
  }
}
