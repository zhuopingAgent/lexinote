export const DEFAULT_GRAMMAR_USER_ID =
  "00000000-0000-0000-0000-000000000001";

export const SELECT_GRAMMAR_CATEGORY_GROUPS_SQL = `
  SELECT
    id::text,
    slug,
    name_zh,
    name_en,
    description,
    priority,
    is_mvp
  FROM grammar_category_groups
  ORDER BY priority ASC, name_zh ASC;
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
  LEFT JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  ORDER BY
    cgrp.priority ASC NULLS LAST,
    gc.priority ASC,
    gc.name_zh ASC;
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

export const SEARCH_GRAMMAR_POINTS_SQL = `
  SELECT
    gp.id::text,
    gp.grammar_point,
    gp.reading,
    gp.category_id::text,
    gc.slug AS category_slug,
    gc.name_zh AS category_name_zh,
    gc.name_en AS category_name_en,
    cgrp.slug AS category_group_slug,
    cgrp.name_zh AS category_group_name_zh,
    cgrp.name_en AS category_group_name_en,
    gp.sub_category,
    gp.core_meaning,
    gp.natural_translation,
    gp.structure,
    gp.practicality,
    gp.spoken_or_written,
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = $4::uuid
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', st.name_en,
        'nameZh', st.name_zh,
        'description', st.description,
        'priority', st.priority
      )) FILTER (WHERE st.id IS NOT NULL),
      '[]'::jsonb
    ) AS scene_tags,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', rt.name_en,
        'nameZh', rt.name_zh,
        'description', rt.description,
        'priority', rt.priority
      )) FILTER (WHERE rt.id IS NOT NULL),
      '[]'::jsonb
    ) AS register_tags
  FROM grammar_points gp
  LEFT JOIN grammar_categories gc ON gc.id = gp.category_id
  LEFT JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  LEFT JOIN grammar_point_scene_tags gpst ON gpst.grammar_point_id = gp.id
  LEFT JOIN scene_tags st ON st.id = gpst.scene_tag_id
  LEFT JOIN grammar_point_register_tags gprt ON gprt.grammar_point_id = gp.id
  LEFT JOIN register_tags rt ON rt.id = gprt.register_tag_id
  WHERE (
    $1::text = ''
    OR gp.grammar_point ILIKE $2
    OR gp.reading ILIKE $2
    OR gp.core_meaning ILIKE $2
    OR gp.natural_translation ILIKE $2
    OR gp.structure ILIKE $2
    OR gc.name_zh ILIKE $2
    OR cgrp.name_zh ILIKE $2
    OR gp.sub_category ILIKE $2
  )
  AND ($5::text = '' OR gc.slug = $5::text)
  AND ($6::text = '' OR cgrp.slug = $6::text)
  GROUP BY
    gp.id,
    gc.slug,
    gc.name_zh,
    gc.name_en,
    gc.priority,
    cgrp.slug,
    cgrp.name_zh,
    cgrp.name_en,
    cgrp.priority
  ORDER BY
    CASE
      WHEN $1::text = '' THEN 10
      WHEN gp.grammar_point = $1::text THEN 0
      WHEN gp.grammar_point ILIKE $2 THEN 1
      WHEN gp.reading ILIKE $2 THEN 2
      WHEN gp.core_meaning ILIKE $2 THEN 3
      ELSE 4
    END,
    CASE gp.practicality
      WHEN 'S' THEN 1
      WHEN 'A' THEN 2
      WHEN 'B' THEN 3
      WHEN 'C' THEN 4
      ELSE 5
    END,
    cgrp.priority ASC NULLS LAST,
    gc.priority ASC,
    gp.grammar_point ASC
  LIMIT $3;
`;

export const SELECT_GRAMMAR_POINT_DETAIL_SQL = `
  SELECT
    gp.id::text,
    gp.grammar_point,
    gp.reading,
    gp.category_id::text,
    gc.slug AS category_slug,
    gc.name_zh AS category_name_zh,
    gc.name_en AS category_name_en,
    cgrp.slug AS category_group_slug,
    cgrp.name_zh AS category_group_name_zh,
    cgrp.name_en AS category_group_name_en,
    gp.sub_category,
    gp.core_meaning,
    gp.natural_translation,
    gp.structure,
    gp.practicality,
    gp.spoken_or_written,
    gp.notes,
    gp.jlpt_level,
    gp.common_mistakes,
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = $2::uuid
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', st.name_en,
        'nameZh', st.name_zh,
        'description', st.description,
        'priority', st.priority
      )) FILTER (WHERE st.id IS NOT NULL),
      '[]'::jsonb
    ) AS scene_tags,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', rt.name_en,
        'nameZh', rt.name_zh,
        'description', rt.description,
        'priority', rt.priority
      )) FILTER (WHERE rt.id IS NOT NULL),
      '[]'::jsonb
    ) AS register_tags
  FROM grammar_points gp
  LEFT JOIN grammar_categories gc ON gc.id = gp.category_id
  LEFT JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  LEFT JOIN grammar_point_scene_tags gpst ON gpst.grammar_point_id = gp.id
  LEFT JOIN scene_tags st ON st.id = gpst.scene_tag_id
  LEFT JOIN grammar_point_register_tags gprt ON gprt.grammar_point_id = gp.id
  LEFT JOIN register_tags rt ON rt.id = gprt.register_tag_id
  WHERE gp.id = $1::uuid
  GROUP BY
    gp.id,
    gc.slug,
    gc.name_zh,
    gc.name_en,
    cgrp.slug,
    cgrp.name_zh,
    cgrp.name_en;
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
  VALUES (
    $1::uuid,
    $2::uuid,
    'learning',
    NOW() + INTERVAL '1 day',
    1,
    NOW()
  )
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
  VALUES (
    $1::uuid,
    $2::uuid,
    'mastered',
    NOW() + INTERVAL '7 days',
    0,
    NOW()
  )
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
  INSERT INTO learning_history (
    user_id,
    grammar_point_id,
    activity_type,
    metadata
  )
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
    gp.id::text,
    gp.grammar_point,
    gp.reading,
    gp.category_id::text,
    gc.slug AS category_slug,
    gc.name_zh AS category_name_zh,
    gc.name_en AS category_name_en,
    cgrp.slug AS category_group_slug,
    cgrp.name_zh AS category_group_name_zh,
    cgrp.name_en AS category_group_name_en,
    gp.sub_category,
    gp.core_meaning,
    gp.natural_translation,
    gp.structure,
    gp.practicality,
    gp.spoken_or_written,
    TRUE AS is_favorite,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', st.name_en,
        'nameZh', st.name_zh,
        'description', st.description,
        'priority', st.priority
      )) FILTER (WHERE st.id IS NOT NULL),
      '[]'::jsonb
    ) AS scene_tags,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', rt.name_en,
        'nameZh', rt.name_zh,
        'description', rt.description,
        'priority', rt.priority
      )) FILTER (WHERE rt.id IS NOT NULL),
      '[]'::jsonb
    ) AS register_tags
  FROM favorites
  JOIN grammar_points gp ON gp.id = favorites.grammar_point_id
  LEFT JOIN grammar_categories gc ON gc.id = gp.category_id
  LEFT JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  LEFT JOIN grammar_point_scene_tags gpst ON gpst.grammar_point_id = gp.id
  LEFT JOIN scene_tags st ON st.id = gpst.scene_tag_id
  LEFT JOIN grammar_point_register_tags gprt ON gprt.grammar_point_id = gp.id
  LEFT JOIN register_tags rt ON rt.id = gprt.register_tag_id
  WHERE favorites.user_id = $1::uuid
  GROUP BY
    favorites.created_at,
    gp.id,
    gc.slug,
    gc.name_zh,
    gc.name_en,
    cgrp.slug,
    cgrp.name_zh,
    cgrp.name_en
  ORDER BY favorites.created_at DESC;
`;

export const SELECT_REVIEW_ITEMS_SQL = `
  SELECT
    rr.id::text AS review_record_id,
    rr.status,
    rr.mistake_count,
    rr.next_review_at,
    rr.last_reviewed_at,
    gp.id::text,
    gp.grammar_point,
    gp.reading,
    gp.category_id::text,
    gc.slug AS category_slug,
    gc.name_zh AS category_name_zh,
    gc.name_en AS category_name_en,
    cgrp.slug AS category_group_slug,
    cgrp.name_zh AS category_group_name_zh,
    cgrp.name_en AS category_group_name_en,
    gp.sub_category,
    gp.core_meaning,
    gp.natural_translation,
    gp.structure,
    gp.practicality,
    gp.spoken_or_written,
    EXISTS (
      SELECT 1
      FROM favorites
      WHERE favorites.user_id = rr.user_id
        AND favorites.grammar_point_id = gp.id
    ) AS is_favorite,
    latest_feedback.sentence AS latest_sentence,
    latest_feedback.feedback_text AS latest_feedback,
    latest_feedback.corrected_sentence,
    latest_feedback.mistake_types,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', st.name_en,
        'nameZh', st.name_zh,
        'description', st.description,
        'priority', st.priority
      )) FILTER (WHERE st.id IS NOT NULL),
      '[]'::jsonb
    ) AS scene_tags,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'nameEn', rt.name_en,
        'nameZh', rt.name_zh,
        'description', rt.description,
        'priority', rt.priority
      )) FILTER (WHERE rt.id IS NOT NULL),
      '[]'::jsonb
    ) AS register_tags
  FROM review_records rr
  JOIN grammar_points gp ON gp.id = rr.grammar_point_id
  LEFT JOIN grammar_categories gc ON gc.id = gp.category_id
  LEFT JOIN grammar_category_groups cgrp ON cgrp.id = gc.group_id
  LEFT JOIN grammar_point_scene_tags gpst ON gpst.grammar_point_id = gp.id
  LEFT JOIN scene_tags st ON st.id = gpst.scene_tag_id
  LEFT JOIN grammar_point_register_tags gprt ON gprt.grammar_point_id = gp.id
  LEFT JOIN register_tags rt ON rt.id = gprt.register_tag_id
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
  GROUP BY
    rr.id,
    gp.id,
    gc.slug,
    gc.name_zh,
    gc.name_en,
    cgrp.slug,
    cgrp.name_zh,
    cgrp.name_en,
    latest_feedback.sentence,
    latest_feedback.feedback_text,
    latest_feedback.corrected_sentence,
    latest_feedback.mistake_types
  ORDER BY
    rr.next_review_at ASC NULLS FIRST,
    rr.mistake_count DESC,
    gp.grammar_point ASC;
`;
