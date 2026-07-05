import Link from "next/link";
import type { GrammarPointSummary } from "@/shared/types/api";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";
import { TagBadge } from "@/app/components/grammar/tag-badge";

type GrammarCardProps = {
  grammarPoint: GrammarPointSummary;
};

export function GrammarCard({ grammarPoint }: GrammarCardProps) {
  const titleId = `grammar-card-title-${grammarPoint.id}`;

  return (
    <article className="flex min-h-[238px] flex-col rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            id={titleId}
            href={`/grammar/${grammarPoint.id}`}
            className="block min-h-10 min-w-10 max-w-full rounded-[8px] py-1 text-[26px] leading-tight font-medium text-white/82 transition hover:text-white"
          >
            {grammarPoint.grammarPoint}
          </Link>
          {grammarPoint.reading ? (
            <p className="mt-1 break-words text-sm leading-6 text-white/42">
              {grammarPoint.reading}
            </p>
          ) : null}
        </div>
        <PracticalityBadge practicality={grammarPoint.practicality} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {grammarPoint.categoryGroupNameZh ? (
          <TagBadge tag={grammarPoint.categoryGroupNameZh} />
        ) : null}
        {grammarPoint.categoryNameZh ? (
          <TagBadge tag={grammarPoint.categoryNameZh} />
        ) : null}
        {grammarPoint.subCategory ? <TagBadge tag={grammarPoint.subCategory} /> : null}
      </div>

      <p className="mt-4 line-clamp-3 text-sm leading-6 text-white/62">
        {grammarPoint.coreMeaning}
      </p>

      {grammarPoint.structure ? (
        <p className="mt-3 rounded-[12px] border border-white/8 bg-[#15151599] px-3 py-2 font-mono text-xs leading-5 text-white/54">
          {grammarPoint.structure}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {grammarPoint.sceneTags.slice(0, 2).map((tag) => (
          <TagBadge key={`scene-${tag.nameEn}`} tag={tag} tone="scene" />
        ))}
        {grammarPoint.registerTags.slice(0, 2).map((tag) => (
          <TagBadge key={`register-${tag.nameEn}`} tag={tag} tone="register" />
        ))}
      </div>

      <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
        <span className="text-xs text-white/35">
          {grammarPoint.isFavorite ? "已收藏" : "语法卡片"}
        </span>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/grammar/${grammarPoint.id}`}
            aria-describedby={titleId}
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-4 text-sm font-medium text-white/62 transition hover:border-white/22 hover:text-white/78"
          >
            查看详情
          </Link>
          <Link
            href={`/practice?grammarId=${grammarPoint.id}`}
            aria-describedby={titleId}
            className="inline-flex h-10 items-center justify-center rounded-full bg-accent px-4 text-sm font-semibold text-black transition hover:bg-accent-strong"
          >
            开始练习
          </Link>
        </div>
      </div>
    </article>
  );
}
