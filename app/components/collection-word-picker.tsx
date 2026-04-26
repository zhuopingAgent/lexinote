"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  AddCollectionWordsResponse,
  DictionaryOverviewItem,
  DictionaryOverviewResponse,
} from "@/shared/types/api";

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type CollectionWordPickerProps = {
  collectionId: number;
  existingWordIds: number[];
};

const PAGE_SIZE = 24;

function summarizeMeaning(meaning: string) {
  return meaning.split(/[；;。]/)[0]?.trim() || meaning.trim();
}

export function CollectionWordPicker({
  collectionId,
  existingWordIds,
}: CollectionWordPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [entries, setEntries] = useState<DictionaryOverviewItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const activeResetRequestIdRef = useRef(0);
  const activeResetAbortControllerRef = useRef<AbortController | null>(null);

  const existingWordIdSet = useMemo(() => new Set(existingWordIds), [existingWordIds]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 250);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setSelectedWordIds((currentWordIds) =>
      currentWordIds.filter((wordId) => !existingWordIdSet.has(wordId))
    );
  }, [existingWordIdSet]);

  useEffect(() => {
    void loadEntries({ query: debouncedQuery, reset: true });
  }, [debouncedQuery]);

  async function loadEntries(options: {
    query: string;
    reset: boolean;
    cursor?: string;
  }) {
    const requestId = options.reset
      ? activeResetRequestIdRef.current + 1
      : activeResetRequestIdRef.current;

    if (options.reset) {
      activeResetAbortControllerRef.current?.abort();
      activeResetAbortControllerRef.current = new AbortController();
      activeResetRequestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);
    } else {
      setIsLoadingMore(true);
    }

    try {
      const searchParams = new URLSearchParams();
      if (options.query) {
        searchParams.set("query", options.query);
      }
      searchParams.set("limit", String(PAGE_SIZE));
      if (options.cursor) {
        searchParams.set("cursor", options.cursor);
      }

      const response = await fetch(`/api/words?${searchParams.toString()}`, {
        signal: options.reset
          ? activeResetAbortControllerRef.current?.signal
          : undefined,
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as DictionaryOverviewResponse;
      if (options.reset && requestId !== activeResetRequestIdRef.current) {
        return;
      }
      setEntries((currentEntries) =>
        options.reset ? payload.words : [...currentEntries, ...payload.words]
      );
      setNextCursor(payload.nextCursor);
      setHasLoaded(true);
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") {
        return;
      }

      if (options.reset && requestId !== activeResetRequestIdRef.current) {
        return;
      }

      setError(loadError instanceof Error ? loadError.message : "发生了意外错误");
      if (options.reset) {
        setEntries([]);
        setNextCursor(null);
      }
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }

  function toggleWordSelection(wordId: number) {
    setSelectedWordIds((currentWordIds) =>
      currentWordIds.includes(wordId)
        ? currentWordIds.filter((currentWordId) => currentWordId !== wordId)
        : [...currentWordIds, wordId]
    );
  }

  async function onAddSelectedWords() {
    if (selectedWordIds.length === 0) {
      setError("请先勾选至少一个词条。");
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/collections/${collectionId}/words/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wordIds: selectedWordIds,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as AddCollectionWordsResponse;

      if (payload.addedCount === 0) {
        setNotice("所选词条都已经在当前 collection 中。");
        return;
      }

      router.push(
        `/collections/detail?collectionId=${collectionId}&added=${payload.addedCount}`
      );
      router.refresh();
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : "发生了意外错误";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-[22px] border border-white/10 bg-[#1e1e1ecc] p-[clamp(20px,2.8vw,28px)] shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-medium tracking-[-0.03em] text-white/72">
            选择要加入的单词
          </p>
          <p className="mt-1 text-sm leading-6 text-white/40">
            可以先搜索再勾选。这里只展示本地词典里的词条，并按入库时间倒序加载。
          </p>
        </div>
        <p className="text-sm text-white/35">
          已选 {selectedWordIds.length} / 已加载 {entries.length} 条
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setError(null);
            setNotice(null);
          }}
          placeholder="搜索单词、读音或释义，例如：抱く / いだく / 怀有"
          aria-label="搜索可添加词条"
          className="h-12 flex-1 rounded-[14px] border border-white/12 bg-[#151515cc] px-4 text-sm text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10"
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setError(null);
            setNotice(null);
          }}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-[14px] border border-white/10 px-5 text-sm text-white/52 transition hover:border-white/18 hover:text-white/66"
        >
          清空搜索
        </button>
      </div>

      {error ? <p className="mt-4 text-sm leading-6 text-danger">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm leading-6 text-white/42">{notice}</p> : null}

      {isLoading ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[132px] animate-pulse rounded-[16px] border border-white/8 bg-[#15151599] px-4 py-4"
            >
              <div className="h-6 w-24 rounded bg-white/10" />
              <div className="mt-3 h-4 w-20 rounded bg-white/8" />
              <div className="mt-4 h-4 w-full rounded bg-white/8" />
              <div className="mt-2 h-4 w-3/4 rounded bg-white/6" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && entries.length > 0 ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => {
            const isExisting = existingWordIdSet.has(entry.wordId);
            const isSelected = selectedWordIds.includes(entry.wordId);

            return (
              <label
                key={entry.wordId}
                className={
                  isExisting
                    ? "rounded-[16px] border border-white/8 bg-[#15151588] px-4 py-4 opacity-60"
                    : isSelected
                      ? "cursor-pointer rounded-[16px] border border-white/20 bg-white/8 px-4 py-4"
                      : "cursor-pointer rounded-[16px] border border-white/10 bg-[#15151599] px-4 py-4 transition hover:border-white/16 hover:bg-white/5"
                }
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isExisting || isSelected}
                    onChange={() => toggleWordSelection(entry.wordId)}
                    disabled={isExisting}
                    className="mt-1 size-4 rounded border-white/15 bg-transparent accent-white/80"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-lg font-medium tracking-[-0.03em] text-white/78">
                        {entry.word}
                      </p>
                      <span className="text-sm text-white/42">{entry.pronunciation}</span>
                      <span className="inline-flex rounded-full bg-white/7 px-2.5 py-1 text-xs text-white/48">
                        {entry.partOfSpeech}
                      </span>
                      {isExisting ? (
                        <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
                          已添加
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-white/42">
                      {summarizeMeaning(entry.meaningZh)}
                    </p>
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      ) : null}

      {!isLoading && hasLoaded && entries.length === 0 ? (
        <div className="mt-5 rounded-[18px] border border-dashed border-white/12 bg-[#17171799] px-6 py-10 text-center">
          <p className="text-base font-medium text-white/58">没有匹配的本地词条</p>
          <p className="mt-2 text-sm leading-6 text-white/38">
            你可以先回词典页查询一次，把词条写入本地，再回来添加。
          </p>
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onAddSelectedWords()}
          disabled={isSubmitting || selectedWordIds.length === 0}
          className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/74 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "添加中..." : `添加已选 ${selectedWordIds.length} 个词条`}
        </button>

        {nextCursor ? (
          <button
            type="button"
            onClick={() =>
              void loadEntries({
                query: debouncedQuery,
                cursor: nextCursor,
                reset: false,
              })
            }
            disabled={isLoadingMore}
            className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm text-white/56 transition hover:border-white/18 hover:text-white/68 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isLoadingMore ? "加载中..." : "加载更多"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
