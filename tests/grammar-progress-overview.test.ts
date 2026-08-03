import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrammarProgressOverview } from "@/app/components/grammar/grammar-progress-overview";

describe("grammar progress overview", () => {
  it("separates incomplete work from completed grammar due for review", () => {
    const markup = renderToStaticMarkup(
      createElement(GrammarProgressOverview, {
        progress: {
          totalGrammarPoints: 340,
          startedCount: 12,
          masteredCount: 4,
          pendingCompletionCount: 2,
          dueReviewCount: 1,
          reviewCount: 3,
          favoriteCount: 2,
          groupProgress: [],
        },
        isLoading: false,
      })
    );

    expect(markup).toContain('aria-label="待完成 2"');
    expect(markup).toContain('aria-label="待复习 1"');
    expect(markup).toContain("待完成");
    expect(markup).toContain("待复习");
    expect(markup).toContain("知识维度允许交叉归类");
    expect(markup).toContain("易混对比");
  });
});
