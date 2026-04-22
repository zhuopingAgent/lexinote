"use client";

import type { SearchHistoryItem } from "@/app/lib/search-history";

type HistoryListProps = {
  items: SearchHistoryItem[];
  onOpenItem: (item: SearchHistoryItem) => void;
  onClear: () => void;
};

export function HistoryList({
  items,
  onOpenItem,
  onClear,
}: HistoryListProps) {
  return (
    <div className="mx-auto w-full max-w-[848px]">
      <div className="rounded-[clamp(14px,2vw,16px)] border border-white/10 bg-[#1e1e1eb3] p-[clamp(16px,2.6vw,24px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white/70">検索履歴</p>
            <p className="mt-1 text-sm leading-6 text-white/40">
              {items.length > 0
                ? `已保存 ${items.length} 条查询记录，点击任意一项即可恢复结果。`
                : "当前还没有查询记录。"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClear}
            disabled={items.length === 0}
            className="inline-flex h-10 shrink-0 items-center justify-center rounded-full border border-white/10 px-4 text-sm text-white/54 transition hover:border-white/18 hover:bg-white/5 hover:text-white/70 disabled:cursor-not-allowed disabled:opacity-40"
          >
            清空历史
          </button>
        </div>

        {items.length > 0 ? (
          <div className="mt-5 space-y-3">
            {items.map((item) => {
              const showsLookupWordHint =
                item.result.lookupWord !== item.searchedWord;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onOpenItem(item)}
                  className="w-full rounded-[14px] border border-white/8 bg-[#15151599] px-4 py-4 text-left transition hover:border-white/16 hover:bg-white/5"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <p className="text-lg font-medium tracking-[-0.02em] text-white/74">
                          {item.searchedWord}
                        </p>
                        <span className="rounded-full bg-white/8 px-2.5 py-1 text-xs text-white/42">
                          {item.result.entry.partOfSpeech}
                        </span>
                      </div>

                      <p className="mt-2 text-sm leading-6 text-white/45">
                        {item.result.entry.pronunciation}
                        <span className="mx-2 text-white/18">/</span>
                        {item.result.entry.meaningZh}
                      </p>

                      {item.context ? (
                        <p className="mt-2 text-sm leading-6 text-white/35">
                          语境：{item.context}
                        </p>
                      ) : null}

                      {showsLookupWordHint ? (
                        <p className="mt-1 text-sm leading-6 text-white/35">
                          按原形「{item.result.lookupWord}」查询
                        </p>
                      ) : null}
                    </div>

                    <p className="shrink-0 text-xs leading-5 text-white/28">
                      {formatHistoryTimestamp(item.searchedAt)}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="mt-5 rounded-[14px] border border-dashed border-white/10 bg-[#15151566] px-5 py-10 text-center">
            <p className="text-base font-medium text-white/58">还没有历史记录</p>
            <p className="mt-2 text-sm leading-6 text-white/35">
              查询成功后会自动出现在这里。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function formatHistoryTimestamp(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
