import type { DictionaryEntry, DictionaryExample, WordLookupResponse } from "@/shared/types/api";

export type SearchHistoryItem = {
  id: string;
  searchedWord: string;
  context: string;
  pronunciation: string;
  searchedAt: string;
  result: WordLookupResponse;
};

const SEARCH_HISTORY_STORAGE_KEY = "lexinote.search-history";
const SEARCH_HISTORY_LIMIT = 50;

type CreateSearchHistoryItemInput = {
  searchedWord: string;
  context?: string;
  pronunciation?: string;
  searchedAt?: string;
  result: WordLookupResponse;
};

export function createSearchHistoryItem({
  searchedWord,
  context = "",
  pronunciation = "",
  searchedAt = new Date().toISOString(),
  result,
}: CreateSearchHistoryItemInput): SearchHistoryItem {
  const normalizedWord = searchedWord.trim();
  const normalizedContext = context.trim();
  const normalizedPronunciation = pronunciation.trim();

  return {
    id: buildSearchHistoryItemId({
      searchedWord: normalizedWord,
      context: normalizedContext,
      pronunciation: normalizedPronunciation,
      result,
    }),
    searchedWord: normalizedWord,
    context: normalizedContext,
    pronunciation: normalizedPronunciation,
    searchedAt,
    result,
  };
}

export function upsertSearchHistoryItems(
  items: SearchHistoryItem[],
  nextItem: SearchHistoryItem,
  limit = SEARCH_HISTORY_LIMIT
) {
  const deduplicatedItems = items.filter((item) => item.id !== nextItem.id);

  return [nextItem, ...deduplicatedItems].slice(0, limit);
}

export function loadSearchHistory() {
  if (typeof window === "undefined") {
    return [] as SearchHistoryItem[];
  }

  const rawValue = window.localStorage.getItem(SEARCH_HISTORY_STORAGE_KEY);

  if (!rawValue) {
    return [] as SearchHistoryItem[];
  }

  try {
    const parsedValue = JSON.parse(rawValue);

    if (!Array.isArray(parsedValue)) {
      return [] as SearchHistoryItem[];
    }

    return parsedValue.filter(isSearchHistoryItem);
  } catch {
    return [] as SearchHistoryItem[];
  }
}

export function saveSearchHistory(items: SearchHistoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(SEARCH_HISTORY_STORAGE_KEY, JSON.stringify(items));
}

export function clearSearchHistory() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(SEARCH_HISTORY_STORAGE_KEY);
}

function buildSearchHistoryItemId({
  searchedWord,
  context,
  pronunciation,
  result,
}: Omit<SearchHistoryItem, "id" | "searchedAt">) {
  return JSON.stringify([
    searchedWord,
    context,
    pronunciation,
    result.lookupWord,
    result.entry.pronunciation,
  ]);
}

function isSearchHistoryItem(value: unknown): value is SearchHistoryItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SearchHistoryItem>;

  return (
    typeof candidate.id === "string" &&
    typeof candidate.searchedWord === "string" &&
    typeof candidate.context === "string" &&
    typeof candidate.pronunciation === "string" &&
    typeof candidate.searchedAt === "string" &&
    isWordLookupResponse(candidate.result)
  );
}

function isWordLookupResponse(value: unknown): value is WordLookupResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<WordLookupResponse>;

  const hasValidEntries =
    candidate.entries === undefined ||
    (Array.isArray(candidate.entries) &&
      candidate.entries.every((entry) => isDictionaryEntry(entry)));

  return (
    typeof candidate.word === "string" &&
    typeof candidate.lookupWord === "string" &&
    (candidate.lookupReason === undefined ||
      typeof candidate.lookupReason === "string") &&
    (candidate.source === "dictionary" || candidate.source === "ai") &&
    isDictionaryEntry(candidate.entry) &&
    hasValidEntries
  );
}

function isDictionaryEntry(value: unknown): value is DictionaryEntry {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DictionaryEntry>;

  return (
    typeof candidate.word === "string" &&
    typeof candidate.pronunciation === "string" &&
    typeof candidate.meaningZh === "string" &&
    typeof candidate.partOfSpeech === "string" &&
    Array.isArray(candidate.examples) &&
    candidate.examples.every((example) => isDictionaryExample(example))
  );
}

function isDictionaryExample(value: unknown): value is DictionaryExample {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<DictionaryExample>;

  return (
    typeof candidate.japanese === "string" &&
    typeof candidate.reading === "string" &&
    typeof candidate.translationZh === "string"
  );
}
