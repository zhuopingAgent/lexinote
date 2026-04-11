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
    <div className="w-full max-w-2xl overflow-hidden rounded-[14px] border border-white/10 bg-[#1e1e1e]/90 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:rounded-[16px]">
      <div className="border-b border-white/10 p-4 sm:p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2.5 sm:gap-3">
              <h2 className="break-words text-[30px] leading-9 font-medium tracking-[0.01em] text-white/80 sm:text-[34px] sm:leading-10 md:text-[36px]">
                {word.word}
              </h2>
              <button
                type="button"
                onClick={handleSpeak}
                className="inline-flex size-8 items-center justify-center rounded-full transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white/15 sm:size-9"
                aria-label={`朗读 ${word.word}`}
              >
                <VolumeIcon className="size-5 text-white/55" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 text-white/55 sm:gap-3">
              <span className="text-base leading-6 sm:text-[18px] sm:leading-7">{word.reading}</span>
              {word.romaji ? <span className="text-sm text-white/30">•</span> : null}
              {word.romaji ? <span className="text-sm text-white/45">{word.romaji}</span> : null}
            </div>
          </div>

          {word.jlptLevel ? (
            <div className="self-start rounded-full bg-[#fe9a0033] px-3 py-1 text-xs font-medium text-[#ffb900] backdrop-blur-sm sm:text-sm">
              {word.jlptLevel}
            </div>
          ) : null}
        </div>

        <div className="mt-3">
          <span className="inline-block rounded-full bg-white/10 px-3 py-1 text-[13px] text-white/55 backdrop-blur-sm sm:text-sm">
            {word.partOfSpeech}
          </span>
        </div>
      </div>

      <div className="border-b border-white/10 p-4 sm:p-5 md:p-6">
        <div className="mb-3 flex items-center gap-2">
          <BookOpenIcon className="size-5 text-white/55" />
          <h3 className="text-base font-medium text-white/70 sm:text-[18px]">意味</h3>
        </div>

        {word.meanings.length > 0 ? (
          <ul className="space-y-2">
            {word.meanings.map((meaning, index) => (
              <li
                key={`${meaning}-${index}`}
                className="flex gap-[10px] text-[15px] leading-6 text-white/60 sm:gap-[12px] sm:text-[16px]"
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

      <div className="p-4 sm:p-5 md:p-6">
        <div className="mb-4 flex items-center gap-2">
          <LightbulbIcon className="size-5 text-white/55" />
          <h3 className="text-base font-medium text-white/70 sm:text-[18px]">例文</h3>
        </div>

        {word.examples.length > 0 ? (
          <div className="space-y-3 sm:space-y-4">
            {word.examples.map((example, index) => (
              <div
                key={`${example.japanese}-${index}`}
                className="border-l-[1.5px] border-white/20 pl-3.5 sm:pl-[17px]"
              >
                <p className="mb-1 break-words text-[15px] leading-6 text-white/75 sm:text-[16px]">
                  {example.japanese}
                </p>
                <p className="mb-1 break-words text-sm leading-5 text-white/35">
                  {example.reading}
                </p>
                <p className="break-words text-[15px] leading-6 text-white/50 sm:text-[16px]">
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
