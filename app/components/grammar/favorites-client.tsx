"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { GrammarPointSummary } from "@/shared/types/grammar";
import { GrammarCard } from "@/app/components/grammar/grammar-card";
import { getErrorMessage } from "@/app/lib/api-client";
import {
  fetchGrammarFavorites,
  removeGrammarFavorite,
} from "@/app/lib/grammar-api";

export function FavoritesClient() {
  const [items, setItems] = useState<GrammarPointSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const controller = new AbortController();

    async function loadFavorites() {
      setIsLoading(true);
      setError(null);

      try {
        const result = await fetchGrammarFavorites(controller.signal);
        setItems(result.items);
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "收藏加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadFavorites();

    return () => {
      controller.abort();
    };
  }, []);

  async function removeFavorite(grammarPointId: string) {
    setRemovingIds((current) => new Set(current).add(grammarPointId));
    setError(null);
    try {
      await removeGrammarFavorite(grammarPointId);
      setItems((current) => current.filter((item) => item.id !== grammarPointId));
    } catch (removeError) {
      setError(getErrorMessage(removeError, "取消收藏失败，请稍后再试。"));
    } finally {
      setRemovingIds((current) => {
        const next = new Set(current);
        next.delete(grammarPointId);
        return next;
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-[1120px]">
      <section className="rounded-[22px] border border-white/10 bg-[#1e1e1eb3] p-[clamp(18px,2.6vw,26px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-2xl leading-tight font-semibold text-white/78">收藏</p>
            <p className="mt-1 text-sm leading-6 text-white/42">
              已保存 {items.length} 个语法点。
            </p>
          </div>
          <Link
            href="/grammar"
            className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/55 transition hover:border-white/20 hover:text-white/72"
          >
            返回文法
          </Link>
        </div>
      </section>

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
        >
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="min-h-[238px] animate-pulse rounded-[18px] border border-white/8 bg-[#1a1a1a99] p-5"
            />
          ))}
        </div>
      ) : null}

      {!isLoading && !error && items.length === 0 ? (
        <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
          <p className="text-base font-medium text-white/60">还没有收藏</p>
          <Link
            href="/grammar"
            className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
          >
            去搜索
          </Link>
        </div>
      ) : null}

      {!isLoading && items.length > 0 ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <GrammarCard
              key={item.id}
              grammarPoint={item}
              onRemoveFavorite={removeFavorite}
              isRemovingFavorite={removingIds.has(item.id)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
