"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AiApiErrorModal } from "@/app/components/ai-api-error-modal";
import {
  ChatIcon,
  MenuIcon,
  SendIcon,
  SettingsIcon,
  StopIcon,
} from "@/app/components/icons";
import { ConversationMessageView } from "@/app/components/conversation/conversation-message";
import { ConversationSettingsDrawer } from "@/app/components/conversation/conversation-settings-drawer";
import { ConversationSidebar } from "@/app/components/conversation/conversation-sidebar";
import { consumeConversationEventStream } from "@/app/lib/conversation-stream";
import {
  getErrorMessage,
  isAbortError,
  isAiQuotaExhaustedError,
  readJson,
} from "@/app/lib/api-client";
import type {
  CollectionResponse,
  CollectionSummary,
  ConversationAnalysisResponse,
  ConversationBootstrapResponse,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMemoryKind,
  ConversationMessage,
  ConversationMode,
  ConversationPreferences,
  ConversationSession,
  ConversationSessionResponse,
  PromoteConversationLearningItemRequest,
  PromoteConversationLearningItemResponse,
} from "@/shared/types/api";

const MODE_LABELS: Record<ConversationMode, string> = {
  auto: "自动识别",
  zh_to_ja: "中译日",
  ja_to_zh: "日译中",
  polish_ja: "日语润色",
  explain_ja: "用法讲解",
};

const DEFAULT_PREFERENCES: ConversationPreferences = {
  defaultMode: "auto",
  translationStyle: "natural_first",
  defaultRegister: "auto",
  defaultCollectionId: null,
};

function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const map = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => map.set(item.id, item));
  return Array.from(map.values());
}

function sortSessionsByActivity(sessions: ConversationSession[]) {
  return [...sessions].sort(
    (left, right) =>
      right.updatedAt.localeCompare(left.updatedAt) ||
      right.id.localeCompare(left.id)
  );
}

type ConversationClientProps = {
  initialSessionId?: string | null;
};

export function ConversationClient({ initialSessionId = null }: ConversationClientProps) {
  const router = useRouter();
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [learningItems, setLearningItems] = useState<ConversationLearningItem[]>([]);
  const [globalMemories, setGlobalMemories] = useState<ConversationMemory[]>([]);
  const [sessionMemories, setSessionMemories] = useState<ConversationMemory[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [mode, setMode] = useState<ConversationMode>("auto");
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [olderMessagesCursor, setOlderMessagesCursor] = useState<string | null>(null);
  const [aiAvailable, setAiAvailable] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isBootstrapLoading, setIsBootstrapLoading] = useState(true);
  const [isSessionLoading, setIsSessionLoading] = useState(Boolean(initialSessionId));
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiApiErrorMessage, setAiApiErrorMessage] = useState<string | null>(null);
  const activeSessionIdRef = useRef(activeSessionId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const analysisInFlightRef = useRef(new Set<string>());
  const analyzeMessageRef = useRef<
    (sessionId: string, messageId: string) => Promise<void>
  >(async () => {});
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const pendingScrollRestoreRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const skipSessionLoadRef = useRef<string | null>(null);
  const bootstrapGenerationRef = useRef(0);
  activeSessionIdRef.current = activeSessionId;

  useEffect(() => {
    abortControllerRef.current?.abort();
    setIsGenerating(false);
    setActiveSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(
    () => () => {
      abortControllerRef.current?.abort();
    },
    []
  );

  useEffect(() => {
    const generation = ++bootstrapGenerationRef.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsBootstrapLoading(true);
      try {
        const params = new URLSearchParams();
        if (query.trim()) params.set("query", query.trim());
        const response = await fetch(`/api/conversation/bootstrap?${params}`, {
          signal: controller.signal,
        });
        const result = await readJson<ConversationBootstrapResponse>(response);
        if (generation !== bootstrapGenerationRef.current) return;
        setSessions(result.sessions);
        setNextCursor(result.nextCursor);
        setPreferences(result.preferences);
        setGlobalMemories(result.globalMemories);
        setCollections(result.collections);
        setAiAvailable(result.aiAvailable);
        if (!activeSessionId) setMode(result.preferences.defaultMode);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "对话列表加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted && generation === bootstrapGenerationRef.current) {
          setIsBootstrapLoading(false);
        }
      }
    }, query ? 220 : 0);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, activeSessionId]);

  useEffect(() => {
    if (!activeSessionId) {
      setCurrentSession(null);
      setMessages([]);
      setLearningItems([]);
      setSessionMemories([]);
      setOlderMessagesCursor(null);
      return;
    }
    if (skipSessionLoadRef.current === activeSessionId) {
      skipSessionLoadRef.current = null;
      setIsSessionLoading(false);
      return;
    }
    const controller = new AbortController();
    setIsSessionLoading(true);
    setError(null);
    void fetch(`/api/conversations/${activeSessionId}`, { signal: controller.signal })
      .then((response) => readJson<ConversationSessionResponse>(response))
      .then((result) => {
        setCurrentSession(result.session);
        setMode(result.session.mode);
        setMessages(result.messages);
        setLearningItems(result.learningItems);
        setSessionMemories(result.memories);
        setOlderMessagesCursor(result.olderMessagesCursor);
        const pendingAnalyses = result.messages.filter(
          (message) =>
            message.role === "assistant" &&
            message.status === "completed" &&
            message.analysisStatus === "pending"
        );
        void (async () => {
          for (const message of pendingAnalyses) {
            if (activeSessionIdRef.current !== activeSessionId) return;
            await analyzeMessageRef.current(activeSessionId, message.id);
          }
        })();
      })
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "对话加载失败，请稍后再试。"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsSessionLoading(false);
      });
    return () => controller.abort();
  }, [activeSessionId]);

  useLayoutEffect(() => {
    const pendingScrollRestore = pendingScrollRestoreRef.current;
    const viewport = messagesViewportRef.current;
    if (pendingScrollRestore && viewport) {
      viewport.scrollTop =
        pendingScrollRestore.scrollTop +
        (viewport.scrollHeight - pendingScrollRestore.scrollHeight);
      pendingScrollRestoreRef.current = null;
      return;
    }
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  async function loadMoreSessions() {
    if (!nextCursor) return;
    const generation = bootstrapGenerationRef.current;
    setIsBootstrapLoading(true);
    try {
      const params = new URLSearchParams({ cursor: nextCursor });
      if (query.trim()) params.set("query", query.trim());
      const result = await fetch(`/api/conversation/bootstrap?${params}`).then(
        (response) => readJson<ConversationBootstrapResponse>(response)
      );
      if (generation !== bootstrapGenerationRef.current) return;
      setSessions((current) =>
        sortSessionsByActivity(mergeById(current, result.sessions))
      );
      setNextCursor(result.nextCursor);
    } catch (loadError) {
      if (generation === bootstrapGenerationRef.current) {
        setError(getErrorMessage(loadError, "更多对话加载失败，请重试。"));
      }
    } finally {
      if (generation === bootstrapGenerationRef.current) {
        setIsBootstrapLoading(false);
      }
    }
  }

  async function loadOlderMessages() {
    if (!activeSessionId || !olderMessagesCursor) return;
    const sessionId = activeSessionId;
    setIsLoadingOlder(true);
    try {
      const result = await fetch(
        `/api/conversations/${sessionId}?cursor=${encodeURIComponent(olderMessagesCursor)}`
      ).then((response) => readJson<ConversationSessionResponse>(response));
      if (activeSessionIdRef.current !== sessionId) return;
      const viewport = messagesViewportRef.current;
      if (viewport) {
        pendingScrollRestoreRef.current = {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
        };
      }
      setMessages((current) => mergeById(result.messages, current));
      setOlderMessagesCursor(result.olderMessagesCursor);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "更早消息加载失败，请重试。"));
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function ensureSession() {
    if (activeSessionId) return activeSessionId;
    const result = await fetch("/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    }).then((response) =>
      readJson<{ session: ConversationSession }>(response)
    );
    skipSessionLoadRef.current = result.session.id;
    setActiveSessionId(result.session.id);
    setCurrentSession(result.session);
    setSessions((current) =>
      sortSessionsByActivity(mergeById(current, [result.session]))
    );
    window.history.replaceState(null, "", `/conversation/${result.session.id}`);
    return result.session.id;
  }

  async function analyzeMessage(sessionId: string, messageId: string) {
    if (analysisInFlightRef.current.has(messageId)) return;
    analysisInFlightRef.current.add(messageId);
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? { ...message, analysisStatus: "running" }
          : message
      )
    );
    try {
      const result = await fetch(
        `/api/conversations/${sessionId}/messages/${messageId}/analysis`,
        { method: "POST" }
      ).then((response) => readJson<ConversationAnalysisResponse>(response));
      if (activeSessionIdRef.current !== sessionId) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === result.message.id ? result.message : message
        )
      );
      setLearningItems((current) => mergeById(current, result.learningItems));
      setGlobalMemories((current) =>
        mergeById(
          current,
          result.memories.filter((memory) => memory.scope === "global")
        )
      );
      setSessionMemories((current) =>
        mergeById(
          current,
          result.memories.filter((memory) => memory.scope === "session")
        )
      );
      setCurrentSession(result.session);
      setSessions((current) => {
        const next = current.map((session) =>
          session.id === result.session.id ? result.session : session
        );
        return sortSessionsByActivity(
          next.some((session) => session.id === result.session.id)
            ? next
            : [result.session, ...next]
        );
      });
    } catch (analysisError) {
      if (activeSessionIdRef.current !== sessionId) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, analysisStatus: "failed" }
            : message
        )
      );
      if (isAiQuotaExhaustedError(analysisError)) {
        setAiApiErrorMessage(getErrorMessage(analysisError, "AI 分析额度不足。"));
      }
    } finally {
      analysisInFlightRef.current.delete(messageId);
    }
  }

  analyzeMessageRef.current = analyzeMessage;

  async function sendMessage(
    overrideContent?: string,
    retryParentMessageId?: string,
    overrideMode?: ConversationMode | null
  ) {
    const content = (overrideContent ?? input).trim();
    if (!content || isGenerating || !aiAvailable) return;
    setError(null);
    setIsGenerating(true);
    if (!overrideContent) setInput("");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let completedMessage: ConversationMessage | null = null;
    try {
      const sessionId = await ensureSession();
      const response = await fetch(`/api/conversations/${sessionId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          clientMessageId: crypto.randomUUID(),
          content,
          mode: overrideMode ?? mode,
          retryParentMessageId,
        }),
      });
      if (!response.ok) {
        await readJson(response);
      }
      let assistantMessageId = "";
      await consumeConversationEventStream(response, (event) => {
        if (event.type === "assistant_created") {
          assistantMessageId = event.assistantMessage.id;
          setMessages((current) =>
            mergeById(current, [event.userMessage, event.assistantMessage])
          );
          return;
        }
        if (event.type === "text_delta") {
          setMessages((current) =>
            current.map((message) =>
              message.id === assistantMessageId
                ? { ...message, content: message.content + event.delta }
                : message
            )
          );
          return;
        }
        if (event.type === "completed") {
          completedMessage = event.message;
          setMessages((current) =>
            current.map((message) =>
              message.id === event.message.id ? event.message : message
            )
          );
          setCurrentSession((current) =>
            current?.id === sessionId
              ? { ...current, updatedAt: event.message.updatedAt }
              : current
          );
          setSessions((current) =>
            sortSessionsByActivity(
              current.map((session) =>
                session.id === sessionId
                  ? { ...session, updatedAt: event.message.updatedAt }
                  : session
              )
            )
          );
          return;
        }
        setError(event.message);
        if (event.assistantMessage) {
          setMessages((current) =>
            current.map((message) =>
              message.id === event.assistantMessage?.id
                ? event.assistantMessage
                : message
            )
          );
        }
      });
      if (completedMessage) {
        void analyzeMessage(sessionId, (completedMessage as ConversationMessage).id);
      }
    } catch (sendError) {
      if (!isAbortError(sendError)) {
        const message = getErrorMessage(sendError, "发送失败，请稍后再试。");
        setError(message);
        if (isAiQuotaExhaustedError(sendError)) setAiApiErrorMessage(message);
      } else {
        setMessages((current) =>
          current.map((message) =>
            message.status === "streaming"
              ? { ...message, status: "cancelled", errorMessage: "回答已停止。" }
              : message
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setIsGenerating(false);
    }
  }

  async function renameSession(sessionId: string, title: string) {
    const result = await fetch(`/api/conversations/${sessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    }).then((response) => readJson<{ session: ConversationSession }>(response));
    setSessions((current) =>
      sortSessionsByActivity(
        current.map((session) =>
          session.id === sessionId ? result.session : session
        )
      )
    );
    if (currentSession?.id === sessionId) setCurrentSession(result.session);
  }

  async function deleteSession(sessionId: string) {
    if (activeSessionId === sessionId) {
      abortControllerRef.current?.abort();
    }
    await fetch(`/api/conversations/${sessionId}`, { method: "DELETE" }).then(
      async (response) => {
        if (!response.ok) await readJson(response);
      }
    );
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    if (activeSessionId === sessionId) {
      setActiveSessionId(null);
      setCurrentSession(null);
      setMessages([]);
      router.push("/conversation");
    }
  }

  async function changeMode(nextMode: ConversationMode) {
    setMode(nextMode);
    if (!activeSessionId) return;
    const result = await fetch(`/api/conversations/${activeSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: nextMode }),
    }).then((response) => readJson<{ session: ConversationSession }>(response));
    setCurrentSession(result.session);
    setSessions((current) =>
      sortSessionsByActivity(
        current.map((session) =>
          session.id === result.session.id ? result.session : session
        )
      )
    );
  }

  async function updatePreferences(input: Partial<ConversationPreferences>) {
    const result = await fetch("/api/conversation/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((response) =>
      readJson<{ preferences: ConversationPreferences }>(response)
    );
    setPreferences(result.preferences);
  }

  async function createCollection(name: string) {
    const result = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((response) => readJson<CollectionResponse>(response));
    setCollections((current) => [result.collection, ...current]);
    return result.collection;
  }

  async function createMemory(input: {
    scope: "global" | "session";
    kind: ConversationMemoryKind;
    content: string;
  }) {
    const result = await fetch("/api/conversation/memories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, sessionId: activeSessionId }),
    }).then((response) => readJson<{ memory: ConversationMemory }>(response));
    if (result.memory.scope === "global") {
      setGlobalMemories((current) => mergeById(current, [result.memory]));
    } else {
      setSessionMemories((current) => mergeById(current, [result.memory]));
    }
  }

  async function updateMemory(
    memoryId: string,
    input: { content?: string; status?: "active" | "dismissed" }
  ) {
    const result = await fetch(`/api/conversation/memories/${memoryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((response) => readJson<{ memory: ConversationMemory }>(response));
    setGlobalMemories((current) =>
      current.map((memory) => (memory.id === memoryId ? result.memory : memory))
    );
    setSessionMemories((current) =>
      current.map((memory) => (memory.id === memoryId ? result.memory : memory))
    );
  }

  async function deleteMemory(memoryId: string) {
    await fetch(`/api/conversation/memories/${memoryId}`, { method: "DELETE" }).then(
      async (response) => {
        if (!response.ok) await readJson(response);
      }
    );
    setGlobalMemories((current) => current.filter((memory) => memory.id !== memoryId));
    setSessionMemories((current) => current.filter((memory) => memory.id !== memoryId));
  }

  async function promoteLearningItem(
    itemId: string,
    input: PromoteConversationLearningItemRequest
  ) {
    const result = await fetch(
      `/api/conversation/learning-items/${itemId}/promote`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    ).then((response) =>
      readJson<PromoteConversationLearningItemResponse>(response)
    );
    setLearningItems((current) =>
      current.map((item) => (item.id === itemId ? result.item : item))
    );
    return result;
  }

  async function dismissLearningItem(itemId: string) {
    const result = await fetch(`/api/conversation/learning-items/${itemId}`, {
      method: "DELETE",
    }).then((response) => readJson<{ item: ConversationLearningItem }>(response));
    setLearningItems((current) =>
      current.map((item) => (item.id === itemId ? result.item : item))
    );
  }

  const allMemories = [...globalMemories, ...sessionMemories];

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <AiApiErrorModal message={aiApiErrorMessage} onClose={() => setAiApiErrorMessage(null)} />
      <ConversationSidebar
        activeSessionId={activeSessionId}
        isOpen={isSidebarOpen}
        isLoading={isBootstrapLoading}
        nextCursor={nextCursor}
        query={query}
        sessions={sessions}
        onClose={() => setIsSidebarOpen(false)}
        onDelete={deleteSession}
        onLoadMore={loadMoreSessions}
        onQueryChange={setQuery}
        onRename={renameSession}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface-soft px-3 sm:px-4">
          <button type="button" aria-label="打开对话列表" onClick={() => setIsSidebarOpen(true)} className="inline-flex size-10 items-center justify-center rounded-md text-muted transition hover:bg-surface-strong hover:text-foreground lg:hidden"><MenuIcon className="size-5" /></button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/80">
            {currentSession?.title ?? "新对话"}
          </h1>
          <select aria-label="对话模式" value={mode} disabled={isGenerating} onChange={(event) => void changeMode(event.target.value as ConversationMode)} className="h-9 max-w-[132px] rounded-md border border-border bg-background px-2 text-sm sm:max-w-none">
            {Object.entries(MODE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button type="button" aria-label="打开偏好与记忆" onClick={() => setIsSettingsOpen(true)} className="inline-flex size-10 items-center justify-center rounded-md text-muted transition hover:bg-surface-strong hover:text-foreground"><SettingsIcon className="size-5" /></button>
        </header>

        <div ref={messagesViewportRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[820px] px-4 pb-8 pt-4 sm:px-6">
            {olderMessagesCursor ? <div className="mb-4 text-center"><button type="button" disabled={isLoadingOlder} onClick={() => void loadOlderMessages()} className="rounded-md px-3 py-2 text-xs text-muted transition hover:bg-surface-strong hover:text-foreground">{isLoadingOlder ? "加载中..." : "加载更早消息"}</button></div> : null}
            {isSessionLoading ? (
              <div className="space-y-5 py-8"><div className="h-16 animate-pulse rounded-md bg-surface-soft" /><div className="h-28 animate-pulse rounded-md bg-surface-soft" /></div>
            ) : messages.length === 0 ? (
              <div className="flex min-h-[42vh] flex-col items-center justify-center text-center">
                <ChatIcon className="size-9 text-accent" />
                <p className="mt-4 text-lg font-semibold text-foreground/76">新对话</p>
              </div>
            ) : (
              messages.map((message) => (
                <ConversationMessageView
                  key={message.id}
                  message={message}
                  collections={collections}
                  defaultCollectionId={preferences.defaultCollectionId}
                  learningItems={learningItems}
                  memories={allMemories}
                  onAnalyze={(messageId) => activeSessionId ? analyzeMessage(activeSessionId, messageId) : Promise.resolve()}
                  onCreateCollection={createCollection}
                  onDismissLearningItem={dismissLearningItem}
                  onPromoteLearningItem={promoteLearningItem}
                  onRetry={async (assistantMessage) => {
                    const parent = messages.find((message) => message.id === assistantMessage.parentMessageId);
                    if (parent) await sendMessage(parent.content, parent.id, assistantMessage.mode);
                  }}
                  onSetDefaultCollection={(collectionId) => updatePreferences({ defaultCollectionId: collectionId })}
                  onUpdateMemory={(memoryId, status) => updateMemory(memoryId, { status })}
                />
              ))
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        <div className="shrink-0 border-t border-border bg-background/95 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur sm:px-5">
          <div className="mx-auto w-full max-w-[820px]">
            {error ? <div role="alert" className="mb-2 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">{error}</div> : null}
            {!aiAvailable ? <div className="mb-2 rounded-md border border-border bg-surface-soft px-3 py-2 text-sm text-muted">AI Gateway 未配置，历史与记忆仍可查看，但暂时不能发送消息。</div> : null}
            <div className="flex items-end gap-2 rounded-lg border border-border bg-surface p-2 shadow-[0_12px_36px_rgba(0,0,0,0.16)] focus-within:border-foreground/30">
              <textarea
                aria-label="对话消息"
                value={input}
                disabled={!aiAvailable}
                maxLength={8000}
                rows={1}
                placeholder={`${MODE_LABELS[mode]}...`}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                className="max-h-40 min-h-11 min-w-0 flex-1 resize-none border-0 bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none disabled:cursor-not-allowed"
              />
              {isGenerating ? (
                <button type="button" aria-label="停止生成" onClick={() => abortControllerRef.current?.abort()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition hover:opacity-85"><StopIcon className="size-4" /></button>
              ) : (
                <button type="button" aria-label="发送消息" disabled={!input.trim() || !aiAvailable} onClick={() => void sendMessage()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-accent text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-35"><SendIcon className="size-5" /></button>
              )}
            </div>
          </div>
        </div>
      </section>

      <ConversationSettingsDrawer
        collections={collections}
        globalMemories={globalMemories}
        isOpen={isSettingsOpen}
        preferences={preferences}
        sessionId={activeSessionId}
        sessionMemories={sessionMemories}
        onClose={() => setIsSettingsOpen(false)}
        onCreateCollection={createCollection}
        onCreateMemory={createMemory}
        onDeleteMemory={deleteMemory}
        onUpdateMemory={updateMemory}
        onUpdatePreferences={updatePreferences}
      />
    </div>
  );
}
