export type SupportedAiModel = "gpt-5.4" | "gpt-5-mini" | "gpt-5-nano";

export type WordLookupRequest = {
  word: string;
  model?: SupportedAiModel;
};

export type LookupSource = "dictionary" | "ai-only";

export type DictionaryEntry = {
  word: string;
  reading: string | null;
  meaningZh: string;
  partOfSpeech: string | null;
};

export type AIExplanationOutput = {
  actualUsage: string;
  commonScenarios: string;
  nuanceDifferences: string;
  commonMistakes: string;
};

export type WordLookupResponse = {
  word: string;
  source: LookupSource;
  entry: DictionaryEntry | null;
  explanation: AIExplanationOutput;
};

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
