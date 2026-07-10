"use client";

import type {
  GrammarProgressGroup,
  KnowledgeDimension,
} from "@/shared/types/grammar";

type GrammarPathNavigationProps = {
  dimensions: KnowledgeDimension[];
  progressGroups: GrammarProgressGroup[];
  selectedSlug: string;
  isLoading: boolean;
  onSelect: (slug: string) => void;
};

function formatPercent(part: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.min(Math.round((part / total) * 100), 100);
}

export function GrammarPathNavigation({
  dimensions,
  progressGroups,
  selectedSlug,
  isLoading,
  onSelect,
}: GrammarPathNavigationProps) {
  const progressBySlug = new Map(
    progressGroups.map((group) => [group.slug, group])
  );

  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">学习路径</h2>
        {!isLoading && dimensions.length > 0 ? (
          <span className="text-xs text-muted">{dimensions.length} 个维度</span>
        ) : null}
      </div>

      <nav
        aria-label="知识维度"
        className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="h-[68px] w-[210px] shrink-0 animate-pulse rounded-lg bg-surface-soft lg:w-full"
              />
            ))
          : dimensions.map((dimension, index) => {
              const group = progressBySlug.get(dimension.slug);
              const masteredCount = group?.masteredCount ?? 0;
              const totalCount = group?.totalCount ?? 0;
              const percentage = formatPercent(masteredCount, totalCount);
              const isSelected = selectedSlug === dimension.slug;

              return (
                <button
                  key={dimension.slug}
                  type="button"
                  aria-label={dimension.nameZh}
                  aria-pressed={isSelected}
                  onClick={() => onSelect(dimension.slug)}
                  className={
                    isSelected
                      ? "flex w-[210px] shrink-0 items-start gap-3 rounded-lg border border-accent/35 bg-accent-soft p-3 text-left lg:w-full"
                      : "flex w-[210px] shrink-0 items-start gap-3 rounded-lg border border-transparent p-3 text-left transition hover:border-border hover:bg-surface-soft lg:w-full"
                  }
                >
                  <span
                    className={
                      isSelected
                        ? "w-5 shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-accent-strong"
                        : "w-5 shrink-0 pt-0.5 text-xs font-medium tabular-nums text-muted"
                    }
                  >
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        isSelected
                          ? "block text-sm leading-5 font-semibold text-foreground"
                          : "block text-sm leading-5 font-medium text-foreground"
                      }
                    >
                      {dimension.nameZh}
                    </span>
                    <span className="mt-1.5 flex items-center gap-2">
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-strong">
                        <span
                          className={
                            isSelected
                              ? "block h-full rounded-full bg-accent"
                              : "block h-full rounded-full bg-muted"
                          }
                          style={{ width: `${percentage}%` }}
                        />
                      </span>
                      <span className="shrink-0 text-xs tabular-nums text-muted">
                        掌握 {masteredCount}/{totalCount}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
      </nav>
    </aside>
  );
}
