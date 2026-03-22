export const ENSURE_JAPANESE_DICTIONARY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS japanese_dictionary_entries (
    word TEXT PRIMARY KEY,
    pronunciation TEXT NOT NULL,
    meaning_zh TEXT NOT NULL,
    part_of_speech TEXT NOT NULL
  );

  DO $$
  BEGIN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'japanese_dictionary_entries'
        AND column_name = 'reading'
    ) AND NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'japanese_dictionary_entries'
        AND column_name = 'pronunciation'
    ) THEN
      ALTER TABLE japanese_dictionary_entries
        RENAME COLUMN reading TO pronunciation;
    END IF;
  END $$;

  DELETE FROM japanese_dictionary_entries
  WHERE word IS NULL
     OR pronunciation IS NULL
     OR meaning_zh IS NULL
     OR part_of_speech IS NULL;

  ALTER TABLE japanese_dictionary_entries
    ALTER COLUMN word SET NOT NULL,
    ALTER COLUMN pronunciation SET NOT NULL,
    ALTER COLUMN meaning_zh SET NOT NULL,
    ALTER COLUMN part_of_speech SET NOT NULL;
`;
