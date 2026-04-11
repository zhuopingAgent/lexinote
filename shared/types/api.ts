export type WordLookupRequest = {
  word: string;
};

export type LookupSource = "dictionary" | "ai";

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
};
