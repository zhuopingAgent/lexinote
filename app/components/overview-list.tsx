"use client";

import { useState } from "react";
import type { CollectionSummary, DictionaryOverviewItem } from "@/shared/types/api";

type OverviewListProps = {
  words: DictionaryOverviewItem[];
  query: string;
  nextCursor: string | null;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  collections: CollectionSummary[];
  isCollectionsLoading: boolean;
  onQueryChange: (value: string) => void;
  onLoadMore: () => Promise<void>;
  onEnsureCollectionsLoaded: () => Promise<void>;
  onAddWordToCollection: (
    collectionId: number,
    wordId: number
  ) => Promise<"added" | "already_exists">;
};

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0;
}

function summarizeMeaning(meaning: string) {
  return meaning.split(/[；;。]/)[0]?.trim() || meaning.trim();
}

function formatCreatedAt(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function OverviewList({
  words,
  query,
  nextCursor,
  isLoading,
  isLoadingMore,
  error,
  collections,
  isCollectionsLoading,
  onQueryChange,
  onLoadMore,
  onEnsureCollectionsLoaded,
  onAddWordToCollection,
}: OverviewListProps) {
  const [openPickerWordId, setOpenPickerWordId] = useState<number | null>(null);
  const [isPreparingCollections, setIsPreparingCollections] = useState(false);
  const [busyActionKey, setBusyActionKey] = useState<string | null>(null);
  const [wordNoticeMap, setWordNoticeMap] = useState<Record<number, string>>({});

  async function onToggleCollectionPicker(wordId: number) {
    if (!isPositiveInteger(wordId)) {
      setWordNoticeMap((currentMap) => ({
        ...currentMap,
        [wordId]: "这个词条缺少有效 ID，请刷新页面后重试。",
      }));
      return;
    }

    if (openPickerWordId === wordId) {
      setOpenPickerWordId(null);
      return;
    }

    setWordNoticeMap((currentMap) => {
      const nextMap = { ...currentMap };
      delete nextMap[wordId];
      return nextMap;
    });

    if (collections.length === 0) {
      setIsPreparingCollections(true);

      try {
        await onEnsureCollectionsLoaded();
      } finally {
        setIsPreparingCollections(false);
      }
    }

    setOpenPickerWordId(wordId);
  }

  async function onSelectCollection(collectionId: number, wordId: number) {
    if (!isPositiveInteger(collectionId) || !isPositiveInteger(wordId)) {
      setWordNoticeMap((currentMap) => ({
        ...currentMap,
        [wordId]: "当前词条或 collection 信息无效，请刷新页面后重试。",
      }));
      return;
    }

    const busyKey = `${collectionId}:${wordId}`;
    setBusyActionKey(busyKey);

    try {
      const status = await onAddWordToCollection(collectionId, wordId);
      setWordNoticeMap((currentMap) => ({
        ...currentMap,
        [wordId]:
          status === "added"
            ? "已加入所选 collection。"
            : "这个词条已经在所选 collection 中。",
      }));
      setOpenPickerWordId(null);
    } catch (actionError) {
      const message = actionError instanceof Error ? actionError.message : "添加失败，请稍后再试。";
      setWordNoticeMap((currentMap) => ({
        ...currentMap,
        [wordId]: message,
      }));
    } finally {
      setBusyActionKey(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[960px]">
      <div className="rounded-[clamp(18px,2vw,22px)] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.5vw,24px)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-medium tracking-[-0.03em] text-white/72">全览</p>
            <p className="mt-1 text-sm leading-6 text-white/40">
              展示数据库中的全部单词，按入库时间倒序排列。
            </p>
          </div>
          <p className="text-sm text-white/35">已加载 {words.length} 个词条</p>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索单词、读音、词性或释义"
            aria-label="搜索全览词条"
            className="h-12 flex-1 rounded-[14px] border border-white/12 bg-[#151515cc] px-4 text-sm text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10"
          />
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-[14px] border border-white/10 px-5 text-sm text-white/52 transition hover:border-white/18 hover:text-white/66"
          >
            清空搜索
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft/80 px-5 py-4 text-danger"
        >
          <p className="text-sm font-semibold">全览加载失败</p>
          <p className="mt-1 text-sm leading-6">{error}</p>
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[174px] animate-pulse rounded-[18px] border border-white/8 bg-[#1a1a1a99] p-5"
            >
              <div className="h-6 w-24 rounded bg-white/10" />
              <div className="mt-3 h-4 w-20 rounded bg-white/8" />
              <div className="mt-6 h-4 w-full rounded bg-white/8" />
              <div className="mt-2 h-4 w-3/4 rounded bg-white/6" />
              <div className="mt-7 h-3 w-16 rounded bg-white/6" />
            </div>
          ))}
        </div>
      ) : null}

      {!isLoading && !error && words.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">
            {query.trim() ? "没有匹配的词条" : "数据库里还没有单词"}
          </p>
          <p className="mt-2 text-sm leading-6 text-white/38">
            {query.trim()
              ? "换个关键词试试，或者先到词典页查询后再回来查看。"
              : "先查询一些词条，或者通过 collection 页面添加后，这里就会显示出来。"}
          </p>
        </div>
      ) : null}

      {!isLoading && words.length > 0 ? (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {words.map((word) => {
              const hasValidWordId = isPositiveInteger(word.wordId);

              return (
                <article
                  key={hasValidWordId ? word.wordId : `${word.word}-${word.pronunciation}`}
                  className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[22px] font-medium tracking-[-0.04em] text-white/80">
                        {word.word}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-white/45">
                        {word.pronunciation}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs leading-5 text-white/28">
                      {formatCreatedAt(word.createdAt)}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <span className="inline-flex rounded-full bg-white/7 px-3 py-1 text-xs text-white/48">
                      {word.partOfSpeech}
                    </span>
                  </div>

                  <div className="mt-5">
                    <p className="text-xs uppercase tracking-[0.16em] text-white/28">
                      意味
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/52">
                      {summarizeMeaning(word.meaningZh)}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-white/8 pt-4">
                    <button
                      type="button"
                      onClick={() => void onToggleCollectionPicker(word.wordId)}
                      disabled={
                        !hasValidWordId || isPreparingCollections || isCollectionsLoading
                      }
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/60 transition hover:border-white/18 hover:bg-white/5 hover:text-white/74 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {openPickerWordId === word.wordId
                        ? "收起 collection"
                        : "加入 collection"}
                    </button>

                    {!hasValidWordId ? (
                      <p className="mt-3 text-sm leading-6 text-white/42">
                        这个词条缺少有效 ID，暂时无法加入 collection。
                      </p>
                    ) : null}

                    {openPickerWordId === word.wordId ? (
                      <div className="mt-3 space-y-3 rounded-[16px] border border-white/8 bg-[#15151599] p-4">
                        {isPreparingCollections || isCollectionsLoading ? (
                          <p className="text-sm leading-6 text-white/42">
                            正在加载 collections...
                          </p>
                        ) : collections.length > 0 ? (
                          <>
                            <p className="text-sm leading-6 text-white/42">
                              选择一个 collection 来添加这个词条。
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {collections.map((collection) => {
                                const actionKey = `${collection.collectionId}:${word.wordId}`;

                                return (
                                  <button
                                    key={collection.collectionId}
                                    type="button"
                                    onClick={() =>
                                      void onSelectCollection(
                                        collection.collectionId,
                                        word.wordId
                                      )
                                    }
                                    disabled={busyActionKey !== null}
                                    className="inline-flex h-10 items-center justify-center rounded-full bg-white/8 px-4 text-sm text-white/70 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                                  >
                                    {busyActionKey === actionKey
                                      ? "添加中..."
                                      : collection.name}
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <p className="text-sm leading-6 text-white/42">
                            还没有 collection，先去创建一个再回来添加。
                          </p>
                        )}
                      </div>
                    ) : null}

                    {wordNoticeMap[word.wordId] ? (
                      <p className="mt-3 text-sm leading-6 text-white/42">
                        {wordNoticeMap[word.wordId]}
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
          </div>

          {nextCursor ? (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                onClick={() => void onLoadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-11 items-center justify-center rounded-full border border-white/10 px-5 text-sm text-white/56 transition hover:border-white/18 hover:text-white/68 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {isLoadingMore ? "加载中..." : "加载更多"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
