import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GrammarCard } from "@/app/components/grammar/grammar-card";
import { mapSummaryRow } from "@/features/grammar-learning/infrastructure/GrammarRepositoryMapper";
import type { GrammarSummaryRow } from "@/features/grammar-learning/infrastructure/GrammarRepositoryRows";

function summaryRow(learningStatus: string | null): GrammarSummaryRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    grammar_point: "AはBです",
    point_type: "sentence_pattern",
    canonical_form: "AはBです",
    sense_key: "sentence_pattern_a_wa_b_desu",
    form_group_slug: null,
    status: "active",
    primary_category: null,
    taxonomy_tags: [],
    curriculum: null,
    migration_target: null,
    reading: "AはBです",
    category_id: null,
    category_slug: null,
    category_name_zh: null,
    category_name_en: null,
    category_group_slug: null,
    category_group_name_zh: null,
    category_group_name_en: null,
    sub_category: "判断句",
    core_meaning: "说明 A 是 B。",
    natural_translation: "A 是 B。",
    structure: "A + は + B + です",
    practicality: "S",
    spoken_or_written: "both",
    is_favorite: false,
    learning_status: learningStatus,
    scene_tags: [],
    register_tags: [],
  };
}

describe("grammar card mastery status", () => {
  it("maps and displays the mastered status beside the card metadata", () => {
    const grammarPoint = mapSummaryRow(summaryRow("mastered"));
    const markup = renderToStaticMarkup(
      createElement(GrammarCard, { grammarPoint })
    );

    expect(grammarPoint.learningStatus).toBe("mastered");
    expect(markup).toContain("已掌握");
  });

  it("does not label grammar points without a mastered record", () => {
    const grammarPoint = mapSummaryRow(summaryRow(null));
    const markup = renderToStaticMarkup(
      createElement(GrammarCard, { grammarPoint })
    );

    expect(grammarPoint.learningStatus).toBeNull();
    expect(markup).not.toContain("已掌握");
  });

  it("routes migrated comparison records to the comparison card instead of practice", () => {
    const row = summaryRow(null);
    row.status = "migrated";
    row.migration_target = {
      kind: "comparison_set",
      slug: "wa_vs_ga",
      nameZh: "は与が",
    };
    const grammarPoint = mapSummaryRow(row);
    const markup = renderToStaticMarkup(
      createElement(GrammarCard, { grammarPoint })
    );

    expect(markup).toContain("查看对比");
    expect(markup).toContain("/grammar/comparisons#comparison-wa_vs_ga");
    expect(markup).not.toContain(`/practice?grammarId=${grammarPoint.id}`);
  });
});
