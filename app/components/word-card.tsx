"use client";

import type { ReactNode } from "react";
import { VolumeIcon } from "@/app/components/icons";

export interface WordData {
  word: string;
  reading: string;
  romaji: string;
  partOfSpeech: string;
  meanings: string[];
  examples: {
    japanese: string;
    reading: string;
    translation: string;
  }[];
  jlptLevel?: string;
}

interface WordCardProps {
  word: WordData;
  actions?: ReactNode;
}

export function WordCard({ word, actions }: WordCardProps) {
  const handleSpeak = () => {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.word);
    utterance.lang = "ja-JP";
    utterance.rate = 0.8;
    window.speechSynthesis.speak(utterance);
  };

  return (
    <article className="w-full overflow-hidden rounded-lg border border-border bg-surface">
      <header className="p-[clamp(18px,2.5vw,24px)]">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="break-words text-3xl leading-tight font-semibold text-foreground">
                {word.word}
              </h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-surface-strong hover:text-foreground focus:outline-none focus:ring-2 focus:ring-accent-soft"
                aria-label={`朗读 ${word.word}`}
                title="朗读"
              >
                <VolumeIcon className="size-5" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="text-base text-foreground/75">{word.reading}</span>
              {word.romaji ? <span aria-hidden="true">·</span> : null}
              {word.romaji ? <span>{word.romaji}</span> : null}
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap justify-end gap-2">
            <span className="inline-flex min-h-7 items-center rounded-md bg-surface-strong px-2.5 py-1 text-xs text-muted">
              {word.partOfSpeech}
            </span>
            {word.jlptLevel ? (
              <span className="inline-flex min-h-7 items-center rounded-md bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-strong">
                {word.jlptLevel}
              </span>
            ) : null}
          </div>
        </div>
      </header>

      <section className="border-t border-border p-[clamp(18px,2.5vw,24px)]">
        <h3 className="text-sm font-semibold text-foreground">意味</h3>

        {word.meanings.length > 0 ? (
          <ol className="mt-3 space-y-2">
            {word.meanings.map((meaning, index) => (
              <li
                key={`${meaning}-${index}`}
                className="grid grid-cols-[22px_minmax(0,1fr)] gap-2 text-sm leading-6 text-foreground/75"
              >
                <span className="tabular-nums text-muted">{index + 1}.</span>
                <span className="break-words">{meaning}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-muted">当前结果还没有可展示的释义。</p>
        )}
      </section>

      <section className="border-t border-border p-[clamp(18px,2.5vw,24px)]">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-foreground">例文</h3>
          {word.examples.length > 0 ? (
            <span className="text-xs text-muted">{word.examples.length} 句</span>
          ) : null}
        </div>

        {word.examples.length > 0 ? (
          <div className="mt-3 divide-y divide-border">
            {word.examples.map((example, index) => (
              <div key={`${example.japanese}-${index}`} className="py-3 first:pt-0 last:pb-0">
                <p className="break-words text-sm leading-6 text-foreground">
                  {example.japanese}
                </p>
                {example.reading ? (
                  <p className="mt-1 break-words text-xs leading-5 text-muted">
                    {example.reading}
                  </p>
                ) : null}
                <p className="mt-1 break-words text-sm leading-6 text-foreground/65">
                  {example.translation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm leading-6 text-muted">暂时没有生成例句。</p>
        )}
      </section>

      {actions ? <footer className="border-t border-border p-4">{actions}</footer> : null}
    </article>
  );
}
