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
    const grammarContentPath = path.join(
      process.cwd(),
      "shared/db/sql/grammar-content.sql"
    );
    const fixturesPath = path.join(process.cwd(), "e2e/fixtures.sql");
    const [schemaSql, grammarContentSql, fixturesSql] = await Promise.all([
      readFile(schemaPath, "utf8"),
      readFile(grammarContentPath, "utf8"),
      readFile(fixturesPath, "utf8"),
    ]);

    await pool.query(schemaSql);
    await pool.query(grammarContentSql);
    const firstGrammarSeedSnapshot = await pool.query(`
      SELECT jsonb_build_object(
        'dimensions', (SELECT COUNT(*) FROM taxonomy_dimensions),
        'nodes', (SELECT COUNT(*) FROM taxonomy_nodes),
        'points', (SELECT COUNT(*) FROM grammar_points),
        'pointTags', (SELECT COUNT(*) FROM grammar_point_taxonomy_tags),
        'connections', (SELECT COUNT(*) FROM grammar_point_connections),
        'prerequisites', (SELECT COUNT(*) FROM grammar_point_prerequisites),
        'examples', (SELECT COUNT(*) FROM example_sentences),
        'learningStages', (SELECT COUNT(*) FROM learning_stages),
        'learningModules', (SELECT COUNT(*) FROM learning_modules),
        'curriculumPlacements', (SELECT COUNT(*) FROM grammar_point_curriculum),
        'comparisonSets', (SELECT COUNT(*) FROM comparison_sets),
        'comparisonMembers', (SELECT COUNT(*) FROM comparison_set_members),
        'errorTypes', (SELECT COUNT(*) FROM error_types),
        'errorAliases', (SELECT COUNT(*) FROM error_type_aliases),
        'exerciseBlueprints', (SELECT COUNT(*) FROM exercise_blueprints),
        'scenarioTemplates', (SELECT COUNT(*) FROM scenario_templates)
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
        scene_tag_id,
        register_tag_id,
        prompt_text
      )
      SELECT
        'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee1'::uuid,
        '00000000-0000-0000-0000-000000000001'::uuid,
        id,
        '私は学生です。',
        (SELECT id FROM scene_tags WHERE name_en = 'hospital'),
        (SELECT id FROM register_tags WHERE name_en = 'polite'),
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
        '["wrong_register"]'::jsonb
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
    await pool.query(grammarContentSql);
    const secondGrammarSeedSnapshot = await pool.query(`
      SELECT jsonb_build_object(
        'dimensions', (SELECT COUNT(*) FROM taxonomy_dimensions),
        'nodes', (SELECT COUNT(*) FROM taxonomy_nodes),
        'points', (SELECT COUNT(*) FROM grammar_points),
        'pointTags', (SELECT COUNT(*) FROM grammar_point_taxonomy_tags),
        'connections', (SELECT COUNT(*) FROM grammar_point_connections),
        'prerequisites', (SELECT COUNT(*) FROM grammar_point_prerequisites),
        'examples', (SELECT COUNT(*) FROM example_sentences),
        'learningStages', (SELECT COUNT(*) FROM learning_stages),
        'learningModules', (SELECT COUNT(*) FROM learning_modules),
        'curriculumPlacements', (SELECT COUNT(*) FROM grammar_point_curriculum),
        'comparisonSets', (SELECT COUNT(*) FROM comparison_sets),
        'comparisonMembers', (SELECT COUNT(*) FROM comparison_set_members),
        'errorTypes', (SELECT COUNT(*) FROM error_types),
        'errorAliases', (SELECT COUNT(*) FROM error_type_aliases),
        'exerciseBlueprints', (SELECT COUNT(*) FROM exercise_blueprints),
        'scenarioTemplates', (SELECT COUNT(*) FROM scenario_templates)
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
        (SELECT COUNT(*) FROM exercise_blueprints WHERE status = 'active') AS active_exercise_blueprints,
        (SELECT COUNT(*) FROM exercise_blueprints WHERE status = 'hidden') AS hidden_exercise_blueprints,
        (SELECT COUNT(*) FROM scenario_templates WHERE status = 'active') AS active_scenario_templates,
        (SELECT COUNT(*) FROM learning_stages WHERE status = 'active') AS active_learning_stages,
        (SELECT COUNT(*) FROM learning_modules WHERE status = 'active') AS active_learning_modules,
        (
          SELECT COUNT(*)
          FROM learning_modules module
          WHERE module.status = 'active'
            AND NOT EXISTS (
              SELECT 1
              FROM grammar_point_curriculum curriculum
              JOIN grammar_points point ON point.id = curriculum.grammar_point_id
              WHERE curriculum.learning_module_id = module.id
                AND point.status = 'active'
            )
        ) AS empty_active_learning_modules,
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
          SELECT COUNT(*)
          FROM (
            SELECT example.jp
            FROM example_sentences example
            JOIN grammar_points point ON point.id = example.grammar_point_id
            WHERE point.status = 'active'
            GROUP BY example.jp
            HAVING COUNT(DISTINCT example.grammar_point_id) > 1
          ) duplicates
        ) AS duplicate_active_examples,
        (
          SELECT COUNT(*)
          FROM grammar_points gp
          WHERE gp.status = 'active'
            AND (
              NULLIF(BTRIM(gp.core_meaning), '') IS NULL
              OR NULLIF(BTRIM(gp.usage_notes), '') IS NULL
              OR gp.primary_taxonomy_node_id IS NULL
              OR NOT EXISTS (
                SELECT 1
                FROM grammar_point_connections connection
                WHERE connection.grammar_point_id = gp.id
              )
              OR NOT EXISTS (
                SELECT 1
                FROM example_sentences example
                WHERE example.grammar_point_id = gp.id
              )
            )
        ) AS incomplete_active_learning_units,
        (
          SELECT COUNT(*)
          FROM grammar_points gp
          WHERE gp.status = 'active'
            AND gp.seed_key LIKE 'gp_ext_%'
            AND (
              SELECT COUNT(*)
              FROM example_sentences example
              WHERE example.grammar_point_id = gp.id
            ) <> 3
        ) AS expanded_units_without_three_examples,
        (
          SELECT COUNT(*)
          FROM grammar_points gp
          LEFT JOIN grammar_point_curriculum curriculum
            ON curriculum.grammar_point_id = gp.id
          WHERE gp.status = 'active'
            AND curriculum.grammar_point_id IS NULL
        ) AS active_without_curriculum,
        (
          SELECT COUNT(*)
          FROM grammar_points gp
          JOIN grammar_point_curriculum curriculum
            ON curriculum.grammar_point_id = gp.id
          WHERE gp.status = 'active'
            AND (curriculum.learning_module_id IS NULL OR curriculum.module_order IS NULL)
        ) AS active_without_module,
        (
          SELECT COUNT(*)
          FROM grammar_point_curriculum curriculum
          JOIN learning_modules module ON module.id = curriculum.learning_module_id
          WHERE curriculum.learning_stage_id <> module.learning_stage_id
        ) AS curriculum_module_stage_mismatches,
        (
          SELECT COUNT(*)
          FROM (
            WITH RECURSIVE prerequisite_paths(origin_id, current_id, path, has_cycle) AS (
              SELECT
                relation.grammar_point_id,
                relation.prerequisite_grammar_point_id,
                ARRAY[relation.grammar_point_id, relation.prerequisite_grammar_point_id],
                relation.grammar_point_id = relation.prerequisite_grammar_point_id
              FROM grammar_point_prerequisites relation
              UNION ALL
              SELECT
                prerequisite_paths.origin_id,
                relation.prerequisite_grammar_point_id,
                prerequisite_paths.path || relation.prerequisite_grammar_point_id,
                relation.prerequisite_grammar_point_id = ANY(prerequisite_paths.path)
              FROM prerequisite_paths
              JOIN grammar_point_prerequisites relation
                ON relation.grammar_point_id = prerequisite_paths.current_id
              WHERE NOT prerequisite_paths.has_cycle
            )
            SELECT 1
            FROM prerequisite_paths
            WHERE has_cycle
          ) cycles
        ) AS prerequisite_cycles,
        (
          SELECT COUNT(*)
          FROM grammar_point_prerequisites relation
          JOIN grammar_point_curriculum dependent_curriculum
            ON dependent_curriculum.grammar_point_id = relation.grammar_point_id
          JOIN learning_stages dependent_stage
            ON dependent_stage.id = dependent_curriculum.learning_stage_id
          JOIN grammar_point_curriculum prerequisite_curriculum
            ON prerequisite_curriculum.grammar_point_id = relation.prerequisite_grammar_point_id
          JOIN learning_stages prerequisite_stage
            ON prerequisite_stage.id = prerequisite_curriculum.learning_stage_id
          WHERE (
            prerequisite_stage.display_order,
            prerequisite_curriculum.recommended_order
          ) >= (
            dependent_stage.display_order,
            dependent_curriculum.recommended_order
          )
        ) AS prerequisite_order_violations,
        (
          SELECT COUNT(*)
          FROM grammar_points
          WHERE status = 'active'
            AND form_group_slug IN (
              'sou_da', 'rareru', 'to', 'ga', 'tte', 'te_iru', 'you_ni', 'bakari', 'tame'
            )
        ) AS normalized_polysemy_units,
        (
          SELECT COUNT(*)
          FROM (
            VALUES
              ('〜そうだ', 2),
              ('〜られる', 4),
              ('〜と', 3),
              ('が', 2),
              ('〜って', 2),
              ('〜ている', 3),
              ('〜ように', 2)
          ) expected(canonical_form, sense_count)
          WHERE (
            SELECT COUNT(*)
            FROM grammar_points gp
            WHERE gp.status = 'active'
              AND gp.canonical_form = expected.canonical_form
          ) <> expected.sense_count
        ) AS polysemy_group_mismatches,
        (
          SELECT COUNT(*)
          FROM (
            SELECT 'wa_case_particle' AS violation
            WHERE EXISTS (
              SELECT 1
              FROM grammar_points gp
              JOIN grammar_point_taxonomy_tags tag ON tag.grammar_point_id = gp.id
              JOIN taxonomy_nodes node ON node.id = tag.taxonomy_node_id
              WHERE gp.seed_key = 'gp_wa' AND node.slug = 'case_particles'
            )
            UNION ALL
            SELECT 'made_case_particle'
            WHERE EXISTS (
              SELECT 1
              FROM grammar_points gp
              JOIN grammar_point_taxonomy_tags tag ON tag.grammar_point_id = gp.id
              JOIN taxonomy_nodes node ON node.id = tag.taxonomy_node_id
              WHERE gp.canonical_form = 'まで' AND node.slug = 'case_particles'
            )
            UNION ALL
            SELECT 'request_primary_or_tags'
            WHERE EXISTS (
              SELECT 1
              FROM grammar_points gp
              JOIN taxonomy_nodes primary_node ON primary_node.id = gp.primary_taxonomy_node_id
              WHERE gp.seed_key IN ('gp_te_moraemasu_ka', 'gp_te_itadakemasu_ka')
                AND (
                  primary_node.slug <> 'requests_permission_advice'
                  OR NOT EXISTS (
                    SELECT 1
                    FROM grammar_point_taxonomy_tags tag
                    JOIN taxonomy_nodes node ON node.id = tag.taxonomy_node_id
                    WHERE tag.grammar_point_id = gp.id
                      AND node.slug = 'giving_receiving_benefit'
                  )
                )
            )
            UNION ALL
            SELECT 'change_primary_or_basic_tag'
            WHERE EXISTS (
              SELECT 1
              FROM grammar_points gp
              JOIN taxonomy_nodes primary_node ON primary_node.id = gp.primary_taxonomy_node_id
              WHERE gp.seed_key IN ('gp_ninaru_change', 'gp_nisuru_change')
                AND (
                  primary_node.slug <> 'change_start_continuation_end'
                  OR NOT EXISTS (
                    SELECT 1
                    FROM grammar_point_taxonomy_tags tag
                    JOIN taxonomy_nodes node ON node.id = tag.taxonomy_node_id
                    WHERE tag.grammar_point_id = gp.id
                      AND node.slug = 'basic_sentence_patterns'
                  )
                )
            )
          ) violations
        ) AS content_accuracy_violations,
        (
          SELECT COUNT(*)
          FROM comparison_sets comparison_set
          WHERE comparison_set.status = 'active'
            AND (
              NULLIF(BTRIM(comparison_set.common_meaning), '') IS NULL
              OR jsonb_array_length(comparison_set.decision_rules) = 0
              OR jsonb_array_length(comparison_set.connection_differences) = 0
              OR jsonb_array_length(comparison_set.register_differences) = 0
              OR jsonb_array_length(comparison_set.non_interchangeable_cases) = 0
              OR jsonb_array_length(comparison_set.minimal_pair_examples) = 0
              OR jsonb_array_length(comparison_set.learner_mistakes) = 0
              OR (
                SELECT COUNT(*)
                FROM comparison_set_members member
                WHERE member.comparison_set_id = comparison_set.id
              ) < 2
            )
        ) AS incomplete_comparison_sets,
        (
          SELECT COUNT(*)
          FROM comparison_set_members member
          JOIN grammar_points gp ON gp.id = member.grammar_point_id
          WHERE gp.status <> 'active'
        ) AS inactive_comparison_members,
        (
          SELECT COUNT(*)
          FROM (
            SELECT
              comparison_set.id AS comparison_set_id,
              (rule ->> 'preferredMemberPosition')::integer AS member_position
            FROM comparison_sets comparison_set
            CROSS JOIN LATERAL jsonb_array_elements(comparison_set.decision_rules) rule
            UNION ALL
            SELECT
              comparison_set.id,
              (difference ->> 'memberPosition')::integer
            FROM comparison_sets comparison_set
            CROSS JOIN LATERAL jsonb_array_elements(
              comparison_set.connection_differences || comparison_set.register_differences
            ) difference
            UNION ALL
            SELECT
              comparison_set.id,
              (sentence ->> 'memberPosition')::integer
            FROM comparison_sets comparison_set
            CROSS JOIN LATERAL jsonb_array_elements(comparison_set.minimal_pair_examples) pair
            CROSS JOIN LATERAL jsonb_array_elements(pair -> 'sentences') sentence
          ) member_reference
          WHERE member_reference.member_position < 1
             OR member_reference.member_position > (
               SELECT COUNT(*)
               FROM comparison_set_members member
               WHERE member.comparison_set_id = member_reference.comparison_set_id
             )
        ) AS invalid_comparison_member_positions,
        (
          SELECT COUNT(*)
          FROM (
            VALUES
              ('conjugation_error'),
              ('connection_error'),
              ('particle_error'),
              ('tense_aspect_error'),
              ('giving_receiving_direction_error'),
              ('semantic_error'),
              ('register_mismatch'),
              ('collocation_error'),
              ('literal_translation'),
              ('unnatural_expression')
          ) expected(code)
          LEFT JOIN error_types
            ON error_types.code = expected.code
           AND error_types.status = 'active'
          WHERE error_types.id IS NULL
        ) AS missing_stable_error_codes,
        (
          SELECT COUNT(*)
          FROM ai_feedback_issues issue
          LEFT JOIN ai_feedback feedback ON feedback.id = issue.ai_feedback_id
          LEFT JOIN error_types error_type ON error_type.id = issue.error_type_id
          WHERE feedback.id IS NULL OR error_type.id IS NULL
        ) AS dangling_feedback_issues,
        (
          SELECT COUNT(*)
          FROM ai_feedback feedback
          JOIN ai_feedback_issues issue ON issue.ai_feedback_id = feedback.id
          JOIN error_types error_type ON error_type.id = issue.error_type_id
          WHERE feedback.id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeee2'::uuid
            AND feedback.feedback_text = 'legacy compatibility check'
            AND feedback.meaning_score IS NOT NULL
            AND feedback.explanation IS NOT NULL
            AND jsonb_array_length(feedback.issues) > 0
            AND error_type.code = 'register_mismatch'
        ) AS readable_legacy_feedback,
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
      Number(integrity?.active_learning_units) !== 339 ||
      Number(integrity?.migrated_legacy_points) !== 11 ||
      Number(integrity?.active_comparison_sets) !== 27 ||
      Number(integrity?.active_error_types) !== 10 ||
      Number(integrity?.active_exercise_blueprints) !== 3 ||
      Number(integrity?.hidden_exercise_blueprints) !== 3 ||
      Number(integrity?.active_scenario_templates) !== 10 ||
      Number(integrity?.active_learning_stages) !== 5 ||
      Number(integrity?.active_learning_modules) !== 19 ||
      Number(integrity?.empty_active_learning_modules) !== 0 ||
      Number(integrity?.active_without_primary) !== 0 ||
      Number(integrity?.primary_category_mismatch) !== 0 ||
      Number(integrity?.dangling_taxonomy_tags) !== 0 ||
      Number(integrity?.duplicate_learning_units) !== 0 ||
      Number(integrity?.duplicate_active_examples) !== 0 ||
      Number(integrity?.incomplete_active_learning_units) !== 0 ||
      Number(integrity?.expanded_units_without_three_examples) !== 0 ||
      Number(integrity?.active_without_curriculum) !== 0 ||
      Number(integrity?.active_without_module) !== 0 ||
      Number(integrity?.curriculum_module_stage_mismatches) !== 0 ||
      Number(integrity?.prerequisite_cycles) !== 0 ||
      Number(integrity?.prerequisite_order_violations) !== 0 ||
      Number(integrity?.normalized_polysemy_units) < 22 ||
      Number(integrity?.polysemy_group_mismatches) !== 0 ||
      Number(integrity?.content_accuracy_violations) !== 0 ||
      Number(integrity?.incomplete_comparison_sets) !== 0 ||
      Number(integrity?.inactive_comparison_members) !== 0 ||
      Number(integrity?.invalid_comparison_member_positions) !== 0 ||
      Number(integrity?.missing_stable_error_codes) !== 0 ||
      Number(integrity?.dangling_feedback_issues) !== 0 ||
      Number(integrity?.readable_legacy_feedback) !== 1 ||
      Number(integrity?.preserved_legacy_references) !== 5
    ) {
      throw new Error(`Grammar domain integrity check failed: ${JSON.stringify(integrity)}`);
    }

    await pool.query(`
      TRUNCATE TABLE
        practice_attempt_issues,
        mastery_evidence,
        practice_attempts,
        exercise_instances,
        practice_sessions,
        learner_skill_states,
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
