export type WordLookupRequest = {
  word: string;
  context?: string;
  pronunciation?: string;
};
export type DictionaryEntryCandidate = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  createdAt?: string;
};

export type DictionaryOverviewItem = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  createdAt: string;
};

export type DictionaryEntryDetail = DictionaryEntry & {
  wordId: number;
  createdAt: string;
};

export type SavedDictionaryEntry = {
  wordId: number;
  isNewEntry: boolean;
};

export type DictionaryOverviewResponse = {
  words: DictionaryOverviewItem[];
  nextCursor: string | null;
};

export type LookupSource = "dictionary" | "ai";

export type LookupResolutionType =
  | "exact"
  | "local_base_form"
  | "ai_base_form"
  | "ai_generated";

export type LookupPersistenceStatus =
  | "saved"
  | "not_saved"
  | "not_persistable";

export type LookupExampleStatus = "ready" | "missing";

export type DictionaryExample = {
  japanese: string;
  reading: string;
  translationZh: string;
};

export type DictionaryEntry = {
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  examples: DictionaryExample[];
};

export type WordLookupResponse = {
  word: string;
  lookupWord: string;
  lookupReason?: string;
  source: LookupSource;
  entry: DictionaryEntry;
  entries?: DictionaryEntry[];
  metadata?: {
    resolutionType: LookupResolutionType;
    isContextual: boolean;
    persistenceStatus: LookupPersistenceStatus;
    selectedPronunciation: string;
    exampleStatus: LookupExampleStatus;
  };
};
