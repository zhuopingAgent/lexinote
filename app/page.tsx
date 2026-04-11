"use client";

import { FormEvent, useId, useRef, useState } from "react";
import type { WordLookupResponse } from "@/shared/types/api";
import {
  AppBrandIcon,
  BookIcon,
  CollectionIcon,
  HistoryIcon,
  SearchIcon,
  StarIcon,
} from "@/app/components/icons";
import { WordCard } from "@/app/components/word-card";
import { WordCardSkeleton } from "@/app/components/word-card-skeleton";
import { mapResultToWordData } from "@/app/lib/word-data";

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

const SIDEBAR_ITEMS = [
  { label: "辞書", icon: BookIcon, active: true },
  { label: "お気に入り", icon: StarIcon, active: false },
  { label: "履歴", icon: HistoryIcon, active: false },
  { label: "コレクション", icon: CollectionIcon, active: false },
];

const TOP_NAV_ITEMS = [
  { label: "辞書", active: true },
  { label: "語彙", active: false },
];

export default function Home() {
  const [word, setWord] = useState("");
  const [result, setResult] = useState<WordLookupResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const statusId = useId();
  const resultCacheRef = useRef(new Map<string, WordLookupResponse>());
  const canSubmit = word.trim().length > 0 && !isLoading;
  const hasResult = result !== null;
  const showsLookupWordHint = result !== null && result.lookupWord !== result.word;
  const wordCardData = result ? mapResultToWordData(result) : null;
  const statusMessage = error
    ? `查询失败：${error}`
    : result
      ? showsLookupWordHint
        ? `已完成 ${result.word} 的查询，并按原形 ${result.lookupWord} 检索。`
        : `已完成 ${result.word} 的查询。`
      : isLoading
        ? "正在查询单词。"
        : "输入一个日语词即可开始查询。";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedWord = word.trim();

    if (!normalizedWord) {
      setError("请输入一个日语单词。");
      setResult(null);
      return;
    }

    const cachedResult = resultCacheRef.current.get(normalizedWord);
    if (cachedResult) {
      setError(null);
      setResult(cachedResult);
      setIsLoading(false);
      return;
    }

    setError(null);
    setResult(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/words/lookup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ word: normalizedWord }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as WordLookupResponse;
      resultCacheRef.current.set(normalizedWord, payload);
      setResult(payload);
    } catch (lookupError) {
      const message =
        lookupError instanceof Error ? lookupError.message : "发生了意外错误";
      setError(message);
      setResult(null);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col overflow-x-clip bg-background text-foreground">
      <header className="border-b border-black/50 bg-[#1e1e1ecc]">
        <div className="mr-auto flex h-[clamp(56px,6vw,60px)] w-full max-w-[1160px] items-center gap-[clamp(24px,5vw,48px)] pl-[clamp(16px,4vw,32px)] pr-[clamp(16px,3vw,24px)]">
          <div className="flex items-center gap-2.5">
            <AppBrandIcon className="size-[clamp(22px,2.5vw,24px)] text-accent" />
            <p className="text-[clamp(17px,2.3vw,20px)] font-medium tracking-[-0.03em] text-white/70">
              LexiNote
            </p>
          </div>

          <nav
            className="flex items-center gap-[clamp(12px,2.4vw,24px)] whitespace-nowrap"
            aria-label="Primary"
          >
            {TOP_NAV_ITEMS.map((item) => (
              <span
                key={item.label}
                className={
                  item.active
                    ? "text-[clamp(13px,1.8vw,16px)] text-white/60"
                    : "text-[clamp(13px,1.8vw,16px)] text-white/45"
                }
              >
                {item.label}
              </span>
            ))}
          </nav>
        </div>
      </header>

      <div className="flex flex-1 flex-col md:grid md:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden border-r border-white/10 bg-[#1e1e1e80] md:block">
          <div className="px-4 py-4">
            <nav className="space-y-1" aria-label="Sidebar">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    aria-current={item.active ? "page" : undefined}
                    className={
                      item.active
                        ? "flex h-12 w-full items-center gap-3 rounded-[10px] bg-white/10 px-4 text-left text-white/70"
                        : "flex h-12 w-full items-center gap-3 rounded-[10px] px-4 text-left text-white/40 transition hover:bg-white/5 hover:text-white/60"
                    }
                  >
                    <Icon className="size-5 shrink-0" />
                    <span className="text-base font-medium tracking-[-0.02em]">
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-white/10 px-4 py-3 md:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1 pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {SIDEBAR_ITEMS.map((item) => {
                const Icon = item.icon;

                return (
                  <button
                    key={item.label}
                    type="button"
                    className={
                      item.active
                        ? "inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/70"
                        : "inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-white/45"
                    }
                  >
                    <Icon className="size-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <section className="flex-1 px-[clamp(16px,4vw,40px)] py-[clamp(32px,4vw,48px)]">
            <p id={statusId} className="sr-only" aria-live="polite" aria-atomic="true">
              {statusMessage}
            </p>

            <div className="mx-auto w-full max-w-[848px]">
              <div>
                <form
                  onSubmit={onSubmit}
                  aria-describedby={statusId}
                  className="mx-auto w-full max-w-[672px]"
                >
                  <label className="relative block">
                    <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/35" />
                    <input
                      type="search"
                      value={word}
                      onChange={(event) => setWord(event.target.value)}
                      placeholder="日本語の単語を入力してください..."
                      aria-label="日语词"
                      className="h-[clamp(48px,5vw,50px)] w-full rounded-[clamp(12px,2vw,14px)] border border-white/20 bg-[#1e1e1ecc] pl-12 pr-4 text-sm tracking-[-0.01em] text-white/78 outline-none placeholder:text-white/35 focus:border-white/30 focus:ring-2 focus:ring-white/10"
                    />
                  </label>
                  <button type="submit" disabled={!canSubmit} className="sr-only">
                    开始查询
                  </button>
                </form>
              </div>

              {error ? (
                <div
                  role="alert"
                  className="mt-8 rounded-2xl border border-danger/30 bg-danger-soft/80 px-5 py-4 text-danger"
                >
                  <p className="text-sm font-semibold">查询失败</p>
                  <p className="mt-1 text-sm leading-6">{error}</p>
                </div>
              ) : null}

              {(isLoading || hasResult) && !error ? (
                <div
                  className={
                    showsLookupWordHint
                      ? "mt-[clamp(14px,2vw,18px)] flex flex-col items-center gap-3"
                      : "mt-[clamp(32px,4vw,40px)] flex flex-col items-center gap-4"
                  }
                >
                  {showsLookupWordHint ? (
                    <div className="flex flex-col items-center gap-1.5">
                      <p className="text-center text-sm leading-6 text-white/45">
                        已按原形「{result.lookupWord}」查询
                      </p>
                      {result.lookupReason ? (
                        <p className="max-w-[32rem] text-center text-xs leading-5 text-white/32">
                          {result.lookupReason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {wordCardData ? (
                    <WordCard word={wordCardData} />
                  ) : (
                    <WordCardSkeleton />
                  )}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex min-h-[clamp(72px,8vw,84px)] w-full max-w-[1160px] items-center justify-center px-[clamp(16px,3vw,24px)] py-5 text-center text-xs leading-6 text-white/40 sm:text-sm md:py-0">
          日本語学習辞書 - Japanese Learning Dictionary
        </div>
      </footer>
    </main>
  );
}
