\i shared/db/sql/schema.sql

INSERT INTO japanese_dictionary_entries (word, pronunciation, meaning_zh, part_of_speech)
VALUES
  ('食べる', 'たべる', '吃；进食', '动词'),
  ('静か', 'しずか', '安静；安稳', '形容动词'),
  ('大切', 'たいせつ', '重要；珍贵', '形容动词')
ON CONFLICT ON CONSTRAINT japanese_dictionary_entries_word_key DO UPDATE SET
  pronunciation = EXCLUDED.pronunciation,
  meaning_zh = EXCLUDED.meaning_zh,
  part_of_speech = EXCLUDED.part_of_speech;
