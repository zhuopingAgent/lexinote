import Link from "next/link";
import type { GrammarProgressResponse } from "@/shared/types/grammar";
import { BookOpenIcon, StarIcon } from "@/app/components/icons";

type GrammarProgressOverviewProps = {
  progress: GrammarProgressResponse | null;
  isLoading: boolean;
  error?: string | null;
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
}: GrammarProgressOverviewProps) {
  const totalCount = progress?.totalGrammarPoints ?? 0;
  const startedCount = progress?.startedCount ?? 0;
  const masteredCount = progress?.masteredCount ?? 0;
  const reviewCount = progress?.reviewCount ?? 0;
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

        <div className="flex shrink-0 gap-2">
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
          <Link
            href="/review"
            aria-label={reviewCount > 0 ? `待复习 ${reviewCount}` : "复习"}
            className={
              reviewCount > 0
                ? "inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong"
                : "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-3 text-sm font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
            }
          >
            <BookOpenIcon className="size-4" />
            <span className="hidden min-[360px]:inline">
              {reviewCount > 0 ? "待复习" : "复习"}
            </span>
            {reviewCount > 0 ? (
              <span className="tabular-nums">{reviewCount}</span>
            ) : null}
          </Link>
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
        {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
      </div>
    </header>
  );
}
