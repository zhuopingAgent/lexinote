import { AIExplanationService } from "@/features/ai-explanation/application/AIExplanationService";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import type {
  SupportedAiModel,
  WordLookupPreview,
  WordLookupResponse,
} from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export class WordLookupService {
  constructor(
    private readonly dictionaryService: JapaneseDictionaryService,
    private readonly aiExplanationService: AIExplanationService
  ) {}

  async explainWord(
    rawWord: string,
    model?: SupportedAiModel
  ): Promise<WordLookupResponse> {
    const preview = await this.prepareLookup(rawWord);
    return this.completeLookup(preview, model);
  }

  async prepareLookup(rawWord: string): Promise<WordLookupPreview> {
    const word = rawWord.trim();
    if (!word) {
      throw new ValidationError("word is required");
    }

    const entry = await this.dictionaryService.findEntry(word);
    if (!entry) {
      return {
        word,
        source: "ai-only",
        entry: null,
      };
    }

    return {
      word,
      source: "dictionary",
      entry,
    };
  }

  async completeLookup(
    preview: WordLookupPreview,
    model?: SupportedAiModel,
    onTextDelta?: (delta: string) => void | Promise<void>,
    signal?: AbortSignal
  ): Promise<WordLookupResponse> {
    const explanationResult = preview.entry
      ? await this.aiExplanationService.explain(
          preview.entry,
          model,
          onTextDelta,
          signal
        )
      : await this.aiExplanationService.explainWordOnly(
          preview.word,
          model,
          onTextDelta,
          signal
        );

    return {
      ...preview,
      ...explanationResult,
    };
  }
}
