"use client";

import { useEffect, useId, useState } from "react";
import { CollectionPanel } from "@/app/components/collection-panel";
import { HistoryList } from "@/app/components/history-list";
import { OverviewList } from "@/app/components/overview-list";
import {
  AppBrandIcon,
  BookIcon,
  CollectionIcon,
  HistoryIcon,
  SearchIcon,
  StarIcon,
} from "@/app/components/icons";
import { WordCard } from "@/app/components/word-card";
import { WordCardSkeleton } from "@/app/components/word-card-skeleton";
import { useCollections } from "@/app/hooks/use-collections";
import { useLookupFlow } from "@/app/hooks/use-lookup-flow";
import { useOverviewWords } from "@/app/hooks/use-overview-words";
import type { AppView } from "@/app/lib/app-view";

const SIDEBAR_ITEMS = [
  { label: "辞書", icon: BookIcon, view: "dictionary" as AppView },
  { label: "全览", icon: StarIcon, view: "overview" as AppView },
  { label: "履歴", icon: HistoryIcon, view: "history" as AppView },
  { label: "コレクション", icon: CollectionIcon, view: "collections" as AppView },
];

const TOP_NAV_ITEMS = [
  { label: "辞書", active: true },
  { label: "語彙", active: false },
];

function getRequestedView() {
  const requestedView = new URLSearchParams(window.location.search).get("view");
  return requestedView === "dictionary" ||
    requestedView === "overview" ||
    requestedView === "history" ||
    requestedView === "collections"
    ? requestedView
    : "dictionary";
}

export default function Home() {
  const [activeView, setActiveView] = useState<AppView>("dictionary");
  const statusId = useId();
  const {
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
  } = useLookupFlow(setActiveView);
  const {
    overviewQuery,
    setOverviewQuery,
    overviewWords,
    overviewNextCursor,
    overviewError,
    isOverviewLoading,
    isOverviewLoadingMore,
    hasLoadedOverview,
    onLoadMoreOverviewWords,
  } = useOverviewWords(activeView);
  const {
    collections,
    collectionName,
    setCollectionName,
    collectionError,
    editingCollectionId,
    editingCollectionName,
    setEditingCollectionName,
    editingCollectionAutoFilterEnabled,
    setEditingCollectionAutoFilterEnabled,
    editingCollectionAutoFilterCriteria,
    setEditingCollectionAutoFilterCriteria,
    isCollectionsLoading,
    isCreatingCollection,
    busyCollectionId,
    hasLoadedCollections,
    ensureCollectionsLoaded,
    onAddOverviewWordToCollection,
    onCreateCollection,
    onStartEditingCollection,
    onCancelEditingCollection,
    onSaveCollectionUpdate,
    onDeleteCollection,
    onResyncCollection,
  } = useCollections(activeView);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveView(getRequestedView());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const statusMessage =
    activeView === "overview"
      ? isOverviewLoading && !hasLoadedOverview
        ? "正在加载全览。"
        : overviewError
          ? `全览加载失败：${overviewError}`
          : overviewWords.length > 0
            ? `已打开全览，当前已加载 ${overviewWords.length} 个词条。`
            : "已打开全览，当前还没有内容。"
      : activeView === "collections"
      ? isCollectionsLoading && !hasLoadedCollections
        ? "正在加载 collections。"
        : collectionError
          ? `Collection 操作失败：${collectionError}`
          : collections.length > 0
            ? `已打开 collections，共 ${collections.length} 个。`
            : "已打开 collections，当前还没有内容。"
      : activeView === "history"
      ? historyItems.length > 0
        ? `已打开查询历史，共 ${historyItems.length} 条记录。`
        : "已打开查询历史，当前还没有记录。"
      : isLoading
        ? loadingMode === "retry"
          ? "正在根据补充说明重新查询单词。"
          : loadingContext
            ? "正在结合语境查询单词。"
            : "正在查询单词。"
        : error
          ? `查询失败：${error}`
          : result
            ? showsContextHint
              ? hasMultipleResults
                ? `已完成 ${result.word} 的查询，并参考语境 ${activeContext} 展示了更相关的候选结果。`
                : `已完成 ${result.word} 的查询，并参考语境 ${activeContext} 优先展示了更匹配的结果。`
              : hasMultipleResults
                ? `已完成 ${result.word} 的查询，找到 ${resultEntries.length} 个结果。`
              : showsLookupWordHint
                ? `已完成 ${result.word} 的查询，并按原形 ${result.lookupWord} 检索。`
                : `已完成 ${result.word} 的查询。`
            : "输入一个日语词即可开始查询。";

  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <header className="border-b border-black/50 bg-[#1e1e1ecc]">
        <div className="mr-auto flex h-[clamp(56px,6vw,60px)] w-full max-w-[1160px] items-center gap-[clamp(24px,5vw,48px)] pl-[clamp(16px,4vw,32px)] pr-[clamp(16px,3vw,24px)]">
          <div className="flex items-center gap-2.5">
            <AppBrandIcon className="size-[clamp(22px,2.5vw,24px)] text-accent" />
            <p className="text-[clamp(17px,2.3vw,20px)] font-medium tracking-[-0.03em] text-white/70">
              LexiNote
            </p>
          </div>

          <nav
            className="flex items-center gap-[clamp(12px,2.4vw,24px)] whitespace-nowrap"
            aria-label="Primary"
          >
            {TOP_NAV_ITEMS.map((item) => (
              <span
                key={item.label}
                className={
                  item.active
                    ? "text-[clamp(13px,1.8vw,16px)] text-white/60"
                    : "text-[clamp(13px,1.8vw,16px)] text-white/45"
                }
              >
                {item.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#1e1e1e80] md:block">
          <div className="px-4 py-4">
            <nav className="space-y-1" aria-label="Sidebar">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.view) {
                        setActiveView(item.view);
                      }
                    }}
                    aria-current={item.view === activeView ? "page" : undefined}
                    disabled={!item.view}
                    className={
                      item.view === activeView
                        ? "flex h-12 w-full items-center gap-3 rounded-[10px] bg-white/10 px-4 text-left text-white/70"
                        : item.view
                          ? "flex h-12 w-full items-center gap-3 rounded-[10px] px-4 text-left text-white/40 transition hover:bg-white/5 hover:text-white/60"
                          : "flex h-12 w-full items-center gap-3 rounded-[10px] px-4 text-left text-white/20"
                    }
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="text-base font-medium tracking-[-0.02em]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-4 py-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => {
                      if (item.view) {
                        setActiveView(item.view);
                      }
                    }}
                    disabled={!item.view}
                    className={
                      item.view === activeView
                        ? "inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/70"
                        : item.view
                          ? "inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/45"
                          : "inline-flex items-center gap-2 rounded-full border border-white/6 px-4 py-2 text-sm text-white/22"
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(32px,4vw,48px)]">
            <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
              {statusMessage}
            </p>

            <div
              className={`mx-auto w-full ${
                hasMultipleResults ? "max-w-[1000px]" : "max-w-[848px]"
              }`}
            >
              {activeView === "overview" ? (
                <OverviewList
                  words={overviewWords}
                  query={overviewQuery}
                  nextCursor={overviewNextCursor}
                  isLoading={isOverviewLoading}
                  isLoadingMore={isOverviewLoadingMore}
                  error={overviewError}
                  collections={collections}
                  isCollectionsLoading={isCollectionsLoading}
                  onQueryChange={setOverviewQuery}
                  onLoadMore={onLoadMoreOverviewWords}
                  onEnsureCollectionsLoaded={ensureCollectionsLoaded}
                  onAddWordToCollection={onAddOverviewWordToCollection}
                />
              ) : activeView === "collections" ? (
                <CollectionPanel
                  collections={collections}
                  collectionName={collectionName}
                  editingCollectionId={editingCollectionId}
                  editingCollectionName={editingCollectionName}
                  editingCollectionAutoFilterEnabled={
                    editingCollectionAutoFilterEnabled
                  }
                  editingCollectionAutoFilterCriteria={
                    editingCollectionAutoFilterCriteria
                  }
                  error={collectionError}
                  isLoading={isCollectionsLoading}
                  isCreating={isCreatingCollection}
                  busyCollectionId={busyCollectionId}
                  onCollectionNameChange={setCollectionName}
                  onCreateCollection={onCreateCollection}
                  onStartEditing={onStartEditingCollection}
                  onEditingCollectionNameChange={setEditingCollectionName}
                  onEditingCollectionAutoFilterEnabledChange={
                    setEditingCollectionAutoFilterEnabled
                  }
                  onEditingCollectionAutoFilterCriteriaChange={
                    setEditingCollectionAutoFilterCriteria
                  }
                  onCancelEditing={onCancelEditingCollection}
                  onSaveEditing={onSaveCollectionUpdate}
                  onResyncCollection={onResyncCollection}
                  onDeleteCollection={onDeleteCollection}
                />
              ) : activeView === "history" ? (
                <HistoryList
                  items={historyItems}
                  onOpenItem={onOpenHistoryItem}
                  onClear={onClearHistory}
                />
              ) : (
                <>
                  <div>
                    <form
                      onSubmit={onSubmit}
                      aria-describedby={statusId}
                      className="mx-auto w-full max-w-[672px]"
                    >
                      <label className="mb-3 block">
                        <span className="mb-2 block text-sm text-white/45">
                          查询语境（可选）
                        </span>
                        <input
                          type="text"
                          value={searchContextDraft}
                          onChange={(event) => setSearchContextDraft(event.target.value)}
                          placeholder="例如：不安を抱く / 希望例句偏日常会话"
                          aria-label="查询语境"
                          className="h-[clamp(46px,5vw,48px)] w-full rounded-[clamp(12px,2vw,14px)] border border-white/15 bg-[#1e1e1e99] px-4 text-sm tracking-[-0.01em] text-white/72 outline-none placeholder:text-white/28 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                        />
                      </label>
                      <label className="relative block">
                        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35" />
                        <input
                          type="search"
                          value={word}
                          onChange={(event) => setWord(event.target.value)}
                          placeholder="日本語の単語を入力してください..."
                          aria-label="日语词"
                          className="h-[clamp(48px,5vw,50px)] w-full rounded-[clamp(12px,2vw,14px)] border border-white/20 bg-[#1e1e1ecc] pl-12 pr-4 text-sm tracking-[-0.01em] text-white/78 outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                        />
                      </label>
                      <button type="submit" disabled={!canSubmit} className="sr-only">
                        开始查询
                      </button>
                    </form>
                  </div>

                  {error ? (
                    <div
                      role="alert"
                      className="mt-8 rounded-2xl border border-danger/30 bg-danger-soft/80 px-5 py-4 text-danger"
                    >
                      <p className="text-sm font-semibold">查询失败</p>
                      <p className="mt-1 text-sm leading-6">{error}</p>
                    </div>
                  ) : null}

                  {isLoading || hasResult ? (
                    <div
                      className={
                        showsLookupWordHint || showsContextHint
                          ? "mt-[clamp(14px,2vw,18px)] flex flex-col items-center gap-3"
                          : "mt-[clamp(32px,4vw,40px)] flex flex-col items-center gap-4"
                      }
                    >
                      {showsLookupWordHint || showsContextHint ? (
                        <div className="flex flex-col items-center gap-1.5">
                          {showsContextHint ? (
                            <p className="text-center text-sm leading-6 text-white/45">
                              {hasMultipleResults
                                ? `已参考语境「${activeContext}」展示更相关的候选结果`
                                : `已参考语境「${activeContext}」优先展示更匹配的结果`}
                            </p>
                          ) : null}
                          {showsLookupWordHint ? (
                            <p className="text-center text-sm leading-6 text-white/45">
                              已按原形「{result?.lookupWord}」查询
                            </p>
                          ) : null}
                          {result?.lookupReason ? (
                            <p className="max-w-[32rem] text-center text-xs leading-5 text-white/32">
                              {result?.lookupReason}
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                      {hasMultipleResults && wordCardsData.length > 0 ? (
                        <div className="w-full max-w-[960px]">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="text-sm leading-6 text-white/45">
                              共找到 {wordCardsData.length} 个本地结果，已并列展示。
                            </p>
                            <p className="hidden text-xs leading-5 text-white/28 sm:block">
                              左右滑动可查看全部结果
                            </p>
                          </div>

                          <div className="flex gap-4 overflow-x-auto pb-2 pr-1 [scrollbar-width:thin]">
                            {wordCardsData.map((wordCard, index) => (
                              <div
                                key={`${wordCard.word}-${wordCard.reading}-${index}`}
                                className="basis-[86%] shrink-0 sm:basis-[390px] lg:basis-[420px]"
                              >
                                <WordCard word={wordCard} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : wordCardsData[0] ? (
                        <WordCard word={wordCardsData[0]} />
                      ) : (
                        <WordCardSkeleton />
                      )}

                      {hasMultipleResults && resultDifferenceNotes.length > 0 ? (
                        <div className="w-full max-w-[960px]">
                          <div className="rounded-[clamp(14px,2vw,16px)] border border-white/10 bg-[#1e1e1eb3] p-[clamp(16px,2.4vw,20px)]">
                            <div className="flex flex-col gap-3">
                              <div>
                                <p className="text-sm font-medium text-white/68">
                                  各结果之间的区别
                                </p>
                                {resultDifferenceOverview ? (
                                  <p className="mt-1 text-sm leading-6 text-white/40">
                                    {resultDifferenceOverview}
                                  </p>
                                ) : null}
                              </div>

                              <div className="space-y-2.5">
                                {resultDifferenceNotes.map((note) => (
                                  <div
                                    key={note.key}
                                    className="rounded-[14px] border border-white/8 bg-[#15151599] px-4 py-3"
                                  >
                                    <p className="text-sm font-medium text-white/66">
                                      {note.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-white/42">
                                      {note.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {hasResult ? (
                        <div className={`w-full ${resultPanelWidthClass}`}>
                          <div className="rounded-[clamp(14px,2vw,16px)] border border-white/10 bg-[#1e1e1eb3] p-[clamp(16px,2.4vw,20px)]">
                            <div className="flex flex-col gap-3">
                              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-white/65">
                                    对当前结果不满意？
                                  </p>
                                  <p className="mt-1 text-sm leading-6 text-white/38">
                                    补充你想要的解释方向、场景或例句风格，再重新查询一次。
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={onToggleRetryPanel}
                                  disabled={isLoading}
                                  className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/12 px-4 text-sm text-white/62 transition hover:border-white/20 hover:bg-white/5 hover:text-white/78 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  {isRetryPanelOpen ? "收起补充说明" : "重新查询"}
                                </button>
                              </div>

                              {isRetryPanelOpen ? (
                                <form onSubmit={onRetrySubmit} className="space-y-3">
                                  {hasMultipleResults ? (
                                    <fieldset className="space-y-2">
                                      <legend className="text-sm text-white/48">
                                        选择要重查的词条
                                      </legend>
                                      <div className="grid gap-2 sm:grid-cols-2">
                                        {resultEntries.map((entry, index) => (
                                          <label
                                            key={`${entry.word}-${entry.pronunciation}-${index}`}
                                            className={
                                              selectedRetryPronunciation ===
                                              entry.pronunciation
                                                ? "cursor-pointer rounded-[14px] border border-white/20 bg-white/8 px-4 py-3"
                                                : "cursor-pointer rounded-[14px] border border-white/10 bg-[#15151599] px-4 py-3 transition hover:border-white/16 hover:bg-white/5"
                                            }
                                          >
                                            <input
                                              type="radio"
                                              name="retry-entry"
                                              value={entry.pronunciation}
                                              checked={
                                                selectedRetryPronunciation ===
                                                entry.pronunciation
                                              }
                                              onChange={(event) =>
                                                setSelectedRetryPronunciation(
                                                  event.target.value
                                                )
                                              }
                                              className="sr-only"
                                            />
                                            <p className="text-sm font-medium text-white/68">
                                              {entry.pronunciation}
                                            </p>
                                            <p className="mt-1 text-sm leading-6 text-white/40">
                                              {entry.meaningZh
                                                .split(/[；;。]/)[0]
                                                .trim() || "当前词条"}
                                            </p>
                                          </label>
                                        ))}
                                      </div>
                                    </fieldset>
                                  ) : null}

                                  <label className="block">
                                    <span className="mb-2 block text-sm text-white/48">
                                      补充说明
                                    </span>
                                    <textarea
                                      value={retryContext}
                                      onChange={(event) =>
                                        setRetryContext(event.target.value)
                                      }
                                      placeholder="例如：希望释义更简单一点；例句偏日常会话；顺便解释它和相近词的区别。"
                                      aria-label="重新查询补充说明"
                                      autoFocus
                                      rows={4}
                                      disabled={isLoading}
                                      className="min-h-28 w-full resize-y rounded-[14px] border border-white/12 bg-[#151515cc] px-4 py-3 text-sm leading-6 text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                                    />
                                  </label>

                                  <div className="flex flex-wrap items-center gap-3">
                                    <button
                                      type="submit"
                                      disabled={!canRetrySubmit}
                                      className="inline-flex h-10 items-center justify-center rounded-full bg-white/10 px-4 text-sm font-medium text-white/74 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                      {isLoading ? "重新查询中..." : "按补充说明重新查询"}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={onCancelRetry}
                                      disabled={isLoading}
                                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/44 transition hover:border-white/18 hover:text-white/62 disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                      取消
                                    </button>
                                  </div>
                                </form>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex min-h-[clamp(72px,8vw,84px)] w-full max-w-[1160px] items-center justify-center px-[clamp(16px,3vw,24px)] py-5 text-center text-xs leading-6 text-white/40 sm:text-sm md:py-0">
          日本語学習辞書 - Japanese Learning Dictionary
        </div>
      </footer>
    </main>
  );
}
