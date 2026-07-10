"use client";

import Link from "next/link";
import type { GrammarProgressGroup, GrammarProgressResponse } from "@/shared/types/api";

type GrammarProgressOverviewProps = {
  progress: GrammarProgressResponse | null;
  selectedGroupSlug: string;
  selectedCategoryName?: string | null;
  resultCount: number;
  isLoading: boolean;
  error?: string | null;
  onGroupSelect: (groupSlug: string) => void;
};

function clampPercent(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(Math.max(value, 0), 100);
}

function formatPercent(part: number, total: number) {
  return Math.round(clampPercent(total > 0 ? (part / total) * 100 : 0));
}

function resolveNextGroup(groups: GrammarProgressGroup[]) {
  return (
    groups.find((group) => group.totalCount > 0 && group.startedCount < group.totalCount) ??
    groups[0] ??
    null
  );
}

function ProgressBar({
  value,
  label,
  tone = "accent",
}: {
  value: number;
  label: string;
  tone?: "accent" | "soft";
}) {
  const width = clampPercent(value);

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      className="h-2 overflow-hidden rounded-full bg-white/8"
    >
      <div
        className={
          tone === "accent"
            ? "h-full rounded-full bg-accent"
            : "h-full rounded-full bg-white/32"
        }
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

function LoadingRows() {
  return (
    <div className="grid gap-2">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="h-[74px] animate-pulse rounded-[14px] border border-white/8 bg-white/[0.03]"
        />
      ))}
    </div>
  );
}

export function GrammarProgressOverview({
  progress,
  selectedGroupSlug,
  selectedCategoryName,
  resultCount,
  isLoading,
  error,
  onGroupSelect,
}: GrammarProgressOverviewProps) {
  const groups = progress?.groupProgress ?? [];
  const totalCount = progress?.totalGrammarPoints ?? 0;
  const startedCount = progress?.startedCount ?? 0;
  const masteredCount = progress?.masteredCount ?? 0;
  const reviewCount = progress?.reviewCount ?? 0;
  const favoriteCount = progress?.favoriteCount ?? 0;
  const startedPercent = formatPercent(startedCount, totalCount);
  const masteredPercent = formatPercent(masteredCount, totalCount);
  const nextGroup = resolveNextGroup(groups);
  const selectedGroup = groups.find((group) => group.slug === selectedGroupSlug);
  const focusTitle =
    selectedCategoryName ??
    selectedGroup?.nameZh ??
    nextGroup?.nameZh ??
    "表达功能";

  return (
    <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.6vw,26px)]">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
        <div className="min-w-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-2xl leading-tight font-semibold text-white/82">
                文法学习地图
              </p>
              <p className="mt-2 max-w-[620px] text-sm leading-6 text-white/46">
                先看学习进度，再按大类进入练习。当前重点：{focusTitle}。
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link
                href="/review"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/58 transition hover:border-white/20 hover:text-white/76"
              >
                复习
              </Link>
              <Link
                href="/favorites"
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/58 transition hover:border-white/20 hover:text-white/76"
              >
                收藏
              </Link>
            </div>
          </div>

          <div className="mt-6 rounded-[16px] border border-white/8 bg-[#15151599]">
            <div className="grid grid-cols-2 divide-x divide-y divide-white/8 md:grid-cols-4 md:divide-y-0">
              <div className="px-4 py-3">
                <p className="text-xs text-white/36">已开始</p>
                <p className="mt-1 text-2xl font-semibold text-white/82">
                  {startedCount}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-white/36">待复习</p>
                <p className="mt-1 text-2xl font-semibold text-accent-strong">
                  {reviewCount}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-white/36">已掌握</p>
                <p className="mt-1 text-2xl font-semibold text-white/82">
                  {masteredCount}
                </p>
              </div>
              <div className="px-4 py-3">
                <p className="text-xs text-white/36">已收藏</p>
                <p className="mt-1 text-2xl font-semibold text-white/82">
                  {favoriteCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/48">整体启动率</span>
                <span className="font-medium text-white/72">{startedPercent}%</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={startedPercent} label="整体启动率" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-white/48">掌握进度</span>
                <span className="font-medium text-white/72">{masteredPercent}%</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={masteredPercent} label="掌握进度" tone="soft" />
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-[16px] border border-white/8 bg-[#15151599] px-4 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-semibold text-white/72">
                  {reviewCount > 0
                    ? `今天先处理 ${reviewCount} 个复习点`
                    : nextGroup
                      ? `下一步建议：${nextGroup.nameZh}`
                      : "继续选择一个语法点练习"}
                </p>
                <p className="mt-1 text-xs leading-5 text-white/40">
                  当前筛选显示 {resultCount} 个语法点，总库 {totalCount} 个。
                </p>
              </div>
              {reviewCount > 0 ? (
                <Link
                  href="/review"
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong"
                >
                  去复习
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => onGroupSelect(nextGroup?.slug ?? "")}
                  disabled={!nextGroup}
                  className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  查看建议大类
                </button>
              )}
            </div>
          </div>

          {error ? (
            <p className="mt-3 text-xs leading-5 text-danger">{error}</p>
          ) : null}
        </div>

        <div className="min-w-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-white/68">大类进度</p>
              <p className="mt-1 text-xs text-white/34">点击大类即可筛选学习路径。</p>
            </div>
            <button
              type="button"
              onClick={() => onGroupSelect("")}
              className="inline-flex h-9 items-center rounded-full border border-white/10 px-3 text-xs text-white/50 transition hover:border-white/20 hover:text-white/72"
            >
              全部
            </button>
          </div>

          <div className="mt-4 max-h-[420px] overflow-y-auto pr-1">
            {isLoading ? <LoadingRows /> : null}

            {!isLoading && groups.length > 0 ? (
              <div className="grid gap-2">
                {groups.map((group, index) => {
                  const groupStartedPercent = formatPercent(
                    group.startedCount,
                    group.totalCount
                  );
                  const isSelected = selectedGroupSlug === group.slug;

                  return (
                    <button
                      key={group.slug}
                      type="button"
                      aria-label={`选择第 ${index + 1} 个文法大类`}
                      aria-pressed={isSelected}
                      onClick={() => onGroupSelect(group.slug)}
                      className={
                        isSelected
                          ? "rounded-[14px] border border-accent/35 bg-accent-soft px-4 py-3 text-left"
                          : "rounded-[14px] border border-white/8 bg-white/[0.025] px-4 py-3 text-left transition hover:border-white/18 hover:bg-white/[0.045]"
                      }
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={
                            isSelected
                              ? "flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-black"
                              : "flex size-8 shrink-0 items-center justify-center rounded-full border border-white/10 text-xs font-semibold text-white/44"
                          }
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={
                                isSelected
                                  ? "text-sm font-semibold text-accent-strong"
                                  : "text-sm font-semibold text-white/72"
                              }
                            >
                              {group.nameZh}
                            </span>
                            <span className="text-xs text-white/38">
                              {group.startedCount}/{group.totalCount}
                            </span>
                          </span>
                          <span className="mt-2 block">
                            <ProgressBar
                              value={groupStartedPercent}
                              label={`${group.nameZh} 启动率`}
                              tone={isSelected ? "accent" : "soft"}
                            />
                          </span>
                          <span className="mt-2 flex flex-wrap gap-2 text-xs text-white/36">
                            <span>共 {group.totalCount} 个语法点</span>
                            {group.reviewCount > 0 ? (
                              <span className="rounded-full border border-accent/20 bg-accent-soft px-2 py-0.5 text-accent-strong">
                                复习 {group.reviewCount}
                              </span>
                            ) : null}
                            {group.favoriteCount > 0 ? (
                              <span>收藏 {group.favoriteCount}</span>
                            ) : null}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
