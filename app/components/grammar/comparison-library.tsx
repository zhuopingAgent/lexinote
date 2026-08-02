"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { ComparisonSet, GrammarTaxonomyResponse } from "@/shared/types/grammar";
import { getErrorMessage, readJson } from "@/app/lib/api-client";

function memberLabel(set: ComparisonSet, position: number) {
  return set.members.find((member) => member.sortOrder === position)?.grammarPoint ?? "对应表达";
}

function displayComparisonName(name: string) {
  return name.replace(/\s+vs\s+/gi, " 与 ");
}

export function ComparisonLibrary() {
  const [items, setItems] = useState<ComparisonSet[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/grammar/taxonomy", { signal: controller.signal })
      .then((response) => readJson<GrammarTaxonomyResponse>(response))
      .then((result) => setItems(result.comparisonSets))
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setError(getErrorMessage(loadError, "易混语法加载失败，请稍后再试。"));
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoading(false);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const prefix = "#comparison-";
    if (!window.location.hash.startsWith(prefix)) return;
    const requestedSlug = decodeURIComponent(window.location.hash.slice(prefix.length));
    if (!items.some((item) => item.slug === requestedSlug)) return;
    window.requestAnimationFrame(() => {
      const target = document.getElementById(
        `comparison-${requestedSlug}`
      ) as HTMLDetailsElement | null;
      if (!target) return;
      target.open = true;
      target.scrollIntoView({ block: "start" });
    });
  }, [items]);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) =>
      [
        item.nameZh,
        displayComparisonName(item.nameZh),
        item.summary,
        item.commonMeaning,
        ...item.members.map((member) => member.grammarPoint),
      ]
        .some((value) => value.toLocaleLowerCase().includes(normalized))
    );
  }, [items, query]);

  return (
    <div className="mx-auto w-full max-w-[1000px]">
      <header className="border-b border-border pb-6">
        <Link href="/grammar" className="text-sm font-medium text-muted transition hover:text-foreground">
          返回文法
        </Link>
        <h1 className="mt-3 text-3xl font-semibold text-foreground">易混语法对比</h1>
        <p className="mt-2 max-w-[720px] text-sm leading-6 text-muted">
          先看选择条件，再对照最小例句。每组成员都链接到具体语法用法，不把同形语法混在一起。
        </p>
        <label htmlFor="comparison-search" className="sr-only">搜索易混语法</label>
        <input
          id="comparison-search"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="搜索语法或对比主题"
          className="mt-5 h-11 w-full max-w-[560px] rounded-lg border border-border bg-surface px-4 text-sm text-foreground outline-none transition placeholder:text-muted focus:border-foreground/40"
        />
      </header>

      {error ? <p role="alert" className="mt-5 text-sm text-danger">{error}</p> : null}
      {isLoading ? (
        <div className="mt-6 space-y-3">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-surface" />)}
        </div>
      ) : null}
      {!isLoading && !error && filteredItems.length === 0 ? (
        <p className="mt-8 text-sm text-muted">没有找到匹配的对比组。</p>
      ) : null}

      <div className="mt-6 space-y-3">
        {filteredItems.map((item) => (
          <details
            key={item.id}
            id={`comparison-${item.slug}`}
            className="group scroll-mt-24 rounded-lg border border-border bg-surface p-5 open:border-foreground/20"
          >
            <summary className="cursor-pointer list-none rounded-md pr-8 marker:hidden focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold text-foreground">
                    {displayComparisonName(item.nameZh)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-muted">{item.summary}</p>
                </div>
                <span className="text-xs text-muted">{item.members.length} 个用法</span>
              </div>
            </summary>

            <div className="mt-5 border-t border-border pt-5">
              <div className="flex flex-wrap gap-2">
                {item.members.map((member) => (
                  <Link key={member.grammarPointId} href={`/grammar/${member.senseKey}`} className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-foreground/78 transition hover:border-foreground/30 hover:text-foreground">
                    {member.grammarPoint}
                  </Link>
                ))}
              </div>

              {item.commonMeaning ? <p className="mt-5 text-sm leading-6 text-foreground/70">共同点：{item.commonMeaning}</p> : null}
              {item.decisionRules.length > 0 ? (
                <section className="mt-5">
                  <h3 className="text-sm font-semibold text-foreground">怎么选</h3>
                  <ul className="mt-3 space-y-3">
                    {item.decisionRules.map((rule) => (
                      <li key={`${rule.conditionZh}-${rule.preferredMemberPosition}`} className="border-l-2 border-accent pl-3 text-sm leading-6 text-foreground/70">
                        {rule.conditionZh}：优先用「{memberLabel(item, rule.preferredMemberPosition)}」。{rule.explanationZh}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {item.minimalPairExamples.length > 0 ? (
                <section className="mt-5">
                  <h3 className="text-sm font-semibold text-foreground">对比例句</h3>
                  {item.minimalPairExamples.slice(0, 2).map((pair) => (
                    <div key={pair.contextZh} className="mt-3 border-t border-border pt-3">
                      <p className="text-xs font-semibold text-muted">{pair.contextZh}</p>
                      {pair.sentences.map((sentence) => (
                        <p key={`${sentence.memberPosition}-${sentence.jp}`} className="mt-2 text-sm leading-6 text-foreground/72">
                          <strong className="font-semibold">{memberLabel(item, sentence.memberPosition)}：</strong>
                          <span lang="ja">{sentence.jp}</span>
                          <span className="ml-2 text-muted">{sentence.zh}</span>
                        </p>
                      ))}
                      <p className="mt-2 text-xs leading-5 text-muted">{pair.explanationZh}</p>
                    </div>
                  ))}
                </section>
              ) : null}

              {item.members[0] ? (
                <div className="mt-5 flex justify-end">
                  <Link href={`/practice?grammarId=${item.members[0].grammarPointId}&mode=focus&comparisonSetId=${item.id}`} className="inline-flex h-10 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-background transition hover:bg-accent-strong">
                    开始对比练习
                  </Link>
                </div>
              ) : null}
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
