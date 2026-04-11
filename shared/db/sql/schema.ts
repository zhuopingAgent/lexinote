export const ENSURE_JAPANESE_DICTIONARY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS japanese_dictionary_entries (
    word_id BIGSERIAL PRIMARY KEY,
    word TEXT NOT NULL,
    pronunciation TEXT NOT NULL,
    meaning_zh TEXT NOT NULL,
    part_of_speech TEXT NOT NULL,
    examples JSONB NOT NULL DEFAULT '[]'::jsonb
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

  ALTER TABLE japanese_dictionary_entries
    ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]'::jsonb;

  ALTER TABLE japanese_dictionary_entries
    ADD COLUMN IF NOT EXISTS word_id BIGINT;

  CREATE SEQUENCE IF NOT EXISTS japanese_dictionary_entries_word_id_seq;

  ALTER SEQUENCE japanese_dictionary_entries_word_id_seq
    OWNED BY japanese_dictionary_entries.word_id;

  ALTER TABLE japanese_dictionary_entries
    ALTER COLUMN word_id SET DEFAULT nextval('japanese_dictionary_entries_word_id_seq');

  UPDATE japanese_dictionary_entries
  SET word_id = nextval('japanese_dictionary_entries_word_id_seq')
  WHERE word_id IS NULL;

  DO $$
  DECLARE
    current_primary_key_columns TEXT[];
    max_word_id BIGINT;
  BEGIN
    SELECT array_agg(attribute.attname ORDER BY attribute.attname)
    INTO current_primary_key_columns
    FROM pg_constraint constraint_record
    JOIN LATERAL unnest(constraint_record.conkey) AS key_column(attnum) ON TRUE
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = key_column.attnum
    WHERE constraint_record.conrelid = 'japanese_dictionary_entries'::regclass
      AND constraint_record.contype = 'p';

    SELECT MAX(word_id) INTO max_word_id
    FROM japanese_dictionary_entries;

    IF max_word_id IS NULL THEN
      PERFORM setval('japanese_dictionary_entries_word_id_seq', 1, false);
    ELSE
      PERFORM setval('japanese_dictionary_entries_word_id_seq', max_word_id, true);
    END IF;

    IF current_primary_key_columns IS DISTINCT FROM ARRAY['word_id'] THEN
      IF current_primary_key_columns IS NOT NULL THEN
        ALTER TABLE japanese_dictionary_entries
          DROP CONSTRAINT japanese_dictionary_entries_pkey;
      END IF;

      ALTER TABLE japanese_dictionary_entries
        ADD CONSTRAINT japanese_dictionary_entries_pkey
        PRIMARY KEY (word_id);
    END IF;
  END $$;

  DO $$
  DECLARE
    current_unique_columns TEXT[];
  BEGIN
    SELECT array_agg(attribute.attname ORDER BY attribute.attname)
    INTO current_unique_columns
    FROM pg_constraint constraint_record
    JOIN LATERAL unnest(constraint_record.conkey) AS key_column(attnum) ON TRUE
    JOIN pg_attribute attribute
      ON attribute.attrelid = constraint_record.conrelid
     AND attribute.attnum = key_column.attnum
    WHERE constraint_record.conrelid = 'japanese_dictionary_entries'::regclass
      AND constraint_record.contype = 'u'
      AND constraint_record.conname = 'japanese_dictionary_entries_word_key';

    IF current_unique_columns IS DISTINCT FROM ARRAY['pronunciation', 'word'] THEN
      IF current_unique_columns IS NOT NULL THEN
        ALTER TABLE japanese_dictionary_entries
          DROP CONSTRAINT japanese_dictionary_entries_word_key;
      END IF;

      ALTER TABLE japanese_dictionary_entries
        ADD CONSTRAINT japanese_dictionary_entries_word_key
        UNIQUE (word, pronunciation);
    END IF;
  END $$;

  DELETE FROM japanese_dictionary_entries
  WHERE word IS NULL
     OR pronunciation IS NULL
     OR meaning_zh IS NULL
     OR part_of_speech IS NULL;

  ALTER TABLE japanese_dictionary_entries
    ALTER COLUMN word_id SET NOT NULL,
    ALTER COLUMN word SET NOT NULL,
    ALTER COLUMN pronunciation SET NOT NULL,
    ALTER COLUMN meaning_zh SET NOT NULL,
    ALTER COLUMN part_of_speech SET NOT NULL,
    ALTER COLUMN examples SET DEFAULT '[]'::jsonb,
    ALTER COLUMN examples SET NOT NULL;
`;
