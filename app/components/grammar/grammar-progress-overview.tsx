import Link from "next/link";
import type { GrammarProgressResponse } from "@/shared/types/grammar";
import { BookOpenIcon, StarIcon } from "@/app/components/icons";

type GrammarProgressOverviewProps = {
  progress: GrammarProgressResponse | null;
  isLoading: boolean;
  error?: string | null;
  onShowCurriculum?: () => void;
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

export function GrammarProgressOverview({
  progress,
  isLoading,
  error,
  onShowCurriculum = () => undefined,
}: GrammarProgressOverviewProps) {
  const totalCount = progress?.totalGrammarPoints ?? 0;
  const startedCount = progress?.startedCount ?? 0;
  const masteredCount = progress?.masteredCount ?? 0;
  const pendingCompletionCount = progress?.pendingCompletionCount ?? 0;
  const dueReviewCount = progress?.dueReviewCount ?? 0;
  const favoriteCount = progress?.favoriteCount ?? 0;
  const masteredPercent = formatPercent(masteredCount, totalCount);

  return (
    <header className="border-b border-border pb-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="whitespace-nowrap text-3xl leading-tight font-semibold text-foreground">
            文法
          </h1>
          <p className="mt-2 hidden text-sm leading-6 text-muted sm:block">
            按知识维度学习，随时回到需要复习的内容。
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap justify-end gap-2">
          <Link
            href="/favorites"
            aria-label={`收藏 ${favoriteCount}`}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
          >
            <StarIcon className="size-4" />
            <span className="hidden min-[360px]:inline">收藏</span>
            {!isLoading ? (
              <span className="tabular-nums text-foreground">{favoriteCount}</span>
            ) : null}
          </Link>
          {pendingCompletionCount > 0 ? (
            <Link
              href="/review#pending"
              aria-label={`待完成 ${pendingCompletionCount}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong"
            >
              <BookOpenIcon className="size-4" />
              <span className="hidden min-[360px]:inline">待完成</span>
              <span className="tabular-nums">{pendingCompletionCount}</span>
            </Link>
          ) : null}
          {dueReviewCount > 0 ? (
            <Link
              href="/review#due-review"
              aria-label={`待复习 ${dueReviewCount}`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-accent/40 bg-surface px-3 text-sm font-semibold text-foreground transition hover:border-accent"
            >
              <BookOpenIcon className="size-4" />
              <span className="hidden min-[360px]:inline">待复习</span>
              <span className="tabular-nums">{dueReviewCount}</span>
            </Link>
          ) : null}
          {pendingCompletionCount === 0 && dueReviewCount === 0 ? (
            <Link
              href="/review"
              aria-label="复习"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
            >
              <BookOpenIcon className="size-4" />
              <span className="hidden min-[360px]:inline">复习</span>
            </Link>
          ) : null}
        </div>
      </div>

      <div className="mt-5 max-w-[560px]">
        <div className="flex items-center justify-between gap-4 text-sm">
          <span className="font-medium text-foreground">整体掌握</span>
          {isLoading ? (
            <span className="h-5 w-20 animate-pulse rounded bg-surface-strong" />
          ) : (
            <span className="tabular-nums text-muted">
              <strong className="font-semibold text-foreground">{masteredCount}</strong>
              <span aria-hidden="true"> / </span>
              {totalCount}
            </span>
          )}
        </div>
        <div
          role="progressbar"
          aria-label="整体掌握进度"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={masteredPercent}
          className="mt-2 h-2 overflow-hidden rounded-full bg-surface-strong"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${masteredPercent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-muted">
          {isLoading ? "正在读取学习进度" : `${startedCount} 个已开始`}
        </p>
        {!isLoading ? (
          <p className="mt-1 hidden text-xs leading-5 text-muted sm:block">
            整体总数按具体用法去重；知识维度允许交叉归类，因此各维度数量不能直接相加。
          </p>
        ) : null}
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>

      {!isLoading && !error ? (
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-border pt-3 sm:mt-5 sm:flex sm:justify-between sm:pt-4">
          <div>
            <p className="hidden text-xs font-semibold text-muted sm:block">建议下一步</p>
            <p className="text-xs leading-5 text-foreground/72 sm:mt-1 sm:text-sm sm:leading-6 sm:text-foreground/78">
              {dueReviewCount > 0
                ? `先复习今天到期的 ${dueReviewCount} 个语法。`
                : pendingCompletionCount > 0
                  ? `继续完成已经开始的 ${pendingCompletionCount} 个语法。`
                  : "从基础课程开始，按顺序建立文法骨架。"}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {dueReviewCount > 0 ? (
              <Link href="/review#due-review" className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong sm:h-10 sm:px-4">
                开始复习
              </Link>
            ) : pendingCompletionCount > 0 ? (
              <Link href="/review#pending" className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong sm:h-10 sm:px-4">
                继续学习
              </Link>
            ) : (
              <button type="button" onClick={onShowCurriculum} className="inline-flex h-9 items-center justify-center rounded-lg bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong sm:h-10 sm:px-4">
                查看基础课程
              </button>
            )}
            <Link href="/grammar/comparisons" className="hidden h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium text-muted transition hover:border-foreground/30 hover:text-foreground sm:inline-flex">
              易混对比
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}
