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
import { GrammarPathNavigation } from "@/app/components/grammar/grammar-path-navigation";
import { GrammarProgressOverview } from "@/app/components/grammar/grammar-progress-overview";
import { GrammarSearch } from "@/app/components/grammar/grammar-search";
import { getErrorMessage, readJson } from "@/app/lib/api-client";

const GRAMMAR_PAGE_SIZE = 36;
const GRAMMAR_FETCH_LIMIT = GRAMMAR_PAGE_SIZE + 1;

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
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isTaxonomyLoading, setIsTaxonomyLoading] = useState(true);
  const [isProgressLoading, setIsProgressLoading] = useState(true);
  const [isSearchLoading, setIsSearchLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchGenerationRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);

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
    loadMoreControllerRef.current?.abort();
    setIsLoadingMore(false);
    setLoadMoreError(null);
    setHasMore(false);
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
        params.set("limit", String(GRAMMAR_FETCH_LIMIT));

        try {
          const result = await fetch(`/api/grammar?${params.toString()}`, {
            signal: controller.signal,
          }).then((response) => readJson<GrammarSearchResponse>(response));

          if (searchGenerationRef.current === generation) {
            setItems(result.items.slice(0, GRAMMAR_PAGE_SIZE));
            setHasMore(result.items.length > GRAMMAR_PAGE_SIZE);
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
      loadMoreControllerRef.current?.abort();
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

  function clearQuery() {
    setQuery("");
    setSubmittedQuery("");
  }

  function handleDimensionChange(nextDimensionSlug: string) {
    setDimensionSlug(nextDimensionSlug);
    setCategorySlug("");
  }

  async function loadMore() {
    if (isLoadingMore || !hasMore) {
      return;
    }

    loadMoreControllerRef.current?.abort();
    const controller = new AbortController();
    const generation = searchGenerationRef.current;
    loadMoreControllerRef.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(null);

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
    params.set("limit", String(GRAMMAR_FETCH_LIMIT));
    params.set("offset", String(items.length));

    try {
      const result = await fetch(`/api/grammar?${params.toString()}`, {
        signal: controller.signal,
      }).then((response) => readJson<GrammarSearchResponse>(response));

      if (searchGenerationRef.current === generation) {
        const nextItems = result.items.slice(0, GRAMMAR_PAGE_SIZE);
        setItems((currentItems) => {
          const existingIds = new Set(currentItems.map((item) => item.id));
          return [
            ...currentItems,
            ...nextItems.filter((item) => !existingIds.has(item.id)),
          ];
        });
        setHasMore(result.items.length > GRAMMAR_PAGE_SIZE);
      }
    } catch (error) {
      if (!controller.signal.aborted && searchGenerationRef.current === generation) {
        setLoadMoreError(getErrorMessage(error, "更多语法加载失败，请稍后再试。"));
      }
    } finally {
      if (
        loadMoreControllerRef.current === controller &&
        searchGenerationRef.current === generation
      ) {
        setIsLoadingMore(false);
      }
    }
  }

  const categoryButtonCategories = taxonomyNodes.filter(
    (category) => category.dimensionSlug === dimensionSlug
  );
  const selectedDimension = knowledgeDimensions.find(
    (dimension) => dimension.slug === dimensionSlug
  );
  const selectedCategory = taxonomyNodes.find(
    (category) => category.slug === categorySlug
  );

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <GrammarProgressOverview
        progress={progress}
        isLoading={isProgressLoading}
        error={progressError}
      />

      <div className="mt-6">
        <GrammarSearch
          query={query}
          isLoading={isSearchLoading}
          resultCount={items.length}
          onQueryChange={setQuery}
          onClearQuery={clearQuery}
          onSubmit={() => setSubmittedQuery(query)}
        />
      </div>

      {taxonomyError ? (
        <div
          role="alert"
          className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-sm leading-6 text-danger"
        >
          {taxonomyError}
        </div>
      ) : null}

      <div className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <GrammarPathNavigation
          dimensions={knowledgeDimensions}
          progressGroups={progress?.groupProgress ?? []}
          selectedSlug={dimensionSlug}
          isLoading={isTaxonomyLoading}
          onSelect={handleDimensionChange}
        />

        <section className="min-w-0" aria-labelledby="grammar-results-heading">
          <div className="border-b border-border pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">当前路径</p>
                <h2
                  id="grammar-results-heading"
                  className="mt-1 text-xl leading-7 font-semibold text-foreground"
                >
                  {selectedDimension?.nameZh ?? "文法列表"}
                </h2>
                {selectedDimension ? (
                  <p className="mt-1 max-w-[680px] text-sm leading-6 text-muted">
                    {selectedDimension.description}
                  </p>
                ) : null}
              </div>
            </div>

            {isTaxonomyLoading ? (
              <div className="mt-4 flex gap-2 overflow-hidden">
                {Array.from({ length: 5 }).map((_, index) => (
                  <span
                    key={index}
                    className="h-9 w-28 shrink-0 animate-pulse rounded-md bg-surface-soft"
                  />
                ))}
              </div>
            ) : (
              <div
                aria-label="语法分类"
                className="mt-4 flex gap-2 overflow-x-auto pb-2"
              >
                <button
                  type="button"
                  aria-pressed={!categorySlug}
                  onClick={() => setCategorySlug("")}
                  className={
                    categorySlug
                      ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
                      : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-accent/35 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
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
                        ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-accent/35 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
                        : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
                    }
                  >
                    {category.nameZh}
                  </button>
                ))}
              </div>
            )}

            {selectedCategory ? (
              <div className="mt-3 border-l-2 border-accent pl-3">
                <p className="text-sm leading-6 text-foreground">
                  {selectedCategory.description}
                </p>
                {selectedCategory.exampleExpressions.length > 0 ? (
                  <p className="mt-1 text-xs leading-5 text-muted">
                    示例：{selectedCategory.exampleExpressions.join("、")}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {searchError ? (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-5 py-4 text-sm leading-6 text-danger"
            >
              {searchError}
            </div>
          ) : null}

          {isSearchLoading ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="min-h-[220px] animate-pulse rounded-lg border border-border bg-surface p-5"
                >
                  <div className="h-7 w-32 rounded bg-surface-strong" />
                  <div className="mt-4 h-4 w-24 rounded bg-surface-strong" />
                  <div className="mt-6 h-4 w-full rounded bg-surface-strong" />
                  <div className="mt-2 h-4 w-4/5 rounded bg-surface-strong" />
                  <div className="mt-8 h-9 w-24 rounded-md bg-surface-strong" />
                </div>
              ))}
            </div>
          ) : null}

          {!isSearchLoading && !searchError && items.length === 0 ? (
            <div className="mt-5 rounded-lg border border-dashed border-border bg-surface-soft px-6 py-12 text-center">
              <p className="text-base font-medium text-foreground">
                没有匹配的语法点
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                换个关键词、分类或学习路径再试。
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-4 text-sm font-medium text-foreground transition hover:border-foreground/30"
              >
                清除筛选
              </button>
            </div>
          ) : null}

          {!isSearchLoading && !searchError && items.length > 0 ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {items.map((item) => (
                <GrammarCard key={item.id} grammarPoint={item} />
              ))}
            </div>
          ) : null}

          {!isSearchLoading && !searchError && items.length > 0 && hasMore ? (
            <div className="mt-6 flex flex-col items-center gap-2">
              {loadMoreError ? (
                <p role="alert" className="text-sm text-danger">
                  {loadMoreError}
                </p>
              ) : null}
              <button
                type="button"
                onClick={() => void loadMore()}
                disabled={isLoadingMore}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border bg-surface px-5 text-sm font-medium text-foreground transition hover:border-foreground/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoadingMore ? "正在加载..." : loadMoreError ? "重试加载" : "加载更多"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
