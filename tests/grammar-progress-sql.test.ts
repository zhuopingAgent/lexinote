import { describe, expect, it } from "vitest";
import {
  SELECT_GRAMMAR_PROGRESS_SQL,
  SELECT_GRAMMAR_PROGRESS_TOTALS_SQL,
  SELECT_OBJECTIVE_RECOMMENDATIONS_SQL,
  SELECT_REVIEW_ITEMS_SQL,
} from "@/shared/db/sql/grammar.sql";

describe("grammar progress SQL", () => {
  it("counts knowledge dimension progress through taxonomy tags", () => {
    expect(SELECT_GRAMMAR_PROGRESS_SQL).toContain(
      "LEFT JOIN grammar_point_taxonomy_tags progress_tags"
    );
    expect(SELECT_GRAMMAR_PROGRESS_SQL).toContain(
      "ON progress_tags.taxonomy_node_id = tn.id"
    );
    expect(SELECT_GRAMMAR_PROGRESS_SQL).toContain(
      "ON gp.id = progress_tags.grammar_point_id"
    );
    expect(SELECT_GRAMMAR_PROGRESS_SQL).not.toContain(
      "ON gp.primary_taxonomy_node_id = tn.id"
    );
  });

  it("keeps global progress totals independent from taxonomy tag overlap", () => {
    expect(SELECT_GRAMMAR_PROGRESS_TOTALS_SQL).toContain(
      "FROM grammar_points gp"
    );
    expect(SELECT_GRAMMAR_PROGRESS_TOTALS_SQL).not.toContain(
      "grammar_point_taxonomy_tags"
    );
  });

  it("classifies completion by status and due review by schedule", () => {
    for (const sql of [
      SELECT_GRAMMAR_PROGRESS_TOTALS_SQL,
      SELECT_GRAMMAR_PROGRESS_SQL,
    ]) {
      expect(sql).toContain("COALESCE(rr.status, 'new') <> 'mastered'");
      expect(sql).toContain("rr.status = 'mastered'");
      expect(sql).not.toContain("estimate < 0.72");
      expect(sql).not.toContain("exposure_count > 0");
      expect(sql).not.toContain("rr.mistake_count > 0");
      expect(sql).toContain("rr.next_review_at <= NOW()");
    }

    const reviewFilter = SELECT_REVIEW_ITEMS_SQL
      .split("WHERE rr.user_id = $1::uuid")[1]
      ?.split("ORDER BY")[0];
    expect(reviewFilter?.trim()).toBe("");

    const recommendationFilter = SELECT_OBJECTIVE_RECOMMENDATIONS_SQL
      .split("recommendation_scope AS (")[1]
      ?.split("ranked_objectives AS (")[0];
    expect(recommendationFilter).not.toContain("estimate < 0.72");
    expect(recommendationFilter).not.toContain("exposure_count > 0");
    expect(recommendationFilter).not.toContain("next_review_at <= NOW()");
  });
});
