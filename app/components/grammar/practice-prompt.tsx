import type { PracticeGenerateResponse } from "@/shared/types/api";
import { TagBadge } from "@/app/components/grammar/tag-badge";

type PracticePromptProps = {
  practice: PracticeGenerateResponse | null;
  isLoading: boolean;
};

export function PracticePrompt({ practice, isLoading }: PracticePromptProps) {
  if (isLoading) {
    return (
      <section className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
        <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-white/8" />
        <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-white/8" />
      </section>
    );
  }

  if (!practice) {
    return (
      <section className="rounded-[18px] border border-dashed border-white/12 bg-[#17171799] p-5 text-sm leading-6 text-white/42">
        选择场景、语体和等级后生成练习。
      </section>
    );
  }

  return (
    <section className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white/74">练习任务</h2>
        <div className="flex flex-wrap gap-2">
          {practice.sceneTag ? <TagBadge tag={practice.sceneTag} tone="scene" /> : null}
          {practice.registerTag ? (
            <TagBadge tag={practice.registerTag} tone="register" />
          ) : null}
          <TagBadge tag={practice.source === "ai" ? "AI" : "本地"} />
        </div>
      </div>

      <p className="mt-4 text-base leading-7 text-white/76">{practice.prompt}</p>

      {practice.hints.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-white/44">提示</p>
          <ul className="mt-2 space-y-2 text-sm leading-6 text-white/48">
            {practice.hints.map((hint) => (
              <li key={hint}>{hint}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-5">
        <p className="text-sm font-semibold text-white/44">参考答案</p>
        <div className="mt-3 space-y-3">
          {practice.referenceAnswers.map((answer) => (
            <article
              key={`${answer.jp}-${answer.zh}`}
              className="rounded-[14px] border border-white/8 bg-[#15151599] p-4"
            >
              <p className="text-sm leading-6 text-white/75">{answer.jp}</p>
              <p className="mt-1 text-sm leading-6 text-white/45">{answer.zh}</p>
              <p className="mt-2 text-xs leading-5 text-white/36">{answer.noteZh}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
