"use client";

import { useId, useState } from "react";
import { CollectionIcon, SearchIcon } from "@/app/components/icons";
import { getErrorMessage } from "@/app/lib/api-client";
import type { CollectionSummary, DictionaryEntry } from "@/shared/types/api";

type DictionaryEntryActionsProps = {
  entry: DictionaryEntry;
  isIncomplete?: boolean;
  canAddToCollection: boolean;
  addDisabledReason?: string;
  collections: CollectionSummary[];
  isCollectionsLoading: boolean;
  onStartRetryWithEntry: (entry: DictionaryEntry) => void;
  onEnsureCollectionsLoaded: () => Promise<void>;
  onAddEntryToCollection: (
    collectionId: number,
    word: string,
    pronunciation: string
  ) => Promise<"added" | "already_exists">;
};

export function DictionaryEntryActions({
  entry,
  isIncomplete = false,
  canAddToCollection,
  addDisabledReason,
  collections,
  isCollectionsLoading,
  onStartRetryWithEntry,
  onEnsureCollectionsLoaded,
  onAddEntryToCollection,
}: DictionaryEntryActionsProps) {
  const noticeId = useId();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPreparingCollections, setIsPreparingCollections] = useState(false);
  const [busyCollectionId, setBusyCollectionId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const unavailableReason = !canAddToCollection
    ? addDisabledReason ?? "当前结果还不能加入单词本。"
    : null;
  const displayedNotice = unavailableReason ?? notice;
  const entryAccessibleName = isIncomplete
    ? entry.word
    : `${entry.word} ${entry.pronunciation}`;

  async function onTogglePicker() {
    setNotice(null);

    if (!canAddToCollection) {
      return;
    }

    if (isPickerOpen) {
      setIsPickerOpen(false);
      return;
    }

    if (collections.length === 0) {
      setIsPreparingCollections(true);
      try {
        await onEnsureCollectionsLoaded();
      } catch (loadError) {
        setNotice(getErrorMessage(loadError, "加载单词本失败，请稍后再试。"));
        return;
      } finally {
        setIsPreparingCollections(false);
      }
    }

    setIsPickerOpen(true);
  }

  async function onSelectCollection(collectionId: number) {
    setBusyCollectionId(collectionId);
    setNotice(null);

    try {
      const status = await onAddEntryToCollection(
        collectionId,
        entry.word,
        entry.pronunciation
      );
      setNotice(
        status === "added"
          ? "已加入所选单词本。"
          : "这个词条已经在所选单词本中。"
      );
      setIsPickerOpen(false);
    } catch (actionError) {
      setNotice(getErrorMessage(actionError, "添加失败，请稍后再试。"));
    } finally {
      setBusyCollectionId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void onTogglePicker()}
          disabled={Boolean(unavailableReason) || isPreparingCollections || isCollectionsLoading}
          aria-expanded={isPickerOpen}
          aria-describedby={displayedNotice ? noticeId : undefined}
          aria-label={`${isPickerOpen ? "收起单词本" : "加入单词本"} ${entryAccessibleName}`}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-transparent bg-accent px-4 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:border-border disabled:bg-surface-strong disabled:text-muted disabled:opacity-100"
        >
          <CollectionIcon className="size-4" />
          {isPickerOpen ? "收起单词本" : "加入单词本"}
        </button>
        <button
          type="button"
          onClick={() => onStartRetryWithEntry(entry)}
          aria-label={
            isIncomplete
              ? `补充语境重新查询 ${entry.word}`
              : `按此读音重查 ${entry.word} ${entry.pronunciation}`
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-4 text-sm font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
        >
          <SearchIcon className="size-4" />
          补充语境
        </button>
      </div>

      {isPickerOpen ? (
        <div className="border-t border-border pt-3">
          {isPreparingCollections || isCollectionsLoading ? (
            <p className="text-sm leading-6 text-muted">正在加载单词本...</p>
          ) : collections.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {collections.map((collection) => (
                <button
                  key={collection.collectionId}
                  type="button"
                  onClick={() => void onSelectCollection(collection.collectionId)}
                  disabled={busyCollectionId !== null}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface-strong px-3 text-sm text-foreground transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyCollectionId === collection.collectionId
                    ? "添加中..."
                    : collection.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted">
              还没有单词本，先创建一个再回来添加。
            </p>
          )}
        </div>
      ) : null}

      {displayedNotice ? (
        <p id={noticeId} className="text-sm leading-6 text-muted">
          {displayedNotice}
        </p>
      ) : null}
    </div>
  );
}
