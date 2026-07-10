"use client";

import Link from "next/link";
import { useState } from "react";
import type { GrammarPointDetail, GrammarTaxonomyTag } from "@/shared/types/api";
import { displayGrammarPointTypeLabel } from "@/app/components/grammar/display-labels";
import {
  PracticalityBadge,
  SpokenOrWrittenBadge,
} from "@/app/components/grammar/practicality-badge";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import { getErrorMessage } from "@/app/lib/api-client";

type GrammarDetailProps = {
  grammarPoint: GrammarPointDetail;
  onFavoriteChange?: (isFavorite: boolean) => Promise<void>;
};

export function GrammarDetail({
  grammarPoint,
  onFavoriteChange,
}: GrammarDetailProps) {
  const [isFavorite, setIsFavorite] = useState(Boolean(grammarPoint.isFavorite));
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const taxonomyGroups = Array.from(
    grammarPoint.taxonomyTags.reduce(
      (groups, tag) => {
        const group = groups.get(tag.dimensionSlug) ?? {
          dimensionNameZh: tag.dimensionNameZh,
          tags: [] as GrammarTaxonomyTag[],
        };
        group.tags.push(tag);
        groups.set(tag.dimensionSlug, group);
        return groups;
      },
      new Map<
        string,
        { dimensionNameZh: string; tags: GrammarTaxonomyTag[] }
      >()
    ).values()
  );

  async function handleFavoriteToggle() {
    if (!onFavoriteChange) {
      return;
    }

    const nextFavorite = !isFavorite;
    setIsSavingFavorite(true);
    setFavoriteError(null);

    try {
      await onFavoriteChange(nextFavorite);
      setIsFavorite(nextFavorite);
    } catch (error) {
      setFavoriteError(getErrorMessage(error, "收藏状态保存失败。"));
    } finally {
      setIsSavingFavorite(false);
    }
  }

  return (
    <article className="mx-auto w-full max-w-[1000px]">
      <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(20px,3vw,30px)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PracticalityBadge practicality={grammarPoint.practicality} />
              <SpokenOrWrittenBadge value={grammarPoint.spokenOrWritten} />
              <TagBadge tag={displayGrammarPointTypeLabel(grammarPoint.pointType)} />
              {grammarPoint.jlptLevel ? <TagBadge tag={grammarPoint.jlptLevel} /> : null}
            </div>
            <h1 className="mt-4 break-words text-[clamp(36px,6vw,58px)] leading-tight font-semibold text-white/84">
              {grammarPoint.grammarPoint}
            </h1>
            {grammarPoint.reading ? (
              <p className="mt-2 text-lg leading-7 text-white/46">
                {grammarPoint.reading}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <button
              type="button"
              onClick={handleFavoriteToggle}
              disabled={isSavingFavorite}
              className={
                isFavorite
                  ? "inline-flex h-11 items-center justify-center rounded-full border border-accent/30 bg-accent-soft px-5 text-sm font-semibold text-accent-strong transition hover:border-accent/45 disabled:opacity-60"
                  : "inline-flex h-11 items-center justify-center rounded-full border border-white/12 px-5 text-sm font-semibold text-white/62 transition hover:border-white/22 hover:text-white/78 disabled:opacity-60"
              }
            >
              {isSavingFavorite ? "保存中" : isFavorite ? "已收藏" : "收藏"}
            </button>
            <Link
              href={`/practice?grammarId=${grammarPoint.id}`}
              className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
            >
              开始练习
            </Link>
          </div>
        </div>

        {favoriteError ? (
          <p className="mt-4 rounded-[14px] border border-danger/30 bg-danger-soft/80 px-4 py-3 text-sm text-danger">
            {favoriteError}
          </p>
        ) : null}

        {grammarPoint.migrationTarget ? (
          <div className="mt-5 rounded-[16px] border border-accent/25 bg-accent-soft px-4 py-3 text-sm leading-6 text-white/64">
            这个旧学习条目已迁移到
            {grammarPoint.migrationTarget.kind === "comparison_set"
              ? "对比学习"
              : "错误诊断"}
            ：{grammarPoint.migrationTarget.nameZh}。原链接和学习记录继续保留。
          </div>
        ) : null}

        <div className="mt-7 grid gap-4 md:grid-cols-[1.3fr_0.7fr]">
          <section className="rounded-[18px] border border-white/8 bg-[#15151599] p-5">
            <p className="text-sm font-semibold text-white/48">核心意思</p>
            <p className="mt-3 text-lg leading-8 text-white/76">
              {grammarPoint.coreMeaning}
            </p>
            {grammarPoint.naturalTranslation ? (
              <p className="mt-3 text-base leading-7 text-white/52">
                {grammarPoint.naturalTranslation}
              </p>
            ) : null}
          </section>

          <section className="rounded-[18px] border border-white/8 bg-[#15151599] p-5">
            <p className="text-sm font-semibold text-white/48">接续</p>
            <p className="mt-3 font-mono text-sm leading-7 text-white/72">
              {grammarPoint.structure ?? "当前语法点暂无固定接续。"}
            </p>
          </section>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <section>
            <p className="text-sm font-semibold text-white/48">主分类</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grammarPoint.primaryCategory ? (
                <>
                  <TagBadge tag={grammarPoint.primaryCategory.dimensionNameZh} />
                  <TagBadge tag={grammarPoint.primaryCategory.nameZh} />
                </>
              ) : (
                <span className="text-sm text-white/38">已从知识分类迁移</span>
              )}
              {grammarPoint.subCategory ? <TagBadge tag={grammarPoint.subCategory} /> : null}
            </div>
          </section>
          <section>
            <p className="text-sm font-semibold text-white/48">场景</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grammarPoint.sceneTags.map((tag) => (
                <TagBadge key={tag.nameEn} tag={tag} tone="scene" />
              ))}
            </div>
          </section>
          <section>
            <p className="text-sm font-semibold text-white/48">语体</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grammarPoint.registerTags.map((tag) => (
                <TagBadge key={tag.nameEn} tag={tag} tone="register" />
              ))}
            </div>
          </section>
          {taxonomyGroups.map((group) => (
            <section key={group.dimensionNameZh}>
              <p className="text-sm font-semibold text-white/48">
                {group.dimensionNameZh}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.tags.map((tag) => (
                  <TagBadge key={tag.id} tag={tag.nameZh} />
                ))}
              </div>
            </section>
          ))}
        </div>

        {grammarPoint.notes ? (
          <p className="mt-6 rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-white/56">
            {grammarPoint.notes}
          </p>
        ) : null}
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-semibold text-white/74">例句</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {grammarPoint.examples.length > 0 ? (
            grammarPoint.examples.map((example) => (
              <article
                key={example.id}
                className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5"
              >
                <p className="break-words text-base leading-7 text-white/78">
                  {example.jp}
                </p>
                {example.zh ? (
                  <p className="mt-2 break-words text-sm leading-6 text-white/46">
                    {example.zh}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  {example.sceneTag ? (
                    <TagBadge tag={example.sceneTag} tone="scene" />
                  ) : null}
                  {example.registerTag ? (
                    <TagBadge tag={example.registerTag} tone="register" />
                  ) : null}
                  <TagBadge tag={`难度 ${example.difficulty}`} />
                </div>
                {example.notes ? (
                  <p className="mt-3 text-xs leading-5 text-white/38">{example.notes}</p>
                ) : null}
              </article>
            ))
          ) : (
            <p className="rounded-[18px] border border-dashed border-white/12 bg-[#17171799] px-5 py-8 text-sm text-white/42">
              暂无例句。
            </p>
          )}
        </div>
      </section>

      {grammarPoint.commonMistakes.length > 0 ? (
        <section className="mt-6 rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
          <h2 className="text-lg font-semibold text-white/74">常见误区</h2>
          <ul className="mt-4 space-y-3">
            {grammarPoint.commonMistakes.map((mistake) => (
              <li key={mistake} className="text-sm leading-6 text-white/56">
                {mistake}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grammarPoint.similarGrammar.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white/74">相似语法</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {grammarPoint.similarGrammar.map((relation) => (
              <article
                key={relation.id}
                className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5"
              >
                <Link
                  href={`/grammar/${relation.similarGrammarPointId}`}
                  className="text-xl font-semibold text-white/78 transition hover:text-white"
                >
                  {relation.similarGrammarPointText}
                </Link>
                <p className="mt-3 text-sm leading-6 text-white/56">
                  {relation.differenceSummary}
                </p>
                {relation.exampleA || relation.exampleB ? (
                  <div className="mt-4 space-y-2 border-l border-white/14 pl-4 text-sm leading-6 text-white/45">
                    {relation.exampleA ? <p>{relation.exampleA}</p> : null}
                    {relation.exampleB ? <p>{relation.exampleB}</p> : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
