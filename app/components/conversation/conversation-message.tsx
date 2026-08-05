"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BookIcon,
  CheckIcon,
  CopyIcon,
  LightbulbIcon,
  PlusIcon,
  TrashIcon,
} from "@/app/components/icons";
import { getErrorMessage } from "@/app/lib/api-client";
import type { CollectionSummary } from "@/shared/types/collections";
import type {
  ConversationAnalysis,
  ConversationAnalysisFocus,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMessage,
  PromoteConversationLearningItemRequest,
  PromoteConversationLearningItemResponse,
} from "@/shared/types/conversation";

type ConversationMessageViewProps = {
  analyses: ConversationAnalysis[];
  analysisError: string | null;
  collections: CollectionSummary[];
  defaultCollectionId: number | null;
  learningItems: ConversationLearningItem[];
  memories: ConversationMemory[];
  message: ConversationMessage;
  isAnalyzing: boolean;
  onAnalyze: (
    messageId: string,
    input: { focus: ConversationAnalysisFocus; instruction: string }
  ) => Promise<void>;
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

const ANALYSIS_FOCUS_OPTIONS: Array<{
  value: ConversationAnalysisFocus;
  label: string;
}> = [
  { value: "all", label: "综合" },
  { value: "grammar", label: "语法" },
  { value: "vocabulary", label: "词汇" },
  { value: "expressions", label: "表达" },
];

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
  const previousDefaultCollectionIdRef = useRef(defaultCollectionId);

  useEffect(() => {
    const previousDefault = previousDefaultCollectionIdRef.current?.toString() ?? "";
    const nextDefault = defaultCollectionId?.toString() ?? "";
    setCollectionId((current) =>
      !current || current === previousDefault ? nextDefault : current
    );
    previousDefaultCollectionIdRef.current = defaultCollectionId;
  }, [defaultCollectionId]);

  const isSelectedCollectionDefault =
    Boolean(collectionId) && Number(collectionId) === defaultCollectionId;

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
      setNotice(getErrorMessage(error, "保存失败，请重试。"));
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
      setNotice(getErrorMessage(error, "新建单词本失败。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function dismiss() {
    setIsBusy(true);
    setNotice(null);
    try {
      await onDismiss(item.id);
    } catch (error) {
      setNotice(getErrorMessage(error, "忽略失败，请重试。"));
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
        <button type="button" aria-label={`忽略 ${item.surfaceForm}`} disabled={isBusy} onClick={() => void dismiss()} className="inline-flex size-8 shrink-0 items-center justify-center rounded text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-45">
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
            <select aria-label={`选择 ${item.surfaceForm} 的单词本`} value={collectionId} onChange={(event) => { setCollectionId(event.target.value); setMakeDefault(false); }} className="h-9 max-w-full rounded-md border border-border bg-background px-2 text-sm">
              <option value="">选择单词本</option>
              {collections.map((collection) => (
                <option key={collection.collectionId} value={collection.collectionId}>
                  {collection.name}
                </option>
              ))}
            </select>
            <button type="button" title="新建单词本" aria-label="新建单词本" disabled={isBusy} onClick={() => setIsCreatingCollection((current) => !current)} className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45">
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
          <input aria-label="单词本名称" value={newCollectionName} disabled={isBusy} maxLength={80} onChange={(event) => setNewCollectionName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void createCollection(); } }} className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-55" />
          <button type="button" disabled={isBusy || !newCollectionName.trim()} onClick={() => void createCollection()} className="inline-flex h-9 items-center rounded-md bg-accent px-3 text-sm font-semibold text-black disabled:opacity-45">创建</button>
        </div>
      ) : null}
      {item.kind !== "grammar" && isSelectedCollectionDefault ? (
        <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted">
          <CheckIcon className="size-3.5 text-accent-strong" />
          默认单词本
        </p>
      ) : item.kind !== "grammar" && collectionId ? (
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
  analyses,
  analysisError,
  collections,
  defaultCollectionId,
  learningItems,
  memories,
  message,
  isAnalyzing,
  onAnalyze,
  onCreateCollection,
  onDismissLearningItem,
  onPromoteLearningItem,
  onRetry,
  onSetDefaultCollection,
  onUpdateMemory,
}: ConversationMessageViewProps) {
  const [copied, setCopied] = useState(false);
  const [isAnalysisFormOpen, setIsAnalysisFormOpen] = useState(false);
  const [analysisFocus, setAnalysisFocus] =
    useState<ConversationAnalysisFocus>("all");
  const [analysisInstruction, setAnalysisInstruction] = useState("");
  const [busyMemoryId, setBusyMemoryId] = useState<string | null>(null);
  const [memoryError, setMemoryError] = useState<string | null>(null);
  const messageAnalyses = useMemo(
    () =>
      analyses
        .filter((analysis) => analysis.messageId === message.id)
        .sort((left, right) => left.revision - right.revision),
    [analyses, message.id]
  );
  const currentAnalysis =
    messageAnalyses.findLast((analysis) => analysis.isCurrent) ?? null;
  const latestAnalysis = messageAnalyses.at(-1) ?? null;
  const displayedAnalysisError = isAnalyzing
    ? null
    : analysisError ??
      (latestAnalysis?.status === "failed"
        ? latestAnalysis.errorMessage || "上次学习分析失败，请重试。"
        : null);
  const messageLearningItems = useMemo(
    () =>
      learningItems.filter(
        (item) =>
          item.sourceMessageId === message.id &&
          item.status !== "dismissed" &&
          (item.status === "saved" ||
            item.analysisId === currentAnalysis?.id ||
            (item.analysisId === null && currentAnalysis === null))
      ),
    [currentAnalysis, learningItems, message.id]
  );
  const messageMemories = useMemo(
    () => memories.filter((memory) => memory.sourceMessageId === message.id && memory.status === "suggested"),
    [memories, message.id]
  );
  async function updateSuggestedMemory(
    memoryId: string,
    status: "active" | "dismissed"
  ) {
    setBusyMemoryId(memoryId);
    setMemoryError(null);
    try {
      await onUpdateMemory(memoryId, status);
    } catch (error) {
      setMemoryError(getErrorMessage(error, "记忆更新失败，请重试。"));
    } finally {
      setBusyMemoryId(null);
    }
  }

  async function submitAnalysis() {
    await onAnalyze(message.id, {
      focus: analysisFocus,
      instruction: analysisInstruction.trim(),
    });
    setIsAnalysisFormOpen(false);
  }

  function openAnalysisForm(analysis?: ConversationAnalysis | null) {
    if (analysis) {
      setAnalysisFocus(analysis.focus);
      setAnalysisInstruction(analysis.instruction);
    }
    setIsAnalysisFormOpen(true);
  }

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
          {message.status === "cancelled" ? (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
              <span>回答已停止</span>
              <button type="button" onClick={() => void onRetry(message)} className="rounded-md border border-border px-3 py-1.5 transition hover:text-foreground">
                重新生成
              </button>
            </div>
          ) : null}

          {isAnalysisFormOpen ? (
            <div className="mt-4 border-y border-border py-4">
              <div className="flex flex-wrap gap-2" role="group" aria-label="学习分析范围">
                {ANALYSIS_FOCUS_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    disabled={isAnalyzing}
                    aria-pressed={analysisFocus === option.value}
                    onClick={() => setAnalysisFocus(option.value)}
                    className={`h-8 rounded-md border px-3 text-xs transition ${analysisFocus === option.value ? "border-accent bg-accent-soft text-accent-strong" : "border-border text-muted hover:text-foreground"}`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <textarea
                aria-label="分析意图"
                value={analysisInstruction}
                disabled={isAnalyzing}
                maxLength={1000}
                rows={2}
                onChange={(event) => setAnalysisInstruction(event.target.value)}
                placeholder="补充希望关注或排除的内容"
                className="mt-3 min-h-20 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none focus:border-foreground/30 disabled:opacity-55"
              />
              <div className="mt-3 flex items-center gap-2">
                <button type="button" disabled={isAnalyzing} onClick={() => void submitAnalysis()} className="inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-wait disabled:opacity-50">
                  <LightbulbIcon className="size-4" />
                  {isAnalyzing ? "分析中..." : currentAnalysis ? "重新分析" : "开始分析"}
                </button>
                <button type="button" disabled={isAnalyzing} onClick={() => setIsAnalysisFormOpen(false)} className="h-9 rounded-md px-3 text-sm text-muted transition hover:bg-surface-strong hover:text-foreground disabled:opacity-50">
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {isAnalyzing && !isAnalysisFormOpen ? (
            <p className="mt-3 text-xs text-muted">正在按你的要求分析...</p>
          ) : null}
          {displayedAnalysisError ? (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-danger">
              <span>{displayedAnalysisError}</span>
              <button type="button" onClick={() => openAnalysisForm(latestAnalysis)} className="rounded-md border border-danger/30 px-2 py-1 transition hover:bg-danger-soft">调整后重试</button>
            </div>
          ) : null}

          {currentAnalysis ? (
            <section className="mt-4 border-y border-border py-4" aria-label="学习分析">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground/80">学习分析</h3>
                <button type="button" disabled={isAnalyzing} onClick={() => openAnalysisForm(currentAnalysis)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition hover:bg-surface-strong hover:text-foreground disabled:opacity-45">
                  <LightbulbIcon className="size-3.5" />
                  调整分析
                </button>
              </div>
              {currentAnalysis.instruction ? <p className="mt-2 text-xs text-muted">分析意图：{currentAnalysis.instruction}</p> : null}
              {currentAnalysis.overview ? <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/72">{currentAnalysis.overview}</p> : null}
              {messageLearningItems.length > 0 ? (
                <div className="mt-3 px-1">
                  {messageLearningItems.map((item) => (
                    <LearningItemCard key={item.id} item={item} collections={collections} defaultCollectionId={defaultCollectionId} onDismiss={onDismissLearningItem} onPromote={onPromoteLearningItem} onCreateCollection={onCreateCollection} onSetDefaultCollection={onSetDefaultCollection} />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-xs text-muted">这次分析没有发现值得保存的学习项。</p>
              )}
            </section>
          ) : messageLearningItems.length > 0 ? (
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
                  <button type="button" aria-label={`确认记忆建议：${memory.content}`} disabled={busyMemoryId === memory.id} onClick={() => void updateSuggestedMemory(memory.id, "active")} className="rounded px-2 py-1 font-semibold text-accent-strong hover:bg-accent-soft disabled:opacity-45">确认</button>
                  <button type="button" aria-label={`忽略记忆建议：${memory.content}`} disabled={busyMemoryId === memory.id} onClick={() => void updateSuggestedMemory(memory.id, "dismissed")} className="rounded px-2 py-1 hover:bg-surface-strong disabled:opacity-45">忽略</button>
                </div>
              ))}
              {memoryError ? <p role="alert" className="text-xs text-danger">{memoryError}</p> : null}
            </div>
          ) : null}

          {message.content ? (
            <div className="mt-3 flex flex-wrap items-center gap-1">
              <button
                type="button"
                aria-label="复制回答"
                onClick={async () => {
                  await navigator.clipboard.writeText(message.content);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1200);
                }}
                className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition hover:bg-surface-strong hover:text-foreground"
              >
                <CopyIcon className="size-3.5" />
                {copied ? "已复制" : "复制"}
              </button>
              {message.status === "completed" && !currentAnalysis ? (
                <button type="button" disabled={isAnalyzing} onClick={() => openAnalysisForm(latestAnalysis)} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs text-muted transition hover:bg-surface-strong hover:text-foreground disabled:opacity-45">
                  <LightbulbIcon className="size-3.5" />
                  学习分析
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}
