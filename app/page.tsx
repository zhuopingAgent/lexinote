"use client";

import { FormEvent, useState } from "react";
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

export default function Home() {
  const [word, setWord] = useState("");
  const [model, setModel] = useState<SupportedAiModel>("gpt-5.4");
  const [preview, setPreview] = useState<WordLookupPreview | null>(null);
  const [result, setResult] = useState<WordLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExplanationLoading, setIsExplanationLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const canSubmit = word.trim().length > 0 && !isLoading;
  const display = result ?? preview;

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
        throw new Error(payload.error?.message || "Request failed");
      }

      if (!response.body) {
        throw new Error("Streaming response is not available");
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
        submitError instanceof Error ? submitError.message : "Unexpected error";
      setError(message);
      setPreview(null);
      setResult(null);
      setIsExplanationLoading(false);
      setStreamingText("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10 sm:px-8">
      <header className="flex justify-center border-b border-zinc-200/80 pb-6">
        <div className="w-full max-w-3xl">
          <p className="text-[11px] tracking-[0.24em] text-zinc-500 uppercase">
            LexiNote
          </p>
          <h1 className="mt-3 text-2xl font-medium tracking-tight text-zinc-900">
            Japanese AI Word Explainer
          </h1>
        </div>
      </header>

      <section className="flex flex-1 flex-col items-center py-14 sm:py-18">
        <div className="w-full max-w-3xl space-y-8">
          <div className="space-y-3 text-center">
            <p className="text-sm leading-7 text-zinc-600">
              输入一个日语词，查看基础词典信息，以及面向中文母语者的学习型解释。
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-3xl border border-zinc-200 bg-white px-4 py-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)] sm:px-5"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="flex-1">
                <span className="mb-2 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Japanese word
                </span>
                <input
                  type="text"
                  value={word}
                  onChange={(event) => setWord(event.target.value)}
                  placeholder="例如：食べる"
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                />
              </label>
              <label className="sm:w-44">
                <span className="mb-2 block text-xs font-medium tracking-wide text-zinc-500 uppercase">
                  Model
                </span>
                <select
                  value={model}
                  onChange={(event) =>
                    setModel(event.target.value as SupportedAiModel)
                  }
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-[15px] text-zinc-900 outline-none transition focus:border-zinc-400 focus:bg-white"
                >
                  <option value="gpt-5.4">GPT-5.4</option>
                  <option value="gpt-5-mini">GPT-5 mini</option>
                  <option value="gpt-5-nano">GPT-5 nano</option>
                </select>
              </label>
              <button
                type="submit"
                disabled={!canSubmit}
                className="rounded-2xl border border-zinc-900 bg-zinc-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:border-zinc-300 disabled:bg-zinc-300"
              >
                {isLoading ? "Searching..." : "Search"}
              </button>
            </div>
          </form>

          <section className="space-y-4">
            {!isLoading && !error && !display ? (
              <div className="rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/70 px-6 py-12 text-center">
                <p className="text-sm text-zinc-600">
                  还没有结果。输入一个日语词后点击 Search。
                </p>
              </div>
            ) : null}

            {isLoading && !display ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <div className="h-5 w-28 animate-pulse rounded bg-zinc-200" />
                  <div className="mt-4 space-y-3">
                    <div className="h-4 w-40 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-32 animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
                <div className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <div className="h-5 w-36 animate-pulse rounded bg-zinc-200" />
                  <div className="mt-4 space-y-3">
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                    <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
                  </div>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="rounded-3xl border border-red-200 bg-red-50 px-6 py-5">
                <p className="text-sm font-medium text-red-700">查询失败</p>
                <p className="mt-1 text-sm text-red-600">{error}</p>
              </div>
            ) : null}

            {display ? (
              <div className="space-y-4">
                <article className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                        Dictionary Entry
                      </p>
                      <h2 className="mt-3 text-3xl font-medium tracking-tight text-zinc-950">
                        {display.entry?.word ?? display.word}
                      </h2>
                    </div>
                    <div className="grid gap-3 text-sm text-zinc-700 sm:min-w-56">
                      <p>
                        <span className="text-zinc-500">读音 / Kana</span>
                        <span className="ml-3 text-zinc-900">
                          {display.entry?.reading || "需结合上下文确认"}
                        </span>
                      </p>
                      <p>
                        <span className="text-zinc-500">词性</span>
                        <span className="ml-3 text-zinc-900">
                          {display.entry?.partOfSpeech || "需结合上下文确认"}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 border-t border-zinc-100 pt-5">
                    <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                      Basic Meaning
                    </p>
                    <p className="mt-2 text-[15px] leading-7 text-zinc-900">
                      {display.entry?.meaningZh || "本地词典未命中，以下为 AI 基于单词本身生成的解释。"}
                    </p>
                  </div>
                </article>

                <article className="rounded-3xl border border-zinc-200 bg-white p-6">
                  <p className="text-xs font-medium tracking-wide text-zinc-500 uppercase">
                    AI Explanation
                  </p>
                  {result ? (
                    <div className="mt-5 grid gap-5">
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-4">
                        <h3 className="text-sm font-medium text-zinc-900">
                          实际用法
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                          {result.explanation.actualUsage}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-4">
                        <h3 className="text-sm font-medium text-zinc-900">
                          常见场景
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                          {result.explanation.commonScenarios}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-4">
                        <h3 className="text-sm font-medium text-zinc-900">
                          语感与近义差别
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                          {result.explanation.nuanceDifferences}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-4">
                        <h3 className="text-sm font-medium text-zinc-900">
                          中文母语者常犯错误
                        </h3>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                          {result.explanation.commonMistakes}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-5 space-y-4">
                      <p className="text-sm text-zinc-600">
                        已返回基础词典信息，AI explanation 正在生成。
                      </p>
                      {streamingText ? (
                        <div className="rounded-2xl border border-zinc-100 bg-zinc-50/60 px-4 py-4">
                          <p className="whitespace-pre-wrap text-sm leading-7 text-zinc-700">
                            {streamingText}
                          </p>
                        </div>
                      ) : null}
                      {isExplanationLoading ? (
                        <div className="space-y-3">
                          <div className="h-4 w-32 animate-pulse rounded bg-zinc-200" />
                          <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                          <div className="h-4 w-full animate-pulse rounded bg-zinc-100" />
                          <div className="h-4 w-5/6 animate-pulse rounded bg-zinc-100" />
                        </div>
                      ) : null}
                    </div>
                  )}
                </article>
              </div>
            ) : null}
          </section>
        </div>
      </section>
    </main>
  );
}
