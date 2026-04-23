"use client";

import { useEffect, useState, type KeyboardEvent, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import type { CollectionWordItem } from "@/shared/types/api";

type CollectionWordGridProps = {
  collectionId: number;
  words: CollectionWordItem[];
};

type ApiError = {
  error?: {
    message?: string;
  };
};

function getSourceLabel(source: CollectionWordItem["source"]) {
  return source === "manual" ? "手动添加" : "AI 筛选";
}

export function CollectionWordGrid({
  collectionId,
  words,
}: CollectionWordGridProps) {
  const router = useRouter();
  const [currentWords, setCurrentWords] = useState(words);
  const [busyWordId, setBusyWordId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCurrentWords(words);
  }, [words]);

  function openWordDetail(wordId: number) {
    router.push(`/collections/words/detail?collectionId=${collectionId}&wordId=${wordId}`);
  }

  function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>, wordId: number) {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    openWordDetail(wordId);
  }

  function stopCardNavigation(event: MouseEvent<HTMLElement>) {
    event.stopPropagation();
  }

  async function onRemoveWord(event: MouseEvent<HTMLButtonElement>, wordId: number) {
    stopCardNavigation(event);

    const confirmed = window.confirm("确认把这个词条从当前 collection 中移除吗？");
    if (!confirmed) {
      return;
    }

    setError(null);
    setNotice(null);
    setBusyWordId(wordId);

    try {
      const response = await fetch(
        `/api/collections/${collectionId}/words/${wordId}`,
        {
          method: "DELETE",
        }
      );

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      setCurrentWords((currentItems) =>
        currentItems.filter((word) => word.wordId !== wordId)
      );
      setNotice("已从当前 collection 中移除该词条。");
      router.refresh();
    } catch (removeError) {
      setError(
        removeError instanceof Error ? removeError.message : "移除失败，请稍后重试。"
      );
    } finally {
      setBusyWordId(null);
    }
  }

  if (currentWords.length === 0) {
    return (
      <div className="mt-6 rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
        <p className="text-base font-medium text-white/60">这个 collection 里还没有单词</p>
        <p className="mt-2 text-sm leading-6 text-white/38">
          下一步我们可以把查询结果加入 collection，这里就会开始展示具体词条。
        </p>
      </div>
    );
  }

  return (
    <>
      {notice ? (
        <div className="mt-5 rounded-[18px] border border-white/10 bg-[#1a2218cc] px-5 py-4 text-white/72">
          <p className="text-sm leading-6">{notice}</p>
        </div>
      ) : null}

      {error ? (
        <div
          role="alert"
          className="mt-5 rounded-2xl border border-danger/30 bg-danger-soft/80 px-5 py-4 text-danger"
        >
          <p className="text-sm font-semibold">移除失败</p>
          <p className="mt-1 text-sm leading-6">{error}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {currentWords.map((word) => {
          const isBusy = busyWordId === word.wordId;

          return (
            <div
              key={word.wordId}
              role="link"
              tabIndex={0}
              onClick={() => openWordDetail(word.wordId)}
              onKeyDown={(event) => onCardKeyDown(event, word.wordId)}
              className="group flex cursor-pointer flex-col rounded-[20px] border border-white/10 bg-[#1e1e1ecc] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.16)] transition hover:border-white/18 hover:bg-[#232323] hover:shadow-[0_22px_54px_rgba(0,0,0,0.22)] focus:outline-none focus:ring-2 focus:ring-white/15"
              aria-label={`查看 ${word.word} 的详情`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[24px] font-medium tracking-[-0.04em] text-white/80 transition group-hover:text-white/88">
                    {word.word}
                  </p>
                  <p className="mt-1 text-sm leading-6 text-white/45">
                    {word.pronunciation}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <span className="inline-flex shrink-0 rounded-full bg-white/7 px-3 py-1 text-xs text-white/52">
                    {word.partOfSpeech}
                  </span>
                  <span className="inline-flex shrink-0 rounded-full border border-white/10 px-3 py-1 text-xs text-white/40">
                    {getSourceLabel(word.source)}
                  </span>
                </div>
              </div>

              <p className="mt-5 break-words text-sm leading-6 text-white/50">
                {word.meaningZh}
              </p>

              <div className="mt-auto border-t border-white/8 pt-4">
                <button
                  type="button"
                  onClick={(event) => void onRemoveWord(event, word.wordId)}
                  disabled={isBusy}
                  className="inline-flex h-10 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/48 transition hover:border-white/18 hover:text-white/62 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isBusy ? "移除中..." : "移除"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
