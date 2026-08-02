"use client";

import { useEffect, useRef, useState } from "react";
import type { AppView } from "@/app/lib/app-view";
import {
  getErrorMessage,
  isAbortError,
} from "@/app/lib/api-client";
import { fetchDictionaryOverview } from "@/app/lib/dictionary-api";
import { isPositiveInteger } from "@/app/lib/number";
import { mergeUniqueWordEntriesById } from "@/app/lib/word-list";
import type { DictionaryOverviewItem } from "@/shared/types/dictionary";
import { WORD_PAGE_SIZE } from "@/shared/constants/pagination";

export function useOverviewWords(activeView: AppView) {
  const [overviewQuery, setOverviewQuery] = useState("");
  const [overviewWords, setOverviewWords] = useState<DictionaryOverviewItem[]>([]);
  const [overviewNextCursor, setOverviewNextCursor] = useState<string | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [isOverviewLoading, setIsOverviewLoading] = useState(false);
  const [isOverviewLoadingMore, setIsOverviewLoadingMore] = useState(false);
  const [hasLoadedOverview, setHasLoadedOverview] = useState(false);
  const overviewRequestIdRef = useRef(0);
  const overviewAbortControllerRef = useRef<AbortController | null>(null);
  const overviewLoadMoreRequestIdRef = useRef(0);
  const overviewLoadMoreAbortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (activeView !== "overview") {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadOverviewWords({
        query: overviewQuery.trim(),
        reset: true,
      });
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeView, overviewQuery]);

  async function loadOverviewWords(options?: {
    query?: string;
    cursor?: string;
    reset?: boolean;
  }) {
    const normalizedQuery = options?.query?.trim() ?? "";
    const normalizedCursor = options?.cursor?.trim() || undefined;
    const reset = options?.reset ?? false;
    const requestId = reset ? overviewRequestIdRef.current + 1 : overviewRequestIdRef.current;
    let loadMoreRequestId = overviewLoadMoreRequestIdRef.current;

    const isStaleRequest = () =>
      requestId !== overviewRequestIdRef.current ||
      (!reset && loadMoreRequestId !== overviewLoadMoreRequestIdRef.current);

    if (reset) {
      overviewAbortControllerRef.current?.abort();
      overviewLoadMoreAbortControllerRef.current?.abort();
      overviewAbortControllerRef.current = new AbortController();
      overviewLoadMoreAbortControllerRef.current = null;
      overviewRequestIdRef.current = requestId;
      overviewLoadMoreRequestIdRef.current += 1;
      setOverviewError(null);
      setIsOverviewLoading(true);
      setIsOverviewLoadingMore(false);
      setOverviewNextCursor(null);
    } else {
      overviewLoadMoreAbortControllerRef.current?.abort();
      overviewLoadMoreAbortControllerRef.current = new AbortController();
      overviewLoadMoreRequestIdRef.current += 1;
      loadMoreRequestId = overviewLoadMoreRequestIdRef.current;
      setIsOverviewLoadingMore(true);
    }

    try {
      const payload = await fetchDictionaryOverview({
        query: normalizedQuery || undefined,
        cursor: normalizedCursor,
        limit: WORD_PAGE_SIZE,
        signal: reset
          ? overviewAbortControllerRef.current?.signal
          : overviewLoadMoreAbortControllerRef.current?.signal,
      });
      const validEntries = payload.words.filter((entry) =>
        isPositiveInteger(entry.wordId)
      );

      if (isStaleRequest()) {
        return;
      }

      setOverviewWords((currentEntries) => {
        if (reset) {
          return validEntries;
        }

        return mergeUniqueWordEntriesById(currentEntries, validEntries);
      });
      setOverviewNextCursor(payload.nextCursor);
      setHasLoadedOverview(true);
    } catch (overviewLoadError) {
      if (isAbortError(overviewLoadError)) {
        return;
      }

      if (isStaleRequest()) {
        return;
      }

      const message = getErrorMessage(overviewLoadError, "发生了意外错误");
      setOverviewError(message);

      if (reset) {
        setOverviewWords([]);
        setOverviewNextCursor(null);
      }
    } finally {
      if (reset) {
        if (requestId === overviewRequestIdRef.current) {
          setIsOverviewLoading(false);
        }
      } else if (!isStaleRequest()) {
        setIsOverviewLoadingMore(false);
      }
    }
  }

  async function onLoadMoreOverviewWords() {
    if (!overviewNextCursor || isOverviewLoadingMore) {
      return;
    }

    await loadOverviewWords({
      query: overviewQuery.trim(),
      cursor: overviewNextCursor,
      reset: false,
    });
  }

  return {
    overviewQuery,
    setOverviewQuery,
    overviewWords,
    overviewNextCursor,
    overviewError,
    isOverviewLoading,
    isOverviewLoadingMore,
    hasLoadedOverview,
    onLoadMoreOverviewWords,
  };
}
