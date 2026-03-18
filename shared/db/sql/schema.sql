CREATE TABLE IF NOT EXISTS japanese_dictionary_entries (
  word TEXT PRIMARY KEY,
  reading TEXT,
  meaning_zh TEXT NOT NULL,
  part_of_speech TEXT
);
