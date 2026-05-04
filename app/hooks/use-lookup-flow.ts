"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";
import type { AppView } from "@/app/lib/app-view";
import {
  clearSearchHistory,
  createSearchHistoryItem,
  loadSearchHistory,
  saveSearchHistory,
  type SearchHistoryItem,
  upsertSearchHistoryItems,
} from "@/app/lib/search-history";
import {
  buildResultDifferenceNotes,
  buildResultDifferenceOverview,
  getResultEntries,
  mapResultToWordDataList,
} from "@/app/lib/word-data";
import type { WordLookupResponse } from "@/shared/types/api";

type ApiError = {
  error?: {
    message?: string;
  };
};

type LookupMode = "search" | "retry";

function buildLookupCacheKey(word: string, context = "", pronunciation = "") {
  return JSON.stringify({
    word: word.trim(),
    context: context.trim(),
    pronunciation: pronunciation.trim(),
  });
}

export function useLookupFlow(onViewChange: (view: AppView) => void) {
  const [word, setWord] = useState("");
  const [searchContextDraft, setSearchContextDraft] = useState("");
  const [retryContext, setRetryContext] = useState("");
  const [selectedRetryPronunciation, setSelectedRetryPronunciation] = useState("");
  const [result, setResult] = useState<WordLookupResponse | null>(null);
  const [historyItems, setHistoryItems] = useState<SearchHistoryItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeContext, setActiveContext] = useState("");
  const [loadingContext, setLoadingContext] = useState("");
  const [loadingMode, setLoadingMode] = useState<LookupMode | null>(null);
  const [isRetryPanelOpen, setIsRetryPanelOpen] = useState(false);
  const resultCacheRef = useRef(new Map<string, WordLookupResponse>());

  const canSubmit = word.trim().length > 0 && !isLoading;
  const canRetrySubmit = retryContext.trim().length > 0 && result !== null && !isLoading;
  const hasResult = result !== null;
  const showsLookupWordHint = result !== null && result.lookupWord !== result.word;
  const showsContextHint = result !== null && activeContext.length > 0;
  const resultEntries = result ? getResultEntries(result) : [];
  const wordCardsData = result ? mapResultToWordDataList(result) : [];
  const hasMultipleResults = resultEntries.length > 1;
  const resultDifferenceOverview = hasMultipleResults
    ? buildResultDifferenceOverview(resultEntries)
    : null;
  const resultDifferenceNotes = hasMultipleResults
    ? buildResultDifferenceNotes(resultEntries)
    : [];
  const resultPanelWidthClass = hasMultipleResults ? "max-w-[960px]" : "max-w-2xl";

  useEffect(() => {
    setHistoryItems(loadSearchHistory());
  }, []);

  function rememberSearchResult(
    searchedWord: string,
    context: string,
    pronunciation: string,
    payload: WordLookupResponse
  ) {
    const nextItem = createSearchHistoryItem({
      searchedWord,
      context,
      pronunciation,
      result: payload,
    });

    setHistoryItems((currentItems) => {
      const nextItems = upsertSearchHistoryItems(currentItems, nextItem);
      saveSearchHistory(nextItems);
      return nextItems;
    });
  }

  function onOpenHistoryItem(item: SearchHistoryItem) {
    onViewChange("dictionary");
    setWord(item.searchedWord);
    setSearchContextDraft(item.context);
    setRetryContext("");
    setActiveContext(item.context);
    setError(null);
    setResult(item.result);
    setIsLoading(false);
    setLoadingContext("");
    setLoadingMode(null);
    setIsRetryPanelOpen(false);
    setSelectedRetryPronunciation(item.pronunciation || item.result.entry.pronunciation);
    resultCacheRef.current.set(
      buildLookupCacheKey(item.searchedWord, item.context, item.pronunciation),
      item.result
    );
  }

  function onClearHistory() {
    clearSearchHistory();
    setHistoryItems([]);
  }

  async function lookupWord(
    rawWord: string,
    rawContext?: string,
    options?: {
      preserveResult?: boolean;
      source?: LookupMode;
      pronunciation?: string;
    }
  ) {
    const normalizedWord = rawWord.trim();
    const normalizedContext = rawContext?.trim() || "";
    const normalizedPronunciation = options?.pronunciation?.trim() || "";
    const cacheKey = buildLookupCacheKey(
      normalizedWord,
      normalizedContext,
      normalizedPronunciation
    );

    if (!normalizedWord) {
      setError("请输入一个日语单词。");
      setResult(null);
      setActiveContext("");
      return;
    }

    const cachedResult = resultCacheRef.current.get(cacheKey);
    if (cachedResult) {
      rememberSearchResult(
        normalizedWord,
        normalizedContext,
        normalizedPronunciation,
        cachedResult
      );
      setError(null);
      setResult(cachedResult);
      setActiveContext(normalizedContext);
      setSearchContextDraft(normalizedContext);
      setIsRetryPanelOpen(false);
      setRetryContext("");
      setSelectedRetryPronunciation(
        cachedResult.entry.pronunciation || normalizedPronunciation
      );
      setLoadingContext("");
      setLoadingMode(null);
      setIsLoading(false);
      return;
    }

    setError(null);
    if (!options?.preserveResult) {
      setResult(null);
    }
    setLoadingContext(normalizedContext);
    setLoadingMode(options?.source ?? "search");
    setIsLoading(true);

    try {
      const response = await fetch("/api/words/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          word: normalizedWord,
          context: normalizedContext || undefined,
          pronunciation: normalizedPronunciation || undefined,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as WordLookupResponse;
      resultCacheRef.current.set(cacheKey, payload);
      rememberSearchResult(
        normalizedWord,
        normalizedContext,
        normalizedPronunciation,
        payload
      );
      setResult(payload);
      setActiveContext(normalizedContext);
      setSearchContextDraft(normalizedContext);
      setIsRetryPanelOpen(false);
      setRetryContext("");
      setSelectedRetryPronunciation(payload.entry.pronunciation);
    } catch (lookupError) {
      const message = lookupError instanceof Error ? lookupError.message : "发生了意外错误";
      setError(
        options?.preserveResult
          ? `重新查询失败，当前仍显示上次成功结果。${message}`
          : message
      );
      if (!options?.preserveResult) {
        setResult(null);
        setActiveContext("");
        setSelectedRetryPronunciation("");
      }
    } finally {
      setLoadingContext("");
      setLoadingMode(null);
      setIsLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onViewChange("dictionary");
    setIsRetryPanelOpen(false);
    setRetryContext("");
    setSelectedRetryPronunciation("");
    await lookupWord(word, searchContextDraft, { source: "search" });
  }

  async function onRetrySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onViewChange("dictionary");

    if (!result) {
      return;
    }

    if (!retryContext.trim()) {
      setError("请补充你希望返回什么样的结果。");
      return;
    }

    const retryPronunciation =
      hasMultipleResults && selectedRetryPronunciation
        ? selectedRetryPronunciation
        : undefined;

    setWord(result.word);
    await lookupWord(result.word, retryContext, {
      preserveResult: true,
      source: "retry",
      pronunciation: retryPronunciation,
    });
  }

  function onToggleRetryPanel() {
    if (!isRetryPanelOpen && !retryContext.trim() && activeContext) {
      setRetryContext(activeContext);
    }

    if (!isRetryPanelOpen && result) {
      setSelectedRetryPronunciation(
        result.entry.pronunciation || resultEntries[0]?.pronunciation || ""
      );
    }

    setIsRetryPanelOpen((currentValue) => !currentValue);
  }

  function onCancelRetry() {
    setIsRetryPanelOpen(false);
    setRetryContext("");
    setSelectedRetryPronunciation(result?.entry.pronunciation || "");
  }

  return {
    word,
    setWord,
    searchContextDraft,
    setSearchContextDraft,
    retryContext,
    setRetryContext,
    selectedRetryPronunciation,
    setSelectedRetryPronunciation,
    result,
    historyItems,
    error,
    isLoading,
    activeContext,
    loadingContext,
    loadingMode,
    isRetryPanelOpen,
    canSubmit,
    canRetrySubmit,
    hasResult,
    showsLookupWordHint,
    showsContextHint,
    resultEntries,
    wordCardsData,
    hasMultipleResults,
    resultDifferenceOverview,
    resultDifferenceNotes,
    resultPanelWidthClass,
    onOpenHistoryItem,
    onClearHistory,
    onSubmit,
    onRetrySubmit,
    onToggleRetryPanel,
    onCancelRetry,
  };
}
