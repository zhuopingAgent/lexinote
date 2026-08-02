"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  BookIcon,
  CheckIcon,
  CopyIcon,
  LightbulbIcon,
  PlusIcon,
  TrashIcon,
} from "@/app/components/icons";
import type {
  CollectionSummary,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMessage,
  PromoteConversationLearningItemRequest,
  PromoteConversationLearningItemResponse,
} from "@/shared/types/api";

type ConversationMessageViewProps = {
  collections: CollectionSummary[];
  defaultCollectionId: number | null;
  learningItems: ConversationLearningItem[];
  memories: ConversationMemory[];
  message: ConversationMessage;
  onAnalyze: (messageId: string) => Promise<void>;
  onDismissLearningItem: (itemId: string) => Promise<void>;
  onPromoteLearningItem: (
    itemId: string,
    input: PromoteConversationLearningItemRequest
  ) => Promise<PromoteConversationLearningItemResponse>;
  onCreateCollection: (name: string) => Promise<CollectionSummary>;
  onSetDefaultCollection: (collectionId: number) => Promise<void>;
  onRetry: (message: ConversationMessage) => Promise<void>;
  onUpdateMemory: (
    memoryId: string,
    status: "active" | "dismissed"
  ) => Promise<void>;
};

function LearningItemCard({
  collections,
  defaultCollectionId,
  item,
  onDismiss,
  onPromote,
  onCreateCollection,
  onSetDefaultCollection,
}: {
  collections: CollectionSummary[];
  defaultCollectionId: number | null;
  item: ConversationLearningItem;
  onDismiss: (itemId: string) => Promise<void>;
  onPromote: (
    itemId: string,
    input: PromoteConversationLearningItemRequest
  ) => Promise<PromoteConversationLearningItemResponse>;
  onCreateCollection: (name: string) => Promise<CollectionSummary>;
  onSetDefaultCollection: (collectionId: number) => Promise<void>;
}) {
  const [collectionId, setCollectionId] = useState(
    defaultCollectionId?.toString() ?? ""
  );
  const [grammarPointId, setGrammarPointId] = useState(
    item.grammarCandidates[0]?.grammarPointId ?? ""
  );
  const [pronunciation, setPronunciation] = useState("");
  const [pronunciationOptions, setPronunciationOptions] = useState<
    NonNullable<PromoteConversationLearningItemResponse["pronunciationCandidates"]>
  >([]);
  const [isBusy, setIsBusy] = useState(false);
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function promote() {
    setIsBusy(true);
    setNotice(null);
    try {
      const response = await onPromote(item.id, {
        collectionId: collectionId ? Number(collectionId) : undefined,
        pronunciation: pronunciation || undefined,
        grammarPointId: grammarPointId || undefined,
      });
      if (makeDefault && collectionId) {
        await onSetDefaultCollection(Number(collectionId));
      }
      if (response.requiresSelection) {
        setPronunciationOptions(response.pronunciationCandidates ?? []);
        setPronunciation("");
        setNotice("请选择具体读音后再次保存。");
      } else {
        setNotice(item.kind === "grammar" ? "已加入文法复习。" : "已加入单词本。");
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败，请重试。");
    } finally {
      setIsBusy(false);
    }
  }

  async function createCollection() {
    if (!newCollectionName.trim()) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const collection = await onCreateCollection(newCollectionName.trim());
      setCollectionId(String(collection.collectionId));
      setNewCollectionName("");
      setIsCreatingCollection(false);
      setNotice("单词本已创建，可继续保存这个学习项。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "新建单词本失败。");
    } finally {
      setIsBusy(false);
    }
  }

  if (item.status === "saved") {
    return (
      <div className="flex items-center gap-2 border-t border-border py-3 text-sm text-muted">
        <CheckIcon className="size-4 text-accent-strong" />
        {item.surfaceForm} 已保存
      </div>
    );
  }

  return (
    <div className="border-t border-border py-3 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="break-words font-semibold text-foreground">
              {item.surfaceForm}
            </span>
            {item.reading ? <span className="text-xs text-muted">{item.reading}</span> : null}
            <span className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted">
              {item.kind === "vocabulary"
                ? "词汇"
                : item.kind === "expression"
                  ? "固定表达"
                  : "语法"}
            </span>
          </div>
          {item.meaningZh ? <p className="mt-1 text-sm text-foreground/68">{item.meaningZh}</p> : null}
          {item.explanationZh ? <p className="mt-1 text-xs leading-5 text-muted">{item.explanationZh}</p> : null}
        </div>
        <button type="button" aria-label={`忽略 ${item.surfaceForm}`} onClick={() => void onDismiss(item.id)} className="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted hover:bg-danger-soft hover:text-danger">
          <TrashIcon className="size-3.5" />
        </button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {item.kind === "grammar" ? (
          item.grammarCandidates.length > 0 ? (
            <select aria-label={`选择 ${item.surfaceForm} 的语法义项`} value={grammarPointId} onChange={(event) => setGrammarPointId(event.target.value)} className="h-9 min-w-0 max-w-full rounded-md border border-border bg-background px-2 text-sm">
              {item.grammarCandidates.map((candidate) => (
                <option key={candidate.grammarPointId} value={candidate.grammarPointId}>
                  {candidate.grammarPoint} · {candidate.coreMeaning}
                </option>
              ))}
            </select>
          ) : (
            <Link href="/review" className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm text-muted transition hover:text-foreground">
              前往待整理
            </Link>
          )
        ) : (
          <>
            <select aria-label={`选择 ${item.surfaceForm} 的单词本`} value={collectionId} onChange={(event) => setCollectionId(event.target.value)} className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="">选择单词本</option>
              {collections.map((collection) => (
                <option key={collection.collectionId} value={collection.collectionId}>
                  {collection.name}
                </option>
              ))}
            </select>
            <button type="button" title="新建单词本" aria-label="新建单词本" onClick={() => setIsCreatingCollection((current) => !current)} className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted transition hover:text-foreground">
              <PlusIcon className="size-4" />
            </button>
            {pronunciationOptions.length > 0 ? (
              <select aria-label={`选择 ${item.surfaceForm} 的读音`} value={pronunciation} onChange={(event) => setPronunciation(event.target.value)} className="h-9 rounded-md border border-border bg-background px-2 text-sm">
                <option value="">选择读音</option>
                {pronunciationOptions.map((candidate) => (
                  <option key={candidate.wordId} value={candidate.pronunciation}>
                    {candidate.pronunciation} · {candidate.meaningZh}
                  </option>
                ))}
              </select>
            ) : null}
          </>
        )}
        {(item.kind !== "grammar" || item.grammarCandidates.length > 0) ? (
          <button type="button" disabled={isBusy || (item.kind !== "grammar" && !collectionId)} onClick={() => void promote()} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-45">
            {item.kind === "grammar" ? <LightbulbIcon className="size-4" /> : <BookIcon className="size-4" />}
            {isBusy ? "保存中..." : item.kind === "grammar" ? "加入复习" : "加入单词本"}
          </button>
        ) : null}
      </div>
      {item.kind !== "grammar" && isCreatingCollection ? (
        <div className="mt-2 flex max-w-md gap-2">
          <input aria-label="单词本名称" value={newCollectionName} maxLength={80} onChange={(event) => setNewCollectionName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createCollection(); } }} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground/30" />
          <button type="button" disabled={isBusy || !newCollectionName.trim()} onClick={() => void createCollection()} className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold text-black disabled:opacity-45">创建</button>
        </div>
      ) : null}
      {item.kind !== "grammar" && collectionId ? (
        <label className="mt-2 inline-flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={makeDefault} onChange={(event) => setMakeDefault(event.target.checked)} />
          设为默认单词本
        </label>
      ) : null}
      {notice ? <p className="mt-2 text-xs leading-5 text-muted">{notice}</p> : null}
    </div>
  );
}

export function ConversationMessageView({
  collections,
  defaultCollectionId,
  learningItems,
  memories,
  message,
  onAnalyze,
  onCreateCollection,
  onDismissLearningItem,
  onPromoteLearningItem,
  onRetry,
  onSetDefaultCollection,
  onUpdateMemory,
}: ConversationMessageViewProps) {
  const [copied, setCopied] = useState(false);
  const messageLearningItems = useMemo(
    () => learningItems.filter((item) => item.sourceMessageId === message.id && item.status !== "dismissed"),
    [learningItems, message.id]
  );
  const messageMemories = useMemo(
    () => memories.filter((memory) => memory.sourceMessageId === message.id && memory.status === "suggested"),
    [memories, message.id]
  );
  const hasDetails = Boolean(
    message.details.literalTranslation ||
      message.details.nuanceNotes.length ||
      message.details.keyPoints.length
  );

  if (message.role === "user") {
    return (
      <div className="flex justify-end py-3">
        <div className="max-w-[min(84%,680px)] whitespace-pre-wrap break-words rounded-lg bg-surface-strong px-4 py-3 text-[15px] leading-7 text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <article className="py-5" aria-busy={message.status === "streaming"}>
      <div className="flex gap-3">
        <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-md border border-accent/35 bg-accent-soft text-xs font-semibold text-accent-strong">L</div>
        <div className="min-w-0 flex-1">
          <div className="whitespace-pre-wrap break-words text-[15px] leading-7 text-foreground/88">
            {message.content || (message.status === "streaming" ? "正在思考..." : "")}
          </div>

          {message.status === "failed" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-danger">
              <span>{message.errorMessage || "回答生成失败。"}</span>
              <button type="button" onClick={() => void onRetry(message)} className="rounded-md border border-danger/30 px-3 py-1.5 text-xs transition hover:bg-danger-soft">重试</button>
            </div>
          ) : null}
          {message.status === "cancelled" ? <p className="mt-2 text-xs text-muted">回答已停止</p> : null}

          {hasDetails ? (
            <details className="mt-4 border-y border-border py-3">
              <summary className="cursor-pointer text-sm font-medium text-muted transition hover:text-foreground">翻译与表达说明</summary>
              <div className="mt-3 space-y-3 text-sm leading-6 text-foreground/72">
                {message.details.literalTranslation ? <div><p className="text-xs font-semibold text-muted">直译</p><p className="mt-1">{message.details.literalTranslation}</p></div> : null}
                {message.details.nuanceNotes.length > 0 ? <div><p className="text-xs font-semibold text-muted">语气差异</p>{message.details.nuanceNotes.map((note) => <p key={note} className="mt-1">{note}</p>)}</div> : null}
                {message.details.keyPoints.length > 0 ? <div><p className="text-xs font-semibold text-muted">学习重点</p>{message.details.keyPoints.map((point) => <p key={point} className="mt-1">{point}</p>)}</div> : null}
              </div>
            </details>
          ) : null}

          {message.analysisStatus === "failed" ? (
            <button type="button" onClick={() => void onAnalyze(message.id)} className="mt-3 rounded-md border border-border px-3 py-1.5 text-xs text-muted transition hover:text-foreground">重新提取学习项</button>
          ) : null}
          {message.analysisStatus === "running" || message.analysisStatus === "pending" ? <p className="mt-3 text-xs text-muted">正在整理学习项...</p> : null}

          {messageLearningItems.length > 0 ? (
            <div className="mt-4 border-y border-border px-1">
              {messageLearningItems.map((item) => (
                <LearningItemCard key={item.id} item={item} collections={collections} defaultCollectionId={defaultCollectionId} onDismiss={onDismissLearningItem} onPromote={onPromoteLearningItem} onCreateCollection={onCreateCollection} onSetDefaultCollection={onSetDefaultCollection} />
              ))}
            </div>
          ) : null}

          {messageMemories.length > 0 ? (
            <div className="mt-4 space-y-2">
              {messageMemories.map((memory) => (
                <div key={memory.id} className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-surface-soft px-3 py-2 text-xs text-muted">
                  <span className="min-w-0 flex-1">记忆建议：{memory.content}</span>
                  <button type="button" onClick={() => void onUpdateMemory(memory.id, "active")} className="rounded px-2 py-1 font-semibold text-accent-strong hover:bg-accent-soft">确认</button>
                  <button type="button" onClick={() => void onUpdateMemory(memory.id, "dismissed")} className="rounded px-2 py-1 hover:bg-surface-strong">忽略</button>
                </div>
              ))}
            </div>
          ) : null}

          {message.content ? (
            <button
              type="button"
              aria-label="复制回答"
              onClick={async () => {
                await navigator.clipboard.writeText(message.content);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
              className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition hover:bg-surface-strong hover:text-foreground"
            >
              <CopyIcon className="size-3.5" />
              {copied ? "已复制" : "复制"}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}
