const SELECT_COLLECTION_SUMMARY_COLUMNS_SQL = `
  SELECT
    c.collection_id,
    c.name,
    c.description,
    c.created_at,
    c.auto_filter_enabled,
    c.auto_filter_criteria,
    c.auto_filter_sync_status,
    c.auto_filter_last_run_at,
    c.auto_filter_last_error,
    c.auto_filter_rule_version,
    c.auto_filter_last_synced_rule_version,
    COUNT(cw.word_id)::integer AS word_count
`;

export const LIST_COLLECTIONS_SQL = `
  ${SELECT_COLLECTION_SUMMARY_COLUMNS_SQL}
  FROM collections c
  LEFT JOIN collection_words cw
    ON cw.collection_id = c.collection_id
  GROUP BY c.collection_id
  ORDER BY c.created_at DESC, c.collection_id DESC
`;

export const SELECT_COLLECTION_BY_ID_SQL = `
  ${SELECT_COLLECTION_SUMMARY_COLUMNS_SQL}
  FROM collections c
  LEFT JOIN collection_words cw
    ON cw.collection_id = c.collection_id
  WHERE c.collection_id = $1
  GROUP BY c.collection_id
  LIMIT 1
`;

export const SELECT_COLLECTION_WORDS_BY_COLLECTION_ID_SQL = `
  SELECT
    jde.word_id,
    jde.word,
    jde.pronunciation,
    jde.meaning_zh,
    jde.part_of_speech,
    cw.source,
    cw.matched_rule_version
  FROM collection_words cw
  JOIN japanese_dictionary_entries jde
    ON jde.word_id = cw.word_id
  WHERE cw.collection_id = $1
  ORDER BY cw.sort_order ASC NULLS LAST, cw.added_at ASC, jde.word_id ASC
`;

export const SELECT_COLLECTION_RECORD_BY_NAME_SQL = `
  SELECT
    collection_id,
    name,
    description,
    auto_filter_enabled,
    auto_filter_criteria,
    auto_filter_sync_status,
    auto_filter_last_run_at,
    auto_filter_last_error,
    auto_filter_rule_version,
    auto_filter_last_synced_rule_version,
    created_at
  FROM collections
  WHERE LOWER(BTRIM(name)) = LOWER(BTRIM($1))
  LIMIT 1
`;

export const LIST_AUTO_FILTER_COLLECTIONS_SQL = `
  SELECT
    collection_id,
    name,
    auto_filter_criteria,
    auto_filter_rule_version
  FROM collections
  WHERE auto_filter_enabled = TRUE
    AND BTRIM(auto_filter_criteria) <> ''
  ORDER BY collection_id ASC
`;

export const INSERT_COLLECTION_SQL = `
  INSERT INTO collections (
    name,
    description
  )
  VALUES ($1, $2)
  RETURNING collection_id
`;

export const UPDATE_COLLECTION_SQL = `
  UPDATE collections
  SET
    name = $2,
    description = $3,
    auto_filter_enabled = $4,
    auto_filter_criteria = $5,
    auto_filter_sync_status = $6,
    auto_filter_last_run_at = $7,
    auto_filter_last_error = $8,
    auto_filter_rule_version = $9,
    auto_filter_last_synced_rule_version = $10
  WHERE collection_id = $1
  RETURNING collection_id
`;

export const UPDATE_COLLECTION_AUTO_FILTER_STATUS_SQL = `
  UPDATE collections
  SET
    auto_filter_sync_status = $2,
    auto_filter_last_run_at = $3,
    auto_filter_last_error = $4,
    auto_filter_last_synced_rule_version = $5
  WHERE collection_id = $1
  RETURNING collection_id
`;

export const DELETE_COLLECTION_SQL = `
  DELETE FROM collections
  WHERE collection_id = $1
`;

export const INSERT_COLLECTION_WORD_SQL = `
  INSERT INTO collection_words (
    collection_id,
    word_id,
    source,
    matched_rule_version
  )
  VALUES ($1, $2, 'manual', NULL)
  ON CONFLICT (collection_id, word_id) DO NOTHING
  RETURNING word_id
`;

export const INSERT_COLLECTION_WORDS_SQL = `
  WITH selected_word_ids AS (
    SELECT DISTINCT UNNEST($2::bigint[]) AS word_id
  )
  INSERT INTO collection_words (
    collection_id,
    word_id,
    source,
    matched_rule_version
  )
  SELECT
    $1,
    jde.word_id,
    'manual',
    NULL
  FROM japanese_dictionary_entries jde
  JOIN selected_word_ids
    ON selected_word_ids.word_id = jde.word_id
  ON CONFLICT (collection_id, word_id) DO NOTHING
  RETURNING word_id
`;

export const INSERT_WORD_INTO_COLLECTIONS_SQL = `
  WITH selected_collection_ids AS (
    SELECT DISTINCT UNNEST($1::bigint[]) AS collection_id
  )
  INSERT INTO collection_words (
    collection_id,
    word_id,
    source,
    matched_rule_version
  )
  SELECT
    c.collection_id,
    $2,
    'auto',
    c.auto_filter_rule_version
  FROM collections c
  JOIN selected_collection_ids
    ON selected_collection_ids.collection_id = c.collection_id
  ON CONFLICT (collection_id, word_id) DO UPDATE
  SET
    matched_rule_version = EXCLUDED.matched_rule_version
  WHERE collection_words.source = 'auto'
  RETURNING collection_id
`;

export const REPLACE_COLLECTION_AUTO_WORDS_SQL = `
  WITH selected_word_ids AS (
    SELECT DISTINCT UNNEST($3::bigint[]) AS word_id
  ),
  deleted_auto_words AS (
    DELETE FROM collection_words
    WHERE collection_id = $1
      AND source = 'auto'
  )
  INSERT INTO collection_words (
    collection_id,
    word_id,
    source,
    matched_rule_version
  )
  SELECT
    $1,
    jde.word_id,
    'auto',
    $2
  FROM japanese_dictionary_entries jde
  JOIN selected_word_ids
    ON selected_word_ids.word_id = jde.word_id
  ON CONFLICT (collection_id, word_id) DO NOTHING
  RETURNING word_id
`;

export const CLEAR_COLLECTION_AUTO_WORDS_SQL = `
  DELETE FROM collection_words
  WHERE collection_id = $1
    AND source = 'auto'
`;

export const DELETE_COLLECTION_WORD_SQL = `
  DELETE FROM collection_words
  WHERE collection_id = $1
    AND word_id = $2
  RETURNING word_id
`;
