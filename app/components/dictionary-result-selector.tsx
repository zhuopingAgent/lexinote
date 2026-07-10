"use client";

import type { DictionaryEntry } from "@/shared/types/api";

type DictionaryResultSelectorProps = {
  entries: DictionaryEntry[];
  selectedPronunciation: string;
  onSelectEntry: (entry: DictionaryEntry) => void;
};

function summarizeEntry(entry: DictionaryEntry) {
  return entry.meaningZh.split(/[；;。]/)[0]?.trim() || "查看这个词条";
}

export function DictionaryResultSelector({
  entries,
  selectedPronunciation,
  onSelectEntry,
}: DictionaryResultSelectorProps) {
  if (entries.length < 2) {
    return null;
  }

  return (
    <section aria-labelledby="dictionary-reading-selector">
      <div className="flex items-center justify-between gap-3">
        <h2
          id="dictionary-reading-selector"
          className="text-sm font-semibold text-foreground"
        >
          选择读音
        </h2>
        <span className="text-xs text-muted">{entries.length} 个结果</span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {entries.map((entry) => {
          const isSelected = entry.pronunciation === selectedPronunciation;

          return (
            <button
              key={`${entry.word}-${entry.pronunciation}`}
              type="button"
              aria-label={`${isSelected ? "当前词条" : "选择这个词条"} ${entry.word} ${entry.pronunciation}`}
              aria-pressed={isSelected}
              onClick={() => onSelectEntry(entry)}
              className={
                isSelected
                  ? "min-w-0 rounded-lg border border-accent/35 bg-accent-soft px-4 py-3 text-left"
                  : "min-w-0 rounded-lg border border-border bg-surface px-4 py-3 text-left transition hover:border-foreground/30"
              }
            >
              <span className="flex items-center justify-between gap-3 text-base font-semibold text-foreground">
                {entry.pronunciation}
                {isSelected ? (
                  <span className="text-xs font-medium text-accent-strong">
                    当前
                  </span>
                ) : null}
              </span>
              <span className="mt-1 block truncate text-sm text-muted">
                {summarizeEntry(entry)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
