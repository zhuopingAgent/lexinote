export type SupportedAiModel = "gpt-5.4" | "gpt-5-mini" | "gpt-5-nano";

export type WordLookupRequest = {
  word: string;
  model?: SupportedAiModel;
};

export type LookupSource = "dictionary" | "ai-only";
export type ExplanationSource = "openai" | "fallback";

export type DictionaryEntry = {
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
};

export type AIExplanationOutput = {
  actualUsage: string;
  commonScenarios: string;
  nuanceDifferences: string;
  commonMistakes: string;
};

export type AIExplanationResult = {
  explanation: AIExplanationOutput;
  explanationSource: ExplanationSource;
};

export type WordLookupResponse = {
  word: string;
  source: LookupSource;
  entry: DictionaryEntry | null;
} & AIExplanationResult;

export type WordLookupPreview = {
  word: string;
  source: LookupSource;
  entry: DictionaryEntry | null;
};

export type WordLookupStreamEvent =
  | {
      type: "preview";
      data: WordLookupPreview;
    }
  | {
      type: "ai_delta";
      data: {
        delta: string;
      };
    }
  | {
      type: "complete";
      data: WordLookupResponse;
    }
  | {
      type: "error";
      data: {
        code: string;
        message: string;
      };
    };
