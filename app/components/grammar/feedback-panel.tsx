import type { AIFeedbackResult } from "@/shared/types/grammar";
import {
  displayFeedbackSeverityLabel,
  displayMistakeTypeLabel,
  displayRegisterTagLabel,
} from "@/app/components/grammar/display-labels";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import type { PracticeMasteryEvidence } from "@/shared/types/practice";

type FeedbackPanelProps = {
  feedback: AIFeedbackResult | null;
  isLoading?: boolean;
  embedded?: boolean;
  learnerAnswer?: string | null;
  isRecorded?: boolean;
  rubricScores?: PracticeMasteryEvidence["rubricScores"];
};

const SCORE_ITEMS = [
  ["语法", "grammarScore"],
  ["意思", "meaningScore"],
  ["自然度", "naturalnessScore"],
  ["语体", "registerScore"],
  ["场景", "sceneFitScore"],
] as const;

const RUBRIC_SCORE_KEYS = {
  grammarScore: "grammar",
  meaningScore: "meaning",
  naturalnessScore: "naturalness",
  registerScore: "register",
  sceneFitScore: "contextFit",
} as const;

export function FeedbackPanel({
  feedback,
  isLoading,
  embedded = false,
  learnerAnswer,
  isRecorded = false,
  rubricScores,
}: FeedbackPanelProps) {
  if (isLoading) {
    return (
      <section
        className={
          embedded
            ? "border-t border-border pt-6"
            : "rounded-lg border border-border bg-surface p-5"
        }
      >
        <div className="ml-auto h-16 w-2/3 animate-pulse rounded-lg bg-foreground/8" />
        <div className="mt-6 h-5 w-28 animate-pulse rounded bg-foreground/10" />
        <div className="mt-4 h-5 w-full animate-pulse rounded bg-foreground/8" />
        <div className="mt-3 h-5 w-4/5 animate-pulse rounded bg-foreground/8" />
      </section>
    );
  }

  if (!feedback) {
    return null;
  }

  const explanation = feedback.explanation.trim();
  const feedbackText = feedback.feedbackText.trim();
  const correctedSentence = feedback.correctedSentence?.trim() || null;
  const betterVersions = feedback.betterVersions.filter(
    (version) => version.sentence.trim() !== correctedSentence
  );

  return (
    <section
      aria-label="练习反馈对话"
      aria-live="polite"
      className={
        embedded
          ? "border-t border-border pt-6"
          : "rounded-lg border border-border bg-surface p-5"
      }
    >
      {learnerAnswer ? (
        <div className="flex justify-end">
          <div className="max-w-[88%] rounded-lg bg-foreground/8 px-4 py-3 sm:max-w-[76%]">
            <p className="text-xs font-semibold text-muted">你的回答</p>
            <p lang="ja" className="mt-1 whitespace-pre-wrap text-base leading-7 text-foreground/85">
              {learnerAnswer}
            </p>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-[32px_minmax(0,1fr)] gap-3 ${learnerAnswer ? "mt-6" : ""}`}>
        <span
          aria-hidden="true"
          className="inline-flex size-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-background"
        >
          文
        </span>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-foreground/85">
              LexiNote 教练
            </h2>
            <TagBadge tag={feedback.isCorrect ? "表达自然" : "需要调整"} />
          </div>

          <p className="mt-3 text-base font-semibold leading-7 text-foreground">
            {feedbackText || explanation}
          </p>
          {explanation && explanation !== feedbackText ? (
            <p className="mt-2 text-base leading-7 text-foreground/72">
              {explanation}
            </p>
          ) : null}

          {feedback.issues.length > 0 ? (
            <div className="mt-5 space-y-4 border-l-2 border-foreground/12 pl-4">
              {feedback.issues.map((issue) => (
                <div key={issue.errorTypeCode}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground/78">
                      {displayMistakeTypeLabel(issue.errorTypeCode)}
                    </span>
                    {issue.role ? (
                      <span className="text-xs font-medium text-accent-strong">
                        {issue.role === "root" ? "主要问题" : "伴随影响"}
                      </span>
                    ) : null}
                    <span className="text-xs text-muted">
                      {displayFeedbackSeverityLabel(issue.severity)}
                    </span>
                  </div>
                  {issue.evidenceSpan ? (
                    <p className="mt-1 text-xs text-muted">
                      句中位置：<span lang="ja">{issue.evidenceSpan}</span>
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm leading-6 text-foreground/62">
                    {issue.explanation}
                  </p>
                  {issue.correction && issue.correction !== correctedSentence ? (
                    <p className="mt-1 text-sm leading-6 text-foreground/72">
                      <span className="text-muted">改成：</span>
                      <span lang="ja">{issue.correction}</span>
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          {correctedSentence ? (
            <div className="mt-5 border-l-2 border-accent pl-4">
              <p className="text-xs font-semibold text-muted">建议改为</p>
              <p lang="ja" className="mt-1 text-lg leading-8 text-foreground">
                {correctedSentence}
              </p>
            </div>
          ) : null}

          {betterVersions.length > 0 ? (
            <div className="mt-5 space-y-3">
              <p className="text-sm font-semibold text-foreground/72">
                还可以这样说
              </p>
              {betterVersions.map((version) => (
                <div key={`${version.sentence}-${version.explanationZh}`}>
                  <div className="flex flex-wrap items-start gap-2">
                    <p lang="ja" className="text-sm leading-6 text-foreground/82">
                      {version.sentence}
                    </p>
                    {version.registerTag ? (
                      <TagBadge tag={displayRegisterTagLabel(version.registerTag)} />
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    {version.explanationZh}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {feedback.issues.length === 0 && feedback.mistakeTypes.length > 0 ? (
            <div className="mt-5 flex flex-wrap gap-2">
              {feedback.mistakeTypes.map((mistakeType) => (
                <TagBadge
                  key={mistakeType}
                  tag={displayMistakeTypeLabel(mistakeType)}
                />
              ))}
            </div>
          ) : null}

          {feedback.nextHint ? (
            <p className="mt-5 text-sm leading-6 text-accent-strong">
              下一步：{feedback.nextHint}
            </p>
          ) : null}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border pt-4">
            {isRecorded ? (
              <span className="text-xs font-medium text-foreground/48">
                本次作答已记录
              </span>
            ) : null}
            <details className="text-xs text-muted">
              <summary className="cursor-pointer font-medium transition hover:text-foreground">
                查看本次评分
              </summary>
              <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {SCORE_ITEMS.map(([label, key]) => (
                  <div key={key} className="min-w-0">
                    <dt className="truncate">{label}</dt>
                    <dd className="mt-1 text-sm font-semibold text-foreground/76">
                      {rubricScores
                        ? rubricScores[RUBRIC_SCORE_KEYS[key]] === "not_assessed"
                          ? "未评估"
                          : `${rubricScores[RUBRIC_SCORE_KEYS[key]]}/3`
                        : `${feedback[key]}/5`}
                    </dd>
                  </div>
                ))}
              </dl>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
