"use client";

import type { FormEvent } from "react";
import type { KnowledgeDimension, TaxonomyNode } from "@/shared/types/api";
import { SearchIcon } from "@/app/components/icons";

type GrammarSearchProps = {
  knowledgeDimensions: KnowledgeDimension[];
  categories: TaxonomyNode[];
  query: string;
  dimensionSlug: string;
  categorySlug: string;
  isLoading: boolean;
  resultCount: number;
  onQueryChange: (query: string) => void;
  onDimensionChange: (dimensionSlug: string) => void;
  onCategoryChange: (categorySlug: string) => void;
  onClearFilters: () => void;
  onSubmit: () => void;
};

export function GrammarSearch({
  knowledgeDimensions,
  categories,
  query,
  dimensionSlug,
  categorySlug,
  isLoading,
  resultCount,
  onQueryChange,
  onDimensionChange,
  onCategoryChange,
  onClearFilters,
  onSubmit,
}: GrammarSearchProps) {
  const selectedDimension = knowledgeDimensions.find(
    (dimension) => dimension.slug === dimensionSlug
  );
  const selectedCategory = categories.find((category) => category.slug === categorySlug);
  const trimmedQuery = query.trim();
  const hasActiveFilters = Boolean(
    trimmedQuery || categorySlug || dimensionSlug !== "expression_function"
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="mt-5 rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.6vw,26px)]">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xl leading-tight font-semibold text-white/78">
            查找与筛选
          </p>
          <p className="mt-1 text-sm leading-6 text-white/42">
            输入表达、中文意思或接续结构，快速定位要学的语法点。
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-3 md:grid-cols-[1fr_auto] lg:grid-cols-[1fr_260px_auto]">
        <label className="relative block">
          <span className="sr-only">搜索语法</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-white/30" />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="てもらえますか、ので、は / が..."
            className="h-12 w-full rounded-[14px] border border-white/12 bg-[#151515cc] pl-12 pr-4 text-sm text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10"
          />
        </label>

        <label className="hidden lg:block">
          <span className="sr-only">分类</span>
          <select
            value={categorySlug}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="h-12 w-full rounded-[14px] border border-white/12 bg-[#151515cc] px-4 text-sm text-white/68 outline-none focus:border-white/26 focus:ring-2 focus:ring-white/10"
          >
            <option value="">全部分类</option>
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.nameZh}
              </option>
            ))}
          </select>
        </label>

        <button
          type="submit"
          disabled={isLoading}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          <SearchIcon className="size-4" />
          {isLoading ? "搜索中" : "搜索"}
        </button>
      </form>

      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="知识维度">
        {knowledgeDimensions.map((dimension) => (
          <button
            key={dimension.slug}
            type="button"
            aria-pressed={dimensionSlug === dimension.slug}
            onClick={() => onDimensionChange(dimension.slug)}
            className={
              dimensionSlug === dimension.slug
                ? "inline-flex h-10 shrink-0 items-center rounded-full border border-accent/30 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
                : "inline-flex h-10 shrink-0 items-center rounded-full border border-white/8 px-3 text-xs text-white/46 transition hover:border-white/18 hover:text-white/68"
            }
          >
            {dimension.nameZh}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-white/36">
        <span>当前结果 {resultCount} 个</span>
        <button
          type="button"
          onClick={() => {
            onQueryChange("てもらえますか");
            onDimensionChange("expression_function");
            onCategoryChange("");
          }}
          className="inline-flex h-10 items-center rounded-full border border-white/8 px-3 text-white/48 transition hover:border-white/18 hover:text-white/68"
        >
          てもらえますか
        </button>
        <button
          type="button"
          onClick={() => {
            onQueryChange("ので");
            onDimensionChange("expression_function");
            onCategoryChange("");
          }}
          className="inline-flex h-10 items-center rounded-full border border-white/8 px-3 text-white/48 transition hover:border-white/18 hover:text-white/68"
        >
          ので
        </button>
        <button
          type="button"
          onClick={() => {
            onQueryChange("は");
            onDimensionChange("expression_function");
            onCategoryChange("particles_and_relations");
          }}
          className="inline-flex h-10 items-center rounded-full border border-white/8 px-3 text-white/48 transition hover:border-white/18 hover:text-white/68"
        >
          は / が
        </button>
        <button
          type="button"
          onClick={() => {
            onQueryChange("て形");
            onDimensionChange("form_tense_aspect");
            onCategoryChange("verb_conjugation_basics");
          }}
          className="inline-flex h-10 items-center rounded-full border border-white/8 px-3 text-white/48 transition hover:border-white/18 hover:text-white/68"
        >
          て形
        </button>
      </div>

      {hasActiveFilters ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-[14px] border border-white/8 bg-[#15151599] px-4 py-3 text-xs leading-5 text-white/44">
          <span className="font-semibold text-white/58">当前筛选</span>
          {trimmedQuery ? (
            <span className="rounded-full border border-white/8 px-3 py-1 text-white/54">
              关键词：{trimmedQuery}
            </span>
          ) : null}
          {selectedDimension ? (
            <span className="rounded-full border border-white/8 px-3 py-1 text-white/54">
              知识维度：{selectedDimension.nameZh}
            </span>
          ) : null}
          {selectedCategory ? (
            <span className="rounded-full border border-white/8 px-3 py-1 text-white/54">
              分类：{selectedCategory.nameZh}
            </span>
          ) : null}
          <button
            type="button"
            onClick={onClearFilters}
            className="ml-auto inline-flex h-8 items-center rounded-full border border-white/10 px-3 text-white/52 transition hover:border-white/20 hover:text-white/72"
          >
            清除
          </button>
        </div>
      ) : null}

      {selectedDimension ? (
        <div className="mt-4 rounded-[14px] border border-white/8 bg-[#15151599] px-4 py-3">
          <p className="text-sm leading-6 text-white/58">
            {selectedDimension.description}
          </p>
        </div>
      ) : null}

      {selectedCategory ? (
        <div className="mt-4 rounded-[14px] border border-white/8 bg-[#15151599] px-4 py-3">
          <p className="text-sm leading-6 text-white/58">
            {selectedCategory.description}
          </p>
          {selectedCategory.exampleExpressions.length > 0 ? (
            <p className="mt-2 text-xs leading-5 text-white/36">
              示例：{selectedCategory.exampleExpressions.join("、")}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
