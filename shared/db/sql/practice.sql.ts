export const SELECT_RECOMMENDED_PRACTICE_GRAMMAR_SQL = `
  SELECT grammar_point.id::text
  FROM grammar_points grammar_point
  LEFT JOIN review_records review
    ON review.grammar_point_id = grammar_point.id
   AND review.user_id = $1::uuid
  LEFT JOIN grammar_point_curriculum curriculum
    ON curriculum.grammar_point_id = grammar_point.id
  WHERE grammar_point.status = 'active'
  ORDER BY
    CASE
      WHEN review.next_review_at IS NOT NULL AND review.next_review_at <= NOW() THEN 0
      WHEN review.mistake_count > 0 THEN 1
      ELSE 2
    END,
    review.next_review_at ASC NULLS LAST,
    curriculum.level ASC NULLS LAST,
    curriculum.recommended_order ASC NULLS LAST,
    CASE grammar_point.practicality
      WHEN 'S' THEN 1
      WHEN 'A' THEN 2
      WHEN 'B' THEN 3
      WHEN 'C' THEN 4
      ELSE 5
    END,
    grammar_point.id
  LIMIT 1;
`;

export const UPSERT_PRACTICE_SESSION_SQL = `
  INSERT INTO practice_sessions (
    user_id,
    client_session_key,
    entry_mode,
    focus_grammar_point_id,
    preferred_scene_tag_id,
    preferred_register_tag_id,
    planned_exercise_count,
    metadata
  )
  VALUES (
    $1::uuid,
    $2::text,
    $3::text,
    $4::uuid,
    (SELECT id FROM scene_tags WHERE name_en = $5::text),
    (SELECT id FROM register_tags WHERE name_en = $6::text),
    $7::integer,
    $8::jsonb
  )
  ON CONFLICT (user_id, client_session_key) DO UPDATE SET
    updated_at = NOW()
  RETURNING id::text;
`;

export const SELECT_PRACTICE_SESSION_SQL = `
  SELECT
    session.id::text,
    session.user_id::text,
    session.entry_mode,
    session.focus_grammar_point_id::text,
    session.status,
    session.planned_exercise_count,
    session.started_at,
    session.completed_at,
    scene.name_en AS preferred_scene,
    register_tag.name_en AS preferred_register,
    COUNT(exercise.id) FILTER (
      WHERE exercise.status IN ('completed', 'revealed')
    )::integer AS completed_exercise_count,
    COUNT(exercise.id)::integer AS generated_exercise_count
  FROM practice_sessions session
  LEFT JOIN scene_tags scene ON scene.id = session.preferred_scene_tag_id
  LEFT JOIN register_tags register_tag
    ON register_tag.id = session.preferred_register_tag_id
  LEFT JOIN exercise_instances exercise
    ON exercise.practice_session_id = session.id
  WHERE session.id = $1::uuid
    AND session.user_id = $2::uuid
  GROUP BY session.id, scene.name_en, register_tag.name_en;
`;

export const SELECT_ACTIVE_SESSION_EXERCISE_SQL = `
  SELECT exercise.id::text
  FROM exercise_instances exercise
  JOIN practice_sessions session ON session.id = exercise.practice_session_id
  WHERE exercise.practice_session_id = $1::uuid
    AND session.user_id = $2::uuid
    AND exercise.status = 'active'
  ORDER BY exercise.sequence_number DESC
  LIMIT 1;
`;

export const SELECT_PRACTICE_BLUEPRINT_SQL = `
  SELECT
    id::text,
    slug,
    name_zh,
    description,
    skill_dimension,
    exercise_type,
    response_mode,
    supported_point_types,
    minimum_difficulty,
    maximum_difficulty,
    planner_config,
    rubric_template
  FROM exercise_blueprints
  WHERE slug = $1::text
    AND status = 'active'
  LIMIT 1;
`;

export const SELECT_SCENARIO_TEMPLATE_SQL = `
  SELECT
    template.id::text,
    template.slug,
    template.name_zh,
    scene.name_en AS scene_slug,
    scene.name_zh AS scene_label,
    register_tag.name_en AS register_slug,
    register_tag.name_zh AS register_label,
    template.speaker_role,
    template.listener_role,
    template.social_distance,
    template.hierarchy,
    template.request_burden,
    template.medium,
    template.communicative_goals,
    template.known_contexts,
    template.detail_pool,
    template.compatible_function_tags
  FROM scenario_templates template
  JOIN scene_tags scene ON scene.id = template.scene_tag_id
  JOIN register_tags register_tag ON register_tag.id = template.default_register_tag_id
  WHERE template.status = 'active'
    AND template.slug = COALESCE(
      (SELECT slug FROM scenario_templates WHERE slug = $1::text AND status = 'active'),
      'daily_life'
    )
  LIMIT 1;
`;

export const SELECT_LEARNER_SKILL_STATES_SQL = `
  SELECT
    grammar_point_id::text,
    skill_dimension,
    estimate::float8,
    confidence::float8,
    attempts,
    recent_error_codes,
    last_practiced_at,
    next_review_at
  FROM learner_skill_states
  WHERE user_id = $1::uuid
    AND grammar_point_id = $2::uuid
  ORDER BY skill_dimension;
`;

export const SELECT_RECENT_EXERCISE_SIGNATURES_SQL = `
  SELECT exercise.content_signature
  FROM exercise_instances exercise
  JOIN practice_sessions session ON session.id = exercise.practice_session_id
  WHERE session.user_id = $1::uuid
    AND exercise.grammar_point_id = $2::uuid
  ORDER BY exercise.created_at DESC
  LIMIT 20;
`;

export const INSERT_EXERCISE_INSTANCE_SQL = `
  INSERT INTO exercise_instances (
    practice_session_id,
    blueprint_id,
    grammar_point_id,
    comparison_set_id,
    sequence_number,
    skill_dimension,
    exercise_type,
    difficulty,
    response_mode,
    context_snapshot,
    prompt,
    options,
    expected_features,
    reference_answers,
    hint_ladder,
    generation_source,
    generation_seed,
    content_signature
  )
  VALUES (
    $1::uuid,
    (SELECT id FROM exercise_blueprints WHERE slug = $2::text),
    $3::uuid,
    $4::uuid,
    $5::integer,
    $6::text,
    $7::text,
    $8::integer,
    $9::text,
    $10::jsonb,
    $11::text,
    $12::jsonb,
    $13::jsonb,
    $14::jsonb,
    $15::jsonb,
    $16::text,
    $17::text,
    $18::text
  )
  ON CONFLICT (practice_session_id, sequence_number) DO UPDATE SET
    updated_at = exercise_instances.updated_at
  RETURNING id::text;
`;

export const SELECT_EXERCISE_INSTANCE_SQL = `
  SELECT
    exercise.id::text,
    exercise.practice_session_id::text,
    session.user_id::text,
    exercise.grammar_point_id::text,
    exercise.comparison_set_id::text,
    exercise.sequence_number,
    exercise.skill_dimension,
    exercise.exercise_type,
    exercise.difficulty,
    exercise.response_mode,
    exercise.context_snapshot,
    exercise.prompt,
    exercise.options,
    exercise.expected_features,
    exercise.reference_answers,
    exercise.hint_ladder,
    exercise.hints_revealed,
    exercise.generation_source,
    exercise.status,
    COUNT(attempt.id)::integer AS attempt_count
  FROM exercise_instances exercise
  JOIN practice_sessions session ON session.id = exercise.practice_session_id
  LEFT JOIN practice_attempts attempt
    ON attempt.exercise_instance_id = exercise.id
  WHERE exercise.id = $1::uuid
    AND session.user_id = $2::uuid
  GROUP BY exercise.id, session.user_id;
`;

export const REVEAL_NEXT_EXERCISE_HINT_SQL = `
  UPDATE exercise_instances exercise
  SET hints_revealed = LEAST(
        exercise.hints_revealed + 1,
        jsonb_array_length(exercise.hint_ladder)
      ),
      updated_at = NOW()
  FROM practice_sessions session
  WHERE exercise.id = $1::uuid
    AND session.id = exercise.practice_session_id
    AND session.user_id = $2::uuid
    AND exercise.status = 'active'
    AND exercise.hints_revealed < jsonb_array_length(exercise.hint_ladder)
  RETURNING
    exercise.hints_revealed,
    exercise.hint_ladder ->> (exercise.hints_revealed - 1) AS hint,
    exercise.hints_revealed < jsonb_array_length(exercise.hint_ladder) AS has_more_hints;
`;

export const RECORD_PRACTICE_ATTEMPT_SQL = `
  WITH target_exercise AS (
    SELECT exercise.*
    FROM exercise_instances exercise
    JOIN practice_sessions session ON session.id = exercise.practice_session_id
    WHERE exercise.id = $1::uuid
      AND session.user_id = $2::uuid
      AND exercise.status = 'active'
  ),
  inserted_attempt AS (
    INSERT INTO practice_attempts (
      exercise_instance_id,
      user_id,
      attempt_number,
      answer,
      selected_option_id,
      hint_count,
      is_correct,
      grammar_score,
      meaning_score,
      naturalness_score,
      register_score,
      scene_fit_score,
      issues,
      explanation,
      next_hint,
      legacy_user_sentence_id,
      legacy_feedback_id
    )
    SELECT
      target_exercise.id,
      $2::uuid,
      $3::integer,
      $4::text,
      $5::text,
      $6::integer,
      $7::boolean,
      $8::integer,
      $9::integer,
      $10::integer,
      $11::integer,
      $12::integer,
      $13::jsonb,
      $14::text,
      $15::text,
      $16::uuid,
      $17::uuid
    FROM target_exercise
    RETURNING *
  ),
  inserted_issues AS (
    INSERT INTO practice_attempt_issues (
      practice_attempt_id,
      error_type_id,
      severity,
      explanation,
      correction,
      related_grammar_point_id,
      sort_order
    )
    SELECT
      inserted_attempt.id,
      error_type.id,
      issue.item ->> 'severity',
      issue.item ->> 'explanation',
      COALESCE(issue.item ->> 'correction', ''),
      NULLIF(issue.item ->> 'relatedGrammarPointId', '')::uuid,
      issue.ordinality::integer
    FROM inserted_attempt
    CROSS JOIN LATERAL jsonb_array_elements($13::jsonb)
      WITH ORDINALITY AS issue(item, ordinality)
    JOIN error_types error_type
      ON error_type.code = issue.item ->> 'errorTypeCode'
    ON CONFLICT (practice_attempt_id, error_type_id) DO UPDATE SET
      severity = EXCLUDED.severity,
      explanation = EXCLUDED.explanation,
      correction = EXCLUDED.correction,
      related_grammar_point_id = EXCLUDED.related_grammar_point_id,
      sort_order = EXCLUDED.sort_order
    RETURNING practice_attempt_id
  ),
  inserted_evidence AS (
    INSERT INTO mastery_evidence (
      user_id,
      grammar_point_id,
      exercise_instance_id,
      practice_attempt_id,
      skill_dimension,
      evidence_source,
      score,
      independent,
      hint_count,
      attempt_number,
      context_novelty,
      error_codes
    )
    SELECT
      $2::uuid,
      target_exercise.grammar_point_id,
      target_exercise.id,
      inserted_attempt.id,
      target_exercise.skill_dimension,
      'attempt',
      $18::numeric,
      $19::boolean,
      $6::integer,
      $3::integer,
      $20::numeric,
      $21::jsonb
    FROM target_exercise
    JOIN inserted_attempt ON TRUE
    RETURNING *
  ),
  updated_skill AS (
    INSERT INTO learner_skill_states (
      user_id,
      grammar_point_id,
      skill_dimension,
      estimate,
      confidence,
      attempts,
      recent_error_codes,
      last_practiced_at,
      next_review_at
    )
    SELECT
      inserted_evidence.user_id,
      inserted_evidence.grammar_point_id,
      inserted_evidence.skill_dimension,
      inserted_evidence.score,
      0.12,
      1,
      inserted_evidence.error_codes,
      NOW(),
      NOW() + CASE
        WHEN inserted_evidence.score < 0.4 THEN INTERVAL '1 day'
        WHEN inserted_evidence.score < 0.65 THEN INTERVAL '3 days'
        WHEN inserted_evidence.score < 0.8 THEN INTERVAL '7 days'
        ELSE INTERVAL '14 days'
      END
    FROM inserted_evidence
    ON CONFLICT (user_id, grammar_point_id, skill_dimension) DO UPDATE SET
      estimate = ROUND((learner_skill_states.estimate * 0.7 + EXCLUDED.estimate * 0.3)::numeric, 3),
      confidence = LEAST(1, learner_skill_states.confidence + 0.12),
      attempts = learner_skill_states.attempts + 1,
      recent_error_codes = EXCLUDED.recent_error_codes,
      last_practiced_at = NOW(),
      next_review_at = EXCLUDED.next_review_at,
      updated_at = NOW()
    RETURNING estimate::float8, confidence::float8, next_review_at
  ),
  updated_exercise AS (
    UPDATE exercise_instances exercise
    SET status = CASE WHEN $7::boolean THEN 'completed' ELSE exercise.status END,
        updated_at = NOW()
    FROM target_exercise
    WHERE exercise.id = target_exercise.id
    RETURNING exercise.id
  )
  SELECT
    inserted_attempt.id::text,
    updated_skill.estimate,
    updated_skill.confidence,
    updated_skill.next_review_at
  FROM inserted_attempt
  CROSS JOIN updated_skill;
`;

export const REVEAL_EXERCISE_ANSWER_SQL = `
  WITH target_exercise AS (
    SELECT exercise.*
    FROM exercise_instances exercise
    JOIN practice_sessions session ON session.id = exercise.practice_session_id
    WHERE exercise.id = $1::uuid
      AND session.user_id = $2::uuid
      AND exercise.status = 'active'
  ),
  updated_exercise AS (
    UPDATE exercise_instances exercise
    SET status = 'revealed',
        revealed_at = NOW(),
        updated_at = NOW()
    FROM target_exercise
    WHERE exercise.id = target_exercise.id
    RETURNING exercise.*
  ),
  inserted_evidence AS (
    INSERT INTO mastery_evidence (
      user_id,
      grammar_point_id,
      exercise_instance_id,
      skill_dimension,
      evidence_source,
      score,
      independent,
      hint_count,
      attempt_number,
      context_novelty,
      error_codes
    )
    SELECT
      $2::uuid,
      updated_exercise.grammar_point_id,
      updated_exercise.id,
      updated_exercise.skill_dimension,
      'reveal',
      0.2,
      FALSE,
      updated_exercise.hints_revealed,
      0,
      1,
      '["semantic_error"]'::jsonb
    FROM updated_exercise
    ON CONFLICT (exercise_instance_id, evidence_source)
      WHERE evidence_source = 'reveal'
    DO UPDATE SET score = mastery_evidence.score
    RETURNING *
  ),
  updated_skill AS (
    INSERT INTO learner_skill_states (
      user_id,
      grammar_point_id,
      skill_dimension,
      estimate,
      confidence,
      attempts,
      recent_error_codes,
      last_practiced_at,
      next_review_at
    )
    SELECT
      inserted_evidence.user_id,
      inserted_evidence.grammar_point_id,
      inserted_evidence.skill_dimension,
      0.2,
      0.12,
      1,
      inserted_evidence.error_codes,
      NOW(),
      NOW() + INTERVAL '1 day'
    FROM inserted_evidence
    ON CONFLICT (user_id, grammar_point_id, skill_dimension) DO UPDATE SET
      estimate = ROUND((learner_skill_states.estimate * 0.7 + 0.2 * 0.3)::numeric, 3),
      confidence = LEAST(1, learner_skill_states.confidence + 0.12),
      attempts = learner_skill_states.attempts + 1,
      recent_error_codes = EXCLUDED.recent_error_codes,
      last_practiced_at = NOW(),
      next_review_at = NOW() + INTERVAL '1 day',
      updated_at = NOW()
    RETURNING estimate::float8, confidence::float8, next_review_at
  )
  SELECT
    updated_exercise.reference_answers,
    updated_exercise.hints_revealed,
    updated_skill.estimate,
    updated_skill.confidence,
    updated_skill.next_review_at,
    updated_exercise.skill_dimension
  FROM updated_exercise
  CROSS JOIN updated_skill;
`;

export const COMPLETE_PRACTICE_SESSION_SQL = `
  UPDATE practice_sessions
  SET status = 'completed',
      completed_at = COALESCE(completed_at, NOW()),
      updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING id::text;
`;

export const SELECT_PRACTICE_SESSION_SUMMARY_SQL = `
  SELECT jsonb_build_object(
    'skillSummaries', COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'skillDimension', evidence.skill_dimension,
            'evidenceCount', evidence.evidence_count,
            'averageScore', evidence.average_score,
            'estimate', state.estimate,
            'confidence', state.confidence
          )
          ORDER BY evidence.skill_dimension
        )
        FROM (
          SELECT
            mastery.skill_dimension,
            COUNT(*)::integer AS evidence_count,
            ROUND(AVG(mastery.score)::numeric, 3)::float8 AS average_score
          FROM mastery_evidence mastery
          JOIN exercise_instances exercise
            ON exercise.id = mastery.exercise_instance_id
          WHERE exercise.practice_session_id = $1::uuid
          GROUP BY mastery.skill_dimension
        ) evidence
        JOIN practice_sessions session ON session.id = $1::uuid
        JOIN learner_skill_states state
          ON state.user_id = session.user_id
         AND state.grammar_point_id = session.focus_grammar_point_id
         AND state.skill_dimension = evidence.skill_dimension
      ),
      '[]'::jsonb
    )
  ) AS summary;
`;
