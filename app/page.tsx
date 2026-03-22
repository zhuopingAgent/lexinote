"use client";

import { FormEvent, useEffect, useId, useState } from "react";
import type {
  SupportedAiModel,
  WordLookupPreview,
  WordLookupResponse,
  WordLookupStreamEvent,
} from "@/shared/types/api";

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type ExplanationSection = {
  key: keyof WordLookupResponse["explanation"];
  title: string;
  description: string;
};

const EXPLANATION_SECTIONS: ExplanationSection[] = [
  {
    key: "actualUsage",
    title: "实际用法",
    description: "这个词最自然的使用方式与常见搭配。",
  },
  {
    key: "commonScenarios",
    title: "常见场景",
    description: "它最常出现在哪类语境里。",
  },
  {
    key: "nuanceDifferences",
    title: "语感与近义差别",
    description: "和近义表达相比，差别通常体现在哪里。",
  },
  {
    key: "commonMistakes",
    title: "中文母语者常犯错误",
    description: "学习时最容易误解或误用的地方。",
  },
];

const SAMPLE_WORDS = ["食べる", "大丈夫", "気になる"];
const THEME_STORAGE_KEY = "lexinote-theme";
type ThemeMode = "light" | "dark";

export default function Home() {
  const [word, setWord] = useState("");
  const [model, setModel] = useState<SupportedAiModel>("gpt-5.4");
  const [preview, setPreview] = useState<WordLookupPreview | null>(null);
  const [result, setResult] = useState<WordLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [theme, setTheme] = useState<ThemeMode | null>(null);
  const statusId = useId();
  const canSubmit = word.trim().length > 0 && !isLoading;
  const display = result ?? preview;
  const hasDisplay = display !== null;
  const hasStartedSearch = isLoading || isExplanationLoading || hasDisplay || !!error;
  const isFallbackExplanation = result?.explanationSource === "fallback";
  const statusMessage = error
    ? `查询失败：${error}`
    : result && isFallbackExplanation
      ? `已完成 ${result.word} 的词典查询，OpenAI 暂时没有返回结果，页面已显示兜底讲解。`
      : result
        ? `已完成 ${result.word} 的查询。`
        : preview
          ? `已获取 ${preview.word} 的词典信息，正在生成讲解。`
          : isLoading
            ? "正在查询词典与生成讲解。"
            : "输入一个日语词即可开始查询。";

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    const preferredTheme =
      savedTheme === "light" || savedTheme === "dark"
        ? savedTheme
        : window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";

    setTheme(preferredTheme);
  }, []);

  useEffect(() => {
    if (!theme) {
      return;
    }

    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  function applyStreamEvent(event: WordLookupStreamEvent) {
    if (event.type === "preview") {
      setPreview(event.data);
      setResult(null);
      setIsExplanationLoading(true);
      setStreamingText("");
      return;
    }

    if (event.type === "ai_delta") {
      setStreamingText((current) => current + event.data.delta);
      return;
    }

    if (event.type === "complete") {
      setPreview(null);
      setResult(event.data);
      setIsExplanationLoading(false);
      setStreamingText("");
      return;
    }

    setError(event.data.message);
    setIsExplanationLoading(false);
    setStreamingText("");
  }

  function parseSseEvents(chunk: string) {
    return chunk
      .split("\n\n")
      .map((block) => block.trim())
      .filter(Boolean)
      .flatMap((block) =>
        block
          .split("\n")
          .filter((line) => line.startsWith("data: "))
          .map((line) => line.slice(6))
      );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!word.trim()) {
      setError("请输入一个日语单词。");
      setResult(null);
      return;
    }

    setError(null);
    setPreview(null);
    setResult(null);
    setIsLoading(true);
    setIsExplanationLoading(false);
    setStreamingText("");

    try {
      const response = await fetch("/api/words/explain", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word, model }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      if (!response.body) {
        throw new Error("当前环境不支持流式响应");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";

        for (const part of parts) {
          for (const data of parseSseEvents(part)) {
            applyStreamEvent(JSON.parse(data) as WordLookupStreamEvent);
          }
        }
      }

      for (const data of parseSseEvents(buffer)) {
        applyStreamEvent(JSON.parse(data) as WordLookupStreamEvent);
      }
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "发生了意外错误";
      setError(message);
      setPreview(null);
      setResult(null);
      setIsExplanationLoading(false);
      setStreamingText("");
    } finally {
      setIsLoading(false);
    }
  }

  function fillSample(sampleWord: string) {
    setWord(sampleWord);
    setError(null);
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 sm:py-10">
      <div className="w-full">
        <section className="overflow-hidden rounded-[2rem] border border-border bg-surface/95 shadow-[var(--shadow)]">
          <div className="flex items-center justify-between gap-4 border-b border-border/80 px-6 py-5 sm:px-8">
            <p className="text-[11px] font-semibold tracking-[0.32em] text-accent uppercase">
              LexiNote
            </p>
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-border bg-surface px-3 py-2 text-sm font-medium text-foreground transition hover:border-accent/50 hover:text-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
              aria-label={theme === "dark" ? "切换到浅色模式" : "切换到深色模式"}
            >
              {theme === "dark" ? "浅色模式" : "深色模式"}
            </button>
          </div>

          <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-start">
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                  面向中文母语者的日语词汇解释工具
                </div>
                <div className="space-y-3">
                  <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-foreground sm:text-5xl">
                    查一个日语词，立刻看到词典信息与学习重点
                  </h1>
                  <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                    先返回基础词典条目，再继续生成更适合中文母语者理解的语感、场景和常见误区。整个过程会分阶段展示，不用等到最后一刻才看到内容。
                  </p>
                </div>
              </div>

              <form
                onSubmit={onSubmit}
                aria-describedby={statusId}
                className="rounded-[1.75rem] border border-border bg-surface-soft p-4 sm:p-5"
              >
                <div className="grid gap-3 lg:grid-cols-[1fr_12rem_auto] lg:items-end">
                  <label className="space-y-2">
                    <span className="block text-xs font-semibold tracking-[0.22em] text-muted uppercase">
                      日语词
                    </span>
                    <input
                      type="text"
                      value={word}
                      onChange={(event) => setWord(event.target.value)}
                      placeholder="例如：食べる"
                      aria-label="日语词"
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[15px] text-foreground outline-none transition duration-150 placeholder:text-muted/70 focus:border-accent focus:ring-4 focus:ring-accent/15"
                    />
                  </label>

                  <label className="space-y-2">
                    <span className="block text-xs font-semibold tracking-[0.22em] text-muted uppercase">
                      模型
                    </span>
                    <select
                      value={model}
                      onChange={(event) =>
                        setModel(event.target.value as SupportedAiModel)
                      }
                      aria-label="模型"
                      className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-[15px] text-foreground outline-none transition duration-150 focus:border-accent focus:ring-4 focus:ring-accent/15"
                    >
                      <option value="gpt-5.4">GPT-5.4</option>
                      <option value="gpt-5-mini">GPT-5 mini</option>
                      <option value="gpt-5-nano">GPT-5 nano</option>
                    </select>
                  </label>

                  <button
                    type="submit"
                    disabled={!canSubmit}
                    className="rounded-2xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong focus:outline-none focus:ring-4 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-muted/50"
                  >
                    {isLoading ? "查询中..." : "开始查询"}
                  </button>
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">试试这些词：</span>
                  {SAMPLE_WORDS.map((sampleWord) => (
                    <button
                      key={sampleWord}
                      type="button"
                      onClick={() => fillSample(sampleWord)}
                      className="rounded-full border border-border bg-surface px-3 py-1.5 text-sm text-foreground transition hover:border-accent/50 hover:text-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
                    >
                      {sampleWord}
                    </button>
                  ))}
                </div>
              </form>
            </div>

            <aside className="rounded-[1.75rem] border border-border bg-surface-soft p-5">
              <p className="text-xs font-semibold tracking-[0.22em] text-muted uppercase">
                查询节奏
              </p>
              <div className="mt-4 space-y-4">
                <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <p className="text-sm font-medium text-foreground">1. 先看词典</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    先确认写法、读音、词性和基础义项，避免一开始就被大段解释淹没。
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <p className="text-sm font-medium text-foreground">2. 再看语感</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    AI 会补上常见场景、近义差别和中文母语者最容易踩坑的地方。
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface px-4 py-4">
                  <p className="text-sm font-medium text-foreground">3. 分阶段返回</p>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    页面会先显示已拿到的内容，再持续补全，不必等所有部分都生成完。
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        <section
          className="mt-6 space-y-4"
          aria-busy={isLoading || isExplanationLoading}
          aria-describedby={statusId}
        >
          <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
            {statusMessage}
          </p>

          {error ? (
            <div
              role="alert"
              className="rounded-[1.75rem] border border-danger/30 bg-danger-soft px-6 py-5 text-danger"
            >
              <p className="text-sm font-semibold">查询失败</p>
              <p className="mt-1 text-sm leading-6">{error}</p>
            </div>
          ) : null}

          {!hasStartedSearch && !error ? (
            <div className="rounded-[1.75rem] border border-dashed border-border bg-surface/70 px-6 py-12 text-center shadow-[var(--shadow)]">
              <p className="text-lg font-medium text-foreground">还没有结果</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                输入一个日语词后点击“开始查询”，页面会先返回词典信息，再继续补全学习讲解。
              </p>
            </div>
          ) : null}

          {(isLoading || hasDisplay) && !error ? (
            <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
              <article className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow)]">
                <div className="border-b border-border bg-surface-soft px-6 py-5">
                  <p className="text-xs font-semibold tracking-[0.22em] text-muted uppercase">
                    词典卡片
                  </p>
                  {display ? (
                    <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <h2 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                          {display.entry?.word ?? display.word}
                        </h2>
                        <p className="mt-2 text-sm text-muted">
                          {display.entry?.meaningZh || "本地词典未命中，以下内容将主要由 AI 补充解释。"}
                        </p>
                      </div>
                      <div className="inline-flex w-fit rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent">
                        {result ? "讲解已完成" : "词典已返回"}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      <div className="h-10 w-40 animate-pulse rounded-xl bg-surface-strong" />
                      <div className="h-4 w-full animate-pulse rounded bg-surface-strong" />
                    </div>
                  )}
                </div>

                <div className="space-y-5 px-6 py-6">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-surface-soft px-4 py-4">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        读音
                      </p>
                      <p className="mt-2 text-base text-foreground">
                        {display ? display.entry?.pronunciation || "需结合上下文确认" : "加载中"}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-border bg-surface-soft px-4 py-4">
                      <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                        词性
                      </p>
                      <p className="mt-2 text-base text-foreground">
                        {display ? display.entry?.partOfSpeech || "需结合上下文确认" : "加载中"}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-surface-soft px-4 py-4">
                    <p className="text-xs font-semibold tracking-wide text-muted uppercase">
                      基础释义
                    </p>
                    {display ? (
                      <p className="mt-2 text-[15px] leading-7 text-foreground">
                        {display.entry?.meaningZh || "本地词典未命中，以下为 AI 基于单词本身生成的解释。"}
                      </p>
                    ) : (
                      <div className="mt-3 space-y-3">
                        <div className="h-4 w-full animate-pulse rounded bg-surface-strong" />
                        <div className="h-4 w-4/5 animate-pulse rounded bg-surface-strong" />
                      </div>
                    )}
                  </div>
                </div>
              </article>

              <article className="overflow-hidden rounded-[1.75rem] border border-border bg-surface shadow-[var(--shadow)]">
                <div className="border-b border-border bg-surface-soft px-6 py-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold tracking-[0.22em] text-muted uppercase">
                        学习讲解
                      </p>
                      <p className="mt-2 text-sm leading-6 text-muted">
                        不只解释“是什么意思”，也解释“什么时候这样说才自然”。
                      </p>
                    </div>
                    <div className="inline-flex w-fit rounded-full border border-border bg-surface px-3 py-1 text-xs font-medium text-muted">
                      {result && isFallbackExplanation
                        ? "兜底讲解"
                        : result
                        ? "4 / 4 已完成"
                        : isExplanationLoading || isLoading
                          ? "生成中"
                          : "等待查询"}
                    </div>
                  </div>

                  {!result && (isExplanationLoading || streamingText) ? (
                    <div className="mt-4 rounded-2xl border border-accent/20 bg-accent-soft px-4 py-4">
                      <p className="text-sm font-medium text-accent">正在生成详细讲解</p>
                      <p className="mt-1 text-sm leading-6 text-foreground">
                        已返回基础词典信息，下面的卡片会在结果准备好后完整呈现。
                      </p>
                      {streamingText ? (
                        <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm leading-6 text-muted">
                          {streamingText}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {isFallbackExplanation ? (
                    <div className="mt-4 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-4 text-amber-900">
                      <p className="text-sm font-semibold">
                        OpenAI API 当前没有返回可用结果
                      </p>
                      <p className="mt-1 text-sm leading-6">
                        不论是网络、鉴权、限流、模型或上游服务原因，页面都会先展示兜底讲解。你可以稍后重试。
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
                  {EXPLANATION_SECTIONS.map((section) => {
                    const content = result?.explanation[section.key];

                    return (
                      <section
                        key={section.key}
                        className="rounded-2xl border border-border bg-surface-soft px-4 py-4"
                      >
                        <h3 className="text-sm font-semibold text-foreground">
                          {section.title}
                        </h3>
                        <p className="mt-1 text-sm leading-6 text-muted">
                          {section.description}
                        </p>

                        {content ? (
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground">
                            {content}
                          </p>
                        ) : (
                          <div className="mt-4 space-y-3" aria-hidden="true">
                            <div className="h-4 w-full animate-pulse rounded bg-surface-strong" />
                            <div className="h-4 w-full animate-pulse rounded bg-surface-strong" />
                            <div className="h-4 w-5/6 animate-pulse rounded bg-surface-strong" />
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              </article>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}
