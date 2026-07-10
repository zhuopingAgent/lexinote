"use client";

import type { LearningModule, LearningStage } from "@/shared/types/grammar";

type CurriculumPathNavigationProps = {
  stages: LearningStage[];
  modules: LearningModule[];
  selectedSlug: string;
  isLoading: boolean;
  onSelect: (slug: string) => void;
};

export function CurriculumPathNavigation({
  stages,
  modules,
  selectedSlug,
  isLoading,
  onSelect,
}: CurriculumPathNavigationProps) {
  return (
    <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-foreground">课程阶段</h2>
        {!isLoading && stages.length > 0 ? (
          <span className="text-xs text-muted">{stages.length} 个阶段</span>
        ) : null}
      </div>

      <nav
        aria-label="课程阶段"
        className="mt-3 flex gap-2 overflow-x-auto pb-2 lg:grid lg:overflow-visible lg:pb-0"
      >
        {isLoading
          ? Array.from({ length: 4 }).map((_, index) => (
              <span
                key={index}
                className="h-[68px] w-[210px] shrink-0 animate-pulse rounded-lg bg-surface-soft lg:w-full"
              />
            ))
          : stages.map((stage) => {
              const moduleCount = modules.filter(
                (module) => module.stageId === stage.id
              ).length;
              const isSelected = selectedSlug === stage.slug;

              return (
                <button
                  key={stage.slug}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onSelect(stage.slug)}
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
                    {String(stage.displayOrder).padStart(2, "0")}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-5 font-semibold text-foreground">
                      {stage.nameZh.replace(/^阶段\s*\d+[:：]\s*/, "")}
                    </span>
                    <span className="mt-1.5 block text-xs leading-5 text-muted">
                      {moduleCount} 个模块
                    </span>
                  </span>
                </button>
              );
            })}
      </nav>
    </aside>
  );
}
