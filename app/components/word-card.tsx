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
    translation: string;
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
    <div className="w-full max-w-2xl overflow-hidden rounded-[clamp(14px,2vw,16px)] border border-white/10 bg-[#1e1e1e]/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      <div className="border-b border-white/10 p-[clamp(16px,2.5vw,24px)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h2 className="break-words text-[clamp(30px,4vw,36px)] leading-[1.1] font-medium tracking-[0.01em] text-white/80">
                {word.word}
              </h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex size-[clamp(32px,3vw,36px)] items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/15"
                aria-label={`朗读 ${word.word}`}
              >
                <VolumeIcon className="size-5 text-white/55" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-white/55 sm:gap-3">
              <span className="text-[clamp(16px,2vw,18px)] leading-[1.55]">{word.reading}</span>
              {word.romaji ? <span className="text-sm text-white/30">•</span> : null}
              {word.romaji ? <span className="text-sm text-white/45">{word.romaji}</span> : null}
            </div>
          </div>

          {word.jlptLevel ? (
            <div className="self-start rounded-full bg-[#fe9a0033] px-3 py-1 text-[clamp(12px,1.6vw,14px)] font-medium text-[#ffb900] backdrop-blur-sm">
              {word.jlptLevel}
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[clamp(13px,1.6vw,14px)] text-white/55 backdrop-blur-sm">
            {word.partOfSpeech}
          </span>
        </div>
      </div>

      <div className="border-b border-white/10 p-[clamp(16px,2.5vw,24px)]">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenIcon className="size-5 text-white/55" />
          <h3 className="text-[clamp(16px,2vw,18px)] font-medium text-white/70">意味</h3>
        </div>

        {word.meanings.length > 0 ? (
          <ul className="space-y-2">
            {word.meanings.map((meaning, index) => (
              <li
                key={`${meaning}-${index}`}
                className="flex gap-[clamp(10px,1.5vw,12px)] text-[clamp(15px,2vw,16px)] leading-6 text-white/60"
              >
                <span className="min-w-[24px] font-medium text-white/35">
                  {index + 1}.
                </span>
                <span className="break-words">{meaning}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-white/40">当前结果还没有可展示的释义。</p>
        )}
      </div>

      <div className="p-[clamp(16px,2.5vw,24px)]">
        <div className="mb-4 flex items-center gap-2">
          <LightbulbIcon className="size-5 text-white/55" />
          <h3 className="text-[clamp(16px,2vw,18px)] font-medium text-white/70">例文</h3>
        </div>

        {word.examples.length > 0 ? (
          <div className="space-y-[clamp(12px,2vw,16px)]">
            {word.examples.map((example, index) => (
              <div
                key={`${example.japanese}-${index}`}
                className="border-l-[1.5px] border-white/20 pl-[clamp(14px,2vw,17px)]"
              >
                <p className="mb-1 break-words text-[clamp(15px,2vw,16px)] leading-6 text-white/75">
                  {example.japanese}
                </p>
                <p className="mb-1 break-words text-sm leading-5 text-white/35">
                  {example.reading}
                </p>
                <p className="break-words text-[clamp(15px,2vw,16px)] leading-6 text-white/50">
                  {example.translation}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm leading-6 text-white/40">暂时没有生成例句。</p>
        )}
      </div>
    </div>
  );
}
