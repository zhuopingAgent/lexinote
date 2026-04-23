const SELECT_DICTIONARY_ENTRY_COLUMNS_SQL = `
  SELECT
    word,
    pronunciation,
    meaning_zh,
    part_of_speech,
    examples
`;

export const SELECT_DICTIONARY_ENTRY_CANDIDATES_BY_WORD_SQL = `
  SELECT
    word_id,
    word,
    pronunciation,
    meaning_zh,
    part_of_speech
  FROM japanese_dictionary_entries
  WHERE word = $1
  ORDER BY jsonb_array_length(examples) DESC, word_id ASC
`;

export const LIST_DICTIONARY_ENTRY_CANDIDATES_SQL = `
  SELECT
    word_id,
    word,
    pronunciation,
    meaning_zh,
    part_of_speech
  FROM japanese_dictionary_entries
  ORDER BY word ASC, pronunciation ASC, word_id ASC
`;

export const LIST_DICTIONARY_OVERVIEW_SQL = `
  SELECT
    word_id,
    word,
    pronunciation,
    meaning_zh,
    part_of_speech,
    created_at
  FROM japanese_dictionary_entries
  ORDER BY created_at DESC, word_id DESC
`;

export const SELECT_DICTIONARY_ENTRY_BY_WORD_SQL = `
  ${SELECT_DICTIONARY_ENTRY_COLUMNS_SQL}
  FROM japanese_dictionary_entries
  WHERE word = $1
  ORDER BY jsonb_array_length(examples) DESC, word_id ASC
  LIMIT 1
`;

export const SELECT_DICTIONARY_ENTRIES_BY_WORD_SQL = `
  ${SELECT_DICTIONARY_ENTRY_COLUMNS_SQL}
  FROM japanese_dictionary_entries
  WHERE word = $1
  ORDER BY jsonb_array_length(examples) DESC, word_id ASC
`;

export const SELECT_DICTIONARY_ENTRY_BY_KEY_SQL = `
  SELECT
    word,
    pronunciation,
    meaning_zh,
    part_of_speech,
    examples
  FROM japanese_dictionary_entries
  WHERE word = $1
    AND pronunciation = $2
  LIMIT 1
`;

export const SELECT_DICTIONARY_ENTRY_RECORD_BY_KEY_SQL = `
  SELECT
    word_id
  FROM japanese_dictionary_entries
  WHERE word = $1
    AND pronunciation = $2
  LIMIT 1
`;

export const SELECT_DICTIONARY_ENTRY_BY_ID_SQL = `
  SELECT
    word_id,
    word,
    pronunciation,
    meaning_zh,
    part_of_speech,
    examples,
    created_at
  FROM japanese_dictionary_entries
  WHERE word_id = $1
  LIMIT 1
`;

export const UPSERT_DICTIONARY_ENTRY_SQL = `
  INSERT INTO japanese_dictionary_entries (
    word,
    pronunciation,
    meaning_zh,
    part_of_speech,
    examples
  )
  VALUES ($1, $2, $3, $4, $5::jsonb)
  ON CONFLICT ON CONSTRAINT japanese_dictionary_entries_word_key DO UPDATE SET
    meaning_zh = EXCLUDED.meaning_zh,
    part_of_speech = EXCLUDED.part_of_speech,
    examples = EXCLUDED.examples
`;
