import type { AIFeedbackResult } from "@/shared/types/grammar";
import {
  displayFeedbackSeverityLabel,
  displayMistakeTypeLabel,
  displayRegisterTagLabel,
} from "@/app/components/grammar/display-labels";
import { TagBadge } from "@/app/components/grammar/tag-badge";

type FeedbackPanelProps = {
  feedback: AIFeedbackResult | null;
  isLoading?: boolean;
};

function ScorePill({ label, value }: { label: string; value: number }) {
  const tone =
    value >= 4
      ? "border-[#72e0ad33] bg-[#72e0ad14] text-[#9ce7c1]"
      : value >= 3
        ? "border-[#ffbe5c33] bg-[#ffbe5c14] text-[#ffd08a]"
        : "border-danger/30 bg-danger-soft/70 text-danger";

  return (
    <span className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1 text-xs font-semibold ${tone}`}>
      {label} {value}/5
    </span>
  );
}

export function FeedbackPanel({ feedback, isLoading }: FeedbackPanelProps) {
  if (isLoading) {
    return (
      <section className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
        <div className="h-5 w-28 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-white/8" />
        <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-white/8" />
      </section>
    );
  }

  if (!feedback) {
    return null;
  }

  return (
    <section className="rounded-[18px] border border-white/10 bg-[#1e1e1ecc] p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white/74">反馈</h2>
        <TagBadge tag={feedback.isCorrect ? "表达自然" : "需要调整"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ScorePill label="语法" value={feedback.grammarScore} />
        <ScorePill label="意思" value={feedback.meaningScore} />
        <ScorePill label="自然度" value={feedback.naturalnessScore} />
        <ScorePill label="语体" value={feedback.registerScore} />
        <ScorePill label="场景" value={feedback.sceneFitScore} />
      </div>

      <p className="mt-5 text-base leading-7 text-white/72">
        {feedback.explanation || feedback.feedbackText}
      </p>

      {feedback.issues.length > 0 ? (
        <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
          {feedback.issues.map((issue) => (
            <div key={issue.errorTypeCode} className="py-4">
              <div className="flex flex-wrap items-center gap-2">
                <TagBadge tag={displayMistakeTypeLabel(issue.errorTypeCode)} />
                <span className="text-xs text-white/34">
                  {displayFeedbackSeverityLabel(issue.severity)}
                </span>
              </div>
              <p className="mt-2 text-sm leading-6 text-white/56">
                {issue.explanation}
              </p>
              {issue.correction ? (
                <p className="mt-2 text-sm leading-6 text-white/42">
                  {issue.correction}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {feedback.correctedSentence ? (
        <div className="mt-5 rounded-[14px] border border-white/8 bg-[#15151599] p-4">
          <p className="text-sm font-semibold text-white/44">修正句</p>
          <p className="mt-2 text-base leading-7 text-white/78">
            {feedback.correctedSentence}
          </p>
        </div>
      ) : null}

      {feedback.betterVersions.length > 0 ? (
        <div className="mt-5">
          <p className="text-sm font-semibold text-white/44">更自然的版本</p>
          <div className="mt-3 space-y-3">
            {feedback.betterVersions.map((version) => (
              <article
                key={`${version.sentence}-${version.explanationZh}`}
                className="rounded-[14px] border border-white/8 bg-[#15151599] p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm leading-6 text-white/76">{version.sentence}</p>
                  {version.registerTag ? (
                    <TagBadge tag={displayRegisterTagLabel(version.registerTag)} />
                  ) : null}
                </div>
                <p className="mt-2 text-sm leading-6 text-white/46">
                  {version.explanationZh}
                </p>
              </article>
            ))}
          </div>
        </div>
      ) : null}

      {feedback.issues.length === 0 && feedback.mistakeTypes.length > 0 ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {feedback.mistakeTypes.map((mistakeType) => (
            <TagBadge key={mistakeType} tag={displayMistakeTypeLabel(mistakeType)} />
          ))}
        </div>
      ) : null}

      {feedback.nextHint ? (
        <p className="mt-5 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm leading-6 text-accent-strong">
          下一步：{feedback.nextHint}
        </p>
      ) : null}

      {feedback.nextPracticePrompt &&
      feedback.nextPracticePrompt !== feedback.nextHint ? (
        <p className="mt-5 rounded-[14px] border border-accent/20 bg-accent-soft px-4 py-3 text-sm leading-6 text-accent-strong">
          {feedback.nextPracticePrompt}
        </p>
      ) : null}
    </section>
  );
}
