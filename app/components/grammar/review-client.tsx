"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type {
  GrammarReviewAggregations,
  GrammarReviewItem,
  GrammarObjectiveRecommendation,
  GrammarReviewResponse,
} from "@/shared/types/grammar";
import {
  displayFeedbackSeverityLabel,
  displayMistakeTypeLabel,
  displayReviewStatusLabel,
} from "@/app/components/grammar/display-labels";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import { getErrorMessage, readJson } from "@/app/lib/api-client";
import { formatShortDateTime } from "@/app/lib/date";
import { PRACTICE_OBJECTIVE_LABELS } from "@/features/grammar-learning/domain/practice";

export function ReviewClient() {
  const [items, setItems] = useState<GrammarReviewItem[]>([]);
  const [objectiveRecommendations, setObjectiveRecommendations] = useState<
    GrammarObjectiveRecommendation[]
  >([]);
  const [aggregations, setAggregations] = useState<GrammarReviewAggregations>({
    grammarPoints: [],
    errorTypes: [],
    scenarios: [],
    registers: [],
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCompletionCount, setPendingCompletionCount] = useState(0);
  const [dueReviewCount, setDueReviewCount] = useState(0);
  const [activeFilter, setActiveFilter] = useState<{
    group: "grammarPoint" | "errorType" | "scenario" | "register";
    key: string;
    label: string;
  } | null>(null);

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
        setObjectiveRecommendations(result.objectiveRecommendations ?? []);
        setPendingCompletionCount(
          result.pendingCompletionCount ??
            result.items.filter((item) => item.status !== "mastered").length +
              (result.objectiveRecommendations?.length ?? 0)
        );
        setDueReviewCount(
          result.dueReviewCount ??
            result.items.filter((item) =>
              item.status === "mastered" &&
              item.nextReviewAt !== null &&
              new Date(item.nextReviewAt).getTime() <= Date.now()
            ).length
        );
        setAggregations(
          result.aggregations ?? {
            grammarPoints: [],
            errorTypes: [],
            scenarios: [],
            registers: [],
          }
        );
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

  const aggregationGroups = [
    { label: "具体用法", group: "grammarPoint" as const, items: aggregations.grammarPoints },
    { label: "错误类型", group: "errorType" as const, items: aggregations.errorTypes },
    { label: "场景", group: "scenario" as const, items: aggregations.scenarios },
    { label: "语体", group: "register" as const, items: aggregations.registers },
  ];
  const reviewGrammarPointCount = new Set([
    ...items.map((item) => item.grammarPoint.id),
    ...objectiveRecommendations.map((item) => item.grammarPointId),
  ]).size;
  const filteredItems = activeFilter ? items.filter((item) => {
    if (activeFilter.group === "grammarPoint") {
      return item.grammarPoint.id === activeFilter.key;
    }
    if (activeFilter.group === "errorType") {
      return item.issues.some((issue) => issue.errorTypeCode === activeFilter.key) ||
        item.mistakeTypes.includes(activeFilter.key);
    }
    if (activeFilter.group === "scenario") {
      return item.sceneTag?.nameEn === activeFilter.key;
    }
    return item.registerTag?.nameEn === activeFilter.key;
  }) : items;
  const filteredRecommendations = activeFilter
    ? activeFilter.group === "grammarPoint"
      ? objectiveRecommendations.filter((item) => item.grammarPointId === activeFilter.key)
      : []
    : objectiveRecommendations;
  const pendingItems = filteredItems.filter((item) => item.status !== "mastered");
  const dueReviewItems = filteredItems.filter((item) =>
    item.status === "mastered" &&
    item.nextReviewAt !== null &&
    new Date(item.nextReviewAt).getTime() <= Date.now()
  );
  const scheduledReviewItems = filteredItems.filter((item) =>
    item.status === "mastered" && !dueReviewItems.includes(item)
  );
  const orderedItems = [...pendingItems, ...dueReviewItems, ...scheduledReviewItems];

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.6vw,26px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xl leading-tight font-semibold text-white/78">复习</p>
            <p className="mt-1 text-sm leading-6 text-white/42">
              共 {reviewGrammarPointCount} 个具体用法：待完成 {pendingCompletionCount}，待复习 {dueReviewCount}。
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

      {!isLoading && !error && items.length > 0 ? (
        <details className="group mt-6 border-y border-white/8 py-4">
          <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-white/58 marker:hidden">
            <span>{activeFilter ? `筛选：${activeFilter.label}` : "筛选复习记录"}</span>
            <span aria-hidden="true" className="text-white/32 transition group-open:rotate-180">⌄</span>
          </summary>
          <section className="grid gap-5 pt-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="复习筛选">
            {aggregationGroups.map((group) => (
              <div key={group.label}>
                <p className="text-sm font-semibold text-white/46">{group.label}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {group.items.map((aggregateItem) => (
                    <button
                      type="button"
                      key={aggregateItem.key}
                      aria-pressed={activeFilter?.group === group.group && activeFilter.key === aggregateItem.key}
                      onClick={() => setActiveFilter((current) =>
                        current?.group === group.group && current.key === aggregateItem.key
                          ? null
                          : { group: group.group, key: aggregateItem.key, label: aggregateItem.label }
                      )}
                      className={activeFilter?.group === group.group && activeFilter.key === aggregateItem.key
                        ? "inline-flex min-h-8 items-center rounded-full border border-accent/40 bg-accent-soft px-3 py-1 text-xs font-semibold text-accent-strong"
                        : "inline-flex min-h-8 items-center rounded-full border border-white/10 px-3 py-1 text-xs text-white/58 transition hover:border-white/22 hover:text-white/76"}
                    >
                      {aggregateItem.label}
                      <span className="ml-2 text-white/30">{aggregateItem.count}</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </details>
      ) : null}

      {activeFilter ? (
        <div className="mt-5 flex items-center justify-between gap-3 border-b border-white/8 pb-4 text-sm text-white/54">
          <span>正在查看：{activeFilter.label} · {filteredItems.length} 条</span>
          <button type="button" onClick={() => setActiveFilter(null)} className="font-semibold text-accent-strong transition hover:text-accent">
            清除筛选
          </button>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}

      {!isLoading && !error && filteredRecommendations.length > 0 ? (
        <section id="pending" className="mt-6 scroll-mt-20 border-y border-white/8 py-5" aria-labelledby="objective-review-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 id="objective-review-heading" className="text-lg font-semibold text-white/76">
                待完成建议
              </h2>
              <p className="mt-1 text-sm leading-6 text-white/42">
                每个尚未完成的语法点只显示一条记录，学习目标合并展示。
              </p>
            </div>
          </div>
          <div className="mt-4 divide-y divide-white/8">
            {filteredRecommendations.slice(0, 4).map((recommendation) => (
              <div
                key={recommendation.grammarPointId}
                className="grid gap-4 py-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/grammar/${recommendation.grammarPointId}`}
                      className="text-lg font-semibold text-white/78 transition hover:text-white"
                    >
                      {recommendation.grammarPoint}
                    </Link>
                    {recommendation.objectives.map((objective) => (
                      <TagBadge
                        key={objective.learningObjective}
                        tag={PRACTICE_OBJECTIVE_LABELS[objective.learningObjective]}
                      />
                    ))}
                    <span className="text-xs text-white/34">
                      综合掌握 {Math.round(recommendation.overallEstimate * 100)}%
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/52">
                    {recommendation.reasonZh}
                  </p>
                </div>
                <Link
                  href={`/practice?grammarId=${recommendation.grammarPointId}&mode=review`}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong"
                >
                  开始复习
                </Link>
              </div>
            ))}
          </div>
        </section>
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

      {!isLoading && !error && filteredItems.length === 0 && filteredRecommendations.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">
            {activeFilter ? "这个筛选下没有复习项" : "暂时没有复习项"}
          </p>
          <Link
            href="/grammar"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
          >
            去练习
          </Link>
        </div>
      ) : null}

      {!isLoading && orderedItems.length > 0 ? (
        <div className="mt-6 space-y-4">
          {orderedItems.map((item, index) => (
            <div key={item.reviewRecordId}>
              {index === 0 && pendingItems.length > 0 ? (
                <h2
                  id={filteredRecommendations.length === 0 ? "pending" : undefined}
                  className="mb-3 scroll-mt-20 text-lg font-semibold text-white/76"
                >
                  待完成
                </h2>
              ) : null}
              {index === pendingItems.length && dueReviewItems.length > 0 ? (
                <h2 id="due-review" className="mb-3 scroll-mt-20 text-lg font-semibold text-white/76">
                  今日待复习
                </h2>
              ) : null}
              {index === pendingItems.length + dueReviewItems.length && scheduledReviewItems.length > 0 ? (
                <h2 className="mb-3 text-lg font-semibold text-white/76">
                  之后复习
                </h2>
              ) : null}
              <article className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <PracticalityBadge practicality={item.grammarPoint.practicality} />
                    <TagBadge tag={displayReviewStatusLabel(item.status)} />
                    <TagBadge tag={`错误 ${item.mistakeCount}`} />
                    {item.sceneTag ? <TagBadge tag={item.sceneTag} tone="scene" /> : null}
                    {item.registerTag ? (
                      <TagBadge tag={item.registerTag} tone="register" />
                    ) : null}
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
                  {item.objectiveProgress && item.objectiveProgress.length > 0 ? (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {item.objectiveProgress.map((objective) => (
                        <TagBadge
                          key={objective.learningObjective}
                          tag={PRACTICE_OBJECTIVE_LABELS[objective.learningObjective]}
                        />
                      ))}
                      {item.overallEstimate !== null && item.overallEstimate !== undefined ? (
                        <span className="text-xs text-white/34">
                          综合掌握 {Math.round(item.overallEstimate * 100)}%
                        </span>
                      ) : null}
                    </div>
                  ) : null}
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

              {item.issues.length > 0 ? (
                <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
                  {item.issues.map((issue) => (
                    <div key={issue.errorTypeCode} className="py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <TagBadge
                          tag={displayMistakeTypeLabel(issue.errorTypeCode)}
                        />
                        <span className="text-xs text-white/34">
                          {displayFeedbackSeverityLabel(issue.severity)}
                        </span>
                        {issue.role ? (
                          <span className="text-xs font-medium text-accent-strong">
                            {issue.role === "root" ? "主要问题" : "伴随影响"}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-2 text-sm leading-6 text-white/54">
                        {issue.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {item.issues.length === 0
                    ? item.mistakeTypes.map((mistakeType) => (
                        <TagBadge
                          key={mistakeType}
                          tag={displayMistakeTypeLabel(mistakeType)}
                        />
                      ))
                    : null}
                </div>
                <Link
                  href={`/practice?grammarId=${item.grammarPoint.id}&mode=review`}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong"
                >
                  {item.status === "mastered" ? "开始复习" : "继续练习"}
                </Link>
              </div>
              </article>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
