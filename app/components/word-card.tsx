"use client";

import { BookOpenIcon, LightbulbIcon, VolumeIcon } from "@/app/components/icons";

export interface WordData {
  word: string;
  reading: string;
  romaji: string;
  partOfSpeech: string;
  meanings: string[];
  examples: {
    japanese: string;
    reading: string;
    english: string;
  }[];
  jlptLevel?: string;
}

interface WordCardProps {
  word: WordData;
}

export function WordCard({ word }: WordCardProps) {
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
    <div className="w-full max-w-2xl overflow-hidden rounded-[16px] border border-white/10 bg-[#1e1e1e]/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="border-b border-white/10 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h2 className="text-[36px] leading-10 font-medium tracking-[0.01em] text-white/80">
                {word.word}
              </h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex size-9 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/15"
                aria-label={`朗读 ${word.word}`}
              >
                <VolumeIcon className="size-5 text-white/55" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-white/55">
              <span className="text-[18px] leading-7">{word.reading}</span>
              {word.romaji ? <span className="text-sm text-white/30">•</span> : null}
              {word.romaji ? <span className="text-sm text-white/45">{word.romaji}</span> : null}
            </div>
          </div>

          {word.jlptLevel ? (
            <div className="rounded-full bg-[#fe9a0033] px-3 py-1 text-sm font-medium text-[#ffb900] backdrop-blur-sm">
              {word.jlptLevel}
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-white/55 backdrop-blur-sm">
            {word.partOfSpeech}
          </span>
        </div>
      </div>

      <div className="border-b border-white/10 p-6">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenIcon className="size-5 text-white/55" />
          <h3 className="text-[18px] font-medium text-white/70">意味</h3>
        </div>

        {word.meanings.length > 0 ? (
          <ul className="space-y-2">
            {word.meanings.map((meaning, index) => (
              <li key={`${meaning}-${index}`} className="flex gap-[12px] text-[16px] leading-6 text-white/60">
                <span className="min-w-[24px] font-medium text-white/35">
                  {index + 1}.
                </span>
                <span>{meaning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/40">当前结果还没有可展示的释义。</p>
        )}
      </div>

      <div className="p-6">
        <div className="mb-4 flex items-center gap-2">
          <LightbulbIcon className="size-5 text-white/55" />
          <h3 className="text-[18px] font-medium text-white/70">例文</h3>
        </div>

        {word.examples.length > 0 ? (
          <div className="space-y-4">
            {word.examples.map((example, index) => (
              <div
                key={`${example.japanese}-${index}`}
                className="border-l-[1.5px] border-white/20 pl-[17px]"
              >
                <p className="mb-1 text-[16px] leading-6 text-white/75">
                  {example.japanese}
                </p>
                <p className="mb-1 text-sm leading-5 text-white/35">{example.reading}</p>
                <p className="text-[16px] leading-6 text-white/50">{example.english}</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-white/40">
            当前后端还没有返回例句，所以这里先保留卡片结构，后面接上例句数据后会直接显示。
          </p>
        )}
      </div>
    </div>
  );
}
