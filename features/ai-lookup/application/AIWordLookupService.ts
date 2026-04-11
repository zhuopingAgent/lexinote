import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import type { DictionaryEntry } from "@/shared/types/api";

export class AIWordLookupService {
  constructor(private readonly llmClient: LlmClient) {}

  async resolveLookupWord(
    word: string,
    context?: string
  ): Promise<{ lookupWord: string; lookupReason: string } | null> {
    return this.llmClient.resolveLookupWord(word, context);
  }

  async completeEntry(
    word: string,
    baseEntry?: Pick<DictionaryEntry, "pronunciation" | "partOfSpeech" | "meaningZh">,
    context?: string
  ): Promise<DictionaryEntry> {
    return this.llmClient.completeWordEntry(word, baseEntry, context);
  }

  async reconcileEntries(
    word: string,
    genericEntry: DictionaryEntry,
    contextualEntry: DictionaryEntry,
    context: string
  ): Promise<DictionaryEntry | null> {
    return this.llmClient.reconcileWordEntry(
      word,
      genericEntry,
      contextualEntry,
      context
    );
  }
}
