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

function readGrammarContentSql() {
  return readFileSync(
    path.join(process.cwd(), "shared/db/sql/grammar-content.sql"),
    "utf8"
  );
}

function readGrammarContentRecords() {
  const sql = readGrammarContentSql();
  const records: Array<Record<string, unknown>> = [];

  for (const match of sql.matchAll(
    /\$grammar_[a-z_]+\$\s*(\[[\s\S]*?\])\s*\$grammar_[a-z_]+\$::jsonb/g
  )) {
    const block = JSON.parse(match[1]) as Array<Record<string, unknown>>;
    if (block[0] && typeof block[0].seed_key === "string") {
      records.push(...block);
    }
  }

  return records;
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

  it("seeds nine comparison cards and ten stable error types outside knowledge taxonomy", () => {
    const sql = readSchemaSql();
    const comparisonBlock = extractBlock(
      sql,
      "WITH comparison_seed",
      "INSERT INTO comparison_sets"
    );
    const errorBlock = extractBlock(sql, "WITH error_seed", "INSERT INTO error_types");
    const errorCodes = Array.from(
      errorBlock.matchAll(/^\s*\('([^']+)',/gm),
      (match) => match[1]
    );

    const comparisonSlugs = [
      "wa_vs_ga",
      "ni_vs_de",
      "conditional_forms",
      "kara_vs_node",
      "tame_ni_vs_you_ni",
      "sou_da_vs_rashii",
      "te_moraemasu_vs_te_itadakemasu",
      "te_kureru_vs_te_morau",
      "sasete_morau_vs_sasete_itadaku",
    ];
    for (const slug of comparisonSlugs) {
      expect(comparisonBlock).toContain(`'${slug}'`);
    }
    expect(errorCodes).toEqual([
      "conjugation_error",
      "connection_error",
      "particle_error",
      "tense_aspect_error",
      "giving_receiving_direction_error",
      "semantic_error",
      "register_mismatch",
      "collocation_error",
      "literal_translation",
      "unnatural_expression",
    ]);
    expect(sql).toContain("THEN 'migrated'");
  });

  it("stores structured comparison content while keeping members relational", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("common_meaning TEXT NOT NULL DEFAULT ''");
    expect(sql).toContain("decision_rules JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain("minimal_pair_examples JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain("PRIMARY KEY (comparison_set_id, grammar_point_id)");
    expect(sql).toContain(
      "('te_moraemasu_vs_te_itadakemasu', 'gp_te_moraemasu_ka', 1)"
    );
    expect(sql).toContain(
      "('te_moraemasu_vs_te_itadakemasu', 'gp_te_itadakemasu_ka', 2)"
    );
  });

  it("normalizes structured feedback issues without removing legacy fields", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS ai_feedback_issues");
    expect(sql).toContain("error_type_id UUID NOT NULL REFERENCES error_types(id)");
    expect(sql).toContain("mistake_types JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain("issues JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain("role TEXT NOT NULL DEFAULT 'secondary'");
    expect(sql).toContain("confidence NUMERIC(4,3)");
    expect(sql).toContain("evidence_span TEXT");
    expect(sql).toContain("affected_dimensions JSONB NOT NULL DEFAULT '[]'::jsonb");
    expect(sql).toContain("('wrong_register', 'register_mismatch')");
    expect(sql).toContain("('tense_mismatch', 'tense_aspect_error')");
  });

  it("seeds the redesigned practice domain with stable blueprints and scenarios", () => {
    const sql = readSchemaSql();
    const blueprintBlock = extractBlock(
      sql,
      "WITH blueprint_seed",
      "INSERT INTO exercise_blueprints"
    );
    const scenarioBlock = extractBlock(
      sql,
      "WITH scenario_seed",
      "INSERT INTO scenario_templates"
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS practice_sessions");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS exercise_instances");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS practice_attempts");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS mastery_evidence");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS learner_skill_states");
    expect(blueprintBlock.match(/^\s+\($/gm)).toHaveLength(6);
    expect(blueprintBlock).toContain("'meaning_choice'");
    expect(blueprintBlock).toContain("'contextual_response'");
    expect(scenarioBlock.match(/^\s*\('[a-z_]+',/gm)).toHaveLength(10);
    expect(scenarioBlock).toContain("'hospital', '医院'");
    expect(scenarioBlock).toContain("'workplace', '公司'");
    expect(sql).toContain("UNIQUE (user_id, client_session_key)");
    expect(sql).toContain("UNIQUE (practice_session_id, sequence_number)");
    expect(sql).toContain(
      "WHEN exercise_type IN ('meaning_choice', 'contrast_choice', 'guided_translation')"
    );
    expect(sql).toContain("ELSE 'hidden'");
  });

  it("adds versioned V2 practice contracts without replacing legacy practice data", () => {
    const sql = readSchemaSql();

    expect(sql).toContain("ADD COLUMN IF NOT EXISTS plan_snapshot JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS practice_intent_snapshot JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS answer_contract JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS validation_results JSONB");
    expect(sql).toContain("ADD COLUMN IF NOT EXISTS generation_retry_count INTEGER");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS learner_objective_states");
    expect(sql).toContain("PRIMARY KEY (user_id, grammar_point_id, sense_key, learning_objective)");
    expect(sql).toContain("blueprint_version = 2");
    expect(sql).not.toContain("DROP TABLE practice_sessions");
    expect(sql).not.toContain("DELETE FROM practice_attempts");
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
    const stageBlock = extractBlock(
      sql,
      "INSERT INTO learning_stages",
      "ON CONFLICT (slug) DO UPDATE SET"
    );

    expect(sql).toContain("CREATE TABLE IF NOT EXISTS learning_stages");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS learning_modules");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS grammar_point_curriculum");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS grammar_point_prerequisites");
    expect(sql).toContain("grammar prerequisite cycle detected");
    expect(sql).toContain("('gp_te_iru', 'gp_te_form', 'required')");
    expect(sql).toContain("('gp_ta_bakari', 'gp_ta_form', 'required')");
    expect(sql).toContain("('gp_te_moraemasu_ka', 'gp_te_morau', 'required')");
    expect(
      stageBlock.match(
        /\('(?:foundations|conjugation|functional_patterns|voice_aspect_benefit|natural_advanced_use)'/g
      )
    ).toHaveLength(5);
    expect(sql).toContain("('natural_advanced_use', 'media_formal'");
    expect(sql).toContain("('natural_advanced_use', 'advanced_natural'");
  });

  it("seeds complete practical-Japanese expansion content", () => {
    const records = readGrammarContentRecords();
    const seedKeys = records.map((record) => record.seed_key);

    expect(records).toHaveLength(186);
    expect(new Set(seedKeys)).toHaveLength(186);
    expect(seedKeys).toEqual(
      expect.arrayContaining([
        "gp_ext_e_particle",
        "gp_ext_volitional_form",
        "gp_ext_o_go_ninaru",
        "gp_ext_teru_contraction",
        "gp_ext_de_yoroshii_deshouka",
        "gp_ext_to_sareru",
        "gp_ext_hazu_da",
        "gp_ext_ni_tsurete",
        "gp_ext_dokoroka",
      ])
    );

    for (const record of records) {
      expect(String(record.core_meaning ?? ""), String(record.seed_key)).not.toBe("");
      expect(String(record.structure ?? ""), String(record.seed_key)).not.toBe("");
      expect(String(record.usage_notes ?? ""), String(record.seed_key)).not.toBe("");
      expect(record.common_mistakes, String(record.seed_key)).toEqual(
        expect.arrayContaining([expect.any(String)])
      );
      expect(record.examples, String(record.seed_key)).toEqual([
        expect.objectContaining({ jp: expect.any(String), zh: expect.any(String) }),
        expect.objectContaining({ jp: expect.any(String), zh: expect.any(String) }),
        expect.objectContaining({ jp: expect.any(String), zh: expect.any(String) }),
      ]);
    }
  });

  it("adds normalized comparison cards for the expanded content", () => {
    const sql = readGrammarContentSql();

    expect(sql).toContain('"slug":"ni_vs_e_direction"');
    expect(sql).toContain('"slug":"aida_vs_aida_ni"');
    expect(sql).toContain('"slug":"hazu_vs_wake"');
    expect(sql).toContain('"slug":"dake_bakari_dokoroka"');
    expect(sql).toContain('"slug":"kanemasu_vs_koto_ga_dekimasen"');
    expect(sql).toContain("INSERT INTO comparison_set_members");
    expect(sql).toContain("WITH ORDINALITY AS member(seed_key, ordinality)");
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
