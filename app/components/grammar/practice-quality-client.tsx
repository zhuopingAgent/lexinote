"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getErrorMessage, readJson } from "@/app/lib/api-client";
import type { PracticeGenerationMetrics } from "@/shared/types/practice";

const VALIDATION_LABELS: Record<string, string> = {
  SCHEMA_INVALID: "结构不完整",
  TARGET_SENSE_MISMATCH: "目标用法不一致",
  TARGET_FORM_MISSING: "缺少目标形式",
  CONNECTION_INVALID: "接续不正确",
  UNNATURAL_REFERENCE: "参考表达不自然",
  REGISTER_MISMATCH: "语体不匹配",
  CONTEXT_MISMATCH: "场景不一致",
  ANSWER_LEAK: "答案提前泄露",
  AMBIGUOUS_CHOICES: "选项存在多解",
  DUPLICATE_CHOICES: "选项重复",
  INCOMPLETE_CHINESE_PROMPT: "中文题意不完整",
  FAKE_CONTEXT_VARIATION: "语境变化不足",
  MULTIPLE_PRIMARY_ERRORS: "修正题含多个主要错误",
  DIFFICULTY_MISMATCH: "难度不匹配",
  INTERNAL_LABEL_EXPOSED: "内部标签暴露",
  MARKDOWN_NOT_ALLOWED: "出现格式标记",
};

function percentage(value: number) {
  return `${Math.round(value * 100)}%`;
}

function fallbackLabel(reason: string) {
  if (reason.startsWith("AI_GATEWAY_UNAVAILABLE")) return "AI 服务未配置";
  if (reason.startsWith("NETWORK_RETRY_EXHAUSTED")) return "网络重试已用尽";
  if (reason.startsWith("CONTENT_REPAIR_EXHAUSTED")) return "内容修复后仍未通过";
  return "其他可靠降级";
}

export function PracticeQualityClient() {
  const [metrics, setMetrics] = useState<PracticeGenerationMetrics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/practice/metrics", { signal: controller.signal, cache: "no-store" })
      .then((response) => readJson<PracticeGenerationMetrics>(response))
      .then(setMetrics)
      .catch((requestError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(requestError, "练习质量数据加载失败。"));
        }
      });
    return () => controller.abort();
  }, []);

  const fallbackCounts = metrics
    ? Object.entries(metrics.fallbackReasonCounts).reduce<Record<string, number>>(
        (counts, [reason, count]) => {
          const label = fallbackLabel(reason);
          counts[label] = (counts[label] ?? 0) + count;
          return counts;
        },
        {}
      )
    : {};

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <header className="flex flex-col gap-3 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-accent-strong">最近 30 天</p>
          <h1 className="mt-2 text-3xl font-semibold text-foreground">练习生成质量</h1>
          <p className="mt-2 text-sm leading-6 text-muted">只统计服务端校验结果，不包含参考答案和用户作答内容。</p>
        </div>
        <Link href="/grammar" className="text-sm font-semibold text-muted transition hover:text-foreground">返回文法</Link>
      </header>

      {error ? <p role="alert" className="mt-6 text-sm text-danger">{error}</p> : null}
      {!metrics && !error ? <div className="mt-6 h-40 animate-pulse rounded-lg bg-surface-soft" /> : null}
      {metrics ? (
        <>
          <section className="grid border-b border-border py-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["生成题数", String(metrics.generatedItemCount)],
              [
                "首次通过校验",
                metrics.aiGeneratedItemCount > 0
                  ? percentage(metrics.firstPassValidationRate)
                  : "暂无 AI 样本",
              ],
              ["修复率", percentage(metrics.repairRate)],
              ["可靠降级率", percentage(metrics.fallbackRate)],
              ["平均生成耗时", `${Math.round(metrics.generationLatency)} ms`],
              ["重复语境率", percentage(metrics.duplicateContextRate)],
              ["答案泄露", String(metrics.answerLeakCount)],
              ["多解选择题", String(metrics.ambiguousChoiceCount)],
            ].map(([label, value]) => (
              <div key={label} className="border-border px-4 py-4 first:pl-0 lg:border-r lg:last:border-r-0">
                <p className="text-xs text-muted">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </section>

          <div className="grid gap-8 py-7 md:grid-cols-2">
            <section>
              <h2 className="text-lg font-semibold text-foreground">校验拦截</h2>
              <div className="mt-3 divide-y divide-border border-y border-border">
                {Object.entries(metrics.validationErrorCounts).length ? Object.entries(metrics.validationErrorCounts).map(([code, count]) => (
                  <div key={code} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-muted">{VALIDATION_LABELS[code] ?? "其他校验问题"}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                )) : <p className="py-4 text-sm text-muted">没有被拦截的问题。</p>}
              </div>
            </section>
            <section>
              <h2 className="text-lg font-semibold text-foreground">降级原因</h2>
              <div className="mt-3 divide-y divide-border border-y border-border">
                {Object.entries(fallbackCounts).length ? Object.entries(fallbackCounts).map(([label, count]) => (
                  <div key={label} className="flex items-center justify-between gap-4 py-3 text-sm">
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                )) : <p className="py-4 text-sm text-muted">没有触发可靠降级。</p>}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
