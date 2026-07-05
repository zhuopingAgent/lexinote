import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const EXPECTED_GROUP_SLUGS = [
  "expressive_functions",
  "morphology_conjugation_tense_aspect",
  "sentence_structure_components",
  "particle_system",
  "register_honorific_social",
  "discourse_connection_organization",
  "lexical_collocations_constructions",
  "confusing_grammar_contrasts",
  "error_diagnosis_correction",
];

const EXPECTED_EXPRESSIVE_CATEGORY_SLUGS = [
  "basic_sentence_patterns",
  "particles_and_relations",
  "time_and_sequence",
  "reasons_and_explanations",
  "conditions_and_hypotheses",
  "purpose_and_plans",
  "requests_permission_advice",
  "giving_receiving_benefit",
  "inference_judgment_sources",
  "comparison_degree_scope",
  "contrast_concession_comparison",
  "sentence_final_nuance",
  "collocations_and_idioms",
  "ability_potential_difficulty",
  "obligation_necessity_unnecessity",
  "change_start_continuation_end",
  "quotation_reporting_topic",
  "honorifics_and_politeness",
];

const EXPECTED_MORPHOLOGY_CATEGORY_SLUGS = [
  "verb_conjugation_basics",
  "adjective_noun_conjugation",
  "tense_and_negation",
  "progressive_state_experience_completion",
  "derived_forms_potential_passive_causative",
  "modification_connection_nominalization",
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

describe("grammar seed data", () => {
  it("defines the 9-major-group taxonomy in schema.sql", () => {
    const sql = readSchemaSql();
    const groupBlock = extractBlock(
      sql,
      "INSERT INTO grammar_category_groups",
      "INSERT INTO grammar_categories"
    );
    const slugs = Array.from(
      groupBlock.matchAll(/\('([^']+)', '[^']+', '[^']+', '[^']+',/g)
    ).map((match) => match[1]);

    expect(slugs).toEqual(EXPECTED_GROUP_SLUGS);
    expect(groupBlock).toContain("形态、活用与时间体系统");
  });

  it("keeps the 18 expressive categories and adds morphology categories", () => {
    const sql = readSchemaSql();
    const categoryBlock = extractBlock(
      sql,
      "INSERT INTO grammar_categories",
      "WITH active_grammar_seed"
    );

    for (const slug of EXPECTED_EXPRESSIVE_CATEGORY_SLUGS) {
      expect(categoryBlock).toContain(`'${slug}'`);
    }

    for (const slug of EXPECTED_MORPHOLOGY_CATEGORY_SLUGS) {
      expect(categoryBlock).toContain(`'${slug}'`);
    }

    expect(categoryBlock).toContain("group_slug");
    expect(categoryBlock).toContain("example_expressions");
  });

  it("seeds representative grammar points and two examples per point", () => {
    const sql = readSchemaSql();
    const grammarBlock = extractBlock(
      sql,
      "WITH grammar_seed",
      ")\nINSERT INTO grammar_points"
    );
    const activeCategoryBlock = extractBlock(
      sql,
      "WITH active_category_slugs",
      ")\nDELETE FROM grammar_categories"
    );
    const exampleBlock = extractBlock(
      sql,
      "WITH example_seed",
      ")\nINSERT INTO example_sentences"
    );
    const activeCategorySlugs = Array.from(
      activeCategoryBlock.matchAll(/\('([^']+)'\)/g)
    ).map((match) => match[1]);
    const pointCounts = new Map<string, number>();
    const exampleCounts = new Map<string, number>();

    for (const line of grammarBlock.split("\n")) {
      const match = line.match(/^\s*\('([^']+)', '[^']+', '[^']+', '([^']+)',/);
      if (!match) {
        continue;
      }

      const [, seedKey, categorySlug] = match;
      pointCounts.set(categorySlug, (pointCounts.get(categorySlug) ?? 0) + 1);
      expect(line).not.toContain("'[]'::jsonb");

      if (!activeCategorySlugs.includes(categorySlug)) {
        throw new Error(`Unexpected grammar category slug: ${categorySlug}`);
      }

      exampleCounts.set(seedKey, 0);
    }

    for (const line of exampleBlock.split("\n")) {
      const match = line.match(/^\s*\('([^']+)',/);
      if (!match) {
        continue;
      }

      const seedKey = match[1];
      exampleCounts.set(seedKey, (exampleCounts.get(seedKey) ?? 0) + 1);
    }

    for (const slug of EXPECTED_EXPRESSIVE_CATEGORY_SLUGS) {
      expect(pointCounts.get(slug) ?? 0).toBeGreaterThanOrEqual(5);
    }

    expect(pointCounts.get("tense_and_negation") ?? 0).toBeGreaterThanOrEqual(4);
    expect(pointCounts.get("progressive_state_experience_completion") ?? 0).toBeGreaterThanOrEqual(8);
    expect(pointCounts.get("derived_forms_potential_passive_causative") ?? 0).toBeGreaterThanOrEqual(4);
    expect(pointCounts.get("tense_errors") ?? 0).toBeGreaterThanOrEqual(1);

    for (const [seedKey, count] of exampleCounts) {
      expect(count, seedKey).toBeGreaterThanOrEqual(2);
    }
  });
});
