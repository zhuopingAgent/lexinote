import { readFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { Pool } = require("pg");
const { loadEnvConfig } = require("@next/env");

function resolveTestDatabaseUrl() {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) {
    throw new Error("E2E_DATABASE_URL is required for Playwright E2E tests.");
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(connectionString);
  } catch {
    throw new Error("E2E_DATABASE_URL must be a valid PostgreSQL connection string.");
  }

  if (!["localhost", "127.0.0.1"].includes(parsedUrl.hostname)) {
    throw new Error("E2E_DATABASE_URL must point to a local PostgreSQL instance.");
  }

  const databaseName = parsedUrl.pathname.replace(/^\//, "");
  if (!/_((e2e)|(test))$/.test(databaseName)) {
    throw new Error(
      "E2E_DATABASE_URL database name must end with '_e2e' or '_test'."
    );
  }

  return connectionString;
}

export default async function globalSetup() {
  loadEnvConfig(process.cwd());

  const connectionString = resolveTestDatabaseUrl();
  const pool = new Pool({ connectionString, max: 1 });

  try {
    const schemaPath = path.join(process.cwd(), "shared/db/sql/schema.sql");
    const fixturesPath = path.join(process.cwd(), "e2e/fixtures.sql");
    const [schemaSql, fixturesSql] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(fixturesPath, "utf8"),
    ]);

    await pool.query(schemaSql);
    const firstGrammarSeedSnapshot = await pool.query(`
      SELECT jsonb_build_object(
        'dimensions', (SELECT COUNT(*) FROM taxonomy_dimensions),
        'nodes', (SELECT COUNT(*) FROM taxonomy_nodes),
        'points', (SELECT COUNT(*) FROM grammar_points),
        'pointTags', (SELECT COUNT(*) FROM grammar_point_taxonomy_tags),
        'comparisonSets', (SELECT COUNT(*) FROM comparison_sets),
        'comparisonMembers', (SELECT COUNT(*) FROM comparison_set_members),
        'errorTypes', (SELECT COUNT(*) FROM error_types)
      ) AS snapshot
    `);
    await pool.query(`
      INSERT INTO favorites (user_id, grammar_point_id)
      SELECT
        '00000000-0000-0000-0000-000000000001'::uuid,
        id
      FROM grammar_points
      WHERE seed_key = 'gp_wa_vs_ga'
      ON CONFLICT (user_id, grammar_point_id) DO NOTHING;

      INSERT INTO review_records (
        user_id,
        grammar_point_id,
        status,
        mistake_count
      )
      SELECT
        '00000000-0000-0000-0000-000000000001'::uuid,
        id,
        'learning',
        1
      FROM grammar_points
      WHERE seed_key = 'gp_wa_vs_ga'
      ON CONFLICT (user_id, grammar_point_id) DO NOTHING;

      INSERT INTO user_sentences (
        id,
        user_id,
        grammar_point_id,
        sentence,
        prompt_text
      )
      SELECT
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        id,
        '私は学生です。',
        'legacy compatibility check'
      FROM grammar_points
      WHERE seed_key = 'gp_wa_vs_ga'
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO ai_feedback (
        id,
        user_sentence_id,
        feedback_text,
        mistake_types
      )
      VALUES (
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'::uuid,
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
        'legacy compatibility check',
        '[]'::jsonb
      )
      ON CONFLICT (id) DO NOTHING;

      INSERT INTO learning_history (
        id,
        user_id,
        grammar_point_id,
        activity_type
      )
      SELECT
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee3'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        id,
        'legacy_compatibility_check'
      FROM grammar_points
      WHERE seed_key = 'gp_wa_vs_ga'
      ON CONFLICT (id) DO NOTHING;
    `);
    await pool.query(schemaSql);
    const secondGrammarSeedSnapshot = await pool.query(`
      SELECT jsonb_build_object(
        'dimensions', (SELECT COUNT(*) FROM taxonomy_dimensions),
        'nodes', (SELECT COUNT(*) FROM taxonomy_nodes),
        'points', (SELECT COUNT(*) FROM grammar_points),
        'pointTags', (SELECT COUNT(*) FROM grammar_point_taxonomy_tags),
        'comparisonSets', (SELECT COUNT(*) FROM comparison_sets),
        'comparisonMembers', (SELECT COUNT(*) FROM comparison_set_members),
        'errorTypes', (SELECT COUNT(*) FROM error_types)
      ) AS snapshot
    `);

    const firstSnapshot = firstGrammarSeedSnapshot.rows[0]?.snapshot;
    const secondSnapshot = secondGrammarSeedSnapshot.rows[0]?.snapshot;
    if (JSON.stringify(firstSnapshot) !== JSON.stringify(secondSnapshot)) {
      throw new Error("Grammar schema seed is not idempotent across consecutive runs.");
    }

    const grammarIntegrity = await pool.query(`
      SELECT
        (SELECT COUNT(*) FROM taxonomy_dimensions WHERE status = 'active') AS active_dimensions,
        (SELECT COUNT(*) FROM grammar_points WHERE status = 'active') AS active_learning_units,
        (SELECT COUNT(*) FROM grammar_points WHERE status = 'migrated') AS migrated_legacy_points,
        (SELECT COUNT(*) FROM comparison_sets WHERE status = 'active') AS active_comparison_sets,
        (SELECT COUNT(*) FROM error_types WHERE status = 'active') AS active_error_types,
        (
          SELECT COUNT(*)
          FROM grammar_points
          WHERE status = 'active' AND primary_taxonomy_node_id IS NULL
        ) AS active_without_primary,
        (
          SELECT COUNT(*)
          FROM grammar_points gp
          JOIN taxonomy_nodes tn ON tn.id = gp.primary_taxonomy_node_id
          WHERE gp.status = 'active'
            AND gp.category_id IS DISTINCT FROM tn.legacy_category_id
        ) AS primary_category_mismatch,
        (
          SELECT COUNT(*)
          FROM grammar_point_taxonomy_tags gptt
          LEFT JOIN grammar_points gp ON gp.id = gptt.grammar_point_id
          LEFT JOIN taxonomy_nodes tn ON tn.id = gptt.taxonomy_node_id
          WHERE gp.id IS NULL OR tn.id IS NULL
        ) AS dangling_taxonomy_tags,
        (
          SELECT COUNT(*)
          FROM (
            SELECT canonical_form, sense_key
            FROM grammar_points
            GROUP BY canonical_form, sense_key
            HAVING COUNT(*) > 1
          ) duplicates
        ) AS duplicate_learning_units,
        (
          SELECT
            (SELECT COUNT(*) FROM favorites f JOIN grammar_points gp ON gp.id = f.grammar_point_id WHERE gp.seed_key = 'gp_wa_vs_ga')
            + (SELECT COUNT(*) FROM review_records rr JOIN grammar_points gp ON gp.id = rr.grammar_point_id WHERE gp.seed_key = 'gp_wa_vs_ga')
            + (SELECT COUNT(*) FROM user_sentences us JOIN grammar_points gp ON gp.id = us.grammar_point_id WHERE gp.seed_key = 'gp_wa_vs_ga')
            + (SELECT COUNT(*) FROM ai_feedback WHERE id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'::uuid)
            + (SELECT COUNT(*) FROM learning_history lh JOIN grammar_points gp ON gp.id = lh.grammar_point_id WHERE gp.seed_key = 'gp_wa_vs_ga')
        ) AS preserved_legacy_references
    `);
    const integrity = grammarIntegrity.rows[0];
    if (
      Number(integrity?.active_dimensions) !== 7 ||
      Number(integrity?.active_learning_units) !== 144 ||
      Number(integrity?.migrated_legacy_points) !== 11 ||
      Number(integrity?.active_comparison_sets) !== 6 ||
      Number(integrity?.active_error_types) !== 5 ||
      Number(integrity?.active_without_primary) !== 0 ||
      Number(integrity?.primary_category_mismatch) !== 0 ||
      Number(integrity?.dangling_taxonomy_tags) !== 0 ||
      Number(integrity?.duplicate_learning_units) !== 0 ||
      Number(integrity?.preserved_legacy_references) !== 5
    ) {
      throw new Error(`Grammar domain integrity check failed: ${JSON.stringify(integrity)}`);
    }

    await pool.query(`
      TRUNCATE TABLE
        auto_filter_jobs,
        collection_words,
        collections,
        japanese_dictionary_entries,
        ai_feedback,
        user_sentences,
        favorites,
        review_records,
        learning_history
      RESTART IDENTITY CASCADE
    `);
    await pool.query(fixturesSql);
  } finally {
    await pool.end();
  }
}
