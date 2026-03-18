import type {
  AIExplanationOutput,
  DictionaryEntry,
  SupportedAiModel,
} from "@/shared/types/api";
import { LlmClient } from "@/features/ai-explanation/infrastructure/LlmClient";

export class AIExplanationService {
  constructor(private readonly llmClient: LlmClient) {}

  async explain(
    entry: DictionaryEntry,
    model?: SupportedAiModel,
    onTextDelta?: (delta: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<AIExplanationOutput> {
    return this.llmClient.explainWordForZhNative({
      word: entry.word,
      reading: entry.reading,
      meaningZh: entry.meaningZh,
      partOfSpeech: entry.partOfSpeech,
      model,
    }, { onTextDelta, signal });
  }

  async explainWordOnly(
    word: string,
    model?: SupportedAiModel,
    onTextDelta?: (delta: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<AIExplanationOutput> {
    return this.llmClient.explainWordOnlyForZhNative(word, model, {
      onTextDelta,
      signal,
    });
  }
}
