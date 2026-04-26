export type WordLookupRequest = {
  word: string;
  context?: string;
  pronunciation?: string;
};

export type AutoFilterSyncStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type CollectionWordSource = "manual" | "auto";

export type CollectionSummary = {
  collectionId: number;
  name: string;
  description: string;
  wordCount: number;
  createdAt: string;
  autoFilterEnabled: boolean;
  autoFilterCriteria: string;
  autoFilterSyncStatus: AutoFilterSyncStatus;
  autoFilterLastRunAt: string | null;
  autoFilterLastError: string;
  autoFilterRuleVersion: number;
  autoFilterLastSyncedRuleVersion?: number | null;
};

export type CollectionWordItem = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  source: CollectionWordSource;
  matchedRuleVersion: number | null;
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

export type CollectionAutoFilterRule = {
  collectionId: number;
  name: string;
  autoFilterCriteria: string;
  autoFilterRuleVersion: number;
};

export type AutoFilterDictionaryEntry = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  examples?: DictionaryExample[];
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

export type DictionaryOverviewResponse = {
  words: DictionaryOverviewItem[];
  nextCursor: string | null;
};

export type CreateCollectionRequest = {
  name: string;
  description?: string;
};

export type UpdateCollectionRequest = {
  name?: string;
  description?: string;
  autoFilterEnabled?: boolean;
  autoFilterCriteria?: string;
  resyncAutoFilter?: boolean;
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
