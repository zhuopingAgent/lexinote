import type { DictionaryEntryCandidate, DictionaryExample } from "@/shared/types/dictionary";

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
