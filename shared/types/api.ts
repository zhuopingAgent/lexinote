export type WordLookupRequest = {
  word: string;
};

export type LookupSource = "dictionary" | "ai";

export type DictionaryEntry = {
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
};

export type WordLookupResponse = {
  word: string;
  source: LookupSource;
  entry: DictionaryEntry;
};
