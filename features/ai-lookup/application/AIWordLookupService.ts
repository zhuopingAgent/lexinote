import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import type { DictionaryEntry } from "@/shared/types/api";

export class AIWordLookupService {
  constructor(private readonly llmClient: LlmClient) {}

  async inferEntry(word: string): Promise<DictionaryEntry> {
    return this.llmClient.inferWordEntry(word);
  }
}
