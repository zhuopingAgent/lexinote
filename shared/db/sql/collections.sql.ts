const SELECT_COLLECTION_SUMMARY_COLUMNS_SQL = `
  SELECT
    c.collection_id,
    c.name,
    c.description,
    c.created_at,
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
    jde.part_of_speech
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
    created_at
  FROM collections
  WHERE name = $1
  LIMIT 1
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
    description = $3
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
    word_id
  )
  VALUES ($1, $2)
  ON CONFLICT (collection_id, word_id) DO NOTHING
  RETURNING word_id
`;

export const INSERT_COLLECTION_WORDS_SQL = `
  WITH selected_word_ids AS (
    SELECT DISTINCT UNNEST($2::bigint[]) AS word_id
  )
  INSERT INTO collection_words (
    collection_id,
    word_id
  )
  SELECT
    $1,
    jde.word_id
  FROM japanese_dictionary_entries jde
  JOIN selected_word_ids
    ON selected_word_ids.word_id = jde.word_id
  ON CONFLICT (collection_id, word_id) DO NOTHING
  RETURNING word_id
`;
