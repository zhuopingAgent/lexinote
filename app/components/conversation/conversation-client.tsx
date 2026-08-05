"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AiGatewayBudgetModal } from "@/app/components/ai-gateway-budget-modal";
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
import {
  analyzeConversationMessage,
  createConversationCollection,
  createConversationMemory,
  createConversationSession,
  deleteConversationMemory,
  deleteConversationSession,
  dismissConversationLearningItem,
  fetchConversationBootstrap,
  fetchConversationSession,
  maintainConversationSession,
  promoteConversationLearningItem,
  streamConversationMessage,
  updateConversationMemory,
  updateConversationPreferences,
  updateConversationSession,
} from "@/app/lib/conversation-api";
import {
  mergeById,
  replaceSessionByActivity,
  sortSessionsByActivity,
  updateSessionActivity,
  upsertSessionByActivity,
} from "@/app/lib/conversation-state";
import { consumeConversationEventStream } from "@/app/lib/conversation-stream";
import { parseConversationAnalysisCommand } from "@/features/conversation/domain/analysis-request";
import {
  getErrorMessage,
  isAbortError,
  isAiGatewayBudgetExceededError,
} from "@/app/lib/api-client";
import type { CollectionSummary } from "@/shared/types/collections";
import type {
  AnalyzeConversationMessageRequest,
  ConversationAnalysis,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMemoryKind,
  ConversationMessage,
  ConversationMode,
  ConversationPreferences,
  ConversationSession,
  PromoteConversationLearningItemRequest,
} from "@/shared/types/conversation";

const MODE_LABELS: Record<ConversationMode, string> = {
  chat: "通用对话",
  auto: "中日自动",
  zh_to_ja: "中译日",
  ja_to_zh: "日译中",
  polish_ja: "日语润色",
  explain_ja: "用法讲解",
};

const DEFAULT_PREFERENCES: ConversationPreferences = {
  defaultMode: "chat",
  translationStyle: "natural_first",
  defaultRegister: "auto",
  defaultCollectionId: null,
};

const STOP_GENERATION_ARM_DELAY_MS = 500;

type ConversationClientProps = {
  initialSessionId?: string | null;
};

export function ConversationClient({ initialSessionId = null }: ConversationClientProps) {
  const router = useRouter();
  const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
  const [currentSession, setCurrentSession] = useState<ConversationSession | null>(null);
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [analyses, setAnalyses] = useState<ConversationAnalysis[]>([]);
  const [learningItems, setLearningItems] = useState<ConversationLearningItem[]>([]);
  const [globalMemories, setGlobalMemories] = useState<ConversationMemory[]>([]);
  const [sessionMemories, setSessionMemories] = useState<ConversationMemory[]>([]);
  const [collections, setCollections] = useState<CollectionSummary[]>([]);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [mode, setMode] = useState<ConversationMode>("chat");
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
  const [canStopGeneration, setCanStopGeneration] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiGatewayBudgetErrorMessage, setAiGatewayBudgetErrorMessage] = useState<
    string | null
  >(null);
  const activeSessionIdRef = useRef(activeSessionId);
  const abortControllerRef = useRef<AbortController | null>(null);
  const analysisInFlightRef = useRef(new Set<string>());
  const maintenanceInFlightRef = useRef(new Set<string>());
  const maintenanceQueueRef = useRef<Promise<void>>(Promise.resolve());
  const [analysisInFlightMessageIds, setAnalysisInFlightMessageIds] = useState<
    string[]
  >([]);
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const pendingScrollRestoreRef = useRef<{
    scrollHeight: number;
    scrollTop: number;
  } | null>(null);
  const skipSessionLoadRef = useRef<string | null>(null);
  const bootstrapGenerationRef = useRef(0);
  const preferencesMutationRef = useRef<Promise<void>>(Promise.resolve());
  activeSessionIdRef.current = activeSessionId;

  useEffect(() => {
    abortControllerRef.current?.abort();
    setCanStopGeneration(false);
    setIsGenerating(false);
    setActiveSessionId(initialSessionId);
  }, [initialSessionId]);

  useEffect(() => {
    if (!isGenerating) return;
    const timer = window.setTimeout(
      () => setCanStopGeneration(true),
      STOP_GENERATION_ARM_DELAY_MS
    );
    return () => window.clearTimeout(timer);
  }, [isGenerating]);

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
        const result = await fetchConversationBootstrap({
          query: query.trim() || undefined,
          signal: controller.signal,
        });
        if (generation !== bootstrapGenerationRef.current) return;
        setSessions(result.sessions);
        setNextCursor(result.nextCursor);
        setPreferences(result.preferences);
        setGlobalMemories(result.globalMemories);
        setCollections(result.collections);
        setAiAvailable(result.aiAvailable);
        if (!activeSessionIdRef.current) setMode(result.preferences.defaultMode);
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
  }, [query]);

  useEffect(() => {
    if (!activeSessionId) {
      setCurrentSession(null);
      setMessages([]);
      setAnalyses([]);
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
    setCurrentSession(null);
    setMessages([]);
    setAnalyses([]);
    setLearningItems([]);
    setSessionMemories([]);
    setOlderMessagesCursor(null);
    void fetchConversationSession(activeSessionId, { signal: controller.signal })
      .then((result) => {
        setCurrentSession(result.session);
        setMode(result.session.mode);
        setMessages(result.messages);
        setAnalyses(result.analyses ?? []);
        setLearningItems(result.learningItems);
        setSessionMemories(result.memories);
        setOlderMessagesCursor(result.olderMessagesCursor);
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

  useLayoutEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  function startNewConversation() {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    activeSessionIdRef.current = null;
    skipSessionLoadRef.current = null;
    pendingScrollRestoreRef.current = null;
    setActiveSessionId(null);
    setCurrentSession(null);
    setMessages([]);
    setAnalyses([]);
    setLearningItems([]);
    setSessionMemories([]);
    setOlderMessagesCursor(null);
    setInput("");
    setAnalysisErrors({});
    setAnalysisInFlightMessageIds([]);
    setQuery("");
    setMode(preferences.defaultMode);
    setError(null);
    setCanStopGeneration(false);
    setIsGenerating(false);
    setIsSessionLoading(false);
    setIsSidebarOpen(false);
    router.push("/conversation");
  }

  async function loadMoreSessions() {
    if (!nextCursor) return;
    const generation = bootstrapGenerationRef.current;
    setIsBootstrapLoading(true);
    try {
      const result = await fetchConversationBootstrap({
        cursor: nextCursor,
        query: query.trim() || undefined,
      });
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
      const result = await fetchConversationSession(sessionId, {
        cursor: olderMessagesCursor,
      });
      if (activeSessionIdRef.current !== sessionId) return;
      const viewport = messagesViewportRef.current;
      if (viewport) {
        pendingScrollRestoreRef.current = {
          scrollHeight: viewport.scrollHeight,
          scrollTop: viewport.scrollTop,
        };
      }
      setMessages((current) => mergeById(result.messages, current));
      setAnalyses((current) => mergeById(current, result.analyses ?? []));
      setOlderMessagesCursor(result.olderMessagesCursor);
    } catch (loadError) {
      setError(getErrorMessage(loadError, "更早消息加载失败，请重试。"));
    } finally {
      setIsLoadingOlder(false);
    }
  }

  async function ensureSession() {
    if (activeSessionId) return activeSessionId;
    const session = await createConversationSession(mode);
    skipSessionLoadRef.current = session.id;
    activeSessionIdRef.current = session.id;
    setActiveSessionId(session.id);
    setCurrentSession(session);
    setSessions((current) => upsertSessionByActivity(current, session));
    window.history.replaceState(null, "", `/conversation/${session.id}`);
    return session.id;
  }

  async function analyzeMessage(
    sessionId: string,
    messageId: string,
    input: Pick<AnalyzeConversationMessageRequest, "focus" | "instruction"> = {}
  ) {
    if (analysisInFlightRef.current.has(messageId)) return;
    analysisInFlightRef.current.add(messageId);
    setAnalysisInFlightMessageIds((current) => [...current, messageId]);
    setAnalysisErrors((current) => {
      const next = { ...current };
      delete next[messageId];
      return next;
    });
    try {
      const result = await analyzeConversationMessage(sessionId, messageId, {
        clientAnalysisId: crypto.randomUUID(),
        focus: input.focus ?? "all",
        instruction: input.instruction ?? "",
      });
      if (activeSessionIdRef.current !== sessionId) return;
      setAnalyses((current) =>
        mergeById(
          current.map((analysis) =>
            analysis.messageId === messageId
              ? { ...analysis, isCurrent: false }
              : analysis
          ),
          [result.analysis]
        )
      );
      setLearningItems((current) =>
        mergeById(
          current.filter(
            (item) => item.sourceMessageId !== messageId || item.status === "saved"
          ),
          result.learningItems
        )
      );
    } catch (analysisError) {
      if (activeSessionIdRef.current !== sessionId) return;
      const message = getErrorMessage(analysisError, "学习分析失败，请重试。");
      setAnalysisErrors((current) => ({ ...current, [messageId]: message }));
      if (isAiGatewayBudgetExceededError(analysisError)) {
        setAiGatewayBudgetErrorMessage(message);
      }
    } finally {
      analysisInFlightRef.current.delete(messageId);
      setAnalysisInFlightMessageIds((current) =>
        current.filter((id) => id !== messageId)
      );
    }
  }

  async function maintainSession(sessionId: string, messageId: string) {
    if (maintenanceInFlightRef.current.has(messageId)) return;
    maintenanceInFlightRef.current.add(messageId);
    const request = maintenanceQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const result = await maintainConversationSession(sessionId, messageId);
          if (activeSessionIdRef.current !== sessionId) return;
          setCurrentSession(result.session);
          setSessions((current) =>
            upsertSessionByActivity(current, result.session)
          );
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
        } catch (maintenanceError) {
          if (isAiGatewayBudgetExceededError(maintenanceError)) {
            setAiGatewayBudgetErrorMessage(
              getErrorMessage(maintenanceError, "Vercel AI Gateway 额度不足。")
            );
          }
        } finally {
          maintenanceInFlightRef.current.delete(messageId);
        }
      });
    maintenanceQueueRef.current = request.then(
      () => undefined,
      () => undefined
    );
    await request;
  }

  async function sendMessage(
    overrideContent?: string,
    retryParentMessageId?: string,
    overrideMode?: ConversationMode | null,
    retryAssistantMessageId?: string
  ) {
    const content = (overrideContent ?? input).trim();
    if (!content || isGenerating || !aiAvailable) return;
    setError(null);
    const analysisCommand = !overrideContent
      ? parseConversationAnalysisCommand(content)
      : null;
    if (analysisCommand) {
      const target = [...messages]
        .reverse()
        .find(
          (message) => message.role === "assistant" && message.status === "completed"
        );
      if (!activeSessionId || !target) {
        setError("当前没有可以分析的回答。");
        return;
      }
      setInput("");
      await analyzeMessage(activeSessionId, target.id, analysisCommand);
      return;
    }
    setCanStopGeneration(false);
    setIsGenerating(true);
    if (!overrideContent) setInput("");
    const controller = new AbortController();
    abortControllerRef.current = controller;
    let completedMessage: ConversationMessage | null = null;
    let generatedAssistantMessageId: string | null = null;
    try {
      const sessionId = await ensureSession();
      const response = await streamConversationMessage(
        sessionId,
        {
          clientMessageId: crypto.randomUUID(),
          content,
          mode: overrideMode ?? mode,
          retryParentMessageId,
          retryAssistantMessageId,
        },
        controller.signal
      );
      await consumeConversationEventStream(response, (event) => {
        if (event.type === "assistant_created") {
          generatedAssistantMessageId = event.assistantMessage.id;
          setMessages((current) =>
            mergeById(current, [event.userMessage, event.assistantMessage])
          );
          return;
        }
        if (event.type === "text_delta") {
          setMessages((current) =>
            current.map((message) =>
              message.id === generatedAssistantMessageId
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
            updateSessionActivity(current, sessionId, event.message.updatedAt)
          );
          return;
        }
        if (event.code === "AI_GATEWAY_BUDGET_EXCEEDED") {
          setAiGatewayBudgetErrorMessage(event.message);
        }
        if (event.assistantMessage) {
          setMessages((current) =>
            current.map((message) =>
              message.id === event.assistantMessage?.id
                ? event.assistantMessage
                : message
            )
          );
        } else {
          setError(event.message);
        }
      });
      if (completedMessage) {
        void maintainSession(sessionId, (completedMessage as ConversationMessage).id);
      }
    } catch (sendError) {
      if (!isAbortError(sendError)) {
        const message = getErrorMessage(sendError, "发送失败，请稍后再试。");
        setError(message);
        if (isAiGatewayBudgetExceededError(sendError)) {
          setAiGatewayBudgetErrorMessage(message);
        }
      } else {
        setMessages((current) =>
          current.map((message) =>
            message.id === generatedAssistantMessageId &&
            message.status === "streaming"
              ? { ...message, status: "cancelled", errorMessage: "回答已停止。" }
              : message
          )
        );
      }
    } finally {
      abortControllerRef.current = null;
      setCanStopGeneration(false);
      setIsGenerating(false);
    }
  }

  async function renameSession(sessionId: string, title: string) {
    const session = await updateConversationSession(sessionId, { title });
    setSessions((current) => replaceSessionByActivity(current, session));
    if (currentSession?.id === sessionId) setCurrentSession(session);
  }

  async function deleteSession(sessionId: string) {
    if (activeSessionId === sessionId) {
      abortControllerRef.current?.abort();
    }
    await deleteConversationSession(sessionId);
    setSessions((current) => current.filter((session) => session.id !== sessionId));
    if (activeSessionId === sessionId) {
      startNewConversation();
    }
  }

  async function changeMode(nextMode: ConversationMode) {
    const previousMode = mode;
    setMode(nextMode);
    if (!activeSessionId) return;
    try {
      const session = await updateConversationSession(activeSessionId, {
        mode: nextMode,
      });
      setCurrentSession(session);
      setSessions((current) => replaceSessionByActivity(current, session));
    } catch (modeError) {
      setMode(previousMode);
      setError(getErrorMessage(modeError, "对话模式保存失败，请重试。"));
    }
  }

  async function updatePreferences(input: Partial<ConversationPreferences>) {
    const request = preferencesMutationRef.current
      .catch(() => undefined)
      .then(async () => {
        const preferences = await updateConversationPreferences(input);
        setPreferences(preferences);
        if (!activeSessionIdRef.current && input.defaultMode) {
          setMode(preferences.defaultMode);
        }
      });
    preferencesMutationRef.current = request;
    return request;
  }

  async function createCollection(name: string) {
    const collection = await createConversationCollection(name);
    setCollections((current) => [collection, ...current]);
    return collection;
  }

  async function createMemory(input: {
    scope: "global" | "session";
    kind: ConversationMemoryKind;
    content: string;
  }) {
    const memory = await createConversationMemory({
      ...input,
      sessionId: activeSessionId,
    });
    if (memory.scope === "global") {
      setGlobalMemories((current) => mergeById(current, [memory]));
    } else {
      setSessionMemories((current) => mergeById(current, [memory]));
    }
  }

  async function updateMemory(
    memoryId: string,
    input: { content?: string; status?: "active" | "dismissed" }
  ) {
    const memory = await updateConversationMemory(memoryId, input);
    setGlobalMemories((current) =>
      current.map((currentMemory) =>
        currentMemory.id === memoryId ? memory : currentMemory
      )
    );
    setSessionMemories((current) =>
      current.map((currentMemory) =>
        currentMemory.id === memoryId ? memory : currentMemory
      )
    );
  }

  async function deleteMemory(memoryId: string) {
    await deleteConversationMemory(memoryId);
    setGlobalMemories((current) => current.filter((memory) => memory.id !== memoryId));
    setSessionMemories((current) => current.filter((memory) => memory.id !== memoryId));
  }

  async function promoteLearningItem(
    itemId: string,
    input: PromoteConversationLearningItemRequest
  ) {
    const result = await promoteConversationLearningItem(itemId, input);
    setLearningItems((current) =>
      current.map((item) => (item.id === itemId ? result.item : item))
    );
    return result;
  }

  async function dismissLearningItem(itemId: string) {
    const item = await dismissConversationLearningItem(itemId);
    setLearningItems((current) =>
      current.map((currentItem) =>
        currentItem.id === itemId ? item : currentItem
      )
    );
  }

  const allMemories = [...globalMemories, ...sessionMemories];
  const activeSessionPreview = sessions.find(
    (session) => session.id === activeSessionId
  );
  const headerTitle =
    currentSession?.title ??
    activeSessionPreview?.title ??
    (isSessionLoading ? "正在加载..." : "新对话");

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background text-foreground">
      <AiGatewayBudgetModal
        message={aiGatewayBudgetErrorMessage}
        onClose={() => setAiGatewayBudgetErrorMessage(null)}
      />
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
        onNewSession={startNewConversation}
        onQueryChange={setQuery}
        onRename={renameSession}
      />

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface-soft px-3 sm:px-4">
          <button type="button" aria-label="打开对话列表" onClick={() => setIsSidebarOpen(true)} className="inline-flex size-10 items-center justify-center rounded-md text-muted transition hover:bg-surface-strong hover:text-foreground lg:hidden"><MenuIcon className="size-5" /></button>
          <h1 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/80">
            {headerTitle}
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
                  analyses={analyses}
                  analysisError={analysisErrors[message.id] ?? null}
                  message={message}
                  collections={collections}
                  defaultCollectionId={preferences.defaultCollectionId}
                  learningItems={learningItems}
                  memories={allMemories}
                  isAnalyzing={analysisInFlightMessageIds.includes(message.id)}
                  onAnalyze={(messageId, options) => activeSessionId ? analyzeMessage(activeSessionId, messageId, options) : Promise.resolve()}
                  onCreateCollection={createCollection}
                  onDismissLearningItem={dismissLearningItem}
                  onPromoteLearningItem={promoteLearningItem}
                  onRetry={async (assistantMessage) => {
                    const parent = messages.find((message) => message.id === assistantMessage.parentMessageId);
                    if (parent) {
                      await sendMessage(
                        parent.content,
                        parent.id,
                        assistantMessage.mode,
                        assistantMessage.id
                      );
                    }
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
                ref={inputRef}
                aria-label="对话消息"
                value={input}
                disabled={!aiAvailable}
                maxLength={8000}
                rows={1}
                placeholder={`${MODE_LABELS[mode]}...`}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.shiftKey &&
                    !event.nativeEvent.isComposing
                  ) {
                    event.preventDefault();
                    void sendMessage();
                  }
                }}
                className="max-h-40 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto border-0 bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none disabled:cursor-not-allowed"
              />
              {isGenerating ? (
                <button type="button" aria-label="停止生成" disabled={!canStopGeneration} onClick={() => abortControllerRef.current?.abort()} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md bg-foreground text-background transition hover:opacity-85 disabled:cursor-wait disabled:opacity-55"><StopIcon className="size-4" /></button>
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
