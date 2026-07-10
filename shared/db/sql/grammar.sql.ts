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

export const SELECT_COMPARISON_SETS_SQL = `
  SELECT
    cs.id::text,
    cs.slug,
    cs.name_zh,
    cs.summary,
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
      'level', gpc.level,
      'recommendedOrder', gpc.recommended_order
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
    ) AS is_favorite
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
    gp.grammar_point ASC
  LIMIT $3;
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
    ) AS is_favorite
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
        'relationType', relation.relation_type
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
  INSERT INTO ai_feedback (
    user_sentence_id,
    grammar_score,
    naturalness_score,
    register_score,
    scene_fit_score,
    is_correct,
    feedback_text,
    corrected_sentence,
    better_versions,
    mistake_types,
    next_practice_prompt,
    model_name,
    raw_ai_response
  )
  VALUES (
    $1::uuid,
    $2::integer,
    $3::integer,
    $4::integer,
    $5::integer,
    $6::boolean,
    $7::text,
    $8::text,
    $9::jsonb,
    $10::jsonb,
    $11::text,
    $12::text,
    $13::jsonb
  )
  RETURNING id::text;
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
    TRUE AS is_favorite
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
    latest_feedback.sentence AS latest_sentence,
    latest_feedback.feedback_text AS latest_feedback,
    latest_feedback.corrected_sentence,
    latest_feedback.mistake_types
  FROM review_records rr
  JOIN grammar_points gp ON gp.id = rr.grammar_point_id
  ${GRAMMAR_POINT_SELECT_JOINS}
  LEFT JOIN LATERAL (
    SELECT
      user_sentences.sentence,
      ai_feedback.feedback_text,
      ai_feedback.corrected_sentence,
      ai_feedback.mistake_types
    FROM user_sentences
    JOIN ai_feedback ON ai_feedback.user_sentence_id = user_sentences.id
    WHERE user_sentences.user_id = rr.user_id
      AND user_sentences.grammar_point_id = rr.grammar_point_id
    ORDER BY ai_feedback.created_at DESC
    LIMIT 1
  ) AS latest_feedback ON TRUE
  WHERE rr.user_id = $1::uuid
    AND (
      rr.next_review_at IS NULL
      OR rr.next_review_at <= NOW()
      OR rr.mistake_count > 0
    )
  ORDER BY
    rr.next_review_at ASC NULLS FIRST,
    rr.mistake_count DESC,
    gp.grammar_point ASC;
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
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.id IS NOT NULL
    )::int AS started_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.status = 'mastered'
    )::int AS mastered_count,
    COUNT(DISTINCT rr.grammar_point_id) FILTER (
      WHERE rr.id IS NOT NULL
        AND (
          rr.next_review_at IS NULL
          OR rr.next_review_at <= NOW()
          OR rr.mistake_count > 0
        )
    )::int AS review_count,
    COUNT(DISTINCT favorites.grammar_point_id)::int AS favorite_count
  FROM taxonomy_dimensions td
  LEFT JOIN taxonomy_nodes tn
    ON tn.dimension_id = td.id
   AND tn.status = 'active'
  LEFT JOIN grammar_points gp
    ON gp.primary_taxonomy_node_id = tn.id
   AND gp.status = 'active'
  LEFT JOIN review_records rr
    ON rr.grammar_point_id = gp.id
   AND rr.user_id = $1::uuid
  LEFT JOIN favorites
    ON favorites.grammar_point_id = gp.id
   AND favorites.user_id = $1::uuid
  WHERE td.status = 'active'
  GROUP BY td.id
  ORDER BY td.display_order ASC, td.name_zh ASC;
`;
