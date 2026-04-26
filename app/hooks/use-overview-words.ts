"use client";

import { useEffect, useRef, useState } from "react";
import type { AppView } from "@/app/lib/app-view";
import type {
  DictionaryOverviewItem,
  DictionaryOverviewResponse,
} from "@/shared/types/api";

type ApiError = {
  error?: {
    message?: string;
  };
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

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

    if (reset) {
      overviewAbortControllerRef.current?.abort();
      overviewAbortControllerRef.current = new AbortController();
      overviewRequestIdRef.current = requestId;
      setOverviewError(null);
      setIsOverviewLoading(true);
      setOverviewNextCursor(null);
    } else {
      setIsOverviewLoadingMore(true);
    }

    try {
      const searchParams = new URLSearchParams();
      searchParams.set("limit", "24");
      if (normalizedQuery) {
        searchParams.set("query", normalizedQuery);
      }
      if (normalizedCursor) {
        searchParams.set("cursor", normalizedCursor);
      }

      const response = await fetch(`/api/words?${searchParams.toString()}`, {
        signal: reset ? overviewAbortControllerRef.current?.signal : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as DictionaryOverviewResponse;
      const validEntries = payload.words.filter((entry) =>
        isPositiveInteger(entry.wordId)
      );

      if (reset && requestId !== overviewRequestIdRef.current) {
        return;
      }

      setOverviewWords((currentEntries) => {
        if (reset) {
          return validEntries;
        }

        const mergedEntries = [...currentEntries];
        for (const entry of validEntries) {
          if (!mergedEntries.some((currentEntry) => currentEntry.wordId === entry.wordId)) {
            mergedEntries.push(entry);
          }
        }
        return mergedEntries;
      });
      setOverviewNextCursor(payload.nextCursor);
      setHasLoadedOverview(true);
    } catch (overviewLoadError) {
      if (
        overviewLoadError instanceof DOMException &&
        overviewLoadError.name === "AbortError"
      ) {
        return;
      }

      if (reset && requestId !== overviewRequestIdRef.current) {
        return;
      }

      const message =
        overviewLoadError instanceof Error ? overviewLoadError.message : "发生了意外错误";
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
      } else {
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
