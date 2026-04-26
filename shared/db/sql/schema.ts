export const ENSURE_JAPANESE_DICTIONARY_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS japanese_dictionary_entries (
    word_id BIGSERIAL PRIMARY KEY,
    word TEXT NOT NULL,
    pronunciation TEXT NOT NULL,
    meaning_zh TEXT NOT NULL,
    part_of_speech TEXT NOT NULL,
    examples JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

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
    ALTER COLUMN examples SET NOT NULL,
    ALTER COLUMN created_at SET DEFAULT NOW(),
    ALTER COLUMN created_at SET NOT NULL;

  CREATE TABLE IF NOT EXISTS collections (
    collection_id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    auto_filter_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    auto_filter_criteria TEXT NOT NULL DEFAULT '',
    auto_filter_sync_status TEXT NOT NULL DEFAULT 'idle',
    auto_filter_last_run_at TIMESTAMPTZ,
    auto_filter_last_error TEXT NOT NULL DEFAULT '',
    auto_filter_rule_version INTEGER NOT NULL DEFAULT 1,
    auto_filter_last_synced_rule_version INTEGER
  );

  ALTER TABLE collections
    ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS auto_filter_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS auto_filter_criteria TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS auto_filter_sync_status TEXT NOT NULL DEFAULT 'idle',
    ADD COLUMN IF NOT EXISTS auto_filter_last_run_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS auto_filter_last_error TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS auto_filter_rule_version INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS auto_filter_last_synced_rule_version INTEGER;

  UPDATE collections
  SET name = BTRIM(name)
  WHERE name <> BTRIM(name);

  CREATE UNIQUE INDEX IF NOT EXISTS collections_name_normalized_key
    ON collections ((LOWER(BTRIM(name))));

  CREATE TABLE IF NOT EXISTS collection_words (
    collection_id BIGINT NOT NULL
      REFERENCES collections(collection_id)
      ON DELETE CASCADE,
    word_id BIGINT NOT NULL
      REFERENCES japanese_dictionary_entries(word_id)
      ON DELETE CASCADE,
    sort_order INTEGER,
    source TEXT NOT NULL DEFAULT 'manual',
    matched_rule_version INTEGER,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (collection_id, word_id)
  );

  ALTER TABLE collection_words
    ADD COLUMN IF NOT EXISTS sort_order INTEGER,
    ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS matched_rule_version INTEGER,
    ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS collection_words_word_id_idx
    ON collection_words (word_id);

  CREATE INDEX IF NOT EXISTS collection_words_collection_sort_idx
    ON collection_words (collection_id, sort_order, added_at);

  CREATE INDEX IF NOT EXISTS collection_words_collection_source_idx
    ON collection_words (collection_id, source);

  CREATE TABLE IF NOT EXISTS auto_filter_jobs (
    job_id BIGSERIAL PRIMARY KEY,
    job_type TEXT NOT NULL,
    collection_id BIGINT
      REFERENCES collections(collection_id)
      ON DELETE CASCADE,
    word_id BIGINT
      REFERENCES japanese_dictionary_entries(word_id)
      ON DELETE CASCADE,
    rule_version INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  ALTER TABLE auto_filter_jobs
    ADD COLUMN IF NOT EXISTS collection_id BIGINT
      REFERENCES collections(collection_id)
      ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS word_id BIGINT
      REFERENCES japanese_dictionary_entries(word_id)
      ON DELETE CASCADE,
    ADD COLUMN IF NOT EXISTS rule_version INTEGER,
    ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS error_message TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS auto_filter_jobs_status_created_idx
    ON auto_filter_jobs (status, created_at, job_id);

  DROP INDEX IF EXISTS auto_filter_jobs_active_collection_idx;

  CREATE INDEX IF NOT EXISTS auto_filter_jobs_collection_status_created_idx
    ON auto_filter_jobs (job_type, collection_id, status, created_at, job_id);

  CREATE UNIQUE INDEX IF NOT EXISTS auto_filter_jobs_active_collection_rule_idx
    ON auto_filter_jobs (job_type, collection_id, rule_version)
    WHERE collection_id IS NOT NULL
      AND rule_version IS NOT NULL
      AND status IN ('pending', 'running');

  CREATE UNIQUE INDEX IF NOT EXISTS auto_filter_jobs_active_word_idx
    ON auto_filter_jobs (job_type, word_id)
    WHERE word_id IS NOT NULL
      AND status IN ('pending', 'running');
`;
