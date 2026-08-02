"use client";

import type { FormEvent } from "react";
import { SearchIcon } from "@/app/components/icons";

type GrammarSearchProps = {
  query: string;
  isLoading: boolean;
  resultCount: number;
  hasMore: boolean;
  onQueryChange: (query: string) => void;
  onClearQuery: () => void;
  onSubmit: () => void;
  practicality: string;
  learningStatus: string;
  onPracticalityChange: (value: string) => void;
  onLearningStatusChange: (value: string) => void;
};

export function GrammarSearch({
  query,
  isLoading,
  resultCount,
  hasMore,
  onQueryChange,
  onClearQuery,
  onSubmit,
  practicality,
  learningStatus,
  onPracticalityChange,
  onLearningStatusChange,
}: GrammarSearchProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(260px,1fr)_auto_auto] sm:items-center">
      <form role="search" onSubmit={handleSubmit} className="col-span-2 min-w-0 sm:col-span-1">
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

      <label className="sr-only" htmlFor="grammar-practicality-filter">实用度</label>
      <select
        id="grammar-practicality-filter"
        value={practicality}
        onChange={(event) => onPracticalityChange(event.target.value)}
        className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-foreground/40"
      >
        <option value="">全部实用度</option>
        <option value="S">S · 高频必会</option>
        <option value="A">A · 常用</option>
        <option value="B">B · 实用补充</option>
        <option value="C">C · 进阶</option>
        <option value="D">D · 低频</option>
      </select>

      <label className="sr-only" htmlFor="grammar-status-filter">学习状态</label>
      <select
        id="grammar-status-filter"
        value={learningStatus}
        onChange={(event) => onLearningStatusChange(event.target.value)}
        className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-foreground outline-none transition focus:border-foreground/40"
      >
        <option value="">全部状态</option>
        <option value="not_started">未开始</option>
        <option value="learning">学习中</option>
        <option value="mastered">已掌握</option>
      </select>

      <p aria-live="polite" className="col-span-2 text-right text-xs tabular-nums text-muted sm:col-span-3">
        {isLoading
          ? "正在查找..."
          : hasMore
            ? `已显示 ${resultCount} 个，还有更多`
            : `共 ${resultCount} 个`}
      </p>
    </div>
  );
}
