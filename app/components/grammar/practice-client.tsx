"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AiApiErrorModal } from "@/app/components/ai-api-error-modal";
import { FeedbackPanel } from "@/app/components/grammar/feedback-panel";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import {
  getErrorMessage,
  isAiQuotaExhaustedError,
  readJson,
} from "@/app/lib/api-client";
import {
  PRACTICE_OBJECTIVE_LABELS,
  PRACTICE_SKILL_LABELS,
} from "@/features/grammar-learning/domain/practice";
import type { PracticeReferenceAnswer } from "@/shared/types/grammar";
import type {
  PracticeAttemptResponse,
  PracticeHintResponse,
  PracticeRevealResponse,
  PracticeSessionEntryMode,
  PracticeSessionResponse,
} from "@/shared/types/practice";

type PracticeClientProps = {
  grammarPointId?: string;
  entryMode: PracticeSessionEntryMode;
};

function PracticeTaskPrompt({ prompt }: { prompt: string }) {
  const quotedCue = prompt.match(/^([\s\S]*)：“([^”]+)”$/);
  if (!quotedCue) {
    return (
      <span className="text-xl font-semibold leading-8 text-foreground">
        {prompt}
      </span>
    );
  }
  const instruction = /[。？！!?]$/.test(quotedCue[1])
    ? quotedCue[1]
    : `${quotedCue[1]}。`;

  return (
    <>
      <span className="block text-base font-medium leading-7 text-foreground/68">
        {instruction}
      </span>
      <span
        lang="zh-CN"
        className="mt-4 block border-l-2 border-accent pl-4 text-xl font-semibold leading-8 text-foreground"
      >
        {quotedCue[2]}
      </span>
    </>
  );
}

function ReferenceAnswers({
  answers,
  responseMode,
}: {
  answers: PracticeReferenceAnswer[];
  responseMode: "choice" | "text";
}) {
  if (answers.length === 0) {
    return null;
  }

  return (
    <section className="border-t border-border pt-6" aria-label="参考答案">
      <h2 className="text-base font-semibold text-foreground">
        {responseMode === "choice" ? "答案与例句" : "参考表达"}
      </h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {answers.map((answer) => (
          <article
            key={`${answer.jp}-${answer.zh}`}
            className="rounded-lg border border-border bg-surface-soft p-4"
          >
            <p className="text-base leading-7 text-foreground">{answer.jp}</p>
            <p className="mt-2 text-sm leading-6 text-muted">{answer.zh}</p>
            {answer.noteZh ? (
              <p className="mt-2 text-xs leading-5 text-foreground/45">
                {answer.noteZh}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

function LoadingState() {
  return (
    <div className="mx-auto w-full max-w-[960px]" aria-label="正在准备练习">
      <div className="h-2 animate-pulse rounded bg-foreground/10" />
      <div className="mt-8 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <div className="h-52 animate-pulse rounded-lg border border-border bg-surface" />
        <div className="h-80 animate-pulse rounded-lg border border-border bg-surface" />
      </div>
    </div>
  );
}

export function PracticeClient({
  grammarPointId,
  entryMode,
}: PracticeClientProps) {
  const clientInstanceIdRef = useRef<string | null>(null);
  const [runNumber, setRunNumber] = useState(0);
  const [sessionData, setSessionData] = useState<PracticeSessionResponse | null>(
    null
  );
  const [answer, setAnswer] = useState("");
  const [selectedOptionId, setSelectedOptionId] = useState("");
  const [attempt, setAttempt] = useState<PracticeAttemptResponse | null>(null);
  const [hints, setHints] = useState<string[]>([]);
  const [referenceAnswers, setReferenceAnswers] = useState<
    PracticeReferenceAnswer[]
  >([]);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiApiErrorMessage, setAiApiErrorMessage] = useState<string | null>(null);

  const exercise = sessionData?.exercise ?? null;
  const summary = sessionData?.summary ?? null;
  const canAdvance = Boolean(attempt?.exerciseCompleted || isRevealed);

  useEffect(() => {
    const controller = new AbortController();
    clientInstanceIdRef.current ??= globalThis.crypto.randomUUID();
    const sessionKey = `practice:${entryMode}:${grammarPointId ?? "recommended"}:${clientInstanceIdRef.current}:${runNumber}`;

    async function startSession() {
      setIsLoading(true);
      setError(null);
      setAiApiErrorMessage(null);
      try {
        const response = await fetch("/api/practice/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          signal: controller.signal,
          body: JSON.stringify({
            clientSessionKey: sessionKey,
            grammarPointId,
            entryMode,
            plannedExerciseCount: 5,
          }),
        }).then((result) => readJson<PracticeSessionResponse>(result));
        if (!controller.signal.aborted) {
          setAiApiErrorMessage(null);
          setSessionData(response);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          if (isAiQuotaExhaustedError(requestError)) {
            setAiApiErrorMessage(requestError.message);
          }
          setError(
            getErrorMessage(requestError, "练习准备失败，请稍后再试。")
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void startSession();
    return () => controller.abort();
  }, [entryMode, grammarPointId, runNumber]);

  function resetExerciseState() {
    setAnswer("");
    setSelectedOptionId("");
    setAttempt(null);
    setHints([]);
    setReferenceAnswers([]);
    setIsRevealed(false);
    setError(null);
    setAiApiErrorMessage(null);
  }

  function restartSession() {
    resetExerciseState();
    setSessionData(null);
    setIsLoading(true);
    setRunNumber((current) => current + 1);
  }

  async function submitAttempt() {
    if (
      !exercise ||
      (exercise.responseMode === "text" && !answer.trim()) ||
      (exercise.responseMode === "choice" && !selectedOptionId)
    ) {
      return;
    }

    setIsActing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/practice/exercises/${exercise.id}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            answer: exercise.responseMode === "text" ? answer : undefined,
            selectedOptionId:
              exercise.responseMode === "choice" ? selectedOptionId : undefined,
          }),
        }
      ).then((result) => readJson<PracticeAttemptResponse>(result));
      setAttempt(response);
      setReferenceAnswers(response.referenceAnswers);
      setAiApiErrorMessage(null);
    } catch (requestError) {
      if (isAiQuotaExhaustedError(requestError)) {
        setAiApiErrorMessage(requestError.message);
      }
      setError(getErrorMessage(requestError, "提交失败，请稍后再试。"));
    } finally {
      setIsActing(false);
    }
  }

  async function revealHint() {
    if (!exercise) {
      return;
    }
    setIsActing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/practice/exercises/${exercise.id}/hints`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      ).then((result) => readJson<PracticeHintResponse>(result));
      if (response.hint) {
        setHints((current) => [...current, response.hint as string]);
      }
      setSessionData((current) =>
        current?.exercise
          ? {
              ...current,
              exercise: {
                ...current.exercise,
                hintsRevealed: response.hintsRevealed,
                hasMoreHints: response.hasMoreHints,
              },
            }
          : current
      );
    } catch (requestError) {
      setError(getErrorMessage(requestError, "提示加载失败，请稍后再试。"));
    } finally {
      setIsActing(false);
    }
  }

  async function revealAnswer() {
    if (!exercise) {
      return;
    }
    setIsActing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/practice/exercises/${exercise.id}/reveal`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }
      ).then((result) => readJson<PracticeRevealResponse>(result));
      setReferenceAnswers(response.referenceAnswers);
      setIsRevealed(true);
    } catch (requestError) {
      setError(getErrorMessage(requestError, "答案加载失败，请稍后再试。"));
    } finally {
      setIsActing(false);
    }
  }

  async function nextExercise() {
    if (!sessionData) {
      return;
    }
    setIsActing(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/practice/sessions/${sessionData.session.id}/next`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: "{}",
        }
      ).then((result) => readJson<PracticeSessionResponse>(result));
      resetExerciseState();
      setAiApiErrorMessage(null);
      setSessionData(response);
    } catch (requestError) {
      if (isAiQuotaExhaustedError(requestError)) {
        setAiApiErrorMessage(requestError.message);
      }
      setError(getErrorMessage(requestError, "下一题加载失败，请稍后再试。"));
    } finally {
      setIsActing(false);
    }
  }

  if (isLoading) {
    return <LoadingState />;
  }

  if (error && !sessionData) {
    return (
      <div className="mx-auto w-full max-w-[720px] rounded-lg border border-danger/30 bg-danger-soft p-5 text-sm leading-6 text-danger">
        {error}
      </div>
    );
  }

  if (!sessionData) {
    return null;
  }

  if (summary) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <section className="rounded-lg border border-border bg-surface p-6 sm:p-8">
          <p className="text-sm font-semibold text-accent-strong">本组完成</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">
            {summary.grammarPoint.grammarPoint}
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted">
            已完成 {summary.completedExerciseCount} 道练习。结果按具体语法用法和能力维度记录，不会因多重分类重复计算。
          </p>
          <div className="mt-7 divide-y divide-border border-y border-border">
            {(summary.objectiveSummaries?.length
              ? summary.objectiveSummaries.map((objective) => ({
                  key: objective.learningObjective,
                  label: PRACTICE_OBJECTIVE_LABELS[objective.learningObjective],
                  evidenceCount: objective.evidenceCount,
                  averageScore: objective.averageScore,
                }))
              : summary.skillSummaries.map((skill) => ({
                  key: skill.skillDimension,
                  label: PRACTICE_SKILL_LABELS[skill.skillDimension],
                  evidenceCount: skill.evidenceCount,
                  averageScore: skill.averageScore,
                }))).map((item) => (
              <div
                key={item.key}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4"
              >
                <div>
                  <p className="text-sm font-semibold text-foreground/85">
                    {item.label}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {item.evidenceCount} 次有效作答
                  </p>
                </div>
                <p className="text-lg font-semibold text-foreground">
                  {Math.round(item.averageScore * 100)}%
                </p>
              </div>
            ))}
          </div>
          {summary.nextRecommendation ? (
            <div className="mt-6 border-l-2 border-accent pl-4">
              <p className="text-sm font-semibold text-foreground/85">
                下一步：{PRACTICE_OBJECTIVE_LABELS[summary.nextRecommendation.learningObjective]}
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                {summary.nextRecommendation.reasonZh}
              </p>
            </div>
          ) : null}
          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={restartSession}
              className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong"
            >
              再练一组
            </button>
            <Link
              href="/grammar"
              className="inline-flex h-11 items-center justify-center rounded-lg border border-border px-5 text-sm font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground"
            >
              返回文法
            </Link>
          </div>
        </section>
      </div>
    );
  }

  if (!exercise) {
    return <LoadingState />;
  }

  const progressPercent = Math.min(
    100,
    (sessionData.progress.current / sessionData.progress.total) * 100
  );
  const canSubmit =
    !attempt &&
    (exercise.responseMode === "text" ? Boolean(answer.trim()) : Boolean(selectedOptionId));
  const submittedAnswer = attempt
    ? exercise.responseMode === "text"
      ? answer.trim()
      : exercise.options.find((option) => option.id === selectedOptionId)?.label ?? ""
    : null;

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <AiApiErrorModal
        message={aiApiErrorMessage}
        onClose={() => setAiApiErrorMessage(null)}
      />

      <header className="mb-6">
        <div className="flex items-center justify-between gap-4 text-xs text-muted">
          <span>
            第 {sessionData.progress.current} / {sessionData.progress.total} 题
          </span>
          <span>
            {exercise.learningObjective
              ? PRACTICE_OBJECTIVE_LABELS[exercise.learningObjective]
              : PRACTICE_SKILL_LABELS[exercise.skillDimension]}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-foreground/10">
          <div
            className="h-full bg-accent transition-[width] duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="hidden rounded-lg border border-border bg-surface p-5 lg:sticky lg:top-24 lg:block">
          <div className="flex flex-wrap gap-2">
            <PracticalityBadge practicality={exercise.grammarPoint.practicality} />
            <TagBadge tag={exercise.context.sceneLabel} tone="scene" />
          </div>
          <h1 className="mt-4 break-words text-2xl font-semibold leading-tight text-foreground">
            {exercise.grammarPoint.grammarPoint}
          </h1>
          {exercise.grammarPoint.primaryCategory ? (
            <p className="mt-3 text-sm leading-6 text-muted">
              {exercise.grammarPoint.primaryCategory.nameZh}
            </p>
          ) : null}
          <dl className="mt-5 divide-y divide-border border-y border-border text-sm">
            <div className="grid grid-cols-[4.5rem_1fr] gap-2 py-3">
              <dt className="text-muted">语体</dt>
              <dd className="text-foreground/75">{exercise.context.registerLabel}</dd>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr] gap-2 py-3">
              <dt className="text-muted">形式</dt>
              <dd className="text-foreground/75">
                {exercise.responseMode === "choice" ? "选择题" : "中译日"}
              </dd>
            </div>
          </dl>
          <Link
            href={`/grammar/${exercise.grammarPoint.id}`}
            className="mt-5 inline-flex text-sm font-semibold text-accent-strong hover:text-accent"
          >
            查看语法说明
          </Link>
        </aside>

        <section
          aria-label="当前练习"
          className="rounded-lg border border-border bg-surface p-5 sm:p-7"
        >
          <div className="border-b border-border pb-5">
            <div className="mb-3 flex flex-wrap items-center gap-2 lg:hidden">
              <span className="text-sm font-semibold text-foreground">{exercise.grammarPoint.grammarPoint}</span>
              <TagBadge tag={exercise.context.sceneLabel} tone="scene" />
              <TagBadge tag={exercise.context.registerLabel} tone="register" />
            </div>
            <p className="text-xs font-semibold text-muted">
              {exercise.context.speakerRole} → {exercise.context.listenerRole}
            </p>
            {exercise.context.knownContext !== "双方已经知道当前话题" ? (
              <p className="mt-2 text-sm leading-6 text-foreground/60">
                {exercise.context.knownContext}
              </p>
            ) : null}
          </div>

          <section className="py-6" aria-labelledby="practice-task-title">
            <p className="text-xs font-semibold text-accent-strong">
              {exercise.responseMode === "choice" ? "选择题" : "中译日"}
            </p>
            <h2
              id="practice-task-title"
              className="mt-3"
            >
              <PracticeTaskPrompt prompt={exercise.prompt} />
            </h2>

            {exercise.responseMode === "choice" ? (
              <fieldset className="mt-6 grid gap-3" disabled={Boolean(attempt) || isActing}>
                <legend className="sr-only">选择答案</legend>
                {exercise.options.map((option) => {
                  const selected = selectedOptionId === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`grid min-h-12 cursor-pointer grid-cols-[20px_minmax(0,1fr)] items-center gap-3 rounded-lg border px-4 py-3 text-sm leading-6 transition ${
                        selected
                          ? "border-accent/60 bg-accent-soft text-foreground"
                          : "border-border bg-surface-soft text-foreground/75 hover:border-foreground/30"
                      }`}
                    >
                      <input
                        type="radio"
                        name="practice-option"
                        value={option.id}
                        checked={selected}
                        onChange={() => setSelectedOptionId(option.id)}
                        className="size-4 accent-[var(--accent)]"
                      />
                      <span>{option.label}</span>
                    </label>
                  );
                })}
              </fieldset>
            ) : (
              <label className="mt-6 block">
                <span className="text-sm font-semibold text-foreground/75">
                  你的回答
                </span>
                <textarea
                  value={answer}
                  onChange={(event) => setAnswer(event.target.value)}
                  disabled={Boolean(attempt) || isActing}
                  autoFocus
                  rows={5}
                  placeholder="用日语完成这次沟通"
                  className="mt-3 min-h-32 w-full resize-y rounded-lg border border-border bg-surface-strong px-4 py-3 text-base leading-7 text-foreground outline-none placeholder:text-muted/60 focus:border-foreground/45 focus:ring-2 focus:ring-foreground/10 disabled:opacity-60"
                />
              </label>
            )}

            {hints.length > 0 ? (
              <div className="mt-5 border-l-2 border-accent/50 pl-4">
                <p className="text-xs font-semibold text-muted">提示</p>
                <ol className="mt-2 space-y-2 text-sm leading-6 text-foreground/65">
                  {hints.map((hint, index) => (
                    <li key={`${index}-${hint}`}>{index + 1}. {hint}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="mt-5 rounded-lg border border-danger/30 bg-danger-soft px-4 py-3 text-sm leading-6 text-danger"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
              <button
                type="button"
                onClick={revealHint}
                disabled={isActing || !exercise.hasMoreHints || canAdvance}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-border px-4 text-sm font-semibold text-muted transition hover:border-foreground/30 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {exercise.hasMoreHints ? "给我一点提示" : "提示已用完"}
              </button>

              {!attempt ? (
                <button
                  type="button"
                  onClick={submitAttempt}
                  disabled={isActing || !canSubmit}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isActing ? "检查中" : "提交答案"}
                </button>
              ) : attempt.canRetry ? (
                <button
                  type="button"
                  onClick={() => {
                    setAttempt(null);
                    setSelectedOptionId("");
                    setError(null);
                  }}
                  disabled={isActing}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:opacity-50"
                >
                  修改后再试
                </button>
              ) : canAdvance ? (
                <button
                  type="button"
                  onClick={nextExercise}
                  disabled={isActing}
                  className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:opacity-50"
                >
                  {isActing ? "准备中" : "下一题"}
                </button>
              ) : null}
            </div>
          </section>

          <FeedbackPanel
            feedback={attempt?.feedback ?? null}
            isLoading={false}
            embedded
            learnerAnswer={submittedAnswer}
            isRecorded={Boolean(attempt)}
            rubricScores={attempt?.evidence.rubricScores}
            responseMode={exercise.responseMode}
          />

          {attempt?.canReveal && !isRevealed ? (
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={revealAnswer}
                disabled={isActing}
                className="text-sm font-semibold text-muted transition hover:text-foreground disabled:opacity-50"
              >
                放弃本题并查看参考答案
              </button>
            </div>
          ) : null}

          <div className={referenceAnswers.length > 0 ? "mt-6" : ""}>
            <ReferenceAnswers
              answers={referenceAnswers}
              responseMode={exercise.responseMode}
            />
          </div>

          {isRevealed ? (
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={nextExercise}
                disabled={isActing}
                className="inline-flex h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm font-semibold text-background transition hover:bg-accent-strong disabled:opacity-50"
              >
                {isActing ? "准备中" : "下一题"}
              </button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
