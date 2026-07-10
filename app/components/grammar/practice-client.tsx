"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AiApiErrorModal } from "@/app/components/ai-api-error-modal";
import type {
  GrammarDetailResponse,
  GrammarPointDetail,
  GrammarTag,
  GrammarTaxonomyResponse,
  PracticeGenerateResponse,
  PracticeLevel,
  PracticeSubmitResponse,
} from "@/shared/types/grammar";
import { FeedbackPanel } from "@/app/components/grammar/feedback-panel";
import { PracticalityBadge } from "@/app/components/grammar/practicality-badge";
import { PracticePrompt } from "@/app/components/grammar/practice-prompt";
import { SentenceInput } from "@/app/components/grammar/sentence-input";
import { TagBadge } from "@/app/components/grammar/tag-badge";
import {
  getErrorMessage,
  isAiQuotaExhaustedError,
  readJson,
} from "@/app/lib/api-client";

const PRACTICE_REGISTER_OPTIONS = [
  { value: "casual", label: "随便" },
  { value: "polite", label: "一般礼貌" },
  { value: "business", label: "正式 / 商务" },
] as const;

const PRACTICE_LEVEL_OPTIONS = [
  { value: 3, label: "中译日" },
  { value: 4, label: "语体转换" },
  { value: 5, label: "易混对比" },
] as const;

function findInitialTag(tags: GrammarTag[], preferred: string, fallback?: string) {
  return (
    tags.find((tag) => tag.nameEn === preferred)?.nameEn ??
    (fallback ? tags.find((tag) => tag.nameEn === fallback)?.nameEn : undefined) ??
    tags[0]?.nameEn ??
    ""
  );
}

function normalizePracticeRegisterTag(registerTag?: string | null) {
  if (registerTag === "casual" || registerTag === "rough") {
    return "casual";
  }

  if (
    registerTag === "business" ||
    registerTag === "formal" ||
    registerTag === "written" ||
    registerTag === "customer" ||
    registerTag === "academic" ||
    registerTag === "news"
  ) {
    return "business";
  }

  return "polite";
}

export function PracticeClient({ grammarPointId }: { grammarPointId?: string }) {
  const [grammarPoint, setGrammarPoint] = useState<GrammarPointDetail | null>(null);
  const [sceneTags, setSceneTags] = useState<GrammarTag[]>([]);
  const [sceneTag, setSceneTag] = useState("");
  const [registerTag, setRegisterTag] = useState("");
  const [level, setLevel] = useState<PracticeLevel>(3);
  const [practice, setPractice] = useState<PracticeGenerateResponse | null>(null);
  const [sentence, setSentence] = useState("");
  const [feedback, setFeedback] = useState<PracticeSubmitResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [aiApiErrorMessage, setAiApiErrorMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const generationRef = useRef(0);

  const hasGrammarPointId = Boolean(grammarPointId?.trim());
  const selectedScene = useMemo(
    () => sceneTags.find((tag) => tag.nameEn === sceneTag),
    [sceneTags, sceneTag]
  );
  const selectedRegister = useMemo(
    () =>
      PRACTICE_REGISTER_OPTIONS.find((option) => option.value === registerTag) ??
      PRACTICE_REGISTER_OPTIONS[1],
    [registerTag]
  );

  useEffect(() => {
    if (!grammarPointId) {
      setIsLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadPracticeData() {
      setIsLoading(true);
      setLoadError(null);

      try {
        const [detail, taxonomy] = await Promise.all([
          fetch(`/api/grammar/${grammarPointId}`, {
            signal: controller.signal,
          }).then((response) => readJson<GrammarDetailResponse>(response)),
          fetch("/api/grammar/taxonomy", {
            signal: controller.signal,
          }).then((response) => readJson<GrammarTaxonomyResponse>(response)),
        ]);

        if (controller.signal.aborted) {
          return;
        }

        setGrammarPoint(detail.grammarPoint);
        setSceneTags(taxonomy.sceneTags);
        setSceneTag(
          detail.grammarPoint.grammarPoint === "〜てもらえますか"
            ? findInitialTag(taxonomy.sceneTags, "hospital", "daily_life")
            : findInitialTag(
                taxonomy.sceneTags,
                detail.grammarPoint.sceneTags[0]?.nameEn ?? "daily_life"
              )
        );
        setRegisterTag(
          normalizePracticeRegisterTag(detail.grammarPoint.registerTags[0]?.nameEn)
        );
      } catch (error) {
        if (!controller.signal.aborted) {
          setLoadError(getErrorMessage(error, "练习数据加载失败，请稍后再试。"));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadPracticeData();

    return () => {
      controller.abort();
    };
  }, [grammarPointId]);

  function resetGeneratedPractice() {
    generationRef.current += 1;
    setPractice(null);
    setSentence("");
    setFeedback(null);
    setActionError(null);
    setAiApiErrorMessage(null);
    setIsGenerating(false);
  }

  async function generatePractice() {
    if (!grammarPoint) {
      return;
    }

    const generation = generationRef.current + 1;
    generationRef.current = generation;
    const nextSceneTag = sceneTag;
    const nextRegisterTag = registerTag;
    const nextLevel = level;

    setIsGenerating(true);
    setActionError(null);
    setFeedback(null);
    setPractice(null);
    setSentence("");

    try {
      const nextPractice = await fetch("/api/practice/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        cache: "no-store",
        body: JSON.stringify({
          grammarPointId: grammarPoint.id,
          sceneTag: nextSceneTag,
          registerTag: nextRegisterTag,
          level: nextLevel,
        }),
      }).then((response) => readJson<PracticeGenerateResponse>(response));

      if (generationRef.current === generation) {
        setPractice(nextPractice);
        setAiApiErrorMessage(null);
      }
    } catch (error) {
      if (generationRef.current === generation) {
        if (isAiQuotaExhaustedError(error)) {
          setAiApiErrorMessage(error.message);
        }
        setActionError(getErrorMessage(error, "练习生成失败，请稍后再试。"));
      }
    } finally {
      if (generationRef.current === generation) {
        setIsGenerating(false);
      }
    }
  }

  async function submitSentence() {
    if (!grammarPoint || !sentence.trim()) {
      return;
    }

    setIsSubmitting(true);
    setActionError(null);

    try {
      const nextFeedback = await fetch("/api/practice/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          grammarPointId: grammarPoint.id,
          sentence,
          sceneTag,
          registerTag,
          promptText: practice?.prompt,
        }),
      }).then((response) => readJson<PracticeSubmitResponse>(response));
      setFeedback(nextFeedback);
      setAiApiErrorMessage(null);
    } catch (error) {
      if (isAiQuotaExhaustedError(error)) {
        setAiApiErrorMessage(error.message);
      }
      setActionError(getErrorMessage(error, "句子反馈失败，请稍后再试。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!hasGrammarPointId) {
    return (
      <div className="mx-auto w-full max-w-[760px] rounded-[20px] border border-dashed border-white/12 bg-[#17171799] px-6 py-12 text-center">
        <p className="text-base font-medium text-white/62">还没有选择语法点</p>
        <Link
          href="/grammar"
          className="mt-5 inline-flex h-11 items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong"
        >
          去选择
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto grid w-full max-w-[1100px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <div className="h-72 animate-pulse rounded-[18px] border border-white/10 bg-[#1e1e1eb3]" />
        <div className="h-72 animate-pulse rounded-[18px] border border-white/10 bg-[#1e1e1eb3]" />
      </div>
    );
  }

  if (loadError || !grammarPoint) {
    return (
      <div
        role="alert"
        className="mx-auto w-full max-w-[760px] rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
      >
        {loadError ?? "未找到这个语法点。"}
      </div>
    );
  }

  return (
    <div className="mx-auto grid w-full max-w-[1120px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
      <AiApiErrorModal
        message={aiApiErrorMessage}
        onClose={() => setAiApiErrorMessage(null)}
      />
      <aside className="space-y-5">
        <section className="rounded-[18px] border border-white/10 bg-[#1e1e1eb3] p-5">
          <div className="flex flex-wrap items-center gap-2">
            <PracticalityBadge practicality={grammarPoint.practicality} />
            {grammarPoint.primaryCategory ? (
              <>
                <TagBadge tag={grammarPoint.primaryCategory.dimensionNameZh} />
                <TagBadge tag={grammarPoint.primaryCategory.nameZh} />
              </>
            ) : grammarPoint.migrationTarget ? (
              <TagBadge tag={grammarPoint.migrationTarget.nameZh} />
            ) : null}
          </div>
          <h1 className="mt-4 break-words text-3xl leading-tight font-semibold text-white/82">
            {grammarPoint.grammarPoint}
          </h1>
          <p className="mt-3 text-sm leading-6 text-white/54">
            {grammarPoint.coreMeaning}
          </p>
          {grammarPoint.structure ? (
            <p className="mt-4 rounded-[12px] border border-white/8 bg-[#15151599] px-3 py-2 font-mono text-xs leading-5 text-white/54">
              {grammarPoint.structure}
            </p>
          ) : null}
          <Link
            href={`/grammar/${grammarPoint.id}`}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-full border border-white/12 px-4 text-sm text-white/58 transition hover:border-white/22 hover:text-white/74"
          >
            查看详情
          </Link>
        </section>

        <section className="rounded-[18px] border border-white/10 bg-[#1e1e1eb3] p-5">
          <h2 className="text-lg font-semibold text-white/74">练习设置</h2>
          <div className="mt-4 space-y-4">
            <label className="block">
              <span className="text-sm text-white/42">场景</span>
              <select
                value={sceneTag}
                onChange={(event) => {
                  setSceneTag(event.target.value);
                  resetGeneratedPractice();
                }}
                className="mt-2 h-11 w-full rounded-[12px] border border-white/12 bg-[#151515cc] px-3 text-sm text-white/70 outline-none focus:border-white/26 focus:ring-2 focus:ring-white/10"
              >
                {sceneTags.map((tag) => (
                  <option key={tag.nameEn} value={tag.nameEn}>
                    {tag.nameZh}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/42">语体</span>
              <select
                value={registerTag}
                onChange={(event) => {
                  setRegisterTag(event.target.value);
                  resetGeneratedPractice();
                }}
                className="mt-2 h-11 w-full rounded-[12px] border border-white/12 bg-[#151515cc] px-3 text-sm text-white/70 outline-none focus:border-white/26 focus:ring-2 focus:ring-white/10"
              >
                {PRACTICE_REGISTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-sm text-white/42">等级</span>
              <select
                value={level}
                onChange={(event) => {
                  setLevel(Number(event.target.value) as PracticeLevel);
                  resetGeneratedPractice();
                }}
                className="mt-2 h-11 w-full rounded-[12px] border border-white/12 bg-[#151515cc] px-3 text-sm text-white/70 outline-none focus:border-white/26 focus:ring-2 focus:ring-white/10"
              >
                {PRACTICE_LEVEL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={generatePractice}
              disabled={isGenerating}
              className="inline-flex h-11 w-full items-center justify-center rounded-full bg-accent px-5 text-sm font-semibold text-black transition hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isGenerating ? "生成中" : practice ? "重新生成练习" : "生成练习"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {selectedScene ? <TagBadge tag={selectedScene} tone="scene" /> : null}
            <TagBadge tag={selectedRegister.label} tone="register" />
          </div>
        </section>
      </aside>

      <div className="space-y-5">
        {actionError ? (
          <div
            role="alert"
            className="rounded-[18px] border border-danger/30 bg-danger-soft/80 px-5 py-4 text-sm leading-6 text-danger"
          >
            {actionError}
          </div>
        ) : null}

        <PracticePrompt practice={practice} isLoading={isGenerating} />

        {practice ? (
          <SentenceInput
            value={sentence}
            isSubmitting={isSubmitting}
            autoFocus
            onChange={setSentence}
            onSubmit={submitSentence}
          />
        ) : null}

        <FeedbackPanel feedback={feedback} isLoading={isSubmitting} />
      </div>
    </div>
  );
}
