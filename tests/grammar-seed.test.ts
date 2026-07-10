import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EXPECTED_DIMENSION_SLUGS = [
  "expression_function",
  "form_tense_aspect",
  "sentence_structure",
  "particle_system",
  "register_social",
  "discourse_organization",
  "collocation_construction",
];

const LEGACY_COMPARISON_CATEGORY_SLUGS = [
  "particle_contrasts",
  "condition_contrasts",
  "reason_purpose_contrasts",
  "inference_source_contrasts",
];

const LEGACY_ERROR_CATEGORY_SLUGS = [
  "connection_errors",
  "particle_errors",
  "tense_errors",
  "register_errors",
  "literal_translation_errors",
];

function readSchemaSql() {
  return readFileSync(path.join(process.cwd(), "shared/db/sql/schema.sql"), "utf8");
}

function extractBlock(sql: string, startMarker: string, endMarker: string) {
  const start = sql.indexOf(startMarker);
  const end = sql.indexOf(endMarker, start);

  if (start === -1 || end === -1) {
    throw new Error(`Could not find SQL block: ${startMarker}`);
  }

  return sql.slice(start, end);
}

describe("grammar domain seed", () => {
  it("defines exactly seven knowledge dimensions", () => {
    const sql = readSchemaSql();
    const block = extractBlock(
      sql,
      "WITH dimension_seed",
      "INSERT INTO taxonomy_dimensions"
    );
    const slugs = Array.from(
      block.matchAll(/^\s*\('([^']+)',/gm),
      (match) => match[1]
    );

    expect(slugs).toEqual(EXPECTED_DIMENSION_SLUGS);
    expect(block).not.toContain("confusing_grammar_contrasts");
    expect(block).not.toContain("error_diagnosis_correction");
  });

  it("adds canonical learning-unit fields and enforces one primary node for active points", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("point_type TEXT NOT NULL DEFAULT 'grammar_pattern'");
    expect(sql).toContain("canonical_form TEXT");
    expect(sql).toContain("sense_key TEXT");
    expect(sql).toContain("form_group_slug TEXT");
    expect(sql).toContain("primary_taxonomy_node_id UUID REFERENCES taxonomy_nodes(id)");
    expect(sql).toContain("status <> 'active' OR primary_taxonomy_node_id IS NOT NULL");
    expect(sql).toContain("CREATE UNIQUE INDEX IF NOT EXISTS grammar_points_sense_key_key");
    expect(sql).toContain("DROP INDEX IF EXISTS grammar_points_text_key");
    expect(sql).not.toMatch(/DELETE FROM grammar_points\s/);
  });

  it("moves six comparison cards and five error records out of knowledge taxonomy", () => {
    const sql = readSchemaSql();
    const comparisonBlock = extractBlock(
      sql,
      "WITH comparison_seed",
      "INSERT INTO comparison_sets"
    );
    const errorBlock = extractBlock(sql, "WITH error_seed", "INSERT INTO error_types");
    const comparisonSlugs = Array.from(
      comparisonBlock.matchAll(/^\s*\('([^']+)',/gm),
      (match) => match[1]
    );
    const errorCodes = Array.from(
      errorBlock.matchAll(/^\s*\('([^']+)',/gm),
      (match) => match[1]
    );

    expect(comparisonSlugs).toEqual([
      "wa_vs_ga",
      "ni_vs_de",
      "conditional_forms",
      "kara_vs_node",
      "tame_ni_vs_you_ni",
      "sou_da_vs_rashii",
    ]);
    expect(errorCodes).toEqual([
      "connection_error",
      "particle_error",
      "tense_mismatch",
      "register_mismatch",
      "literal_translation",
    ]);
    expect(sql).toContain("THEN 'migrated'");
  });

  it("uses stable keys and conflict-safe associations for repeatable migrations", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("ON CONFLICT (slug) DO UPDATE SET");
    expect(sql).toContain("ON CONFLICT (seed_key) DO UPDATE SET");
    expect(sql).toContain("ON CONFLICT (comparison_set_id, grammar_point_id) DO UPDATE SET");
    expect(sql).toContain("ON CONFLICT (code) DO UPDATE SET");
    expect(sql).toContain("PRIMARY KEY (grammar_point_id, taxonomy_node_id)");
    expect(sql).toContain("BEGIN;");
    expect(sql).toContain("COMMIT;");
  });

  it("reuses existing particles and collocations through taxonomy tags", () => {
    const sql = readSchemaSql();
    const secondaryTagBlock = extractBlock(
      sql,
      "WITH secondary_tag_seed",
      "INSERT INTO grammar_point_taxonomy_tags"
    );

    expect(secondaryTagBlock).toContain("('gp_wa', 'topic_contrast_particles')");
    expect(secondaryTagBlock).toContain("('gp_ga', 'case_particles')");
    expect(secondaryTagBlock).toContain("('gp_yo_ne', 'sentence_final_particles')");
    expect(secondaryTagBlock).toContain("('gp_fuan_wo_idaku', 'noun_verb_collocations')");
    expect(secondaryTagBlock).toContain("('gp_yoyaku_wo_toru', 'noun_verb_collocations')");
  });

  it("splits polysemous forms into stable senses with structured connections", () => {
    const sql = readSchemaSql();
    const senseBlock = extractBlock(
      sql,
      "WITH sense_seed",
      "INSERT INTO grammar_points"
    );

    expect(senseBlock).toContain("gp_sou_da_hearsay");
    expect(senseBlock).toContain("gp_rareru_honorific");
    expect(senseBlock).toContain("gp_rareru_spontaneous");
    expect(senseBlock).toContain("gp_to_quotation");
    expect(senseBlock).toContain("gp_to_case_particle");
    expect(senseBlock).toContain("gp_tte_topic");
    expect(senseBlock).toContain("gp_te_iru_result_state");
    expect(senseBlock).toContain("gp_te_iru_habitual");
    expect(senseBlock).toContain("gp_you_ni_instruction");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS grammar_point_connections");
    expect(sql).toContain("'gp_sou_da_hearsay', 'clause', 'plain_form'");
    expect(sql).toContain("'gp_sou_da', 'verb', 'masu_stem'");
  });

  it("seeds configurable learning stages and cycle-safe prerequisites", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS learning_stages");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS grammar_point_curriculum");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS grammar_point_prerequisites");
    expect(sql).toContain("grammar prerequisite cycle detected");
    expect(sql).toContain("('gp_te_iru', 'gp_te_form', 'required')");
    expect(sql).toContain("('gp_ta_bakari', 'gp_ta_form', 'required')");
    expect(sql).toContain("('gp_te_moraemasu_ka', 'gp_te_morau', 'required')");
    expect(sql.match(/\('(?:foundations|conjugation|functional_patterns|voice_aspect_benefit|natural_advanced_use)'/g)).toHaveLength(5);
  });

  it("keeps all legacy seed records and their examples for ID compatibility", () => {
    const sql = readSchemaSql();
    const grammarBlock = extractBlock(sql, "WITH grammar_seed", ")\nINSERT INTO grammar_points");
    const exampleBlock = extractBlock(sql, "WITH example_seed", ")\nINSERT INTO example_sentences");
    const points = Array.from(
      grammarBlock.matchAll(/^\s*\('([^']+)', '[^']+', '[^']+', '([^']+)',/gm),
      (match) => ({ seedKey: match[1], categorySlug: match[2] })
    );
    const exampleCounts = new Map<string, number>();

    for (const point of points) {
      exampleCounts.set(point.seedKey, 0);
    }
    for (const match of exampleBlock.matchAll(/^\s*\('([^']+)',/gm)) {
      exampleCounts.set(match[1], (exampleCounts.get(match[1]) ?? 0) + 1);
    }

    expect(points).toHaveLength(155);
    expect(
      points.filter((point) =>
        LEGACY_COMPARISON_CATEGORY_SLUGS.includes(point.categorySlug)
      )
    ).toHaveLength(6);
    expect(
      points.filter((point) => LEGACY_ERROR_CATEGORY_SLUGS.includes(point.categorySlug))
    ).toHaveLength(5);
    for (const [seedKey, count] of exampleCounts) {
      expect(count, seedKey).toBeGreaterThanOrEqual(2);
    }
  });
});
