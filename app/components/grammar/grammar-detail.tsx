"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  ComparisonSet,
  GrammarPointDetail,
  GrammarPointSummary,
  GrammarTaxonomyTag,
} from "@/shared/types/grammar";
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
  curriculumNeighbors?: {
    previous: GrammarPointSummary | null;
    next: GrammarPointSummary | null;
  };
};

function isUsefulTeachingNote(value?: string | null) {
  if (!value?.trim()) return false;
  return !/(结构化兼容记录|兼容旧字段|自然使用.+的表达|的自然例句[。.]?$)/.test(value);
}

function learningStatusLabel(status: GrammarPointDetail["learningStatus"]) {
  if (status === "mastered") return "已掌握";
  if (status === "learning" || status === "reviewing") return "学习中";
  if (status === "new") return "已开始";
  return "未开始";
}

function comparisonMemberAt(comparisonSet: ComparisonSet, position: number) {
  return comparisonSet.members.find((member) => member.sortOrder === position);
}

export function GrammarDetail({
  grammarPoint,
  onFavoriteChange,
  curriculumNeighbors,
}: GrammarDetailProps) {
  const [isFavorite, setIsFavorite] = useState(Boolean(grammarPoint.isFavorite));
  const [isSavingFavorite, setIsSavingFavorite] = useState(false);
  const [favoriteError, setFavoriteError] = useState<string | null>(null);
  const taxonomyGroups = Array.from(
    grammarPoint.taxonomyTags.reduce(
      (groups, tag) => {
        if (tag.id === grammarPoint.primaryCategory?.id) {
          return groups;
        }
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
  const siblingHeading = grammarPoint.formSiblings.every(
    (sibling) => sibling.canonicalForm === grammarPoint.canonicalForm
  )
    ? "同形不同用法"
    : "相关形式";
  const visibleMistakes = grammarPoint.commonMistakes.filter(
    (mistake) => !(
      /只按中文意思套用.*忽略.*接续.*语体.*搭配/.test(mistake) ||
      /只记住中文意思.*忽略.*形式和接续/.test(mistake)
    )
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
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href="/grammar" className="text-sm font-medium text-white/48 transition hover:text-white/76">
          返回文法
        </Link>
        {grammarPoint.curriculum ? (
          <span className="text-xs text-white/38">
            {grammarPoint.curriculum.stage.nameZh}
            {grammarPoint.curriculum.module ? ` · ${grammarPoint.curriculum.module.nameZh}` : ""}
          </span>
        ) : null}
      </div>
      <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(20px,3vw,30px)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <PracticalityBadge practicality={grammarPoint.practicality} />
              <SpokenOrWrittenBadge value={grammarPoint.spokenOrWritten} />
              <TagBadge tag={displayGrammarPointTypeLabel(grammarPoint.pointType)} />
              <TagBadge tag={learningStatusLabel(grammarPoint.learningStatus)} />
              {grammarPoint.jlptLevel ? <TagBadge tag={grammarPoint.jlptLevel} /> : null}
              {grammarPoint.curriculum ? (
                <TagBadge
                  tag={grammarPoint.curriculum.stage.nameZh}
                />
              ) : null}
              {grammarPoint.curriculum?.module ? (
                <TagBadge
                  tag={`${grammarPoint.curriculum.module.nameZh} · 第 ${grammarPoint.curriculum.moduleOrder ?? grammarPoint.curriculum.recommendedOrder} 项`}
                />
              ) : null}
            </div>
            <h1 className="mt-4 break-words text-[clamp(36px,6vw,58px)] leading-tight font-semibold text-white/84">
              {grammarPoint.grammarPoint}
            </h1>
            {grammarPoint.reading && grammarPoint.reading !== grammarPoint.grammarPoint ? (
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

        {grammarPoint.formSiblings.length > 0 ? (
          <section className="mt-5 border-t border-white/8 pt-5">
            <p className="text-sm font-semibold text-white/48">{siblingHeading}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {grammarPoint.formSiblings.map((sibling) => (
                <Link
                  key={sibling.id}
                  href={`/grammar/${sibling.senseKey}`}
                  title={sibling.coreMeaning}
                  className="inline-flex min-h-8 items-center rounded-full border border-white/12 px-3 py-1 text-xs font-semibold text-white/58 transition hover:border-white/24 hover:text-white/82"
                >
                  {sibling.grammarPoint}
                </Link>
              ))}
            </div>
          </section>
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
            {grammarPoint.connections.length > 0 ? (
              <div className="mt-3 space-y-3">
                {grammarPoint.connections.map((connection) => (
                  <div key={`${connection.sortOrder}-${connection.pattern}`}>
                    <p className="font-mono text-sm leading-7 text-white/72">
                      {connection.pattern}
                    </p>
                    {isUsefulTeachingNote(connection.notes) ? (
                      <p className="mt-1 text-xs leading-5 text-white/42">
                        {connection.notes}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 font-mono text-sm leading-7 text-white/72">
                {grammarPoint.structure ?? "当前语法点暂无固定接续。"}
              </p>
            )}
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

        {isUsefulTeachingNote(grammarPoint.usage ?? grammarPoint.notes) ? (
          <p className="mt-6 rounded-[16px] border border-white/8 bg-white/5 px-4 py-3 text-sm leading-6 text-white/56">
            <span className="mr-2 font-semibold text-white/66">使用说明</span>
            {grammarPoint.usage ?? grammarPoint.notes}
          </p>
        ) : null}
      </section>

      {grammarPoint.prerequisites.length > 0 ? (
        <section className="mt-6 rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
          <h2 className="text-lg font-semibold text-white/74">前置知识</h2>
          <div className="mt-4 flex flex-wrap gap-2">
                {grammarPoint.prerequisites.map((prerequisite) => (
              <Link
                key={prerequisite.grammarPointId}
                href={`/grammar/${prerequisite.senseKey}`}
                className="inline-flex min-h-9 items-center rounded-full border border-white/12 px-3 py-1 text-sm text-white/60 transition hover:border-white/24 hover:text-white/82"
              >
                {prerequisite.relationType === "required" ? "必修" : "建议"}
                <span className="mx-2 text-white/24">·</span>
                {prerequisite.grammarPoint}
                <span className="mx-2 text-white/24">·</span>
                {learningStatusLabel(prerequisite.learningStatus)}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {grammarPoint.comparisonSets.length > 0 ? (
        <section className="mt-6">
          <h2 className="text-lg font-semibold text-white/74">易混语法对比</h2>
          <div className="mt-4 space-y-4">
            {grammarPoint.comparisonSets.map((comparisonSet) => (
              <article
                key={comparisonSet.id}
                className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5"
              >
                <h3 className="text-xl font-semibold text-white/78">
                  {comparisonSet.nameZh}
                </h3>
                <p className="mt-3 text-sm leading-6 text-white/56">
                  {comparisonSet.commonMeaning || comparisonSet.summary}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {comparisonSet.members.map((member) => (
                    <Link
                      key={member.grammarPointId}
                      href={`/grammar/${member.senseKey}`}
                      className="inline-flex min-h-8 items-center rounded-full border border-white/12 px-3 py-1 text-xs font-semibold text-white/60 transition hover:border-white/24 hover:text-white/82"
                    >
                      {member.grammarPoint}
                    </Link>
                  ))}
                </div>

                <div className="mt-5 grid gap-5 md:grid-cols-2">
                  <div>
                    <p className="text-sm font-semibold text-white/44">选择规则</p>
                    <ul className="mt-3 space-y-3">
                      {comparisonSet.decisionRules.map((rule) => {
                        const preferredMember = comparisonMemberAt(
                          comparisonSet,
                          rule.preferredMemberPosition
                        );
                        return (
                          <li key={`${rule.conditionZh}-${rule.preferredMemberPosition}`}>
                            <p className="text-sm leading-6 text-white/62">
                              {rule.conditionZh}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/40">
                              {preferredMember ? `${preferredMember.grammarPoint}：` : ""}
                              {rule.explanationZh}
                            </p>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/44">接续与语体</p>
                    <ul className="mt-3 space-y-3">
                      {[
                        ...comparisonSet.connectionDifferences,
                        ...comparisonSet.registerDifferences,
                      ].map((difference, index) => {
                        const member = comparisonMemberAt(
                          comparisonSet,
                          difference.memberPosition
                        );
                        return (
                          <li
                            key={`${difference.memberPosition}-${index}-${difference.descriptionZh}`}
                            className="text-sm leading-6 text-white/54"
                          >
                            {member ? `${member.grammarPoint}：` : ""}
                            {difference.descriptionZh}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 border-t border-white/8 pt-4 md:grid-cols-3">
                  <div>
                    <p className="text-sm font-semibold text-white/44">可以互换</p>
                    {comparisonSet.interchangeableCases.map((item) => (
                      <p key={item} className="mt-2 text-xs leading-5 text-white/42">
                        {item}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/44">不能互换</p>
                    {comparisonSet.nonInterchangeableCases.map((item) => (
                      <p key={item} className="mt-2 text-xs leading-5 text-white/42">
                        {item}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white/44">常见误区</p>
                    {comparisonSet.learnerMistakes.map((mistake) => (
                      <p
                        key={mistake.descriptionZh}
                        className="mt-2 text-xs leading-5 text-white/42"
                      >
                        {mistake.descriptionZh} {mistake.correctionZh}
                      </p>
                    ))}
                  </div>
                </div>

                {comparisonSet.minimalPairExamples.map((pair) => (
                  <div
                    key={pair.contextZh}
                    className="mt-5 border-t border-white/8 pt-4"
                  >
                    <p className="text-sm font-semibold text-white/44">
                      {pair.contextZh}
                    </p>
                    <div className="mt-3 space-y-2">
                      {pair.sentences.map((sentence) => {
                        const member = comparisonMemberAt(
                          comparisonSet,
                          sentence.memberPosition
                        );
                        return (
                          <p
                            key={`${sentence.memberPosition}-${sentence.jp}`}
                            className="text-sm leading-6 text-white/64"
                          >
                            {member ? `${member.grammarPoint}：` : ""}
                            {sentence.jp}
                            <span className="ml-2 text-white/36">{sentence.zh}</span>
                          </p>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/38">
                      {pair.explanationZh}
                    </p>
                  </div>
                ))}
              </article>
            ))}
          </div>
        </section>
      ) : null}

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
                {isUsefulTeachingNote(example.notes) ? (
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

      {visibleMistakes.length > 0 ? (
        <section className="mt-6 rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
          <h2 className="text-lg font-semibold text-white/74">常见误区</h2>
          <ul className="mt-4 space-y-3">
            {visibleMistakes.map((mistake) => (
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

      {curriculumNeighbors && (curriculumNeighbors.previous || curriculumNeighbors.next) ? (
        <nav aria-label="课程前后语法" className="mt-6 grid gap-3 sm:grid-cols-2">
          {curriculumNeighbors.previous ? (
            <Link href={`/grammar/${curriculumNeighbors.previous.id}`} className="rounded-lg border border-white/10 bg-[#1e1e1ecc] p-4 transition hover:border-white/22">
              <span className="text-xs text-white/38">上一项</span>
              <span className="mt-1 block text-lg font-semibold text-white/76">{curriculumNeighbors.previous.grammarPoint}</span>
              <span className="mt-1 line-clamp-1 block text-sm text-white/42">{curriculumNeighbors.previous.coreMeaning}</span>
            </Link>
          ) : <span />}
          {curriculumNeighbors.next ? (
            <Link href={`/grammar/${curriculumNeighbors.next.id}`} className="rounded-lg border border-white/10 bg-[#1e1e1ecc] p-4 text-right transition hover:border-white/22">
              <span className="text-xs text-white/38">下一项</span>
              <span className="mt-1 block text-lg font-semibold text-white/76">{curriculumNeighbors.next.grammarPoint}</span>
              <span className="mt-1 line-clamp-1 block text-sm text-white/42">{curriculumNeighbors.next.coreMeaning}</span>
            </Link>
          ) : null}
        </nav>
      ) : null}
    </article>
  );
}
