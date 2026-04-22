export type WordLookupRequest = {
  word: string;
  context?: string;
  pronunciation?: string;
};

export type CollectionSummary = {
  collectionId: number;
  name: string;
  description: string;
  wordCount: number;
  createdAt: string;
};

export type CollectionWordItem = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
};

export type DictionaryEntryCandidate = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
};

export type CollectionDetail = CollectionSummary & {
  words: CollectionWordItem[];
};

export type CollectionListResponse = {
  collections: CollectionSummary[];
};

export type CollectionResponse = {
  collection: CollectionSummary;
};

export type CollectionDetailResponse = {
  collection: CollectionDetail;
};

export type AddCollectionWordRequest = {
  word: string;
  pronunciation?: string;
};

export type AddCollectionWordResponse =
  | {
      status: "added" | "already_exists";
      candidate: DictionaryEntryCandidate;
    }
  | {
      status: "requires_selection";
      candidates: DictionaryEntryCandidate[];
    };

export type AddCollectionWordsRequest = {
  wordIds: number[];
};

export type AddCollectionWordsResponse = {
  addedCount: number;
  skippedCount: number;
};

export type CreateCollectionRequest = {
  name: string;
  description?: string;
};

export type UpdateCollectionRequest = {
  name?: string;
  description?: string;
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
  entries?: DictionaryEntry[];
};
