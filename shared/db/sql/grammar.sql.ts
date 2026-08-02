export const DEFAULT_GRAMMAR_USER_ID =
  "00000000-0000-0000-0000-000000000001";

export const SELECT_KNOWLEDGE_DIMENSIONS_SQL = `
  SELECT
    id::text,
    slug,
    name_zh,
    name_en,
    description,
    display_order,
    status
  FROM taxonomy_dimensions
  WHERE status = 'active'
  ORDER BY display_order ASC, name_zh ASC;
`;

export const SELECT_TAXONOMY_NODES_SQL = `
  SELECT
    tn.id::text,
    tn.slug,
    tn.dimension_id::text,
    td.slug AS dimension_slug,
    td.name_zh AS dimension_name_zh,
    td.name_en AS dimension_name_en,
    tn.name_zh,
    tn.name_en,
    tn.description,
    tn.example_expressions,
    tn.display_order,
    tn.status
  FROM taxonomy_nodes tn
  JOIN taxonomy_dimensions td ON td.id = tn.dimension_id
  WHERE tn.status = 'active'
    AND td.status = 'active'
  ORDER BY td.display_order ASC, tn.display_order ASC, tn.name_zh ASC;
`;

export const SELECT_LEARNING_STAGES_SQL = `
  SELECT
    id::text,
    slug,
    name_zh,
    description,
    display_order,
    status
  FROM learning_stages
  WHERE status = 'active'
  ORDER BY display_order ASC;
`;

export const SELECT_LEARNING_MODULES_SQL = `
  SELECT
    module.id::text,
    stage.id::text AS stage_id,
    stage.slug AS stage_slug,
    stage.name_zh AS stage_name_zh,
    module.slug,
    module.name_zh,
    module.description,
    module.display_order,
    module.status
  FROM learning_modules module
  JOIN learning_stages stage ON stage.id = module.learning_stage_id
  WHERE module.status = 'active'
    AND stage.status = 'active'
  ORDER BY stage.display_order ASC, module.display_order ASC;
`;

export const SELECT_COMPARISON_SETS_SQL = `
  SELECT
    cs.id::text,
    cs.slug,
    cs.name_zh,
    cs.summary,
    cs.common_meaning,
    cs.decision_rules,
    cs.connection_differences,
    cs.register_differences,
    cs.interchangeable_cases,
    cs.non_interchangeable_cases,
    cs.minimal_pair_examples,
    cs.learner_mistakes,
    cs.status,
    COALESCE(members.items, '[]'::jsonb) AS members
  FROM comparison_sets cs
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'grammarPointId', gp.id::text,
        'grammarPoint', gp.grammar_point,
        'canonicalForm', gp.canonical_form,
        'senseKey', gp.sense_key,
        'sortOrder', csm.sort_order
      )
      ORDER BY csm.sort_order ASC, gp.grammar_point ASC
    ) AS items
    FROM comparison_set_members csm
    JOIN grammar_points gp ON gp.id = csm.grammar_point_id
    WHERE csm.comparison_set_id = cs.id
  ) members ON TRUE
  WHERE cs.status = 'active'
  ORDER BY cs.name_zh ASC;
`;

export const SELECT_COMPARISON_SETS_FOR_GRAMMAR_POINT_SQL = `
  SELECT
    cs.id::text,
    cs.slug,
    cs.name_zh,
    cs.summary,
    cs.common_meaning,
    cs.decision_rules,
    cs.connection_differences,
    cs.register_differences,
    cs.interchangeable_cases,
    cs.non_interchangeable_cases,
    cs.minimal_pair_examples,
    cs.learner_mistakes,
    cs.status,
    COALESCE(members.items, '[]'::jsonb) AS members
  FROM comparison_sets cs
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'grammarPointId', gp.id::text,
        'grammarPoint', gp.grammar_point,
        'canonicalForm', gp.canonical_form,
        'senseKey', gp.sense_key,
        'sortOrder', csm.sort_order
      )
      ORDER BY csm.sort_order ASC, gp.grammar_point ASC
    ) AS items
    FROM comparison_set_members csm
    JOIN grammar_points gp ON gp.id = csm.grammar_point_id
    WHERE csm.comparison_set_id = cs.id
  ) members ON TRUE
  WHERE cs.status = 'active'
    AND EXISTS (
      SELECT 1
      FROM comparison_set_members current_member
      WHERE current_member.comparison_set_id = cs.id
        AND current_member.grammar_point_id = $1::uuid
    )
  ORDER BY cs.name_zh ASC;
`;

export const SELECT_ERROR_TYPES_SQL = `
  SELECT
    id::text,
    code,
    name_zh,
    description,
    parent_id::text,
    default_severity,
    status
  FROM error_types
  WHERE status = 'active'
  ORDER BY name_zh ASC;
`;

export const SELECT_GRAMMAR_PROGRESS_TOTALS_SQL = `
  SELECT
    COUNT(DISTINCT gp.id)::int AS total_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE rr.id IS NOT NULL
        OR learner_objective_states.grammar_point_id IS NOT NULL
    )::int AS started_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.status = 'mastered'
    )::int AS mastered_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE COALESCE(rr.status, 'new') <> 'mastered'
        AND (rr.id IS NOT NULL OR learner_objective_states.grammar_point_id IS NOT NULL)
    )::int AS pending_completion_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.status = 'mastered'
        AND rr.next_review_at <= NOW()
    )::int AS due_review_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE rr.id IS NOT NULL
        OR learner_objective_states.grammar_point_id IS NOT NULL
    )::int AS review_count,
    COUNT(DISTINCT favorites.grammar_point_id)::int AS favorite_count
  FROM grammar_points gp
  LEFT JOIN review_records rr
    ON rr.grammar_point_id = gp.id
   AND rr.user_id = $1::uuid
  LEFT JOIN learner_objective_states
    ON learner_objective_states.grammar_point_id = gp.id
   AND learner_objective_states.user_id = $1::uuid
  LEFT JOIN favorites
    ON favorites.grammar_point_id = gp.id
   AND favorites.user_id = $1::uuid
  WHERE gp.status = 'active';
`;

export const SELECT_GRAMMAR_CATEGORY_GROUPS_SQL = `
  SELECT
    gcg.id::text,
    gcg.slug,
    gcg.name_zh,
    gcg.name_en,
    gcg.description,
    gcg.priority,
    gcg.is_mvp
  FROM grammar_category_groups gcg
  JOIN taxonomy_dimensions td ON td.legacy_group_id = gcg.id
  WHERE td.status = 'active'
  ORDER BY td.display_order ASC, gcg.name_zh ASC;
`;

export const SELECT_GRAMMAR_CATEGORIES_SQL = `
  SELECT
    gc.id::text,
    gc.slug,
    gc.group_id::text,
    cgrp.slug AS group_slug,
    cgrp.name_zh AS group_name_zh,
    cgrp.name_en AS group_name_en,
    cgrp.description AS group_description,
    cgrp.priority AS group_priority,
    gc.name_zh,
    gc.name_en,
    gc.description,
    gc.example_expressions,
    gc.priority,
    gc.is_mvp
  FROM grammar_categories gc
  JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  JOIN taxonomy_nodes tn ON tn.legacy_category_id = gc.id
  JOIN taxonomy_dimensions td ON td.id = tn.dimension_id
  WHERE td.slug = 'expression_function'
    AND tn.status = 'active'
  ORDER BY gc.priority ASC, gc.name_zh ASC;
`;

export const SELECT_SCENE_TAGS_SQL = `
  SELECT
    name_en,
    name_zh,
    description,
    priority
  FROM scene_tags
  ORDER BY priority ASC, name_zh ASC;
`;

export const SELECT_REGISTER_TAGS_SQL = `
  SELECT
    name_en,
    name_zh,
    description,
    priority
  FROM register_tags
  ORDER BY priority ASC, name_zh ASC;
`;

const GRAMMAR_POINT_SELECT_FIELDS = `
  gp.id::text,
  gp.grammar_point,
  gp.point_type,
  gp.canonical_form,
  gp.sense_key,
  gp.form_group_slug,
  gp.status,
  gp.reading,
  COALESCE(ptn.legacy_category_id, gp.category_id)::text AS category_id,
  compat_gc.slug AS category_slug,
  compat_gc.name_zh AS category_name_zh,
  compat_gc.name_en AS category_name_en,
  compat_group.slug AS category_group_slug,
  compat_group.name_zh AS category_group_name_zh,
  compat_group.name_en AS category_group_name_en,
  gp.sub_category,
  gp.core_meaning,
  gp.natural_translation,
  gp.structure,
  gp.practicality,
  gp.spoken_or_written,
  CASE
    WHEN ls.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'stage', jsonb_build_object(
        'id', ls.id::text,
        'slug', ls.slug,
        'nameZh', ls.name_zh,
        'description', ls.description,
        'displayOrder', ls.display_order,
        'status', ls.status
      ),
      'module', CASE
        WHEN lm.id IS NULL THEN NULL
        ELSE jsonb_build_object(
          'id', lm.id::text,
          'stageId', ls.id::text,
          'stageSlug', ls.slug,
          'stageNameZh', ls.name_zh,
          'slug', lm.slug,
          'nameZh', lm.name_zh,
          'description', lm.description,
          'displayOrder', lm.display_order,
          'status', lm.status
        )
      END,
      'level', gpc.level,
      'recommendedOrder', gpc.recommended_order,
      'moduleOrder', gpc.module_order
    )
  END AS curriculum,
  CASE
    WHEN ptn.id IS NULL THEN NULL
    ELSE jsonb_build_object(
      'id', ptn.id::text,
      'slug', ptn.slug,
      'dimensionId', ptd.id::text,
      'dimensionSlug', ptd.slug,
      'dimensionNameZh', ptd.name_zh,
      'dimensionNameEn', ptd.name_en,
      'nameZh', ptn.name_zh,
      'nameEn', ptn.name_en,
      'displayOrder', ptn.display_order
    )
  END AS primary_category,
  COALESCE(taxonomy_tags.items, '[]'::jsonb) AS taxonomy_tags,
  CASE
    WHEN cs.id IS NOT NULL THEN jsonb_build_object(
      'kind', 'comparison_set',
      'slug', cs.slug,
      'nameZh', cs.name_zh
    )
    WHEN et.id IS NOT NULL THEN jsonb_build_object(
      'kind', 'error_type',
      'slug', et.code,
      'nameZh', et.name_zh
    )
    ELSE NULL
  END AS migration_target,
  COALESCE(scene_tag_rows.items, '[]'::jsonb) AS scene_tags,
  COALESCE(register_tag_rows.items, '[]'::jsonb) AS register_tags
`;

const GRAMMAR_POINT_SELECT_JOINS = `
  LEFT JOIN taxonomy_nodes ptn ON ptn.id = gp.primary_taxonomy_node_id
  LEFT JOIN taxonomy_dimensions ptd ON ptd.id = ptn.dimension_id
  LEFT JOIN grammar_categories compat_gc
    ON compat_gc.id = COALESCE(ptn.legacy_category_id, gp.category_id)
  LEFT JOIN grammar_category_groups compat_group ON compat_group.id = compat_gc.group_id
  LEFT JOIN grammar_point_curriculum gpc ON gpc.grammar_point_id = gp.id
  LEFT JOIN learning_stages ls ON ls.id = gpc.learning_stage_id
  LEFT JOIN learning_modules lm ON lm.id = gpc.learning_module_id
  LEFT JOIN comparison_sets cs ON cs.legacy_grammar_point_id = gp.id
  LEFT JOIN error_types et ON et.legacy_grammar_point_id = gp.id
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', tn.id::text,
        'slug', tn.slug,
        'dimensionId', td.id::text,
        'dimensionSlug', td.slug,
        'dimensionNameZh', td.name_zh,
        'dimensionNameEn', td.name_en,
        'nameZh', tn.name_zh,
        'nameEn', tn.name_en,
        'displayOrder', tn.display_order
      )
      ORDER BY td.display_order ASC, tn.display_order ASC, tn.name_zh ASC
    ) AS items
    FROM grammar_point_taxonomy_tags gptt
    JOIN taxonomy_nodes tn ON tn.id = gptt.taxonomy_node_id
    JOIN taxonomy_dimensions td ON td.id = tn.dimension_id
    WHERE gptt.grammar_point_id = gp.id
      AND tn.status = 'active'
      AND td.status = 'active'
  ) taxonomy_tags ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'nameEn', st.name_en,
        'nameZh', st.name_zh,
        'description', st.description,
        'priority', st.priority
      )
      ORDER BY st.priority ASC, st.name_zh ASC
    ) AS items
    FROM grammar_point_scene_tags gpst
    JOIN scene_tags st ON st.id = gpst.scene_tag_id
    WHERE gpst.grammar_point_id = gp.id
  ) scene_tag_rows ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'nameEn', rt.name_en,
        'nameZh', rt.name_zh,
        'description', rt.description,
        'priority', rt.priority
      )
      ORDER BY rt.priority ASC, rt.name_zh ASC
    ) AS items
    FROM grammar_point_register_tags gprt
    JOIN register_tags rt ON rt.id = gprt.register_tag_id
    WHERE gprt.grammar_point_id = gp.id
  ) register_tag_rows ON TRUE
`;

export const SEARCH_GRAMMAR_POINTS_SQL = `
  SELECT
    ${GRAMMAR_POINT_SELECT_FIELDS},
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = $4::uuid
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    (
      SELECT review_records.status
      FROM review_records
      WHERE review_records.user_id = $4::uuid
        AND review_records.grammar_point_id = gp.id
    ) AS learning_status
  FROM grammar_points gp
  ${GRAMMAR_POINT_SELECT_JOINS}
  WHERE gp.status = 'active'
    AND (
      $1::text = ''
      OR gp.grammar_point ILIKE $2
      OR gp.canonical_form ILIKE $2
      OR gp.reading ILIKE $2
      OR gp.core_meaning ILIKE $2
      OR gp.natural_translation ILIKE $2
      OR gp.structure ILIKE $2
      OR gp.usage_notes ILIKE $2
      OR compat_gc.name_zh ILIKE $2
      OR ptd.name_zh ILIKE $2
      OR gp.sub_category ILIKE $2
    )
    AND (
      $5::text = ''
      OR EXISTS (
        SELECT 1
        FROM grammar_point_taxonomy_tags filter_tags
        JOIN taxonomy_nodes filter_node ON filter_node.id = filter_tags.taxonomy_node_id
        WHERE filter_tags.grammar_point_id = gp.id
          AND filter_node.slug = $5::text
      )
    )
    AND (
      $6::text = ''
      OR EXISTS (
        SELECT 1
        FROM grammar_point_taxonomy_tags filter_tags
        JOIN taxonomy_nodes filter_node ON filter_node.id = filter_tags.taxonomy_node_id
        JOIN taxonomy_dimensions filter_dimension
          ON filter_dimension.id = filter_node.dimension_id
        WHERE filter_tags.grammar_point_id = gp.id
          AND filter_dimension.slug = $6::text
      )
    )
    AND (
      $7::text = ''
      OR ls.slug = $7::text
    )
    AND (
      $9::text = ''
      OR lm.slug = $9::text
    )
    AND (
      $10::text = ''
      OR gp.practicality = $10::text
    )
    AND (
      $11::text = ''
      OR (
        $11::text = 'not_started'
        AND NOT EXISTS (
          SELECT 1
          FROM review_records status_record
          WHERE status_record.user_id = $4::uuid
            AND status_record.grammar_point_id = gp.id
        )
      )
      OR (
        $11::text = 'learning'
        AND EXISTS (
          SELECT 1
          FROM review_records status_record
          WHERE status_record.user_id = $4::uuid
            AND status_record.grammar_point_id = gp.id
            AND status_record.status IN ('new', 'learning', 'reviewing')
        )
      )
      OR (
        $11::text = 'mastered'
        AND EXISTS (
          SELECT 1
          FROM review_records status_record
          WHERE status_record.user_id = $4::uuid
            AND status_record.grammar_point_id = gp.id
            AND status_record.status = 'mastered'
        )
      )
    )
  ORDER BY
    CASE
      WHEN $1::text = '' THEN 10
      WHEN gp.grammar_point = $1::text THEN 0
      WHEN gp.grammar_point ILIKE $2 THEN 1
      WHEN gp.reading ILIKE $2 THEN 2
      WHEN gp.core_meaning ILIKE $2 THEN 3
      ELSE 4
    END,
    ls.display_order ASC NULLS LAST,
    gpc.recommended_order ASC NULLS LAST,
    CASE gp.practicality
      WHEN 'S' THEN 1
      WHEN 'A' THEN 2
      WHEN 'B' THEN 3
      WHEN 'C' THEN 4
      ELSE 5
    END,
    ptd.display_order ASC NULLS LAST,
    ptn.display_order ASC NULLS LAST,
    gp.grammar_point ASC,
    gp.id ASC
  LIMIT $3
  OFFSET $8;
`;

export const SELECT_GRAMMAR_POINT_DETAIL_SQL = `
  SELECT
    ${GRAMMAR_POINT_SELECT_FIELDS},
    gp.usage_notes,
    gp.notes,
    gp.jlpt_level,
    gp.common_mistakes,
    COALESCE(connections.items, '[]'::jsonb) AS connections,
    COALESCE(prerequisites.items, '[]'::jsonb) AS prerequisites,
    COALESCE(form_siblings.items, '[]'::jsonb) AS form_siblings,
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = $2::uuid
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    (
      SELECT review_records.status
      FROM review_records
      WHERE review_records.user_id = $2::uuid
        AND review_records.grammar_point_id = gp.id
    ) AS learning_status
  FROM grammar_points gp
  ${GRAMMAR_POINT_SELECT_JOINS}
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'baseType', connection.base_type,
        'requiredForm', connection.required_form,
        'pattern', connection.pattern,
        'notes', connection.notes,
        'sortOrder', connection.sort_order
      )
      ORDER BY connection.sort_order ASC
    ) AS items
    FROM grammar_point_connections connection
    WHERE connection.grammar_point_id = gp.id
  ) connections ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'grammarPointId', prerequisite_point.id::text,
        'grammarPoint', prerequisite_point.grammar_point,
        'canonicalForm', prerequisite_point.canonical_form,
        'senseKey', prerequisite_point.sense_key,
        'relationType', relation.relation_type,
        'learningStatus', (
          SELECT prerequisite_review.status
          FROM review_records prerequisite_review
          WHERE prerequisite_review.user_id = $2::uuid
            AND prerequisite_review.grammar_point_id = prerequisite_point.id
        )
      )
      ORDER BY
        CASE relation.relation_type WHEN 'required' THEN 1 ELSE 2 END,
        prerequisite_point.grammar_point ASC
    ) AS items
    FROM grammar_point_prerequisites relation
    JOIN grammar_points prerequisite_point
      ON prerequisite_point.id = relation.prerequisite_grammar_point_id
    WHERE relation.grammar_point_id = gp.id
      AND prerequisite_point.status = 'active'
  ) prerequisites ON TRUE
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', sibling.id::text,
        'grammarPoint', sibling.grammar_point,
        'canonicalForm', sibling.canonical_form,
        'senseKey', sibling.sense_key,
        'coreMeaning', sibling.core_meaning,
        'status', sibling.status
      )
      ORDER BY sibling_curriculum.recommended_order ASC NULLS LAST,
        sibling.grammar_point ASC
    ) AS items
    FROM grammar_points sibling
    LEFT JOIN grammar_point_curriculum sibling_curriculum
      ON sibling_curriculum.grammar_point_id = sibling.id
    WHERE gp.form_group_slug IS NOT NULL
      AND sibling.form_group_slug = gp.form_group_slug
      AND sibling.id <> gp.id
      AND sibling.status = 'active'
  ) form_siblings ON TRUE
  WHERE gp.id::text = $1::text
     OR gp.sense_key = $1::text
  ORDER BY CASE WHEN gp.id::text = $1::text THEN 0 ELSE 1 END
  LIMIT 1;
`;

export const SELECT_EXAMPLES_FOR_GRAMMAR_POINT_SQL = `
  SELECT
    example_sentences.id::text,
    example_sentences.jp,
    example_sentences.zh,
    example_sentences.difficulty,
    example_sentences.naturalness_score,
    example_sentences.notes,
    scene_tags.name_en AS scene_name_en,
    scene_tags.name_zh AS scene_name_zh,
    scene_tags.description AS scene_description,
    scene_tags.priority AS scene_priority,
    register_tags.name_en AS register_name_en,
    register_tags.name_zh AS register_name_zh,
    register_tags.description AS register_description,
    register_tags.priority AS register_priority
  FROM example_sentences
  LEFT JOIN scene_tags ON scene_tags.id = example_sentences.scene_tag_id
  LEFT JOIN register_tags ON register_tags.id = example_sentences.register_tag_id
  WHERE example_sentences.grammar_point_id = $1::uuid
  ORDER BY example_sentences.difficulty ASC, example_sentences.created_at ASC;
`;

export const SELECT_SIMILAR_GRAMMAR_FOR_POINT_SQL = `
  SELECT
    similar_grammar_relations.id::text,
    similar_grammar_relations.grammar_point_id::text,
    similar_grammar_relations.similar_grammar_point_id::text,
    similar_points.grammar_point AS similar_grammar_point_text,
    similar_grammar_relations.difference_summary,
    similar_grammar_relations.example_a,
    similar_grammar_relations.example_b,
    similar_grammar_relations.notes
  FROM similar_grammar_relations
  JOIN grammar_points AS similar_points
    ON similar_points.id = similar_grammar_relations.similar_grammar_point_id
  WHERE similar_grammar_relations.grammar_point_id = $1::uuid
  ORDER BY similar_points.grammar_point ASC;
`;

export const SELECT_TAG_BY_KIND_AND_NAME_SQL = `
  SELECT
    name_en,
    name_zh,
    description,
    priority
  FROM scene_tags
  WHERE $1::text = 'scene'
    AND name_en = $2::text
  UNION ALL
  SELECT
    name_en,
    name_zh,
    description,
    priority
  FROM register_tags
  WHERE $1::text = 'register'
    AND name_en = $2::text
  LIMIT 1;
`;

export const INSERT_USER_SENTENCE_SQL = `
  INSERT INTO user_sentences (
    user_id,
    grammar_point_id,
    sentence,
    scene_tag_id,
    register_tag_id,
    prompt_text
  )
  VALUES (
    $1::uuid,
    $2::uuid,
    $3::text,
    (SELECT id FROM scene_tags WHERE name_en = $4::text),
    (SELECT id FROM register_tags WHERE name_en = $5::text),
    $6::text
  )
  RETURNING id::text;
`;

export const INSERT_AI_FEEDBACK_SQL = `
  WITH inserted_feedback AS (
    INSERT INTO ai_feedback (
      user_sentence_id,
      grammar_score,
      meaning_score,
      naturalness_score,
      register_score,
      scene_fit_score,
      is_correct,
      feedback_text,
      explanation,
      corrected_sentence,
      better_versions,
      mistake_types,
      issues,
      next_practice_prompt,
      next_hint,
      model_name,
      raw_ai_response
    )
    VALUES (
      $1::uuid,
      $2::integer,
      $3::integer,
      $4::integer,
      $5::integer,
      $6::integer,
      $7::boolean,
      $8::text,
      $9::text,
      $10::text,
      $11::jsonb,
      $12::jsonb,
      $13::jsonb,
      $14::text,
      $15::text,
      $16::text,
      $17::jsonb
    )
    RETURNING id
  ),
  inserted_issues AS (
    INSERT INTO ai_feedback_issues (
      ai_feedback_id,
      error_type_id,
      severity,
      explanation,
      correction,
      related_grammar_point_id,
      role,
      confidence,
      evidence_span,
      affected_dimensions,
      sort_order
    )
    SELECT
      inserted_feedback.id,
      error_types.id,
      issue.item ->> 'severity',
      issue.item ->> 'explanation',
      COALESCE(issue.item ->> 'correction', ''),
      NULLIF(issue.item ->> 'relatedGrammarPointId', '')::uuid,
      COALESCE(
        NULLIF(issue.item ->> 'role', ''),
        CASE WHEN issue.ordinality = 1 THEN 'root' ELSE 'secondary' END
      ),
      NULLIF(issue.item ->> 'confidence', '')::numeric,
      NULLIF(issue.item ->> 'evidenceSpan', ''),
      COALESCE(issue.item -> 'affectedDimensions', '[]'::jsonb),
      issue.ordinality::integer
    FROM inserted_feedback
    CROSS JOIN LATERAL jsonb_array_elements($13::jsonb)
      WITH ORDINALITY AS issue(item, ordinality)
    JOIN error_types
      ON error_types.code = issue.item ->> 'errorTypeCode'
    ON CONFLICT (ai_feedback_id, error_type_id) DO UPDATE SET
      severity = EXCLUDED.severity,
      explanation = EXCLUDED.explanation,
      correction = EXCLUDED.correction,
      related_grammar_point_id = EXCLUDED.related_grammar_point_id,
      role = EXCLUDED.role,
      confidence = EXCLUDED.confidence,
      evidence_span = EXCLUDED.evidence_span,
      affected_dimensions = EXCLUDED.affected_dimensions,
      sort_order = EXCLUDED.sort_order
    RETURNING ai_feedback_id
  )
  SELECT id::text
  FROM inserted_feedback;
`;

export const UPSERT_REVIEW_RECORD_FOR_MISTAKE_SQL = `
  INSERT INTO review_records (
    user_id,
    grammar_point_id,
    status,
    next_review_at,
    mistake_count,
    last_reviewed_at
  )
  VALUES ($1::uuid, $2::uuid, 'learning', NOW() + INTERVAL '1 day', 1, NOW())
  ON CONFLICT (user_id, grammar_point_id) DO UPDATE SET
    mistake_count = review_records.mistake_count + 1,
    status = CASE
      WHEN review_records.mistake_count + 1 >= 3 THEN 'reviewing'
      ELSE 'learning'
    END,
    next_review_at = CASE
      WHEN review_records.mistake_count + 1 = 1 THEN NOW() + INTERVAL '1 day'
      WHEN review_records.mistake_count + 1 = 2 THEN NOW() + INTERVAL '3 days'
      ELSE NOW() + INTERVAL '7 days'
    END,
    last_reviewed_at = NOW(),
    updated_at = NOW();
`;

export const UPSERT_REVIEW_RECORD_FOR_CORRECT_SQL = `
  INSERT INTO review_records (
    user_id,
    grammar_point_id,
    status,
    next_review_at,
    mistake_count,
    last_reviewed_at
  )
  VALUES ($1::uuid, $2::uuid, 'mastered', NOW() + INTERVAL '7 days', 0, NOW())
  ON CONFLICT (user_id, grammar_point_id) DO UPDATE SET
    mistake_count = GREATEST(review_records.mistake_count - 1, 0),
    status = CASE
      WHEN GREATEST(review_records.mistake_count - 1, 0) = 0 THEN 'mastered'
      ELSE 'reviewing'
    END,
    next_review_at = NOW() + INTERVAL '7 days',
    last_reviewed_at = NOW(),
    updated_at = NOW();
`;

export const INSERT_LEARNING_HISTORY_SQL = `
  INSERT INTO learning_history (user_id, grammar_point_id, activity_type, metadata)
  VALUES ($1::uuid, $2::uuid, $3::text, $4::jsonb);
`;

export const UPSERT_FAVORITE_SQL = `
  INSERT INTO favorites (user_id, grammar_point_id)
  VALUES ($1::uuid, $2::uuid)
  ON CONFLICT (user_id, grammar_point_id) DO NOTHING;
`;

export const DELETE_FAVORITE_SQL = `
  DELETE FROM favorites
  WHERE user_id = $1::uuid
    AND grammar_point_id = $2::uuid;
`;

export const SELECT_FAVORITES_SQL = `
  SELECT
    ${GRAMMAR_POINT_SELECT_FIELDS},
    TRUE AS is_favorite,
    (
      SELECT review_records.status
      FROM review_records
      WHERE review_records.user_id = $1::uuid
        AND review_records.grammar_point_id = gp.id
    ) AS learning_status
  FROM favorites
  JOIN grammar_points gp ON gp.id = favorites.grammar_point_id
  ${GRAMMAR_POINT_SELECT_JOINS}
  WHERE favorites.user_id = $1::uuid
  ORDER BY favorites.created_at DESC;
`;

export const SELECT_REVIEW_ITEMS_SQL = `
  SELECT
    rr.id::text AS review_record_id,
    rr.status AS review_status,
    rr.mistake_count,
    rr.next_review_at,
    rr.last_reviewed_at,
    ${GRAMMAR_POINT_SELECT_FIELDS},
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = rr.user_id
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    rr.status AS learning_status,
    latest_feedback.sentence AS latest_sentence,
    latest_feedback.feedback_text AS latest_feedback,
    latest_feedback.corrected_sentence,
    latest_feedback.mistake_types,
    latest_feedback.issues,
    latest_feedback.meaning_score,
    latest_feedback.explanation,
    latest_feedback.next_hint,
    latest_feedback.scene_name_en,
    latest_feedback.scene_name_zh,
    latest_feedback.scene_description,
    latest_feedback.scene_priority,
    latest_feedback.register_name_en,
    latest_feedback.register_name_zh,
    latest_feedback.register_description,
    latest_feedback.register_priority
  FROM review_records rr
  JOIN grammar_points gp ON gp.id = rr.grammar_point_id
  ${GRAMMAR_POINT_SELECT_JOINS}
  LEFT JOIN LATERAL (
    SELECT
      user_sentences.sentence,
      ai_feedback.feedback_text,
      ai_feedback.corrected_sentence,
      ai_feedback.mistake_types,
      ai_feedback.issues,
      ai_feedback.meaning_score,
      ai_feedback.explanation,
      ai_feedback.next_hint,
      scene_tags.name_en AS scene_name_en,
      scene_tags.name_zh AS scene_name_zh,
      scene_tags.description AS scene_description,
      scene_tags.priority AS scene_priority,
      register_tags.name_en AS register_name_en,
      register_tags.name_zh AS register_name_zh,
      register_tags.description AS register_description,
      register_tags.priority AS register_priority
    FROM user_sentences
    JOIN ai_feedback ON ai_feedback.user_sentence_id = user_sentences.id
    LEFT JOIN scene_tags ON scene_tags.id = user_sentences.scene_tag_id
    LEFT JOIN register_tags ON register_tags.id = user_sentences.register_tag_id
    WHERE user_sentences.user_id = rr.user_id
      AND user_sentences.grammar_point_id = rr.grammar_point_id
    ORDER BY ai_feedback.created_at DESC
    LIMIT 1
  ) AS latest_feedback ON TRUE
  WHERE rr.user_id = $1::uuid
  ORDER BY
    rr.next_review_at ASC NULLS FIRST,
    rr.mistake_count DESC,
    gp.grammar_point ASC;
`;

export const SELECT_REVIEW_AGGREGATIONS_SQL = `
  WITH review_scope AS (
    SELECT
      rr.id AS review_record_id,
      gp.id AS grammar_point_id,
      gp.grammar_point,
      gp.sense_key,
      latest_feedback.feedback_id,
      latest_feedback.scene_name_en,
      latest_feedback.scene_name_zh,
      latest_feedback.register_name_en,
      latest_feedback.register_name_zh
    FROM review_records rr
    JOIN grammar_points gp ON gp.id = rr.grammar_point_id
    LEFT JOIN LATERAL (
      SELECT
        ai_feedback.id AS feedback_id,
        scene_tags.name_en AS scene_name_en,
        scene_tags.name_zh AS scene_name_zh,
        register_tags.name_en AS register_name_en,
        register_tags.name_zh AS register_name_zh
      FROM user_sentences
      JOIN ai_feedback ON ai_feedback.user_sentence_id = user_sentences.id
      LEFT JOIN scene_tags ON scene_tags.id = user_sentences.scene_tag_id
      LEFT JOIN register_tags ON register_tags.id = user_sentences.register_tag_id
      WHERE user_sentences.user_id = rr.user_id
        AND user_sentences.grammar_point_id = rr.grammar_point_id
      ORDER BY ai_feedback.created_at DESC
      LIMIT 1
    ) latest_feedback ON TRUE
    WHERE rr.user_id = $1::uuid
  ),
  grammar_point_counts AS (
    SELECT
      grammar_point_id,
      grammar_point,
      sense_key,
      COUNT(DISTINCT review_record_id)::integer AS item_count
    FROM review_scope
    GROUP BY grammar_point_id, grammar_point, sense_key
  ),
  error_type_counts AS (
    SELECT
      error_types.code,
      error_types.name_zh,
      COUNT(DISTINCT review_scope.review_record_id)::integer AS item_count
    FROM review_scope
    JOIN ai_feedback_issues
      ON ai_feedback_issues.ai_feedback_id = review_scope.feedback_id
    JOIN error_types ON error_types.id = ai_feedback_issues.error_type_id
    GROUP BY error_types.code, error_types.name_zh
  ),
  scenario_counts AS (
    SELECT
      scene_name_en,
      scene_name_zh,
      COUNT(DISTINCT review_record_id)::integer AS item_count
    FROM review_scope
    WHERE scene_name_en IS NOT NULL AND scene_name_zh IS NOT NULL
    GROUP BY scene_name_en, scene_name_zh
  ),
  register_counts AS (
    SELECT
      register_name_en,
      register_name_zh,
      COUNT(DISTINCT review_record_id)::integer AS item_count
    FROM review_scope
    WHERE register_name_en IS NOT NULL AND register_name_zh IS NOT NULL
    GROUP BY register_name_en, register_name_zh
  )
  SELECT jsonb_build_object(
    'grammarPoints', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', grammar_point_id::text,
            'label', grammar_point,
            'count', item_count,
            'grammarPointId', grammar_point_id::text,
            'senseKey', sense_key
          )
          ORDER BY item_count DESC, grammar_point ASC
        )
        FROM grammar_point_counts
      ),
      '[]'::jsonb
    ),
    'errorTypes', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', code,
            'label', name_zh,
            'count', item_count
          )
          ORDER BY item_count DESC, name_zh ASC
        )
        FROM error_type_counts
      ),
      '[]'::jsonb
    ),
    'scenarios', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', scene_name_en,
            'label', scene_name_zh,
            'count', item_count
          )
          ORDER BY item_count DESC, scene_name_zh ASC
        )
        FROM scenario_counts
      ),
      '[]'::jsonb
    ),
    'registers', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'key', register_name_en,
            'label', register_name_zh,
            'count', item_count
          )
          ORDER BY item_count DESC, register_name_zh ASC
        )
        FROM register_counts
      ),
      '[]'::jsonb
    )
  ) AS aggregations;
`;

export const SELECT_OBJECTIVE_RECOMMENDATIONS_SQL = `
  WITH objective_scope AS (
    SELECT
      learner_objective_states.*,
      grammar_points.grammar_point,
      grammar_points.core_meaning,
      grammar_points.sense_key AS grammar_sense_key
    FROM learner_objective_states
    JOIN grammar_points
      ON grammar_points.id = learner_objective_states.grammar_point_id
    WHERE learner_objective_states.user_id = $1::uuid
      AND grammar_points.status = 'active'
  ),
  recommendation_scope AS (
    SELECT DISTINCT grammar_point_id
    FROM objective_scope
    WHERE NOT EXISTS (
        SELECT 1
        FROM review_records
        WHERE review_records.user_id = objective_scope.user_id
          AND review_records.grammar_point_id = objective_scope.grammar_point_id
          AND review_records.status = 'mastered'
      )
  ),
  ranked_objectives AS (
    SELECT
      objective_scope.*,
      ROW_NUMBER() OVER (
        PARTITION BY objective_scope.grammar_point_id
        ORDER BY
          (objective_scope.next_review_at <= NOW()) DESC NULLS LAST,
          objective_scope.exposure_count DESC,
          CASE
            WHEN objective_scope.attempts = 0 THEN 0
            ELSE objective_scope.assisted_attempts::numeric / objective_scope.attempts
          END DESC,
          objective_scope.estimate ASC,
          objective_scope.confidence ASC,
          objective_scope.learning_objective ASC
      ) AS objective_rank
    FROM objective_scope
    JOIN recommendation_scope
      ON recommendation_scope.grammar_point_id = objective_scope.grammar_point_id
  ),
  objective_aggregates AS (
    SELECT
      grammar_point_id,
      AVG(estimate)::float8 AS overall_estimate,
      AVG(confidence)::float8 AS overall_confidence,
      jsonb_agg(
        jsonb_build_object(
          'learningObjective', learning_objective,
          'estimate', estimate::float8,
          'confidence', confidence::float8,
          'attempts', attempts,
          'assistedAttempts', assisted_attempts,
          'exposureCount', exposure_count,
          'recentErrorCodes', recent_error_codes,
          'nextReviewAt', next_review_at
        )
        ORDER BY objective_rank
      ) AS objective_progress
    FROM ranked_objectives
    GROUP BY grammar_point_id
  )
  SELECT
    primary_objective.grammar_point_id::text,
    primary_objective.grammar_point,
    primary_objective.core_meaning,
    primary_objective.grammar_sense_key AS sense_key,
    primary_objective.learning_objective,
    primary_objective.estimate::float8,
    primary_objective.confidence::float8,
    primary_objective.attempts,
    primary_objective.assisted_attempts,
    primary_objective.exposure_count,
    primary_objective.recent_error_codes,
    primary_objective.next_review_at,
    objective_aggregates.overall_estimate,
    objective_aggregates.overall_confidence,
    objective_aggregates.objective_progress
  FROM ranked_objectives primary_objective
  JOIN objective_aggregates
    ON objective_aggregates.grammar_point_id = primary_objective.grammar_point_id
  WHERE primary_objective.objective_rank = 1
  ORDER BY
    (primary_objective.next_review_at <= NOW()) DESC NULLS LAST,
    primary_objective.exposure_count DESC,
    CASE
      WHEN primary_objective.attempts = 0 THEN 0
      ELSE primary_objective.assisted_attempts::numeric / primary_objective.attempts
    END DESC,
    objective_aggregates.overall_estimate ASC,
    objective_aggregates.overall_confidence ASC,
    primary_objective.grammar_point ASC
  LIMIT 8;
`;

export const SELECT_GRAMMAR_PROGRESS_SQL = `
  SELECT
    td.id::text,
    td.slug,
    td.name_zh,
    td.name_en,
    td.description,
    td.display_order AS priority,
    COUNT(DISTINCT gp.id)::int AS total_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE rr.id IS NOT NULL
        OR learner_objective_states.grammar_point_id IS NOT NULL
    )::int AS started_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.status = 'mastered'
    )::int AS mastered_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE COALESCE(rr.status, 'new') <> 'mastered'
        AND (rr.id IS NOT NULL OR learner_objective_states.grammar_point_id IS NOT NULL)
    )::int AS pending_completion_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.status = 'mastered'
        AND rr.next_review_at <= NOW()
    )::int AS due_review_count,
    COUNT(DISTINCT gp.id) FILTER (
      WHERE rr.id IS NOT NULL
        OR learner_objective_states.grammar_point_id IS NOT NULL
    )::int AS review_count,
    COUNT(DISTINCT favorites.grammar_point_id)::int AS favorite_count
  FROM taxonomy_dimensions td
  LEFT JOIN taxonomy_nodes tn
    ON tn.dimension_id = td.id
   AND tn.status = 'active'
  LEFT JOIN grammar_point_taxonomy_tags progress_tags
    ON progress_tags.taxonomy_node_id = tn.id
  LEFT JOIN grammar_points gp
    ON gp.id = progress_tags.grammar_point_id
   AND gp.status = 'active'
  LEFT JOIN review_records rr
    ON rr.grammar_point_id = gp.id
   AND rr.user_id = $1::uuid
  LEFT JOIN learner_objective_states
    ON learner_objective_states.grammar_point_id = gp.id
   AND learner_objective_states.user_id = $1::uuid
  LEFT JOIN favorites
    ON favorites.grammar_point_id = gp.id
   AND favorites.user_id = $1::uuid
  WHERE td.status = 'active'
  GROUP BY td.id
  ORDER BY td.display_order ASC, td.name_zh ASC;
`;
