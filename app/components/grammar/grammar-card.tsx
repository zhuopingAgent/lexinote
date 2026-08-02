import Link from "next/link";
import type { GrammarPointSummary } from "@/shared/types/grammar";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";

type GrammarCardProps = {
  grammarPoint: GrammarPointSummary;
  curriculumOrder?: number | null;
  contextualCategory?: string | null;
};

const LEARNING_STATUS_STYLES = {
  mastered: {
    label: "已掌握",
    className: "border-[#4ade8050] bg-[#4ade8014] text-[#86efac]",
  },
  learning: {
    label: "学习中",
    className: "border-accent/35 bg-accent-soft text-accent-strong",
  },
  reviewing: {
    label: "学习中",
    className: "border-accent/35 bg-accent-soft text-accent-strong",
  },
  new: {
    label: "已开始",
    className: "border-border bg-surface-strong text-foreground/65",
  },
} as const;

export function GrammarCard({
  grammarPoint,
  curriculumOrder,
  contextualCategory,
}: GrammarCardProps) {
  const titleId = `grammar-card-title-${grammarPoint.id}`;
  const learningStatus = grammarPoint.learningStatus
    ? LEARNING_STATUS_STYLES[grammarPoint.learningStatus]
    : {
        label: "未开始",
        className: "border-border bg-transparent text-muted",
      };

  return (
    <article className="flex min-h-[220px] flex-col rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            id={titleId}
            href={`/grammar/${grammarPoint.id}`}
            className="block min-h-10 min-w-10 max-w-full rounded-md py-1 text-2xl leading-tight font-semibold text-foreground transition hover:text-accent-strong"
          >
            {grammarPoint.grammarPoint}
          </Link>
          {grammarPoint.reading && grammarPoint.reading !== grammarPoint.grammarPoint ? (
            <p className="mt-1 break-words text-sm leading-6 text-muted">
              {grammarPoint.reading}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`inline-flex min-h-7 items-center rounded-full border px-3 py-1 text-xs font-semibold ${learningStatus.className}`}>
            {learningStatus.label}
          </span>
          <PracticalityBadge practicality={grammarPoint.practicality} />
        </div>
      </div>

      <p className="mt-3 text-xs leading-5 text-muted">
        {curriculumOrder ? (
          <span className="mr-2 font-semibold text-accent-strong">
            第 {curriculumOrder} 项
          </span>
        ) : null}
        {contextualCategory ? (
          contextualCategory
        ) : grammarPoint.primaryCategory ? (
          <>
            {grammarPoint.primaryCategory.nameZh}
            {grammarPoint.subCategory ? ` · ${grammarPoint.subCategory}` : ""}
          </>
        ) : grammarPoint.migrationTarget ? (
          <>
            {grammarPoint.migrationTarget.kind === "comparison_set"
              ? "对比学习"
              : "错误诊断"}
            {` · ${grammarPoint.migrationTarget.nameZh}`}
          </>
        ) : null}
      </p>

      <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/75">
        {grammarPoint.coreMeaning}
      </p>

      {grammarPoint.structure ? (
        <p className="mt-3 border-l-2 border-accent/50 pl-3 font-mono text-xs leading-5 text-muted">
          {grammarPoint.structure}
        </p>
      ) : null}

      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <Link
          href={`/grammar/${grammarPoint.id}`}
          aria-describedby={titleId}
          className="inline-flex h-9 items-center justify-center rounded-md border border-border bg-surface px-3 text-sm font-medium text-muted transition hover:border-foreground/30 hover:bg-surface-strong hover:text-foreground"
        >
          查看说明
        </Link>
        <Link
          href={`/practice?grammarId=${grammarPoint.id}`}
          aria-describedby={titleId}
          className="inline-flex h-9 items-center justify-center rounded-md bg-accent px-3 text-sm font-semibold text-background transition hover:bg-accent-strong"
        >
          开始练习
        </Link>
      </div>
    </article>
  );
}
