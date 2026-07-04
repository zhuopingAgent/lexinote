"use client";

import type { FormEvent } from "react";

type SentenceInputProps = {
  value: string;
  isSubmitting: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function SentenceInput({
  value,
  isSubmitting,
  disabled,
  onChange,
  onSubmit,
}: SentenceInputProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5"
    >
      <label htmlFor="practice-sentence" className="text-lg font-semibold text-white/74">
        你的句子
      </label>
      <textarea
        id="practice-sentence"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled || isSubmitting}
        rows={5}
        placeholder="先生、もう一度説明してもらえる？"
        className="mt-4 min-h-32 w-full resize-y rounded-[14px] border border-white/12 bg-[#151515cc] px-4 py-3 text-base leading-7 text-white/76 outline-none placeholder:text-white/28 focus:border-white/26 focus:ring-2 focus:ring-white/10 disabled:opacity-60"
      />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-white/34">{value.trim().length} 字符</p>
        <button
          type="submit"
          disabled={disabled || isSubmitting || !value.trim()}
          className="inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? "提交中" : "提交反馈"}
        </button>
      </div>
    </form>
  );
}
