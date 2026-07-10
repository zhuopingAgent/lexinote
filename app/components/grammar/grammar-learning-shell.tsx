"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GrammarPointSummary,
  GrammarProgressResponse,
  GrammarSearchResponse,
  GrammarTaxonomyResponse,
  KnowledgeDimension,
  TaxonomyNode,
} from "@/shared/types/grammar";
import { GrammarCard } from "@/app/components/grammar/grammar-card";
import { GrammarProgressOverview } from "@/app/components/grammar/grammar-progress-overview";
import { GrammarSearch } from "@/app/components/grammar/grammar-search";
import { getErrorMessage, readJson } from "@/app/lib/api-client";

export function GrammarLearningShell() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [dimensionSlug, setDimensionSlug] = useState("expression_function");
  const [categorySlug, setCategorySlug] = useState("");
  const [knowledgeDimensions, setKnowledgeDimensions] = useState<
    KnowledgeDimension[]
  >([]);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [progress, setProgress] = useState<GrammarProgressResponse | null>(null);
  const [items, setItems] = useState<GrammarPointSummary[]>([]);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [isProgressLoading, setIsProgressLoading] = useState(true);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const searchGenerationRef = useRef(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTaxonomy() {
      setIsTaxonomyLoading(true);
      setTaxonomyError(null);

      try {
        const taxonomy = await fetch("/api/grammar/taxonomy", {
          signal: controller.signal,
        }).then((response) => readJson<GrammarTaxonomyResponse>(response));
        setKnowledgeDimensions(taxonomy.knowledgeDimensions ?? []);
        setTaxonomyNodes(taxonomy.taxonomyNodes ?? []);
      } catch (error) {
        if (!controller.signal.aborted) {
          setTaxonomyError(getErrorMessage(error, "分类加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsTaxonomyLoading(false);
        }
      }
    }

    void loadTaxonomy();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProgress() {
      setIsProgressLoading(true);
      setProgressError(null);

      try {
        const result = await fetch("/api/grammar/progress", {
          signal: controller.signal,
        }).then((response) => readJson<GrammarProgressResponse>(response));
        setProgress(result);
      } catch (error) {
        if (!controller.signal.aborted) {
          setProgressError(
            getErrorMessage(error, "学习进度加载失败，请稍后再试。")
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsProgressLoading(false);
        }
      }
    }

    void loadProgress();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    const timer = window.setTimeout(() => {
      async function search() {
        setIsSearchLoading(true);
        setSearchError(null);

        const params = new URLSearchParams();
        if (submittedQuery.trim()) {
          params.set("query", submittedQuery.trim());
        }
        if (categorySlug) {
          params.set("category", categorySlug);
        }
        if (dimensionSlug) {
          params.set("dimension", dimensionSlug);
        }
        params.set("limit", "36");

        try {
          const result = await fetch(`/api/grammar?${params.toString()}`, {
            signal: controller.signal,
          }).then((response) => readJson<GrammarSearchResponse>(response));

          if (searchGenerationRef.current === generation) {
            setItems(result.items);
          }
        } catch (error) {
          if (!controller.signal.aborted && searchGenerationRef.current === generation) {
            setSearchError(getErrorMessage(error, "搜索失败，请稍后再试。"));
          }
        } finally {
          if (!controller.signal.aborted && searchGenerationRef.current === generation) {
            setIsSearchLoading(false);
          }
        }
      }

      void search();
    }, 220);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [submittedQuery, categorySlug, dimensionSlug]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSubmittedQuery(query);
    }, 260);

    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  function clearFilters() {
    setQuery("");
    setSubmittedQuery("");
    setDimensionSlug("expression_function");
    setCategorySlug("");
  }

  function handleDimensionChange(nextDimensionSlug: string) {
    setDimensionSlug(nextDimensionSlug);
    setCategorySlug("");
  }

  const categoryButtonCategories = taxonomyNodes.filter(
    (category) => category.dimensionSlug === dimensionSlug
  );
  const selectedCategoryName =
    taxonomyNodes.find((category) => category.slug === categorySlug)?.nameZh ?? null;

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <GrammarProgressOverview
        progress={progress}
        selectedGroupSlug={dimensionSlug}
        selectedCategoryName={selectedCategoryName}
        resultCount={items.length}
        isLoading={isProgressLoading}
        error={progressError}
        onGroupSelect={handleDimensionChange}
      />

      <GrammarSearch
        knowledgeDimensions={knowledgeDimensions}
        categories={categoryButtonCategories}
        query={query}
        dimensionSlug={dimensionSlug}
        categorySlug={categorySlug}
        isLoading={isSearchLoading}
        resultCount={items.length}
        onQueryChange={setQuery}
        onDimensionChange={handleDimensionChange}
        onCategoryChange={setCategorySlug}
        onClearFilters={clearFilters}
        onSubmit={() => setSubmittedQuery(query)}
      />

      {taxonomyError ? (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
        >
          {taxonomyError}
        </div>
      ) : null}

      {isTaxonomyLoading ? (
        <div className="mt-5 flex gap-2 overflow-hidden md:flex-wrap">
          {Array.from({ length: 5 }).map((_, index) => (
            <div
              key={index}
              className="h-10 w-28 shrink-0 animate-pulse rounded-full bg-white/8"
            />
          ))}
        </div>
      ) : (
        <div className="mt-5 flex gap-2 overflow-x-auto pb-1 md:flex-wrap md:overflow-visible md:pb-0">
          <button
            type="button"
            aria-pressed={!categorySlug}
            onClick={() => setCategorySlug("")}
            className={
              categorySlug
                ? "inline-flex h-10 shrink-0 items-center rounded-full border border-white/10 px-4 text-sm text-white/45 transition hover:border-white/18 hover:text-white/68"
                : "inline-flex h-10 shrink-0 items-center rounded-full border border-accent/30 bg-accent-soft px-4 text-sm font-semibold text-accent-strong"
            }
          >
            全部
          </button>
          {categoryButtonCategories.map((category) => (
            <button
              key={category.slug}
              type="button"
              aria-pressed={categorySlug === category.slug}
              onClick={() => setCategorySlug(category.slug)}
              className={
                categorySlug === category.slug
                  ? "inline-flex h-10 shrink-0 items-center rounded-full border border-accent/30 bg-accent-soft px-4 text-sm font-semibold text-accent-strong"
                  : "inline-flex h-10 shrink-0 items-center rounded-full border border-white/10 px-4 text-sm text-white/45 transition hover:border-white/18 hover:text-white/68"
              }
            >
              {category.nameZh}
            </button>
          ))}
        </div>
      )}

      {searchError ? (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
        >
          {searchError}
        </div>
      ) : null}

      {isSearchLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[238px] animate-pulse rounded-[18px] border border-white/8 bg-[#1a1a1a99] p-5"
            >
              <div className="h-8 w-32 rounded bg-white/10" />
              <div className="mt-4 h-4 w-24 rounded bg-white/8" />
              <div className="mt-6 h-4 w-full rounded bg-white/8" />
              <div className="mt-2 h-4 w-4/5 rounded bg-white/8" />
              <div className="mt-8 h-8 w-24 rounded-full bg-white/6" />
            </div>
          ))}
        </div>
      ) : null}

      {!isSearchLoading && !searchError && items.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">没有匹配的语法点</p>
          <p className="mt-2 text-sm leading-6 text-white/38">
            换个关键词或分类再试。
          </p>
        </div>
      ) : null}

      {!isSearchLoading && items.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <GrammarCard key={item.id} grammarPoint={item} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
