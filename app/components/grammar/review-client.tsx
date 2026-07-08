"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GrammarReviewItem, GrammarReviewResponse } from "@/shared/types/api";
import {
  displayMistakeTypeLabel,
  displayReviewStatusLabel,
} from "@/app/components/grammar/display-labels";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import { getErrorMessage, readJson } from "@/app/lib/api-client";
import { formatShortDateTime } from "@/app/lib/date";

export function ReviewClient() {
  const [items, setItems] = useState<GrammarReviewItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function loadReviewItems() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetch("/api/review/today", {
          signal: controller.signal,
        }).then((response) => readJson<GrammarReviewResponse>(response));
        setItems(result.items);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "复习记录加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadReviewItems();

    return () => {
      controller.abort();
    };
  }, []);

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.6vw,26px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xl leading-tight font-semibold text-white/78">复习</p>
            <p className="mt-1 text-sm leading-6 text-white/42">
              当前 {items.length} 个语法点需要回看。
            </p>
          </div>
          <Link
            href="/grammar"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/55 transition hover:border-white/20 hover:text-white/72"
          >
            返回文法
          </Link>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-56 animate-pulse rounded-[18px] border border-white/8 bg-[#1a1a1a99]"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">暂时没有复习项</p>
          <Link
            href="/grammar"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
          >
            去练习
          </Link>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="mt-6 space-y-4">
          {items.map((item) => (
            <article
              key={item.reviewRecordId}
              className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PracticalityBadge practicality={item.grammarPoint.practicality} />
                    <TagBadge tag={displayReviewStatusLabel(item.status)} />
                    <TagBadge tag={`错误 ${item.mistakeCount}`} />
                  </div>
                  <Link
                    href={`/grammar/${item.grammarPoint.id}`}
                    className="mt-3 block break-words text-3xl leading-tight font-semibold text-white/82 transition hover:text-white"
                  >
                    {item.grammarPoint.grammarPoint}
                  </Link>
                  <p className="mt-2 text-sm leading-6 text-white/52">
                    {item.grammarPoint.coreMeaning}
                  </p>
                </div>
                <div className="shrink-0 text-sm leading-6 text-white/38">
                  下次：{formatShortDateTime(item.nextReviewAt, "待安排")}
                </div>
              </div>

              {item.latestSentence ? (
                <div className="mt-5 rounded-[14px] border border-white/8 bg-[#15151599] p-4">
                  <p className="text-xs font-semibold text-white/38">最近句子</p>
                  <p className="mt-2 text-sm leading-6 text-white/72">
                    {item.latestSentence}
                  </p>
                </div>
              ) : null}

              {item.latestFeedback ? (
                <p className="mt-4 text-sm leading-6 text-white/54">
                  {item.latestFeedback}
                </p>
              ) : null}

              {item.correctedSentence ? (
                <p className="mt-4 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm leading-6 text-accent-strong">
                  {item.correctedSentence}
                </p>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {item.mistakeTypes.map((mistakeType) => (
                    <TagBadge key={mistakeType} tag={displayMistakeTypeLabel(mistakeType)} />
                  ))}
                </div>
                <Link
                  href={`/practice?grammarId=${item.grammarPoint.id}`}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong"
                >
                  再练一次
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  );
}
