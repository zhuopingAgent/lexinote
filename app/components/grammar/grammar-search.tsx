"use client";

import type { FormEvent } from "react";
import { SearchIcon } from "@/app/components/icons";

type GrammarSearchProps = {
  query: string;
  isLoading: boolean;
  resultCount: number;
  onQueryChange: (query: string) => void;
  onClearQuery: () => void;
  onSubmit: () => void;
};

export function GrammarSearch({
  query,
  isLoading,
  resultCount,
  onQueryChange,
  onClearQuery,
  onSubmit,
}: GrammarSearchProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <form role="search" onSubmit={handleSubmit} className="min-w-0 flex-1">
        <label htmlFor="grammar-search" className="sr-only">
          搜索语法
        </label>
        <div className="relative">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted" />
          <input
            id="grammar-search"
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="搜索表达、中文含义或接续结构"
            className="h-11 w-full appearance-none rounded-lg border border-border bg-surface pr-11 pl-11 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/40 focus:ring-2 focus:ring-accent-soft"
          />
          {query ? (
            <button
              type="button"
              aria-label="清除搜索"
              title="清除搜索"
              onClick={onClearQuery}
              className="absolute top-1/2 right-2 flex size-9 -translate-y-1/2 items-center justify-center rounded-md text-xl leading-none text-muted transition hover:bg-surface-strong hover:text-foreground"
            >
              <span aria-hidden="true">×</span>
            </button>
          ) : null}
        </div>
      </form>

      <p
        aria-live="polite"
        className="min-w-[86px] text-right text-xs tabular-nums text-muted"
      >
        {isLoading ? "正在查找..." : `已显示 ${resultCount} 个`}
      </p>
    </div>
  );
}
