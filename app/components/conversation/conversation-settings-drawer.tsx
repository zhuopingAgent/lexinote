"use client";

import { useRef, useState, type FormEvent } from "react";
import { CheckIcon, CloseIcon, EditIcon, PlusIcon, TrashIcon } from "@/app/components/icons";
import { useModalFocus } from "@/app/hooks/use-modal-focus";
import { getErrorMessage } from "@/app/lib/api-client";
import type { CollectionSummary } from "@/shared/types/collections";
import type {
  ConversationMemory,
  ConversationMemoryKind,
  ConversationPreferences,
} from "@/shared/types/conversation";

type ConversationSettingsDrawerProps = {
  collections: CollectionSummary[];
  globalMemories: ConversationMemory[];
  isOpen: boolean;
  preferences: ConversationPreferences;
  sessionId: string | null;
  sessionMemories: ConversationMemory[];
  onClose: () => void;
  onCreateCollection: (name: string) => Promise<CollectionSummary>;
  onCreateMemory: (input: {
    scope: "global" | "session";
    kind: ConversationMemoryKind;
    content: string;
  }) => Promise<void>;
  onDeleteMemory: (memoryId: string) => Promise<void>;
  onUpdateMemory: (
    memoryId: string,
    input: { content?: string; status?: "active" | "dismissed" }
  ) => Promise<void>;
  onUpdatePreferences: (input: Partial<ConversationPreferences>) => Promise<void>;
};

function MemoryRow({
  memory,
  onDelete,
  onUpdate,
}: {
  memory: ConversationMemory;
  onDelete: (memoryId: string) => Promise<void>;
  onUpdate: (
    memoryId: string,
    input: { content?: string; status?: "active" | "dismissed" }
  ) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [content, setContent] = useState(memory.content);
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function save() {
    if (!content.trim()) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await onUpdate(memory.id, { content: content.trim(), status: "active" });
      setIsEditing(false);
    } catch (error) {
      setActionError(getErrorMessage(error, "记忆保存失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function updateStatus(status: "active" | "dismissed") {
    setIsBusy(true);
    setActionError(null);
    try {
      await onUpdate(memory.id, { status });
    } catch (error) {
      setActionError(getErrorMessage(error, "记忆更新失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function remove() {
    setIsBusy(true);
    setActionError(null);
    try {
      await onDelete(memory.id);
    } catch (error) {
      setActionError(getErrorMessage(error, "记忆删除失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="border-t border-border py-3 first:border-t-0">
      {isEditing ? (
        <div className="flex items-start gap-2">
          <textarea aria-label={`编辑记忆：${memory.content}`} value={content} maxLength={300} onChange={(event) => setContent(event.target.value)} className="min-h-20 min-w-0 flex-1 resize-y rounded-md border border-border bg-background p-2 text-sm outline-none focus:border-foreground/30" />
          <button type="button" aria-label={`保存记忆：${memory.content}`} disabled={isBusy} onClick={() => void save()} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground disabled:opacity-45"><CheckIcon className="size-4" /></button>
          <button type="button" aria-label={`取消编辑记忆：${memory.content}`} disabled={isBusy} onClick={() => { setContent(memory.content); setIsEditing(false); }} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground disabled:opacity-45"><CloseIcon className="size-4" /></button>
        </div>
      ) : (
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">
                {memory.kind === "preference" ? "偏好" : memory.kind === "goal" ? "目标" : "背景"}
              </span>
              {memory.status === "suggested" ? <span className="text-[10px] text-accent-strong">待确认</span> : null}
            </div>
            <p className="mt-1 break-words text-sm leading-6 text-foreground/72">{memory.content}</p>
          </div>
          {memory.status === "suggested" ? (
            <>
              <button type="button" aria-label={`确认记忆：${memory.content}`} disabled={isBusy} onClick={() => void updateStatus("active")} className="inline-flex size-9 items-center justify-center rounded-md text-accent-strong hover:bg-accent-soft disabled:opacity-45"><CheckIcon className="size-4" /></button>
              <button type="button" aria-label={`编辑并确认记忆：${memory.content}`} disabled={isBusy} onClick={() => setIsEditing(true)} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground disabled:opacity-45"><EditIcon className="size-4" /></button>
              <button type="button" aria-label={`忽略记忆：${memory.content}`} disabled={isBusy} onClick={() => void updateStatus("dismissed")} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground disabled:opacity-45"><CloseIcon className="size-4" /></button>
            </>
          ) : (
            <button type="button" aria-label={`编辑记忆：${memory.content}`} disabled={isBusy} onClick={() => setIsEditing(true)} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground disabled:opacity-45"><EditIcon className="size-4" /></button>
          )}
          <button type="button" aria-label={`删除记忆：${memory.content}`} disabled={isBusy} onClick={() => void remove()} className="inline-flex size-9 items-center justify-center rounded-md text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-45"><TrashIcon className="size-4" /></button>
        </div>
      )}
      {actionError ? <p role="alert" className="mt-2 text-xs leading-5 text-danger">{actionError}</p> : null}
    </div>
  );
}

export function ConversationSettingsDrawer({
  collections,
  globalMemories,
  isOpen,
  preferences,
  sessionId,
  sessionMemories,
  onClose,
  onCreateCollection,
  onCreateMemory,
  onDeleteMemory,
  onUpdateMemory,
  onUpdatePreferences,
}: ConversationSettingsDrawerProps) {
  const [memoryContent, setMemoryContent] = useState("");
  const [memoryScope, setMemoryScope] = useState<"global" | "session">("global");
  const [memoryKind, setMemoryKind] = useState<ConversationMemoryKind>("preference");
  const [collectionName, setCollectionName] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { containerRef, onKeyDown } = useModalFocus<HTMLElement>({
    initialFocusRef: closeButtonRef,
    isOpen,
    onClose,
  });

  async function savePreferences(input: Partial<ConversationPreferences>) {
    setActionError(null);
    try {
      await onUpdatePreferences(input);
    } catch (error) {
      setActionError(getErrorMessage(error, "偏好保存失败，请重试。"));
    }
  }

  async function submitMemory(event: FormEvent) {
    event.preventDefault();
    if (!memoryContent.trim()) return;
    setIsBusy(true);
    setActionError(null);
    try {
      await onCreateMemory({
        scope: memoryScope === "session" && !sessionId ? "global" : memoryScope,
        kind: memoryKind,
        content: memoryContent.trim(),
      });
      setMemoryContent("");
    } catch (error) {
      setActionError(getErrorMessage(error, "记忆保存失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  async function submitCollection(event: FormEvent) {
    event.preventDefault();
    if (!collectionName.trim()) return;
    setIsBusy(true);
    setActionError(null);
    try {
      const collection = await onCreateCollection(collectionName.trim());
      await onUpdatePreferences({ defaultCollectionId: collection.collectionId });
      setCollectionName("");
    } catch (error) {
      setActionError(getErrorMessage(error, "单词本创建失败，请重试。"));
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      {isOpen ? <button type="button" aria-hidden="true" tabIndex={-1} className="fixed inset-0 z-40 bg-black/55" onClick={onClose} /> : null}
      <aside ref={containerRef} role="dialog" aria-modal={isOpen ? "true" : undefined} aria-label="对话偏好与记忆" aria-hidden={!isOpen} inert={!isOpen} tabIndex={-1} onKeyDown={onKeyDown} className={`fixed inset-y-0 right-0 z-50 flex w-[min(92vw,420px)] flex-col border-l border-border bg-surface shadow-2xl transition-transform ${isOpen ? "translate-x-0" : "translate-x-full"}`}>
        <div className="flex h-14 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold text-foreground">偏好与记忆</h2>
          <button ref={closeButtonRef} type="button" aria-label="关闭设置" onClick={onClose} className="inline-flex size-10 items-center justify-center rounded-md text-muted hover:bg-surface-strong hover:text-foreground"><CloseIcon className="size-5" /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {actionError ? <p role="alert" className="mb-4 rounded-md bg-danger-soft px-3 py-2 text-xs leading-5 text-danger">{actionError}</p> : null}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted">回答偏好</h3>
            <label className="mt-3 block text-xs text-muted" htmlFor="conversation-default-mode">默认模式</label>
            <select id="conversation-default-mode" value={preferences.defaultMode} onChange={(event) => void savePreferences({ defaultMode: event.target.value as ConversationPreferences["defaultMode"] })} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
              <option value="auto">自动识别</option>
              <option value="zh_to_ja">中译日</option>
              <option value="ja_to_zh">日译中</option>
              <option value="polish_ja">日语润色</option>
              <option value="explain_ja">用法讲解</option>
            </select>
            <label className="mt-3 block text-xs text-muted" htmlFor="conversation-register">默认语体</label>
            <select id="conversation-register" value={preferences.defaultRegister} onChange={(event) => void savePreferences({ defaultRegister: event.target.value as ConversationPreferences["defaultRegister"] })} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
              <option value="auto">根据语境</option>
              <option value="casual">随意</option>
              <option value="polite">礼貌</option>
              <option value="business">商务</option>
            </select>

            <label className="mt-3 block text-xs text-muted" htmlFor="conversation-collection">默认单词本</label>
            <select id="conversation-collection" value={preferences.defaultCollectionId ?? ""} onChange={(event) => void savePreferences({ defaultCollectionId: event.target.value ? Number(event.target.value) : null })} className="mt-1 h-10 w-full rounded-md border border-border bg-background px-3 text-sm">
              <option value="">未设置</option>
              {collections.map((collection) => <option key={collection.collectionId} value={collection.collectionId}>{collection.name}</option>)}
            </select>

            <form className="mt-2 flex gap-2" onSubmit={submitCollection}>
              <input aria-label="新建默认单词本" value={collectionName} disabled={isBusy} onChange={(event) => setCollectionName(event.target.value)} placeholder="新建单词本" className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-55" />
              <button type="submit" disabled={isBusy || !collectionName.trim()} aria-label="新建单词本" className="inline-flex size-9 items-center justify-center rounded-md border border-border text-muted hover:text-foreground disabled:opacity-45"><PlusIcon className="size-4" /></button>
            </form>
          </section>

          <section className="mt-7">
            <h3 className="text-xs font-semibold uppercase text-muted">新增记忆</h3>
            <form className="mt-3" onSubmit={submitMemory}>
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="记忆范围" value={memoryScope} disabled={isBusy} onChange={(event) => setMemoryScope(event.target.value as "global" | "session")} className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-55">
                  <option value="global">跨对话</option>
                  <option value="session" disabled={!sessionId}>当前对话</option>
                </select>
                <select aria-label="记忆类型" value={memoryKind} disabled={isBusy} onChange={(event) => setMemoryKind(event.target.value as ConversationMemoryKind)} className="h-9 rounded-md border border-border bg-background px-2 text-sm disabled:cursor-not-allowed disabled:opacity-55">
                  <option value="preference">偏好</option>
                  <option value="context">背景</option>
                  <option value="goal">目标</option>
                </select>
              </div>
              <textarea aria-label="记忆内容" value={memoryContent} disabled={isBusy} maxLength={300} onChange={(event) => setMemoryContent(event.target.value)} placeholder="输入需要保留的偏好或背景" className="mt-2 min-h-24 w-full resize-y rounded-md border border-border bg-background p-3 text-sm outline-none focus:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-55" />
              <button type="submit" disabled={isBusy || !memoryContent.trim()} className="mt-2 inline-flex h-9 items-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-black hover:bg-accent-strong disabled:opacity-45"><PlusIcon className="size-4" />保存记忆</button>
            </form>
          </section>

          <section className="mt-7">
            <h3 className="text-xs font-semibold uppercase text-muted">跨对话记忆</h3>
            <div className="mt-2">
              {globalMemories.filter((memory) => memory.status !== "dismissed").map((memory) => <MemoryRow key={memory.id} memory={memory} onDelete={onDeleteMemory} onUpdate={onUpdateMemory} />)}
              {globalMemories.filter((memory) => memory.status !== "dismissed").length === 0 ? <p className="py-4 text-sm text-muted">暂无跨对话记忆</p> : null}
            </div>
          </section>

          {sessionId ? (
            <section className="mt-7">
              <h3 className="text-xs font-semibold uppercase text-muted">当前对话记忆</h3>
              <div className="mt-2">
                {sessionMemories.filter((memory) => memory.status !== "dismissed").map((memory) => <MemoryRow key={memory.id} memory={memory} onDelete={onDeleteMemory} onUpdate={onUpdateMemory} />)}
                {sessionMemories.filter((memory) => memory.status !== "dismissed").length === 0 ? <p className="py-4 text-sm text-muted">暂无当前对话记忆</p> : null}
              </div>
            </section>
          ) : null}
        </div>
      </aside>
    </>
  );
}
