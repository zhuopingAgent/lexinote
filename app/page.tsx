"use client";

import { useEffect, useId, useState } from "react";
import { CollectionPanel } from "@/app/components/collection-panel";
import { DictionaryEntryActions } from "@/app/components/dictionary-entry-actions";
import { DictionaryResultSelector } from "@/app/components/dictionary-result-selector";
import { HistoryList } from "@/app/components/history-list";
import { OverviewList } from "@/app/components/overview-list";
import { AiApiErrorModal } from "@/app/components/ai-api-error-modal";
import { AppHeader } from "@/app/components/app-header";
import {
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
import { parseAppView, type AppView } from "@/app/lib/app-view";
import { getTopNavigationItems } from "@/app/lib/top-navigation";
import type { SearchHistoryItem } from "@/app/lib/search-history";
import {
  buildLookupStatusBadges,
  getLookupEntryCollectionState,
} from "@/app/lib/lookup-view";

const VIEW_TABS = [
  {
    label: "辞書",
    displayLabel: "查询",
    icon: BookIcon,
    view: "dictionary" as AppView,
  },
  {
    label: "全覧",
    displayLabel: "全部词条",
    icon: StarIcon,
    view: "overview" as AppView,
  },
  {
    label: "履歴",
    displayLabel: "历史",
    icon: HistoryIcon,
    view: "history" as AppView,
  },
  {
    label: "Collection",
    displayLabel: "单词本",
    icon: CollectionIcon,
    view: "collections" as AppView,
  },
];

function getRequestedView() {
  const requestedView = new URLSearchParams(window.location.search).get("view");
  return parseAppView(requestedView);
}

export default function Home() {
  const [activeView, setActiveView] = useState<AppView>("dictionary");
  const [isContextFieldOpen, setIsContextFieldOpen] = useState(false);
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
    aiApiErrorMessage: lookupAiApiErrorMessage,
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
    onOpenHistoryItem,
    onClearHistory,
    onSubmit,
    onRetrySubmit,
    onCancelRetry,
    onSelectResultEntry,
    onStartRetryWithEntry,
    onDismissAiApiError: onDismissLookupAiApiError,
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
    aiApiErrorMessage: collectionAiApiErrorMessage,
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
    onAddDictionaryEntryToCollection,
    onCreateCollection,
    onStartEditingCollection,
    onCancelEditingCollection,
    onSaveCollectionUpdate,
    onDeleteCollection,
    onResyncCollection,
    onDismissAiApiError: onDismissCollectionAiApiError,
  } = useCollections(activeView);
  const lookupStatusBadges = buildLookupStatusBadges(result);
  const primaryEntry = resultEntries[0] ?? null;
  const primaryWordCard = wordCardsData[0] ?? null;
  const primaryCollectionState = primaryEntry
    ? getLookupEntryCollectionState(primaryEntry, result)
    : {
        canAddToCollection: false,
        addDisabledReason: "当前词条信息不完整。",
      };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setActiveView(getRequestedView());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  function handleOpenHistoryItem(item: SearchHistoryItem) {
    onOpenHistoryItem(item);
    setIsContextFieldOpen(Boolean(item.context.trim()));
  }

  const statusMessage =
    activeView === "overview"
      ? isOverviewLoading && !hasLoadedOverview
        ? "正在加载全覧。"
        : overviewError
          ? `全覧加载失败：${overviewError}`
          : overviewWords.length > 0
            ? `已打开全覧，当前已加载 ${overviewWords.length} 个词条。`
            : "已打开全覧，当前还没有内容。"
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
      <AiApiErrorModal
        message={lookupAiApiErrorMessage ?? collectionAiApiErrorMessage}
        onClose={() => {
          onDismissLookupAiApiError();
          onDismissCollectionAiApiError();
        }}
      />
      <AppHeader navItems={getTopNavigationItems("dictionary")} />

      <nav className="border-b border-border bg-surface-soft" aria-label="词典功能">
        <div className="mx-auto flex w-full max-w-[1180px] gap-1 overflow-x-auto px-[clamp(16px,4vw,40px)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VIEW_TABS.map((item) => {
            const Icon = item.icon;
            const isActive = item.view === activeView;

            return (
              <button
                key={item.label}
                type="button"
                aria-label={item.label}
                aria-current={isActive ? "page" : undefined}
                onClick={() => setActiveView(item.view)}
                className={
                  isActive
                    ? "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 border-accent px-3 text-sm font-semibold text-foreground"
                    : "inline-flex h-12 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted transition hover:text-foreground"
                }
              >
                <Icon className="size-4 shrink-0" />
                <span>{item.displayLabel}</span>
              </button>
            );
          })}
        </div>
      </nav>

      <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(24px,3vw,36px)]">
        <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
          {statusMessage}
        </p>

        <div className="mx-auto w-full max-w-[1000px]">
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
              onOpenItem={handleOpenHistoryItem}
              onClear={onClearHistory}
            />
          ) : (
            <div>
              <header className="mx-auto w-full max-w-[720px]">
                <h1 className="text-3xl leading-tight font-semibold text-foreground">
                  辞書
                </h1>
                <p className="mt-2 hidden text-sm leading-6 text-muted sm:block">
                  查询日语单词、读音、释义和自然例句。
                </p>
              </header>

              <form
                onSubmit={onSubmit}
                aria-describedby={statusId}
                className="mx-auto mt-5 w-full max-w-[720px]"
              >
                <div className="flex gap-2">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">日语词</span>
                    <SearchIcon className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" />
                    <input
                      type="search"
                      value={word}
                      onChange={(event) => setWord(event.target.value)}
                      placeholder="输入日语单词或假名"
                      aria-label="日语词"
                      className="h-12 w-full appearance-none rounded-lg border border-border bg-surface pr-4 pl-12 text-base text-foreground outline-none transition placeholder:text-muted focus:border-foreground/40 focus:ring-2 focus:ring-accent-soft"
                    />
                  </label>
                  <button
                    type="submit"
                    aria-label={isLoading ? "查询中" : "查询"}
                    disabled={!canSubmit}
                    className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <SearchIcon className="size-4" />
                    <span className="hidden sm:inline">
                      {isLoading ? "查询中" : "查询"}
                    </span>
                  </button>
                </div>

                <div className="mt-3">
                  <button
                    type="button"
                    aria-expanded={isContextFieldOpen}
                    onClick={() => setIsContextFieldOpen((isOpen) => !isOpen)}
                    className="inline-flex h-9 items-center rounded-md px-2 text-sm font-medium text-muted transition hover:bg-surface-soft hover:text-foreground"
                  >
                    {isContextFieldOpen
                      ? "收起语境"
                      : searchContextDraft.trim()
                        ? "查看已添加语境"
                        : "+ 添加语境"}
                  </button>

                  {isContextFieldOpen ? (
                    <label className="mt-2 block">
                      <span className="sr-only">查询语境</span>
                      <input
                        type="text"
                        value={searchContextDraft}
                        onChange={(event) =>
                          setSearchContextDraft(event.target.value)
                        }
                        placeholder="例如：不安を抱く、希望例句偏日常会话"
                        aria-label="查询语境"
                        className="h-11 w-full rounded-lg border border-border bg-surface px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/40 focus:ring-2 focus:ring-accent-soft"
                      />
                    </label>
                  ) : null}
                </div>
              </form>

              {!isLoading && !hasResult && !error && historyItems.length > 0 ? (
                <section className="mx-auto mt-8 w-full max-w-[720px]">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-semibold text-foreground">
                      最近查询
                    </h2>
                    <button
                      type="button"
                      onClick={() => setActiveView("history")}
                      className="inline-flex h-9 items-center rounded-md px-2 text-xs font-medium text-muted transition hover:bg-surface-soft hover:text-foreground"
                    >
                      查看全部
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {historyItems.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOpenHistoryItem(item)}
                        className="inline-flex min-h-10 items-center rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition hover:border-foreground/30"
                      >
                        {item.searchedWord}
                        <span className="ml-2 text-xs text-muted">
                          {item.result.entry.pronunciation}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {error ? (
                <div
                  role="alert"
                  className="mx-auto mt-6 w-full max-w-[720px] rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-danger"
                >
                  <p className="text-sm font-semibold">查询失败</p>
                  <p className="mt-1 text-sm leading-6">{error}</p>
                </div>
              ) : null}

              {isLoading || hasResult ? (
                <div className="mx-auto mt-6 flex w-full max-w-[720px] flex-col gap-4">
                  {showsLookupWordHint || showsContextHint ? (
                    <div className="border-l-2 border-accent pl-3">
                      {showsContextHint ? (
                        <p className="text-sm leading-6 text-muted">
                          {hasMultipleResults
                            ? `已参考语境「${activeContext}」展示更相关的候选结果`
                            : `已参考语境「${activeContext}」优先展示更匹配的结果`}
                        </p>
                      ) : null}
                      {showsLookupWordHint ? (
                        <p className="text-sm leading-6 text-muted">
                          已按原形「{result?.lookupWord}」查询
                        </p>
                      ) : null}
                      {result?.lookupReason ? (
                        <p className="mt-1 text-xs leading-5 text-muted">
                          {result?.lookupReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {lookupStatusBadges.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {lookupStatusBadges.map((badge) => (
                        <span
                          key={badge}
                          className="rounded-md border border-border bg-surface-soft px-2.5 py-1 text-xs leading-5 text-muted"
                        >
                          {badge}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {isLoading && !hasResult ? <WordCardSkeleton /> : null}

                  {hasResult && primaryWordCard && primaryEntry ? (
                    <>
                      <DictionaryResultSelector
                        entries={resultEntries}
                        selectedPronunciation={
                          result?.entry.pronunciation ?? primaryEntry.pronunciation
                        }
                        onSelectEntry={onSelectResultEntry}
                      />
                      <WordCard
                        word={primaryWordCard}
                        actions={
                          <DictionaryEntryActions
                            entry={primaryEntry}
                            canAddToCollection={
                              primaryCollectionState.canAddToCollection
                            }
                            addDisabledReason={
                              primaryCollectionState.addDisabledReason
                            }
                            collections={collections}
                            isCollectionsLoading={isCollectionsLoading}
                            onStartRetryWithEntry={onStartRetryWithEntry}
                            onEnsureCollectionsLoaded={ensureCollectionsLoaded}
                            onAddEntryToCollection={
                              onAddDictionaryEntryToCollection
                            }
                          />
                        }
                      />
                    </>
                  ) : null}

                  {hasMultipleResults && resultDifferenceNotes.length > 0 ? (
                    <details className="rounded-lg border border-border bg-surface">
                      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-foreground">
                        各结果之间的区别
                      </summary>
                      <div className="border-t border-border px-4 py-3">
                        {resultDifferenceOverview ? (
                          <p className="text-sm leading-6 text-muted">
                            {resultDifferenceOverview}
                          </p>
                        ) : null}
                        <div className="mt-3 divide-y divide-border">
                          {resultDifferenceNotes.map((note) => (
                            <div key={note.key} className="py-3 first:pt-0 last:pb-0">
                              <p className="text-sm font-medium text-foreground">
                                {note.title}
                              </p>
                              <p className="mt-1 text-sm leading-6 text-muted">
                                {note.description}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </details>
                  ) : null}

                  {isRetryPanelOpen ? (
                    <section className="rounded-lg border border-border bg-surface p-5">
                      <h2 className="text-base font-semibold text-foreground">
                        补充语境重新查询
                      </h2>
                      <form onSubmit={onRetrySubmit} className="mt-4 space-y-4">
                        {hasMultipleResults ? (
                          <fieldset className="space-y-2">
                            <legend className="text-sm font-medium text-muted">
                              选择要重查的词条
                            </legend>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {resultEntries.map((entry, index) => (
                                <label
                                  key={`${entry.word}-${entry.pronunciation}-${index}`}
                                  className={
                                    selectedRetryPronunciation ===
                                    entry.pronunciation
                                      ? "cursor-pointer rounded-lg border border-accent/35 bg-accent-soft px-4 py-3"
                                      : "cursor-pointer rounded-lg border border-border bg-surface-soft px-4 py-3 transition hover:border-foreground/30"
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
                                  <p className="text-sm font-medium text-foreground">
                                    {entry.pronunciation}
                                  </p>
                                  <p className="mt-1 truncate text-sm text-muted">
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
                          <span className="mb-2 block text-sm font-medium text-muted">
                            补充说明
                          </span>
                          <textarea
                            value={retryContext}
                            onChange={(event) => setRetryContext(event.target.value)}
                            placeholder="例如：希望释义更简单；例句偏日常会话；解释和相近词的区别。"
                            aria-label="重新查询补充说明"
                            autoFocus
                            rows={4}
                            disabled={isLoading}
                            className="min-h-28 w-full resize-y rounded-lg border border-border bg-surface-soft px-4 py-3 text-sm leading-6 text-foreground outline-none placeholder:text-muted focus:border-foreground/40 focus:ring-2 focus:ring-accent-soft disabled:cursor-not-allowed disabled:opacity-60"
                          />
                        </label>

                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="submit"
                            disabled={!canRetrySubmit}
                            className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {isLoading ? "重新查询中..." : "按补充说明重新查询"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelRetry}
                            disabled={isLoading}
                            className="inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium text-muted transition hover:bg-surface-strong hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    </section>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
