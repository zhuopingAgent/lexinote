"use client";

import type { FormEvent, KeyboardEvent, MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { CollectionSummary } from "@/shared/types/api";

type CollectionPanelProps = {
  collections: CollectionSummary[];
  collectionName: string;
  editingCollectionId: number | null;
  editingCollectionName: string;
  editingCollectionAutoFilterEnabled: boolean;
  editingCollectionAutoFilterCriteria: string;
  error: string | null;
  isLoading: boolean;
  isCreating: boolean;
  busyCollectionId: number | null;
  onCollectionNameChange: (value: string) => void;
  onCreateCollection: (event: FormEvent<HTMLFormElement>) => Promise<void>;
  onStartEditing: (collection: CollectionSummary) => void;
  onEditingCollectionNameChange: (value: string) => void;
  onEditingCollectionAutoFilterEnabledChange: (value: boolean) => void;
  onEditingCollectionAutoFilterCriteriaChange: (value: string) => void;
  onCancelEditing: () => void;
  onSaveEditing: (event: FormEvent<HTMLFormElement>, collectionId: number) => Promise<void>;
  onDeleteCollection: (collectionId: number) => Promise<void>;
};

function formatWordCount(count: number) {
  return `${count} 个单词`;
}

function getAutoFilterStatusLabel(collection: CollectionSummary) {
  if (!collection.autoFilterEnabled || !collection.autoFilterCriteria.trim()) {
    return null;
  }

  switch (collection.autoFilterSyncStatus) {
    case "pending":
      return { text: "待同步", tone: "text-amber-300 border-amber-400/20 bg-amber-500/10" };
    case "running":
      return { text: "同步中", tone: "text-sky-300 border-sky-400/20 bg-sky-500/10" };
    case "failed":
      return { text: "同步失败", tone: "text-danger border-danger/30 bg-danger-soft/60" };
    case "completed":
      return { text: "已同步", tone: "text-emerald-300 border-emerald-400/20 bg-emerald-500/10" };
    default:
      return { text: "已开启", tone: "text-white/52 border-white/10 bg-white/6" };
  }
}

function getAutoFilterStatusHint(collection: CollectionSummary) {
  if (!collection.autoFilterEnabled || !collection.autoFilterCriteria.trim()) {
    return null;
  }

  switch (collection.autoFilterSyncStatus) {
    case "pending":
      return "已保存筛选条件，正在排队同步词条。";
    case "running":
      return "AI 正在根据筛选条件整理这个 collection。";
    case "failed":
      return collection.autoFilterLastError || "上一次自动筛选失败，请稍后再试。";
    case "completed":
      return collection.autoFilterLastRunAt
        ? "最近一次自动筛选已经完成。"
        : "AI 自动筛选已开启。";
    default:
      return "AI 自动筛选已开启。";
  }
}

export function CollectionPanel({
  collections,
  collectionName,
  editingCollectionId,
  editingCollectionName,
  editingCollectionAutoFilterEnabled,
  editingCollectionAutoFilterCriteria,
  error,
  isLoading,
  isCreating,
  busyCollectionId,
  onCollectionNameChange,
  onCreateCollection,
  onStartEditing,
  onEditingCollectionNameChange,
  onEditingCollectionAutoFilterEnabledChange,
  onEditingCollectionAutoFilterCriteriaChange,
  onCancelEditing,
  onSaveEditing,
  onDeleteCollection,
}: CollectionPanelProps) {
  const router = useRouter();
  const showsEmptyState = !isLoading && collections.length === 0;

  function onOpenCollection(collectionId: number) {
    router.push(`/collections/detail?collectionId=${collectionId}`);
  }

  function onCardKeyDown(
    event: KeyboardEvent<HTMLDivElement>,
    collectionId: number
  ) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    onOpenCollection(collectionId);
  }

  function stopCardNavigation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  return (
    <div className="mx-auto w-full max-w-[848px]">
      <div className="rounded-[clamp(18px,2vw,22px)] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.5vw,24px)]">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-lg font-medium tracking-[-0.03em] text-white/72">
              コレクション
            </p>
            <p className="mt-1 text-sm leading-6 text-white/40">
              新建、重命名或删除你的单词集合。每个集合会显示当前收录的单词数量。
            </p>
          </div>
          <p className="text-sm text-white/35">共 {collections.length} 个集合</p>
        </div>

        <form
          onSubmit={onCreateCollection}
          className="mt-5 flex flex-col gap-3 sm:flex-row"
        >
          <input
            type="text"
            value={collectionName}
            onChange={(event) => onCollectionNameChange(event.target.value)}
            placeholder="输入新 collection 名称，例如：易混词 / 商务表达 / JLPT N2"
            aria-label="新建 collection"
            disabled={isCreating}
            className="h-12 flex-1 rounded-[14px] border border-white/12 bg-[#151515cc] px-4 text-sm text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={isCreating || collectionName.trim().length === 0}
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-[14px] bg-white/10 px-5 text-sm font-medium text-white/74 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {isCreating ? "创建中..." : "新增コレクション"}
          </button>
        </form>
      </div>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft/80 px-5 py-4 text-danger"
        >
          <p className="text-sm font-semibold">Collection 操作失败</p>
          <p className="mt-1 text-sm leading-6">{error}</p>
        </div>
      ) : null}

      {isLoading && collections.length === 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[180px] animate-pulse rounded-[20px] border border-white/8 bg-[#1a1a1a99] p-5"
            >
              <div className="h-5 w-20 rounded bg-white/10" />
              <div className="mt-4 h-7 w-36 rounded bg-white/12" />
              <div className="mt-3 h-4 w-24 rounded bg-white/8" />
              <div className="mt-8 flex gap-2">
                <div className="h-9 w-16 rounded-full bg-white/8" />
                <div className="h-9 w-16 rounded-full bg-white/6" />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {showsEmptyState ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">还没有 collection</p>
          <p className="mt-2 text-sm leading-6 text-white/38">
            先创建一个集合，后面我们再把查询到的词条加进去。
          </p>
        </div>
      ) : null}

      {collections.length > 0 ? (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {collections.map((collection) => {
            const isEditing = editingCollectionId === collection.collectionId;
            const isBusy = busyCollectionId === collection.collectionId;
            const autoFilterStatus = getAutoFilterStatusLabel(collection);
            const autoFilterStatusHint = getAutoFilterStatusHint(collection);

            return (
              <div
                key={collection.collectionId}
                role={isEditing ? undefined : "link"}
                tabIndex={isEditing ? undefined : 0}
                onClick={
                  isEditing ? undefined : () => onOpenCollection(collection.collectionId)
                }
                onKeyDown={
                  isEditing
                    ? undefined
                    : (event) => onCardKeyDown(event, collection.collectionId)
                }
                className={
                  isEditing
                    ? "flex min-h-[176px] flex-col rounded-[20px] border border-white/10 bg-[#1e1e1ecc] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)]"
                    : "flex min-h-[176px] cursor-pointer flex-col rounded-[20px] border border-white/10 bg-[#1e1e1ecc] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.18)] transition hover:border-white/16 hover:bg-[#232323f0] focus:outline-none focus:ring-2 focus:ring-white/14"
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs uppercase tracking-[0.18em] text-white/28">
                      Collection
                    </p>
                    {isEditing ? (
                      <form
                        onSubmit={(event) =>
                          onSaveEditing(event, collection.collectionId)
                        }
                        onClick={stopCardNavigation}
                        className="mt-4 space-y-3"
                      >
                        <input
                          type="text"
                          value={editingCollectionName}
                          onChange={(event) =>
                            onEditingCollectionNameChange(event.target.value)
                          }
                          autoFocus
                          disabled={isBusy}
                          aria-label="编辑 collection 名称"
                          className="h-11 w-full rounded-[14px] border border-white/14 bg-[#151515cc] px-4 text-sm text-white/78 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                        />
                        <div className="rounded-[16px] border border-white/10 bg-[#171717cc] p-4">
                          <label className="flex items-center gap-3 text-sm text-white/72">
                            <input
                              type="checkbox"
                              checked={editingCollectionAutoFilterEnabled}
                              onChange={(event) =>
                                onEditingCollectionAutoFilterEnabledChange(
                                  event.target.checked
                                )
                              }
                              disabled={isBusy}
                              className="size-4 rounded border-white/20 bg-transparent accent-white/80 disabled:cursor-not-allowed"
                            />
                            <span>开启 AI 自动筛选</span>
                          </label>
                          <p className="mt-2 text-xs leading-5 text-white/34">
                            保存后会先扫描现有词条，之后每次有新单词入库时，也会按这里的条件自动加入这个 collection。
                          </p>

                          {editingCollectionAutoFilterEnabled ? (
                            <textarea
                              value={editingCollectionAutoFilterCriteria}
                              onChange={(event) =>
                                onEditingCollectionAutoFilterCriteriaChange(
                                  event.target.value
                                )
                              }
                              disabled={isBusy}
                              rows={4}
                              placeholder="例如：收录 JLPT N3 常见词；偏日常使用；不要专有名词；优先动词和形容词。"
                              aria-label="AI 自动筛选条件"
                              className="mt-3 w-full rounded-[14px] border border-white/12 bg-[#111111cc] px-4 py-3 text-sm leading-6 text-white/74 outline-none placeholder:text-white/28 focus:border-white/24 focus:ring-2 focus:ring-white/10 disabled:cursor-not-allowed disabled:opacity-60"
                            />
                          ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="submit"
                            disabled={
                              isBusy ||
                              editingCollectionName.trim().length === 0 ||
                              (editingCollectionAutoFilterEnabled &&
                                editingCollectionAutoFilterCriteria.trim().length === 0)
                            }
                            className="inline-flex h-10 items-center justify-center rounded-full bg-white/10 px-4 text-sm text-white/72 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            {isBusy
                              ? editingCollectionAutoFilterEnabled
                                ? "保存并筛选中..."
                                : "保存中..."
                              : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={onCancelEditing}
                            disabled={isBusy}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/48 transition hover:border-white/18 hover:text-white/62 disabled:cursor-not-allowed disabled:opacity-45"
                          >
                            取消
                          </button>
                        </div>
                      </form>
                    ) : (
                      <>
                        <p className="mt-4 truncate text-[22px] font-medium tracking-[-0.04em] text-white/76">
                          {collection.name}
                        </p>
                        {autoFilterStatus ? (
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs ${autoFilterStatus.tone}`}
                            >
                              {autoFilterStatus.text}
                            </span>
                          </div>
                        ) : null}
                        {autoFilterStatusHint ? (
                          <p className="mt-2 text-xs leading-5 text-white/36">
                            {autoFilterStatusHint}
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>

                  <div className="inline-flex min-h-10 items-center rounded-full border border-white/10 bg-white/6 px-3 text-sm font-medium text-white/58">
                    {formatWordCount(collection.wordCount)}
                  </div>
                </div>

                {!isEditing ? (
                  <div className="mt-auto flex flex-wrap gap-2 border-t border-white/8 pt-4">
                    <button
                      type="button"
                      onClick={(event) => {
                        stopCardNavigation(event);
                        onStartEditing(collection);
                      }}
                      disabled={isBusy}
                      className="inline-flex h-10 items-center justify-center rounded-full bg-white/8 px-4 text-sm text-white/68 transition hover:bg-white/12 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        stopCardNavigation(event);
                        void onDeleteCollection(collection.collectionId);
                      }}
                      disabled={isBusy}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/48 transition hover:border-white/18 hover:text-white/62 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {isBusy ? "删除中..." : "删除"}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
