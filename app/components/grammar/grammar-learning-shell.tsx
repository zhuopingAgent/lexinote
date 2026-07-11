"use client";

import { useEffect, useRef, useState } from "react";
import type {
  GrammarBootstrapResponse,
  GrammarPointSummary,
  GrammarProgressResponse,
  GrammarSearchResponse,
  KnowledgeDimension,
  LearningModule,
  LearningStage,
  TaxonomyNode,
} from "@/shared/types/grammar";
import { CurriculumPathNavigation } from "@/app/components/grammar/curriculum-path-navigation";
import { GrammarCard } from "@/app/components/grammar/grammar-card";
import { GrammarPathNavigation } from "@/app/components/grammar/grammar-path-navigation";
import { GrammarProgressOverview } from "@/app/components/grammar/grammar-progress-overview";
import { GrammarSearch } from "@/app/components/grammar/grammar-search";
import { getErrorMessage, readJson } from "@/app/lib/api-client";

const GRAMMAR_PAGE_SIZE = 36;
const GRAMMAR_FETCH_LIMIT = GRAMMAR_PAGE_SIZE + 1;
const DEFAULT_DIMENSION_SLUG = "expression_function";
const DEFAULT_STAGE_SLUG = "foundations";

type GrammarBrowseMode = "knowledge" | "curriculum";

export function GrammarLearningShell() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [browseMode, setBrowseMode] = useState<GrammarBrowseMode>("knowledge");
  const [dimensionSlug, setDimensionSlug] = useState(DEFAULT_DIMENSION_SLUG);
  const [categorySlug, setCategorySlug] = useState("");
  const [stageSlug, setStageSlug] = useState(DEFAULT_STAGE_SLUG);
  const [moduleSlug, setModuleSlug] = useState("");
  const [knowledgeDimensions, setKnowledgeDimensions] = useState<
    KnowledgeDimension[]
  >([]);
  const [taxonomyNodes, setTaxonomyNodes] = useState<TaxonomyNode[]>([]);
  const [learningStages, setLearningStages] = useState<LearningStage[]>([]);
  const [learningModules, setLearningModules] = useState<LearningModule[]>([]);
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
  const [hasBootstrapped, setHasBootstrapped] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const searchGenerationRef = useRef(0);
  const loadMoreControllerRef = useRef<AbortController | null>(null);
  const skipNextSearchRef = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    const generation = searchGenerationRef.current + 1;
    searchGenerationRef.current = generation;
    loadMoreControllerRef.current?.abort();
    setIsTaxonomyLoading(true);
    setIsProgressLoading(true);
    setIsSearchLoading(true);
    setIsLoadingMore(false);
    setTaxonomyError(null);
    setProgressError(null);
    setSearchError(null);
    setLoadMoreError(null);
    setHasMore(false);

    async function loadBootstrap() {
      const params = new URLSearchParams();

      params.set("dimension", DEFAULT_DIMENSION_SLUG);
      params.set("limit", String(GRAMMAR_FETCH_LIMIT));
      try {
        const result = await fetch(`/api/grammar/bootstrap?${params.toString()}`, {
          signal: controller.signal,
        }).then((response) => readJson<GrammarBootstrapResponse>(response));

        if (controller.signal.aborted || searchGenerationRef.current !== generation) {
          return;
        }

        setKnowledgeDimensions(result.taxonomy.knowledgeDimensions ?? []);
        setTaxonomyNodes(result.taxonomy.taxonomyNodes ?? []);
        setLearningStages(result.taxonomy.learningStages ?? []);
        setLearningModules(result.taxonomy.learningModules ?? []);
        setProgress(result.progress);
        setItems(result.search.items.slice(0, GRAMMAR_PAGE_SIZE));
        setHasMore(result.search.items.length > GRAMMAR_PAGE_SIZE);
        skipNextSearchRef.current = true;
        setHasBootstrapped(true);
      } catch (error) {
        if (!controller.signal.aborted && searchGenerationRef.current === generation) {
          const message = getErrorMessage(
            error,
            "文法首页加载失败，请稍后再试。"
          );

          setTaxonomyError(message);
          setProgressError(message);
          setSearchError(message);
          skipNextSearchRef.current = false;
          setHasBootstrapped(true);
        }
      } finally {
        if (!controller.signal.aborted && searchGenerationRef.current === generation) {
          setIsTaxonomyLoading(false);
          setIsProgressLoading(false);
          setIsSearchLoading(false);
        }
      }
    }

    void loadBootstrap();

    return () => {
      controller.abort();
    };
  }, []);

  useEffect(() => {
    if (!hasBootstrapped) {
      return;
    }

    if (skipNextSearchRef.current) {
      skipNextSearchRef.current = false;
      return;
    }

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
        if (browseMode === "knowledge" && categorySlug) {
          params.set("category", categorySlug);
        }
        if (browseMode === "knowledge" && dimensionSlug) {
          params.set("dimension", dimensionSlug);
        }
        if (browseMode === "curriculum" && stageSlug) {
          params.set("stage", stageSlug);
        }
        if (browseMode === "curriculum" && moduleSlug) {
          params.set("module", moduleSlug);
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
  }, [
    hasBootstrapped,
    submittedQuery,
    browseMode,
    categorySlug,
    dimensionSlug,
    moduleSlug,
    stageSlug,
  ]);

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
    setDimensionSlug(DEFAULT_DIMENSION_SLUG);
    setCategorySlug("");
    setStageSlug(DEFAULT_STAGE_SLUG);
    setModuleSlug("");
  }

  function clearQuery() {
    setQuery("");
    setSubmittedQuery("");
  }

  function handleDimensionChange(nextDimensionSlug: string) {
    setDimensionSlug(nextDimensionSlug);
    setCategorySlug("");
  }

  function handleStageChange(nextStageSlug: string) {
    setStageSlug(nextStageSlug);
    setModuleSlug("");
  }

  function handleBrowseModeChange(nextMode: GrammarBrowseMode) {
    setBrowseMode(nextMode);
    setCategorySlug("");
    setModuleSlug("");
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
    if (browseMode === "knowledge" && categorySlug) {
      params.set("category", categorySlug);
    }
    if (browseMode === "knowledge" && dimensionSlug) {
      params.set("dimension", dimensionSlug);
    }
    if (browseMode === "curriculum" && stageSlug) {
      params.set("stage", stageSlug);
    }
    if (browseMode === "curriculum" && moduleSlug) {
      params.set("module", moduleSlug);
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
  const selectedStage = learningStages.find(
    (stage) => stage.slug === stageSlug
  );
  const stageModules = learningModules.filter(
    (module) => module.stageSlug === stageSlug
  );
  const selectedModule = learningModules.find(
    (module) => module.slug === moduleSlug
  );
  const selectedPath =
    browseMode === "knowledge" ? selectedDimension : selectedStage;
  const selectedSubcategory =
    browseMode === "knowledge" ? selectedCategory : selectedModule;

  return (
    <div className="mx-auto w-full max-w-[1180px]">
      <GrammarProgressOverview
        progress={progress}
        isLoading={isProgressLoading}
        error={progressError}
      />

      <div className="mt-5 inline-flex h-10 items-center rounded-lg border border-border bg-surface p-1">
        <button
          type="button"
          aria-pressed={browseMode === "knowledge"}
          onClick={() => handleBrowseModeChange("knowledge")}
          className={
            browseMode === "knowledge"
              ? "inline-flex h-8 items-center rounded-md bg-surface-strong px-3 text-sm font-semibold text-foreground"
              : "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted transition hover:text-foreground"
          }
        >
          知识分类
        </button>
        <button
          type="button"
          aria-pressed={browseMode === "curriculum"}
          onClick={() => handleBrowseModeChange("curriculum")}
          className={
            browseMode === "curriculum"
              ? "inline-flex h-8 items-center rounded-md bg-surface-strong px-3 text-sm font-semibold text-foreground"
              : "inline-flex h-8 items-center rounded-md px-3 text-sm font-medium text-muted transition hover:text-foreground"
          }
        >
          课程顺序
        </button>
      </div>

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
        {browseMode === "knowledge" ? (
          <GrammarPathNavigation
            dimensions={knowledgeDimensions}
            progressGroups={progress?.groupProgress ?? []}
            selectedSlug={dimensionSlug}
            isLoading={isTaxonomyLoading}
            onSelect={handleDimensionChange}
          />
        ) : (
          <CurriculumPathNavigation
            stages={learningStages}
            modules={learningModules}
            selectedSlug={stageSlug}
            isLoading={isTaxonomyLoading}
            onSelect={handleStageChange}
          />
        )}

        <section className="min-w-0" aria-labelledby="grammar-results-heading">
          <div className="border-b border-border pb-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium text-muted">
                  {browseMode === "knowledge" ? "当前知识维度" : "当前课程阶段"}
                </p>
                <h2
                  id="grammar-results-heading"
                  className="mt-1 text-xl leading-7 font-semibold text-foreground"
                >
                  {selectedPath?.nameZh ?? "文法列表"}
                </h2>
                {selectedPath ? (
                  <p className="mt-1 max-w-[680px] text-sm leading-6 text-muted">
                    {selectedPath.description}
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
                aria-label={browseMode === "knowledge" ? "语法分类" : "课程模块"}
                className="mt-4 flex gap-2 overflow-x-auto pb-2"
              >
                <button
                  type="button"
                  aria-pressed={
                    browseMode === "knowledge" ? !categorySlug : !moduleSlug
                  }
                  onClick={() =>
                    browseMode === "knowledge"
                      ? setCategorySlug("")
                      : setModuleSlug("")
                  }
                  className={
                    browseMode === "knowledge"
                      ? categorySlug
                        ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
                        : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-accent/35 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
                      : moduleSlug
                      ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
                      : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-accent/35 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
                  }
                >
                  全部
                </button>
                {browseMode === "knowledge"
                  ? categoryButtonCategories.map((category) => (
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
                    ))
                  : stageModules.map((module) => (
                      <button
                        key={module.slug}
                        type="button"
                        aria-pressed={moduleSlug === module.slug}
                        onClick={() => setModuleSlug(module.slug)}
                        className={
                          moduleSlug === module.slug
                            ? "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-accent/35 bg-accent-soft px-3 text-xs font-semibold text-accent-strong"
                            : "inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border border-border bg-surface px-3 text-xs font-medium text-muted transition hover:border-foreground/30 hover:text-foreground"
                        }
                      >
                        {module.nameZh}
                      </button>
                    ))}
              </div>
            )}

            {selectedSubcategory ? (
              <div className="mt-3 border-l-2 border-accent pl-3">
                <p className="text-sm leading-6 text-foreground">
                  {selectedSubcategory.description}
                </p>
                {browseMode === "knowledge" &&
                selectedCategory &&
                selectedCategory.exampleExpressions.length > 0 ? (
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
