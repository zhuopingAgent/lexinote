"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AddCollectionWordsResponse, DictionaryEntryCandidate } from "@/shared/types/api";

type ApiError = {
  error?: {
    code?: string;
    message?: string;
  };
};

type CollectionWordPickerProps = {
  collectionId: number;
  entries: DictionaryEntryCandidate[];
  existingWordIds: number[];
};

function summarizeMeaning(meaning: string) {
  return meaning.split(/[；;。]/)[0]?.trim() || meaning.trim();
}

export function CollectionWordPicker({
  collectionId,
  entries,
  existingWordIds,
}: CollectionWordPickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingWordIdSet = new Set(existingWordIds);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = entries.filter((entry) => {
    if (!normalizedQuery) {
      return true;
    }

    const combinedText = [
      entry.word,
      entry.pronunciation,
      entry.meaningZh,
      entry.partOfSpeech,
    ]
      .join(" ")
      .toLowerCase();

    return combinedText.includes(normalizedQuery);
  });

  function toggleWordSelection(wordId: number) {
    setSelectedWordIds((currentWordIds) =>
      currentWordIds.includes(wordId)
        ? currentWordIds.filter((currentWordId) => currentWordId !== wordId)
        : [...currentWordIds, wordId]
    );
  }

  async function onAddSelectedWords() {
    if (selectedWordIds.length === 0) {
      setError("请先勾选至少一个词条。");
      return;
    }

    setError(null);
    setNotice(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/collections/${collectionId}/words/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          wordIds: selectedWordIds,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json()) as ApiError;
        throw new Error(payload.error?.message || "请求失败");
      }

      const payload = (await response.json()) as AddCollectionWordsResponse;

      if (payload.addedCount === 0) {
        setNotice("所选词条都已经在当前 collection 中。");
        return;
      }

      router.push(
        `/collections/detail?collectionId=${collectionId}&added=${payload.addedCount}`
      );
      router.refresh();
    } catch (addError) {
      const message = addError instanceof Error ? addError.message : "发生了意外错误";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mt-6 rounded-[22px] border border-white/10 bg-[#1e1e1ecc] p-[clamp(20px,2.8vw,28px)] shadow-[0_20px_60px_rgba(0,0,0,0.16)]">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-base font-medium tracking-[-0.03em] text-white/72">
            选择要加入的单词
          </p>
          <p className="mt-1 text-sm leading-6 text-white/40">
            可以直接勾选列表，也可以先搜索再勾选。这里只展示本地词典里的词条。
          </p>
        </div>
        <p className="text-sm text-white/35">
          已选 {selectedWordIds.length} / {visibleEntries.filter((entry) => !existingWordIdSet.has(entry.wordId)).length}
        </p>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索单词、读音或释义，例如：抱く / いだく / 怀有"
          aria-label="搜索可添加词条"
          className="h-12 flex-1 rounded-[14px] border border-white/12 bg-[#151515cc] px-4 text-sm text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10"
        />
        <button
          type="button"
          onClick={() => {
            setQuery("");
            setError(null);
            setNotice(null);
          }}
          className="inline-flex h-12 shrink-0 items-center justify-center rounded-[14px] border border-white/10 px-5 text-sm text-white/52 transition hover:border-white/18 hover:text-white/66"
        >
          清空搜索
        </button>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {visibleEntries.map((entry) => {
          const isExisting = existingWordIdSet.has(entry.wordId);
          const isSelected = selectedWordIds.includes(entry.wordId);

          return (
            <label
              key={entry.wordId}
              className={
                isExisting
                  ? "rounded-[16px] border border-white/8 bg-[#15151588] px-4 py-4 opacity-60"
                  : isSelected
                    ? "cursor-pointer rounded-[16px] border border-white/20 bg-white/8 px-4 py-4"
                    : "cursor-pointer rounded-[16px] border border-white/10 bg-[#15151599] px-4 py-4 transition hover:border-white/16 hover:bg-white/5"
              }
            >
              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  checked={isExisting || isSelected}
                  onChange={() => toggleWordSelection(entry.wordId)}
                  disabled={isExisting}
                  className="mt-1 size-4 rounded border-white/15 bg-transparent accent-white/80"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-lg font-medium tracking-[-0.03em] text-white/78">
                      {entry.word}
                    </p>
                    <span className="text-sm text-white/42">{entry.pronunciation}</span>
                    <span className="inline-flex rounded-full bg-white/7 px-2.5 py-1 text-xs text-white/48">
                      {entry.partOfSpeech}
                    </span>
                    {isExisting ? (
                      <span className="inline-flex rounded-full border border-white/10 px-2.5 py-1 text-xs text-white/45">
                        已添加
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-white/42">
                    {summarizeMeaning(entry.meaningZh)}
                  </p>
                </div>
              </div>
            </label>
          );
        })}
      </div>

      {visibleEntries.length === 0 ? (
        <div className="mt-5 rounded-[18px] border border-dashed border-white/12 bg-[#17171799] px-6 py-10 text-center">
          <p className="text-base font-medium text-white/58">没有匹配的本地词条</p>
          <p className="mt-2 text-sm leading-6 text-white/38">
            你可以先回词典页查询一次，把词条写入本地，再回来添加。
          </p>
        </div>
      ) : null}

      {notice ? <p className="mt-4 text-sm leading-6 text-white/42">{notice}</p> : null}
      {error ? <p className="mt-4 text-sm leading-6 text-danger">{error}</p> : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void onAddSelectedWords()}
          disabled={isSubmitting || selectedWordIds.length === 0}
          className="inline-flex h-11 items-center justify-center rounded-full bg-white/10 px-5 text-sm font-medium text-white/74 transition hover:bg-white/14 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {isSubmitting ? "添加中..." : `添加已选 ${selectedWordIds.length} 个词条`}
        </button>
      </div>
    </div>
  );
}
