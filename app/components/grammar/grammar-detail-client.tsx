"use client";

import { useEffect, useState } from "react";
import type {
  GrammarPointDetail,
  GrammarPointSummary,
} from "@/shared/types/grammar";
import { GrammarDetail } from "@/app/components/grammar/grammar-detail";
import { getErrorMessage } from "@/app/lib/api-client";
import {
  addGrammarFavorite,
  fetchGrammarDetail,
  fetchGrammarSearch,
  removeGrammarFavorite,
} from "@/app/lib/grammar-api";

export function GrammarDetailClient({
  grammarPointId,
}: {
  grammarPointId: string;
}) {
  const [grammarPoint, setGrammarPoint] = useState<GrammarPointDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [curriculumNeighbors, setCurriculumNeighbors] = useState<{
    previous: GrammarPointSummary | null;
    next: GrammarPointSummary | null;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDetail() {
      setIsLoading(true);
      setError(null);

      try {
        const detail = await fetchGrammarDetail(
          grammarPointId,
          controller.signal
        );
        setGrammarPoint(detail.grammarPoint);
        const curriculum = detail.grammarPoint.curriculum;
        if (curriculum?.module) {
          try {
            const moduleItems = await fetchGrammarSearch(
              {
              stage: curriculum.stage.slug,
              module: curriculum.module.slug,
                limit: 80,
              },
              controller.signal
            );
            const currentIndex = moduleItems.items.findIndex(
              (item) => item.id === detail.grammarPoint.id
            );
            setCurriculumNeighbors(currentIndex >= 0 ? {
              previous: moduleItems.items[currentIndex - 1] ?? null,
              next: moduleItems.items[currentIndex + 1] ?? null,
            } : null);
          } catch {
            if (!controller.signal.aborted) setCurriculumNeighbors(null);
          }
        } else {
          setCurriculumNeighbors(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "语法详情加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadDetail();

    return () => {
      controller.abort();
    };
  }, [grammarPointId]);

  async function onFavoriteChange(isFavorite: boolean) {
    const resolvedGrammarPointId = grammarPoint?.id ?? grammarPointId;

    if (isFavorite) {
      await addGrammarFavorite(resolvedGrammarPointId);
      return;
    }

    await removeGrammarFavorite(resolvedGrammarPointId);
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-[1000px]">
        <div className="min-h-[360px] animate-pulse rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-6">
          <div className="h-8 w-28 rounded-full bg-white/8" />
          <div className="mt-7 h-14 w-64 rounded bg-white/10" />
          <div className="mt-5 h-5 w-40 rounded bg-white/8" />
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="h-32 rounded-[18px] bg-white/7" />
            <div className="h-32 rounded-[18px] bg-white/7" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !grammarPoint) {
    return (
      <div
        role="alert"
        className="mx-auto w-full max-w-[760px] rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
      >
        {error ?? "未找到这个语法点。"}
      </div>
    );
  }

  return (
    <GrammarDetail
      key={grammarPoint.id}
      grammarPoint={grammarPoint}
      onFavoriteChange={onFavoriteChange}
      curriculumNeighbors={curriculumNeighbors ?? undefined}
    />
  );
}
