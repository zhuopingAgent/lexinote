import { describe, expect, it } from "vitest";
import {
  SELECT_GRAMMAR_PROGRESS_SQL,
  SELECT_GRAMMAR_PROGRESS_TOTALS_SQL,
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
});
