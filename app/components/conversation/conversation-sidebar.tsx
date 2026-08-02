"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import {
  CheckIcon,
  CloseIcon,
  EditIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from "@/app/components/icons";
import type { ConversationSession } from "@/shared/types/conversation";

type ConversationSidebarProps = {
  activeSessionId: string | null;
  isOpen: boolean;
  isLoading: boolean;
  nextCursor: string | null;
  query: string;
  sessions: ConversationSession[];
  onClose: () => void;
  onDelete: (sessionId: string) => Promise<void>;
  onLoadMore: () => Promise<void>;
  onQueryChange: (query: string) => void;
  onRename: (sessionId: string, title: string) => Promise<void>;
};

function subscribeToDesktopViewport(onChange: () => void) {
  const media = window.matchMedia("(min-width: 1024px)");
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function isDesktopViewport() {
  return window.matchMedia("(min-width: 1024px)").matches;
}

export function ConversationSidebar({
  activeSessionId,
  isOpen,
  isLoading,
  nextCursor,
  query,
  sessions,
  onClose,
  onDelete,
  onLoadMore,
  onQueryChange,
  onRename,
}: ConversationSidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const isDesktop = useSyncExternalStore(
    subscribeToDesktopViewport,
    isDesktopViewport,
    () => true
  );
  const isInteractive = isDesktop || isOpen;

  async function saveRename(sessionId: string) {
    if (!editingTitle.trim()) return;
    setBusyId(sessionId);
    try {
      await onRename(sessionId, editingTitle.trim());
      setEditingId(null);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteSession(session: ConversationSession) {
    if (!window.confirm(`删除对话“${session.title}”？已保存到词典或文法的内容会保留。`)) {
      return;
    }
    setBusyId(session.id);
    try {
      await onDelete(session.id);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="关闭对话列表"
          className="fixed inset-0 z-30 bg-black/55 lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        aria-label="对话列表"
        aria-hidden={!isInteractive}
        inert={!isInteractive}
        className={`fixed inset-y-0 left-0 z-40 flex w-[min(86vw,300px)] flex-col border-r border-border bg-surface shadow-2xl transition-transform lg:static lg:z-auto lg:w-[288px] lg:translate-x-0 lg:shadow-none ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
          <Link
            href="/conversation"
            onClick={onClose}
            className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-md bg-accent px-3 text-sm font-semibold text-black transition hover:bg-accent-strong"
          >
            <PlusIcon className="size-4" />
            新对话
          </Link>
          <button
            type="button"
            aria-label="关闭对话列表"
            onClick={onClose}
            className="inline-flex size-10 items-center justify-center rounded-md text-muted transition hover:bg-surface-strong hover:text-foreground lg:hidden"
          >
            <CloseIcon className="size-5" />
          </button>
        </div>

        <div className="relative m-3">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="搜索对话"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索对话"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none transition focus:border-foreground/30"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {sessions.map((session) => {
            const isActive = session.id === activeSessionId;
            const isEditing = editingId === session.id;
            return (
              <div
                key={session.id}
                className={`group mb-1 flex min-h-11 items-center rounded-md ${
                  isActive ? "bg-surface-strong" : "hover:bg-surface-soft"
                }`}
              >
                {isEditing ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1 px-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRename(session.id);
                    }}
                  >
                    <input
                      autoFocus
                      aria-label="对话标题"
                      value={editingTitle}
                      maxLength={80}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      className="h-8 min-w-0 flex-1 rounded border border-border bg-background px-2 text-sm outline-none focus:border-foreground/30"
                    />
                    <button type="submit" aria-label="保存标题" disabled={busyId === session.id} className="inline-flex size-8 items-center justify-center rounded text-muted hover:text-foreground">
                      <CheckIcon className="size-4" />
                    </button>
                    <button type="button" aria-label="取消改名" onClick={() => setEditingId(null)} className="inline-flex size-8 items-center justify-center rounded text-muted hover:text-foreground">
                      <CloseIcon className="size-4" />
                    </button>
                  </form>
                ) : (
                  <>
                    <Link
                      href={`/conversation/${session.id}`}
                      onClick={onClose}
                      className="min-w-0 flex-1 truncate px-3 py-3 text-sm text-foreground/80"
                    >
                      {session.title}
                    </Link>
                    <div className="mr-1 flex shrink-0 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        aria-label={`重命名 ${session.title}`}
                        onClick={() => {
                          setEditingId(session.id);
                          setEditingTitle(session.title);
                        }}
                        className="inline-flex size-8 items-center justify-center rounded text-muted transition hover:bg-background hover:text-foreground"
                      >
                        <EditIcon className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`删除 ${session.title}`}
                        onClick={() => void deleteSession(session)}
                        disabled={busyId === session.id}
                        className="inline-flex size-8 items-center justify-center rounded text-muted transition hover:bg-danger-soft hover:text-danger"
                      >
                        <TrashIcon className="size-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {!isLoading && sessions.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-muted">没有匹配的对话</p>
          ) : null}

          {nextCursor ? (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => void onLoadMore()}
              className="mt-2 h-10 w-full rounded-md text-sm text-muted transition hover:bg-surface-strong hover:text-foreground disabled:opacity-45"
            >
              {isLoading ? "加载中..." : "加载更多"}
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
