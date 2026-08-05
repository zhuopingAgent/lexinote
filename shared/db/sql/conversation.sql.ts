const SESSION_COLUMNS = `
  id::text,
  title,
  mode,
  summary,
  summary_through_at,
  title_is_manual,
  created_at,
  updated_at
`;

const ANALYSIS_COLUMNS = `
  id::text,
  session_id::text,
  message_id::text,
  revision,
  status,
  focus,
  instruction,
  overview,
  is_current,
  lease_token::text,
  model_name,
  error_code,
  error_message,
  created_at,
  updated_at,
  completed_at
`;

const MESSAGE_COLUMNS = `
  id::text,
  session_id::text,
  role,
  content,
  mode,
  status,
  parent_message_id::text,
  model_name,
  error_code,
  error_message,
  created_at,
  updated_at,
  completed_at
`;

const MEMORY_COLUMNS = `
  id::text,
  session_id::text,
  scope,
  kind,
  content,
  status,
  source_message_id::text,
  created_at,
  updated_at
`;

const LEARNING_ITEM_COLUMNS = `
  id::text,
  session_id::text,
  source_message_id::text,
  analysis_id::text,
  kind,
  surface_form,
  reading,
  meaning_zh,
  explanation_zh,
  source_excerpt,
  status,
  grammar_candidates,
  word_id,
  grammar_point_id::text,
  collection_id,
  error_message,
  created_at,
  updated_at
`;

const LEARNING_ITEM_SURFACE_KEY = `
  CASE
    WHEN kind = 'grammar' THEN LOWER(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REPLACE(REPLACE(BTRIM(surface_form), '～', '〜'), '~', '〜'),
          '\\s+',
          '',
          'g'
        ),
        '^〜+',
        ''
      )
    )
    ELSE LOWER(REGEXP_REPLACE(BTRIM(surface_form), '\\s+', ' ', 'g'))
  END
`;

const LEARNING_ITEM_MEANING_KEY = `
  LOWER(REGEXP_REPLACE(BTRIM(meaning_zh), '\\s+', ' ', 'g'))
`;

export const LIST_CONVERSATION_SESSIONS_SQL = `
  WITH cursor_session AS (
    SELECT updated_at, id
    FROM conversation_sessions
    WHERE id = $4::uuid
      AND user_id = $1::uuid
  )
  SELECT ${SESSION_COLUMNS}
  FROM conversation_sessions
  WHERE user_id = $1::uuid
    AND ($2::text = '' OR title ILIKE $2::text)
    AND (
      $4::uuid IS NULL
      OR (
        EXISTS (SELECT 1 FROM cursor_session)
        AND (updated_at, id) < (
          SELECT updated_at, id
          FROM cursor_session
        )
      )
      OR (
        NOT EXISTS (SELECT 1 FROM cursor_session)
        AND (updated_at, id) < ($3::timestamptz, $4::uuid)
      )
    )
  ORDER BY updated_at DESC, id DESC
  LIMIT $5;
`;

export const SELECT_CONVERSATION_SESSION_SQL = `
  SELECT ${SESSION_COLUMNS}
  FROM conversation_sessions
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  LIMIT 1;
`;

export const INSERT_CONVERSATION_SESSION_SQL = `
  INSERT INTO conversation_sessions (user_id, mode)
  VALUES ($1::uuid, $2::text)
  RETURNING ${SESSION_COLUMNS};
`;

export const UPDATE_CONVERSATION_SESSION_SQL = `
  UPDATE conversation_sessions
  SET
    title = $3::text,
    mode = $4::text,
    title_is_manual = $5::boolean,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${SESSION_COLUMNS};
`;

export const DELETE_CONVERSATION_SESSION_SQL = `
  WITH removed_memory_suggestions AS (
    DELETE FROM conversation_memories
    WHERE user_id = $2::uuid
      AND status <> 'active'
      AND source_message_id IN (
        SELECT id
        FROM conversation_messages
        WHERE session_id = $1::uuid
          AND user_id = $2::uuid
      )
    RETURNING id
  ),
  removed_suggestions AS (
    DELETE FROM conversation_learning_items
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND status IN ('suggested', 'needs_review', 'dismissed', 'failed')
    RETURNING id
  ),
  deleted_session AS (
    DELETE FROM conversation_sessions
    WHERE id = $1::uuid
      AND user_id = $2::uuid
      AND (SELECT COUNT(*) FROM removed_memory_suggestions) >= 0
      AND (SELECT COUNT(*) FROM removed_suggestions) >= 0
    RETURNING id
  )
  SELECT id::text
  FROM deleted_session;
`;

export const UPSERT_DEFAULT_CONVERSATION_PREFERENCES_SQL = `
  INSERT INTO conversation_preferences (user_id)
  VALUES ($1::uuid)
  ON CONFLICT (user_id) DO NOTHING;
`;

export const SELECT_CONVERSATION_PREFERENCES_SQL = `
  SELECT
    default_mode,
    translation_style,
    default_register,
    default_collection_id
  FROM conversation_preferences
  WHERE user_id = $1::uuid
  LIMIT 1;
`;

export const UPDATE_CONVERSATION_PREFERENCES_SQL = `
  UPDATE conversation_preferences
  SET
    default_mode = CASE
      WHEN $2::boolean THEN $3::text
      ELSE default_mode
    END,
    default_register = CASE
      WHEN $4::boolean THEN $5::text
      ELSE default_register
    END,
    default_collection_id = CASE
      WHEN $6::boolean THEN $7::bigint
      ELSE default_collection_id
    END,
    updated_at = NOW()
  WHERE user_id = $1::uuid
  RETURNING
    default_mode,
    translation_style,
    default_register,
    default_collection_id;
`;

export const LIST_CONVERSATION_MESSAGES_SQL = `
  WITH cursor_message AS (
    SELECT created_at, id
    FROM conversation_messages
    WHERE id = $4::uuid
      AND session_id = $1::uuid
      AND user_id = $2::uuid
  )
  SELECT *
  FROM (
    SELECT ${MESSAGE_COLUMNS}
    FROM conversation_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND (
        $4::uuid IS NULL
        OR (
          EXISTS (SELECT 1 FROM cursor_message)
          AND (created_at, id) < (
            SELECT created_at, id
            FROM cursor_message
          )
        )
        OR (
          NOT EXISTS (SELECT 1 FROM cursor_message)
          AND (created_at, id) < ($3::timestamptz, $4::uuid)
        )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT $5
  ) recent_messages
  ORDER BY created_at ASC, id ASC;
`;

export const LIST_CONVERSATION_CONTEXT_MESSAGES_SQL = `
  WITH boundary_message AS (
    SELECT created_at, id
    FROM conversation_messages
    WHERE id = $4::uuid
      AND session_id = $1::uuid
      AND user_id = $2::uuid
  )
  SELECT *
  FROM (
    SELECT ${MESSAGE_COLUMNS}
    FROM conversation_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND status = 'completed'
      AND (
        $4::uuid IS NULL
        OR (created_at, id) <= (
          SELECT created_at, id
          FROM boundary_message
        )
      )
    ORDER BY created_at DESC, id DESC
    LIMIT $3
  ) context_messages
  ORDER BY created_at ASC, id ASC;
`;

export const SELECT_CONVERSATION_MESSAGE_SQL = `
  SELECT ${MESSAGE_COLUMNS}
  FROM conversation_messages
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  LIMIT 1;
`;

export const SELECT_CONVERSATION_MESSAGE_BY_CLIENT_ID_SQL = `
  SELECT ${MESSAGE_COLUMNS}
  FROM conversation_messages
  WHERE session_id = $1::uuid
    AND user_id = $2::uuid
    AND client_message_id = $3::text
  LIMIT 1;
`;

export const INSERT_USER_CONVERSATION_MESSAGE_SQL = `
  INSERT INTO conversation_messages (
    session_id,
    user_id,
    role,
    content,
    mode,
    status,
    client_message_id,
    completed_at
  )
  VALUES ($1::uuid, $2::uuid, 'user', $3::text, $4::text, 'completed', $5::text, NOW())
  ON CONFLICT (session_id, client_message_id) DO NOTHING
  RETURNING ${MESSAGE_COLUMNS};
`;

export const INSERT_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  INSERT INTO conversation_messages (
    session_id,
    user_id,
    role,
    mode,
    status,
    parent_message_id,
    model_name,
    client_message_id
  )
  VALUES ($1::uuid, $2::uuid, 'assistant', $3::text, 'streaming', $4::uuid, $5::text, $6::text)
  ON CONFLICT (session_id, client_message_id) DO NOTHING
  RETURNING ${MESSAGE_COLUMNS};
`;

export const RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  UPDATE conversation_messages
  SET
    content = '',
    mode = $3::text,
    status = 'streaming',
    model_name = $4::text,
    error_code = NULL,
    error_message = NULL,
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
    AND role = 'assistant'
    AND status IN ('failed', 'cancelled')
  RETURNING ${MESSAGE_COLUMNS};
`;

export const COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  WITH completed_message AS (
    UPDATE conversation_messages
    SET
      content = $3::text,
      status = 'completed',
      error_code = NULL,
      error_message = NULL,
      completed_at = NOW(),
      updated_at = NOW()
    WHERE id = $1::uuid
      AND user_id = $2::uuid
      AND status = 'streaming'
    RETURNING *
  ),
  touched_session AS (
    UPDATE conversation_sessions
    SET updated_at = NOW()
    WHERE id IN (SELECT session_id FROM completed_message)
      AND user_id = $2::uuid
    RETURNING id
  )
  SELECT ${MESSAGE_COLUMNS}
  FROM completed_message
  WHERE (SELECT COUNT(*) FROM touched_session) >= 0;
`;

export const INSERT_CONVERSATION_ANALYSIS_SQL = `
  WITH target_message AS (
    SELECT message.id, message.session_id
    FROM conversation_messages message
    JOIN conversation_sessions session ON session.id = message.session_id
    WHERE message.id = $2::uuid
      AND message.session_id = $1::uuid
      AND message.user_id = $3::uuid
      AND session.user_id = $3::uuid
      AND message.role = 'assistant'
      AND message.status = 'completed'
  ),
  created_analysis AS (
    INSERT INTO conversation_analyses (
      user_id,
      session_id,
      message_id,
      client_analysis_id,
      focus,
      instruction,
      model_name,
      lease_token
    )
    SELECT
      $3::uuid,
      session_id,
      id,
      $4::text,
      $5::text,
      $6::text,
      $7::text,
      $8::uuid
    FROM target_message
    ON CONFLICT (session_id, client_analysis_id) DO NOTHING
    RETURNING ${ANALYSIS_COLUMNS}
  )
  SELECT ${ANALYSIS_COLUMNS}
  FROM created_analysis;
`;

export const SELECT_CONVERSATION_ANALYSIS_BY_CLIENT_ID_SQL = `
  SELECT ${ANALYSIS_COLUMNS}
  FROM conversation_analyses
  WHERE session_id = $1::uuid
    AND user_id = $2::uuid
    AND client_analysis_id = $3::text
  LIMIT 1;
`;

export const LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL = `
  SELECT message.id::text
  FROM conversation_messages message
  JOIN conversation_analyses analysis ON analysis.message_id = message.id
  WHERE analysis.id = $1::uuid
    AND analysis.user_id = $2::uuid
    AND analysis.status = 'running'
    AND analysis.lease_token = $3::uuid
  FOR UPDATE OF message;
`;

export const RECLAIM_CONVERSATION_ANALYSIS_SQL = `
  WITH locked_message AS (
    SELECT message.id
    FROM conversation_messages message
    JOIN conversation_analyses analysis ON analysis.message_id = message.id
    WHERE analysis.session_id = $1::uuid
      AND analysis.message_id = $2::uuid
      AND analysis.user_id = $3::uuid
      AND analysis.client_analysis_id = $4::text
      AND (
        analysis.status = 'failed'
        OR (
          analysis.status = 'running'
          AND analysis.locked_at < NOW() - INTERVAL '5 minutes'
        )
      )
    FOR UPDATE OF message
  ),
  reclaimed_analysis AS (
    UPDATE conversation_analyses
    SET status = 'running',
        is_current = FALSE,
        lease_token = $5::uuid,
        error_code = NULL,
        error_message = NULL,
        locked_at = NOW(),
        completed_at = NULL,
        updated_at = NOW()
    WHERE session_id = $1::uuid
      AND message_id = $2::uuid
      AND user_id = $3::uuid
      AND client_analysis_id = $4::text
      AND message_id IN (SELECT id FROM locked_message)
      AND (
        status = 'failed'
        OR (
          status = 'running'
          AND locked_at < NOW() - INTERVAL '5 minutes'
        )
      )
    RETURNING ${ANALYSIS_COLUMNS}
  ),
  removed_items AS (
    DELETE FROM conversation_learning_items
    WHERE analysis_id IN (SELECT id::uuid FROM reclaimed_analysis)
      AND user_id = $3::uuid
      AND status IN ('suggested', 'needs_review', 'failed')
    RETURNING id
  )
  SELECT ${ANALYSIS_COLUMNS}
  FROM reclaimed_analysis
  WHERE (SELECT COUNT(*) FROM removed_items) >= 0;
`;

export const LIST_CONVERSATION_ANALYSES_SQL = `
  WITH ranked_analyses AS (
    SELECT
      ${ANALYSIS_COLUMNS},
      ROW_NUMBER() OVER (
        PARTITION BY message_id
        ORDER BY revision DESC
      ) AS latest_rank
    FROM conversation_analyses
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
  )
  SELECT ${ANALYSIS_COLUMNS}
  FROM ranked_analyses
  WHERE is_current OR latest_rank = 1
  ORDER BY revision ASC;
`;

export const COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL = `
  WITH locked_message AS (
    SELECT message.id
    FROM conversation_messages message
    JOIN conversation_analyses analysis ON analysis.message_id = message.id
    WHERE analysis.id = $1::uuid
      AND analysis.user_id = $2::uuid
      AND analysis.status = 'running'
      AND analysis.lease_token = $3::uuid
    FOR UPDATE OF message
  ),
  target_analysis AS (
    SELECT id, message_id
    FROM conversation_analyses
    WHERE id = $1::uuid
      AND user_id = $2::uuid
      AND status = 'running'
      AND lease_token = $3::uuid
      AND message_id IN (SELECT id FROM locked_message)
    FOR UPDATE
  ),
  dismissed_items AS (
    UPDATE conversation_learning_items
    SET status = 'dismissed', updated_at = NOW()
    WHERE user_id = $2::uuid
      AND source_message_id IN (SELECT message_id FROM target_analysis)
      AND analysis_id IS DISTINCT FROM $1::uuid
      AND status IN ('suggested', 'needs_review')
      AND (
        analysis_id IS NULL
        OR analysis_id IN (
          SELECT previous.id
          FROM conversation_analyses previous
          WHERE previous.message_id IN (SELECT message_id FROM target_analysis)
            AND previous.status IN ('completed', 'failed')
        )
      )
    RETURNING id
  ),
  superseded_analyses AS (
    UPDATE conversation_analyses
    SET is_current = FALSE, updated_at = NOW()
    WHERE user_id = $2::uuid
      AND message_id IN (SELECT message_id FROM target_analysis)
      AND id <> $1::uuid
      AND is_current
    RETURNING id
  ),
  completed_analysis AS (
  UPDATE conversation_analyses
  SET status = 'completed',
      overview = $4::text,
      is_current = TRUE,
      error_code = NULL,
      error_message = NULL,
      completed_at = NOW(),
      updated_at = NOW()
  WHERE id IN (SELECT id FROM target_analysis)
    AND user_id = $2::uuid
    AND status = 'running'
    AND lease_token = $3::uuid
    AND (SELECT COUNT(*) FROM dismissed_items) >= 0
    AND (SELECT COUNT(*) FROM superseded_analyses) >= 0
  RETURNING ${ANALYSIS_COLUMNS}
  )
  SELECT ${ANALYSIS_COLUMNS}
  FROM completed_analysis;
`;

export const FAIL_CONVERSATION_ANALYSIS_RECORD_SQL = `
  WITH locked_message AS (
    SELECT message.id
    FROM conversation_messages message
    JOIN conversation_analyses analysis ON analysis.message_id = message.id
    WHERE analysis.id = $1::uuid
      AND analysis.user_id = $2::uuid
      AND analysis.status = 'running'
      AND analysis.lease_token = $3::uuid
    FOR UPDATE OF message
  ),
  target_analysis AS (
    SELECT id, message_id
    FROM conversation_analyses
    WHERE id = $1::uuid
      AND user_id = $2::uuid
      AND status = 'running'
      AND lease_token = $3::uuid
      AND message_id IN (SELECT id FROM locked_message)
    FOR UPDATE
  ),
  removed_items AS (
    DELETE FROM conversation_learning_items
    WHERE analysis_id IN (SELECT id FROM target_analysis)
      AND user_id = $2::uuid
      AND status IN ('suggested', 'needs_review', 'failed')
    RETURNING id
  ),
  failed_analysis AS (
    UPDATE conversation_analyses
    SET status = 'failed',
        is_current = FALSE,
        error_code = $4::text,
        error_message = $5::text,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id IN (SELECT id FROM target_analysis)
      AND user_id = $2::uuid
      AND status = 'running'
      AND lease_token = $3::uuid
      AND (SELECT COUNT(*) FROM removed_items) >= 0
    RETURNING ${ANALYSIS_COLUMNS}
  )
  SELECT ${ANALYSIS_COLUMNS}
  FROM failed_analysis;
`;

export const FAIL_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  UPDATE conversation_messages
  SET
    content = $3::text,
    status = $4::text,
    error_code = $5::text,
    error_message = $6::text,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
    AND status = 'streaming'
  RETURNING ${MESSAGE_COLUMNS};
`;

export const SAVE_CONVERSATION_MAINTENANCE_SQL = `
  WITH advanced_session AS (
    UPDATE conversation_sessions
    SET
    summary = $3::text,
    title = CASE
      WHEN title_is_manual OR summary_updated_at IS NOT NULL OR $4::text = ''
        THEN title
      ELSE $4::text
    END,
    summary_updated_at = NOW(),
    summary_through_at = $5::timestamptz,
    updated_at = NOW()
    WHERE id = $1::uuid
      AND user_id = $2::uuid
      AND (summary_through_at IS NULL OR summary_through_at < $5::timestamptz)
    RETURNING ${SESSION_COLUMNS}
  ),
  memory_input AS (
    SELECT
      candidate.scope,
      candidate.kind,
      BTRIM(candidate.content) AS content
    FROM JSONB_TO_RECORDSET($7::jsonb) AS candidate(
      scope TEXT,
      kind TEXT,
      content TEXT
    )
    WHERE candidate.scope IN ('global', 'session')
      AND candidate.kind IN ('preference', 'context', 'goal')
      AND BTRIM(candidate.content) <> ''
  ),
  inserted_memories AS (
    INSERT INTO conversation_memories (
      user_id,
      session_id,
      scope,
      kind,
      content,
      status,
      source_message_id
    )
    SELECT
      $2::uuid,
      CASE WHEN memory_input.scope = 'session' THEN $1::uuid ELSE NULL END,
      memory_input.scope,
      memory_input.kind,
      memory_input.content,
      'suggested',
      $6::uuid
    FROM memory_input
    WHERE EXISTS (SELECT 1 FROM advanced_session)
      AND NOT EXISTS (
        SELECT 1
        FROM conversation_memories existing
        WHERE existing.user_id = $2::uuid
          AND LOWER(BTRIM(existing.content)) = LOWER(memory_input.content)
          AND (
            (memory_input.scope = 'global' AND existing.scope = 'global')
            OR (
              memory_input.scope = 'session'
              AND existing.scope = 'session'
              AND existing.session_id = $1::uuid
            )
          )
      )
    RETURNING ${MEMORY_COLUMNS}
  )
  SELECT
    advanced_session.*,
    COALESCE(
      (SELECT JSONB_AGG(TO_JSONB(inserted_memories)) FROM inserted_memories),
      '[]'::jsonb
    ) AS memories
  FROM advanced_session;
`;

export const LIST_CONVERSATION_MEMORIES_SQL = `
  SELECT ${MEMORY_COLUMNS}
  FROM conversation_memories
  WHERE user_id = $1::uuid
    AND (
      ($2::uuid IS NULL AND scope = 'global')
      OR session_id = $2::uuid
    )
  ORDER BY
    CASE status WHEN 'suggested' THEN 0 WHEN 'active' THEN 1 ELSE 2 END,
    updated_at DESC;
`;

export const LIST_ACTIVE_CONVERSATION_MEMORIES_SQL = `
  SELECT ${MEMORY_COLUMNS}
  FROM conversation_memories
  WHERE user_id = $1::uuid
    AND status = 'active'
    AND (
      (scope = 'global' AND session_id IS NULL)
      OR (scope = 'session' AND session_id = $2::uuid)
    )
  ORDER BY scope ASC, updated_at DESC;
`;

export const SELECT_CONVERSATION_MEMORY_SQL = `
  SELECT ${MEMORY_COLUMNS}
  FROM conversation_memories
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  LIMIT 1;
`;

export const INSERT_CONVERSATION_MEMORY_SQL = `
  INSERT INTO conversation_memories (
    user_id,
    session_id,
    scope,
    kind,
    content,
    status,
    source_message_id
  )
  VALUES ($1::uuid, $2::uuid, $3::text, $4::text, $5::text, $6::text, $7::uuid)
  RETURNING ${MEMORY_COLUMNS};
`;

export const UPDATE_CONVERSATION_MEMORY_SQL = `
  UPDATE conversation_memories
  SET
    content = $3::text,
    status = $4::text,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${MEMORY_COLUMNS};
`;

export const DELETE_CONVERSATION_MEMORY_SQL = `
  DELETE FROM conversation_memories
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING id::text;
`;

export const INSERT_CONVERSATION_LEARNING_ITEM_SQL = `
  WITH target_analysis AS (
    SELECT id, session_id, message_id
    FROM conversation_analyses
    WHERE id = $4::uuid
      AND user_id = $1::uuid
      AND session_id = $2::uuid
      AND message_id = $3::uuid
      AND status = 'running'
      AND lease_token = $13::uuid
    FOR SHARE
  )
  INSERT INTO conversation_learning_items (
    user_id,
    session_id,
    source_message_id,
    analysis_id,
    kind,
    surface_form,
    reading,
    meaning_zh,
    explanation_zh,
    source_excerpt,
    status,
    grammar_candidates
  )
  SELECT
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4::uuid,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::text,
    $10::text,
    $11::text,
    $12::jsonb
  FROM target_analysis
  RETURNING ${LEARNING_ITEM_COLUMNS};
`;

export const LIST_CONVERSATION_LEARNING_ITEMS_SQL = `
  WITH ranked_learning_items AS (
    SELECT
      ${LEARNING_ITEM_COLUMNS},
      ROW_NUMBER() OVER (
        PARTITION BY
          kind,
          ${LEARNING_ITEM_SURFACE_KEY},
          ${LEARNING_ITEM_MEANING_KEY}
        ORDER BY
          CASE status WHEN 'saved' THEN 0 ELSE 1 END,
          created_at DESC,
          id DESC
      ) AS duplicate_rank
    FROM conversation_learning_items
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND (
        analysis_id IS NULL
        OR status = 'saved'
        OR analysis_id IN (
          SELECT id FROM conversation_analyses WHERE is_current
        )
      )
  )
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM ranked_learning_items
  WHERE duplicate_rank = 1
  ORDER BY created_at ASC, id ASC;
`;

export const LIST_CONVERSATION_LEARNING_ITEMS_BY_ANALYSIS_SQL = `
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM conversation_learning_items
  WHERE analysis_id = $1::uuid
    AND user_id = $2::uuid
  ORDER BY created_at ASC, id ASC;
`;

export const LIST_CONVERSATION_REVIEW_INBOX_SQL = `
  WITH ranked_learning_items AS (
    SELECT
      ${LEARNING_ITEM_COLUMNS},
      ROW_NUMBER() OVER (
        PARTITION BY
          session_id,
          kind,
          ${LEARNING_ITEM_SURFACE_KEY},
          ${LEARNING_ITEM_MEANING_KEY}
        ORDER BY created_at DESC, id DESC
      ) AS duplicate_rank
    FROM conversation_learning_items
    WHERE user_id = $1::uuid
      AND kind = 'grammar'
      AND (
        analysis_id IS NULL
        OR analysis_id IN (
          SELECT id FROM conversation_analyses WHERE is_current
        )
      )
  )
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM ranked_learning_items
  WHERE duplicate_rank = 1
    AND status IN ('needs_review', 'failed')
  ORDER BY created_at DESC, id DESC
  LIMIT 100;
`;

export const SELECT_CONVERSATION_LEARNING_ITEM_SQL = `
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM conversation_learning_items
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  LIMIT 1;
`;

export const UPDATE_CONVERSATION_LEARNING_ITEM_SQL = `
  UPDATE conversation_learning_items
  SET
    status = $3::text,
    word_id = $4::bigint,
    grammar_point_id = $5::uuid,
    collection_id = $6::bigint,
    error_message = $7::text,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${LEARNING_ITEM_COLUMNS};
`;
