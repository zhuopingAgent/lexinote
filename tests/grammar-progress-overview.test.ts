import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrammarProgressOverview } from "@/app/components/grammar/grammar-progress-overview";

describe("grammar progress overview", () => {
  it("labels due review work as pending completion", () => {
    const markup = renderToStaticMarkup(
      createElement(GrammarProgressOverview, {
        progress: {
          totalGrammarPoints: 339,
          startedCount: 12,
          masteredCount: 4,
          reviewCount: 3,
          favoriteCount: 2,
          groupProgress: [],
        },
        isLoading: false,
      })
    );

    expect(markup).toContain('aria-label="待完成 3"');
    expect(markup).toContain("待完成");
    expect(markup).not.toContain("待复习");
  });
});
