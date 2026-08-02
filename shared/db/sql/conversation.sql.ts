const SESSION_COLUMNS = `
  id::text,
  title,
  mode,
  summary,
  title_is_manual,
  created_at,
  updated_at
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
  details,
  analysis_status,
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

export const LIST_CONVERSATION_SESSIONS_SQL = `
  SELECT ${SESSION_COLUMNS}
  FROM conversation_sessions
  WHERE user_id = $1::uuid
    AND ($2::text = '' OR title ILIKE $2::text)
    AND (
      $3::timestamptz IS NULL
      OR (updated_at, id) < ($3::timestamptz, $4::uuid)
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

export const TOUCH_CONVERSATION_SESSION_SQL = `
  UPDATE conversation_sessions
  SET updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid;
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
  SELECT *
  FROM (
    SELECT ${MESSAGE_COLUMNS}
    FROM conversation_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND (
        $3::timestamptz IS NULL
        OR (created_at, id) < ($3::timestamptz, $4::uuid)
      )
    ORDER BY created_at DESC, id DESC
    LIMIT $5
  ) recent_messages
  ORDER BY created_at ASC, id ASC;
`;

export const LIST_CONVERSATION_CONTEXT_MESSAGES_SQL = `
  SELECT *
  FROM (
    SELECT ${MESSAGE_COLUMNS}
    FROM conversation_messages
    WHERE session_id = $1::uuid
      AND user_id = $2::uuid
      AND status IN ('completed', 'cancelled')
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
    analysis_status,
    client_message_id
  )
  VALUES ($1::uuid, $2::uuid, 'assistant', $3::text, 'streaming', $4::uuid, $5::text, 'not_requested', $6::text)
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
    details = '{}'::jsonb,
    analysis_status = 'not_requested',
    analysis_locked_at = NULL,
    completed_at = NULL,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
    AND role = 'assistant'
    AND status IN ('failed', 'cancelled')
  RETURNING ${MESSAGE_COLUMNS};
`;

export const COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  UPDATE conversation_messages
  SET
    content = $3::text,
    status = 'completed',
    analysis_status = 'pending',
    error_code = NULL,
    error_message = NULL,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${MESSAGE_COLUMNS};
`;

export const FAIL_ASSISTANT_CONVERSATION_MESSAGE_SQL = `
  UPDATE conversation_messages
  SET
    content = $3::text,
    status = $4::text,
    analysis_status = 'not_requested',
    error_code = $5::text,
    error_message = $6::text,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${MESSAGE_COLUMNS};
`;

export const CLAIM_CONVERSATION_ANALYSIS_SQL = `
  UPDATE conversation_messages
  SET
    analysis_status = 'running',
    analysis_locked_at = NOW(),
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
    AND role = 'assistant'
    AND status = 'completed'
    AND (
      analysis_status IN ('pending', 'failed')
      OR (
        analysis_status = 'running'
        AND analysis_locked_at < NOW() - INTERVAL '5 minutes'
      )
    )
  RETURNING ${MESSAGE_COLUMNS};
`;

export const COMPLETE_CONVERSATION_ANALYSIS_SQL = `
  UPDATE conversation_messages
  SET
    details = $3::jsonb,
    analysis_status = 'completed',
    analysis_locked_at = NULL,
    error_code = NULL,
    error_message = NULL,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${MESSAGE_COLUMNS};
`;

export const FAIL_CONVERSATION_ANALYSIS_SQL = `
  UPDATE conversation_messages
  SET
    analysis_status = 'failed',
    analysis_locked_at = NULL,
    error_code = $3::text,
    error_message = $4::text,
    updated_at = NOW()
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${MESSAGE_COLUMNS};
`;

export const UPDATE_CONVERSATION_SUMMARY_SQL = `
  UPDATE conversation_sessions
  SET
    summary = CASE
      WHEN summary_through_at IS NULL OR summary_through_at <= $5::timestamptz
        THEN $3::text
      ELSE summary
    END,
    title = CASE
      WHEN summary_through_at IS NOT NULL AND summary_through_at > $5::timestamptz
        THEN title
      WHEN title_is_manual OR summary_updated_at IS NOT NULL OR $4::text = ''
        THEN title
      ELSE $4::text
    END,
    summary_updated_at = CASE
      WHEN summary_through_at IS NULL OR summary_through_at <= $5::timestamptz
        THEN NOW()
      ELSE summary_updated_at
    END,
    summary_through_at = CASE
      WHEN summary_through_at IS NULL OR summary_through_at <= $5::timestamptz
        THEN $5::timestamptz
      ELSE summary_through_at
    END,
    updated_at = CASE
      WHEN summary_through_at IS NULL OR summary_through_at <= $5::timestamptz
        THEN NOW()
      ELSE updated_at
    END
  WHERE id = $1::uuid
    AND user_id = $2::uuid
  RETURNING ${SESSION_COLUMNS};
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

export const DELETE_ANALYSIS_SUGGESTIONS_SQL = `
  WITH removed_memories AS (
    DELETE FROM conversation_memories
    WHERE source_message_id = $1::uuid
      AND user_id = $2::uuid
      AND status = 'suggested'
  )
  DELETE FROM conversation_learning_items
  WHERE source_message_id = $1::uuid
    AND user_id = $2::uuid
    AND status IN ('suggested', 'needs_review');
`;

export const INSERT_CONVERSATION_LEARNING_ITEM_SQL = `
  INSERT INTO conversation_learning_items (
    user_id,
    session_id,
    source_message_id,
    kind,
    surface_form,
    reading,
    meaning_zh,
    explanation_zh,
    source_excerpt,
    status,
    grammar_candidates
  )
  VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    $4::text,
    $5::text,
    $6::text,
    $7::text,
    $8::text,
    $9::text,
    $10::text,
    $11::jsonb
  )
  RETURNING ${LEARNING_ITEM_COLUMNS};
`;

export const LIST_CONVERSATION_LEARNING_ITEMS_SQL = `
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM conversation_learning_items
  WHERE session_id = $1::uuid
    AND user_id = $2::uuid
    AND status <> 'dismissed'
  ORDER BY created_at ASC, id ASC;
`;

export const LIST_CONVERSATION_REVIEW_INBOX_SQL = `
  SELECT ${LEARNING_ITEM_COLUMNS}
  FROM conversation_learning_items
  WHERE user_id = $1::uuid
    AND kind = 'grammar'
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
