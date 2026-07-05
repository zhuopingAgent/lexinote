"use client";

import { useState } from "react";
import type { CollectionSummary, DictionaryEntry } from "@/shared/types/api";

type DictionaryEntryActionsProps = {
  entry: DictionaryEntry;
  isPrimary: boolean;
  canAddToCollection: boolean;
  addDisabledReason?: string;
  collections: CollectionSummary[];
  isCollectionsLoading: boolean;
  onSelectEntry: (entry: DictionaryEntry) => void;
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
  isPrimary,
  canAddToCollection,
  addDisabledReason,
  collections,
  isCollectionsLoading,
  onSelectEntry,
  onStartRetryWithEntry,
  onEnsureCollectionsLoaded,
  onAddEntryToCollection,
}: DictionaryEntryActionsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isPreparingCollections, setIsPreparingCollections] = useState(false);
  const [busyCollectionId, setBusyCollectionId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function onTogglePicker() {
    setNotice(null);

    if (!canAddToCollection) {
      setNotice(addDisabledReason ?? "当前结果还不能加入 collection。");
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
        setNotice(
          loadError instanceof Error
            ? loadError.message
            : "加载 collection 失败，请稍后再试。"
        );
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
          ? "已加入所选 collection。"
          : "这个词条已经在所选 collection 中。"
      );
      setIsPickerOpen(false);
    } catch (actionError) {
      setNotice(
        actionError instanceof Error ? actionError.message : "添加失败，请稍后再试。"
      );
    } finally {
      setBusyCollectionId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectEntry(entry)}
          disabled={isPrimary}
          aria-label={`${isPrimary ? "当前词条" : "选择这个词条"} ${entry.word} ${entry.pronunciation}`}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 px-3 text-sm text-white/58 transition hover:border-white/18 hover:bg-white/5 hover:text-white/72 disabled:cursor-default disabled:border-white/8 disabled:text-white/30"
        >
          {isPrimary ? "当前词条" : "选择这个词条"}
        </button>
        <button
          type="button"
          onClick={() => onStartRetryWithEntry(entry)}
          aria-label={`按此读音重查 ${entry.word} ${entry.pronunciation}`}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 px-3 text-sm text-white/58 transition hover:border-white/18 hover:bg-white/5 hover:text-white/72"
        >
          按此读音重查
        </button>
        <button
          type="button"
          onClick={() => void onTogglePicker()}
          disabled={isPreparingCollections || isCollectionsLoading}
          aria-expanded={isPickerOpen}
          aria-label={`${isPickerOpen ? "收起 collection" : "加入 collection"} ${entry.word} ${entry.pronunciation}`}
          className="inline-flex h-9 items-center justify-center rounded-full border border-white/10 px-3 text-sm text-white/58 transition hover:border-white/18 hover:bg-white/5 hover:text-white/72 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isPickerOpen ? "收起 collection" : "加入 collection"}
        </button>
      </div>

      {isPickerOpen ? (
        <div className="rounded-[14px] border border-white/8 bg-[#15151599] p-3">
          {isPreparingCollections || isCollectionsLoading ? (
            <p className="text-sm leading-6 text-white/42">正在加载 collections...</p>
          ) : collections.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {collections.map((collection) => (
                <button
                  key={collection.collectionId}
                  type="button"
                  onClick={() => void onSelectCollection(collection.collectionId)}
                  disabled={busyCollectionId !== null}
                  className="inline-flex h-9 items-center justify-center rounded-full bg-white/8 px-3 text-sm text-white/66 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {busyCollectionId === collection.collectionId
                    ? "添加中..."
                    : collection.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm leading-6 text-white/42">
              还没有 collection，先创建一个再回来添加。
            </p>
          )}
        </div>
      ) : null}

      {notice ? <p className="text-sm leading-6 text-white/42">{notice}</p> : null}
    </div>
  );
}
