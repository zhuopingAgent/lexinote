export const AI_ONLY_PLACEHOLDER_MEANING = "__AI_ONLY_PLACEHOLDER__";

export const SELECT_DICTIONARY_ENTRY_SQL = `
  SELECT
    word,
    reading,
    meaning_zh,
    part_of_speech
  FROM japanese_dictionary_entries
  WHERE word = $1
    AND meaning_zh <> $2
  LIMIT 1
`;

export const UPSERT_AI_ONLY_PLACEHOLDER_SQL = `
  INSERT INTO japanese_dictionary_entries (word, reading, meaning_zh, part_of_speech)
  VALUES ($1, NULL, $2, NULL)
  ON CONFLICT (word) DO NOTHING
`;
