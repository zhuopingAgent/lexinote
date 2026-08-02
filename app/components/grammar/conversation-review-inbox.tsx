"use client";

import { useEffect, useState } from "react";
import { SearchIcon, TrashIcon } from "@/app/components/icons";
import { getErrorMessage, readJson } from "@/app/lib/api-client";
import type {
  ConversationGrammarCandidate,
  ConversationLearningItem,
  ConversationReviewInboxResponse,
  GrammarSearchResponse,
  PromoteConversationLearningItemResponse,
} from "@/shared/types/api";

function InboxItem({
  item,
  onDismissed,
  onSaved,
}: {
  item: ConversationLearningItem;
  onDismissed: (itemId: string) => void;
  onSaved: (itemId: string) => void;
}) {
  const [candidates, setCandidates] = useState(item.grammarCandidates);
  const [selectedId, setSelectedId] = useState(
    item.grammarCandidates[0]?.grammarPointId ?? ""
  );
  const [search, setSearch] = useState(item.surfaceForm);
  const [isBusy, setIsBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function searchGrammar() {
    if (!search.trim()) return;
    setIsBusy(true);
    setNotice(null);
    try {
      const result = await fetch(
        `/api/grammar?query=${encodeURIComponent(search.trim())}&limit=5`
      ).then((response) => readJson<GrammarSearchResponse>(response));
      const nextCandidates: ConversationGrammarCandidate[] = result.items.map(
        (candidate) => ({
          grammarPointId: candidate.id,
          grammarPoint: candidate.grammarPoint,
          canonicalForm: candidate.canonicalForm,
          senseKey: candidate.senseKey,
          coreMeaning: candidate.coreMeaning,
        })
      );
      setCandidates(nextCandidates);
      setSelectedId(nextCandidates[0]?.grammarPointId ?? "");
      if (nextCandidates.length === 0) setNotice("现有文法库中仍未找到匹配项。");
    } catch (searchError) {
      setNotice(getErrorMessage(searchError, "搜索失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function save() {
    if (!selectedId) return;
    setIsBusy(true);
    setNotice(null);
    try {
      await fetch(`/api/conversation/learning-items/${item.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ grammarPointId: selectedId }),
      }).then((response) =>
        readJson<PromoteConversationLearningItemResponse>(response)
      );
      onSaved(item.id);
    } catch (saveError) {
      setNotice(getErrorMessage(saveError, "加入复习失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function dismiss() {
    setIsBusy(true);
    try {
      await fetch(`/api/conversation/learning-items/${item.id}`, {
        method: "DELETE",
      }).then((response) => readJson(response));
      onDismissed(item.id);
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <article className="border-t border-border py-4 first:border-t-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h3 className="break-words text-lg font-semibold text-foreground/82">
              {item.surfaceForm}
            </h3>
            {item.reading ? <span className="text-xs text-muted">{item.reading}</span> : null}
          </div>
          {item.meaningZh ? <p className="mt-1 text-sm text-foreground/60">{item.meaningZh}</p> : null}
          {item.sourceExcerpt ? <p className="mt-2 border-l-2 border-accent/40 pl-3 text-sm leading-6 text-muted">{item.sourceExcerpt}</p> : null}
        </div>
        <button type="button" aria-label={`忽略 ${item.surfaceForm}`} disabled={isBusy} onClick={() => void dismiss()} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger"><TrashIcon className="size-4" /></button>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input aria-label={`搜索 ${item.surfaceForm} 的文法匹配`} value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void searchGrammar(); } }} className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:border-foreground/30" />
        </div>
        <button type="button" disabled={isBusy || !search.trim()} onClick={() => void searchGrammar()} className="h-10 rounded-md border border-border px-3 text-sm text-muted transition hover:text-foreground disabled:opacity-45">重新匹配</button>
      </div>

      {candidates.length > 0 ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <select aria-label={`选择 ${item.surfaceForm} 的文法义项`} value={selectedId} onChange={(event) => setSelectedId(event.target.value)} className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm">
            {candidates.map((candidate) => <option key={candidate.grammarPointId} value={candidate.grammarPointId}>{candidate.grammarPoint} · {candidate.coreMeaning}</option>)}
          </select>
          <button type="button" disabled={isBusy || !selectedId} onClick={() => void save()} className="h-10 rounded-md bg-accent px-4 text-sm font-semibold text-black hover:bg-accent-strong disabled:opacity-45">加入复习</button>
        </div>
      ) : null}
      {notice ? <p className="mt-2 text-xs leading-5 text-muted">{notice}</p> : null}
    </article>
  );
}

export function ConversationReviewInbox({
  onCountChange,
}: {
  onCountChange?: (count: number) => void;
}) {
  const [items, setItems] = useState<ConversationLearningItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/conversation/review-inbox", { signal: controller.signal })
      .then((response) => readJson<ConversationReviewInboxResponse>(response))
      .then((result) => {
        setItems(result.items);
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) setError(getErrorMessage(loadError, "对话语法候选加载失败。"));
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!isLoading && !error) {
      onCountChange?.(items.length);
    }
  }, [error, isLoading, items.length, onCountChange]);

  function removeItem(itemId: string) {
    setItems((current) => current.filter((item) => item.id !== itemId));
  }

  if (!isLoading && !error && items.length === 0) return null;

  return (
    <section className="mt-6 border-y border-border py-5" aria-labelledby="conversation-review-inbox-heading">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="conversation-review-inbox-heading" className="text-lg font-semibold text-foreground/78">对话待整理</h2>
          <p className="mt-1 text-sm text-muted">尚未匹配到具体文法义项</p>
        </div>
        {!isLoading ? <span className="text-sm text-muted">{items.length}</span> : null}
      </div>
      {isLoading ? <div className="mt-4 h-24 animate-pulse rounded-md bg-surface-soft" /> : null}
      {error ? <p role="alert" className="mt-4 text-sm text-danger">{error}</p> : null}
      {!isLoading && !error ? <div className="mt-3">{items.map((item) => <InboxItem key={item.id} item={item} onDismissed={removeItem} onSaved={removeItem} />)}</div> : null}
    </section>
  );
}
