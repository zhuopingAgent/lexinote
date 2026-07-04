export const ENSURE_JAPANESE_DICTIONARY_SCHEMA_SQL = `
CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  attempt_count INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  locked_at TIMESTAMPTZ,
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
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ,
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

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT,
  native_language TEXT NOT NULL DEFAULT 'zh',
  target_language TEXT NOT NULL DEFAULT 'ja',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grammar_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  is_mvp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scene_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT UNIQUE NOT NULL,
  name_zh TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS register_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_en TEXT UNIQUE NOT NULL,
  name_zh TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  priority INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grammar_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seed_key TEXT NOT NULL UNIQUE,
  grammar_point TEXT NOT NULL,
  reading TEXT,
  category_id UUID REFERENCES grammar_categories(id),
  sub_category TEXT,
  core_meaning TEXT NOT NULL,
  natural_translation TEXT,
  structure TEXT,
  practicality TEXT NOT NULL CHECK (practicality IN ('S', 'A', 'B', 'C', 'D')),
  spoken_or_written TEXT NOT NULL CHECK (spoken_or_written IN ('spoken', 'written', 'both')) DEFAULT 'both',
  notes TEXT,
  jlpt_level TEXT,
  common_mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_mvp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE grammar_points
  ADD COLUMN IF NOT EXISTS seed_key TEXT,
  ADD COLUMN IF NOT EXISTS reading TEXT,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES grammar_categories(id),
  ADD COLUMN IF NOT EXISTS sub_category TEXT,
  ADD COLUMN IF NOT EXISTS core_meaning TEXT,
  ADD COLUMN IF NOT EXISTS natural_translation TEXT,
  ADD COLUMN IF NOT EXISTS structure TEXT,
  ADD COLUMN IF NOT EXISTS practicality TEXT,
  ADD COLUMN IF NOT EXISTS spoken_or_written TEXT NOT NULL DEFAULT 'both',
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS jlpt_level TEXT,
  ADD COLUMN IF NOT EXISTS common_mistakes JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_mvp BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS grammar_points_seed_key_key
  ON grammar_points (seed_key);

CREATE UNIQUE INDEX IF NOT EXISTS grammar_points_text_key
  ON grammar_points (grammar_point);

CREATE TABLE IF NOT EXISTS grammar_point_scene_tags (
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  scene_tag_id UUID REFERENCES scene_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (grammar_point_id, scene_tag_id)
);

CREATE TABLE IF NOT EXISTS grammar_point_register_tags (
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  register_tag_id UUID REFERENCES register_tags(id) ON DELETE CASCADE,
  PRIMARY KEY (grammar_point_id, register_tag_id)
);

CREATE TABLE IF NOT EXISTS example_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  jp TEXT NOT NULL,
  zh TEXT,
  scene_tag_id UUID REFERENCES scene_tags(id),
  register_tag_id UUID REFERENCES register_tags(id),
  difficulty INTEGER NOT NULL DEFAULT 1,
  naturalness_score INTEGER CHECK (naturalness_score BETWEEN 1 AND 5),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS similar_grammar_relations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  similar_grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  difference_summary TEXT NOT NULL,
  example_a TEXT,
  example_b TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (grammar_point_id, similar_grammar_point_id)
);

CREATE TABLE IF NOT EXISTS user_sentences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE SET NULL,
  sentence TEXT NOT NULL,
  scene_tag_id UUID REFERENCES scene_tags(id),
  register_tag_id UUID REFERENCES register_tags(id),
  prompt_text TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ai_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_sentence_id UUID REFERENCES user_sentences(id) ON DELETE CASCADE,
  grammar_score INTEGER CHECK (grammar_score BETWEEN 1 AND 5),
  naturalness_score INTEGER CHECK (naturalness_score BETWEEN 1 AND 5),
  register_score INTEGER CHECK (register_score BETWEEN 1 AND 5),
  scene_fit_score INTEGER CHECK (scene_fit_score BETWEEN 1 AND 5),
  is_correct BOOLEAN,
  feedback_text TEXT NOT NULL,
  corrected_sentence TEXT,
  better_versions JSONB NOT NULL DEFAULT '[]'::jsonb,
  mistake_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  next_practice_prompt TEXT,
  model_name TEXT,
  raw_ai_response JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, grammar_point_id)
);

CREATE TABLE IF NOT EXISTS review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('new', 'learning', 'reviewing', 'mastered')) DEFAULT 'new',
  next_review_at TIMESTAMPTZ,
  mistake_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, grammar_point_id)
);

CREATE TABLE IF NOT EXISTS learning_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  grammar_point_id UUID REFERENCES grammar_points(id) ON DELETE SET NULL,
  activity_type TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grammar_points_search
  ON grammar_points
  USING gin (to_tsvector('simple', grammar_point || ' ' || coalesce(reading, '') || ' ' || coalesce(core_meaning, '') || ' ' || coalesce(natural_translation, '')));

CREATE INDEX IF NOT EXISTS idx_grammar_points_category
  ON grammar_points (category_id, practicality, grammar_point);

CREATE INDEX IF NOT EXISTS idx_examples_grammar_point_id
  ON example_sentences (grammar_point_id);

CREATE INDEX IF NOT EXISTS idx_user_sentences_user_id
  ON user_sentences (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_feedback_user_sentence_id
  ON ai_feedback (user_sentence_id);

CREATE INDEX IF NOT EXISTS idx_review_records_due
  ON review_records (user_id, next_review_at, mistake_count);

CREATE INDEX IF NOT EXISTS idx_learning_history_user_created
  ON learning_history (user_id, created_at DESC);

INSERT INTO users (id, email, display_name)
VALUES ('00000000-0000-0000-0000-000000000001', 'local@lexinote.local', 'Local Learner')
ON CONFLICT (id) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  updated_at = NOW();

INSERT INTO grammar_categories (slug, name_zh, name_en, description, priority, is_mvp)
VALUES
  ('particles-relationships', '助词与关系', 'Particles and relationships', '用助词表达主题、主语、对象、方向、起点、终点和比较关系。', 1, TRUE),
  ('time-sequence', '时间与顺序', 'Time and sequence', '表达时间点、先后顺序、同时进行、期间和反复发生。', 2, TRUE),
  ('reason-explanation', '原因与说明', 'Reason and explanation', '说明原因、理由、结果归因以及补充解释。', 3, TRUE),
  ('conditions-assumptions', '条件与假设', 'Conditions and assumptions', '表达如果、只要、即使、在某种情况下等条件关系。', 4, TRUE),
  ('requests-permission-advice', '请求、许可与建议', 'Requests, permission, and advice', '用于请求、许可、禁止、建议和主动帮忙。', 5, TRUE),
  ('giving-receiving-benefit', '授受与受益表达', 'Giving and receiving benefit expressions', '表达谁为谁做事、谁从行为中受益以及礼貌请求。', 6, TRUE),
  ('guessing-judgment-source', '推测、判断与信息来源', 'Guessing, judgment, and information source', '表达主观判断、可能性、根据外观推测和传闻来源。', 7, TRUE),
  ('sentence-final-nuance', '句末语气与自然表达', 'Sentence-final nuance and natural expression', '让句子更像自然会话，表达解释、缓冲、确认、提醒和轻微引用。', 8, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  is_mvp = EXCLUDED.is_mvp,
  updated_at = NOW();

INSERT INTO scene_tags (name_en, name_zh, description, priority)
VALUES
  ('restaurant', '餐厅', '点餐、加单、确认、请求服务。', 1),
  ('shopping', '购物', '询问商品、退换货、结账。', 2),
  ('hospital', '医院', '说明症状、请求医生或护士重复说明。', 3),
  ('workplace', '公司', '同事、上司、客户之间的沟通。', 4),
  ('email', '邮件', '商务、学校或正式邮件。', 5),
  ('phone_call', '电话', '电话预约、确认和说明。', 6),
  ('customer_service', '客服', '店员、客服和客户沟通。', 7),
  ('government_office', '市役所 / 手续', '办理手续、确认资料和咨询。', 8),
  ('transportation', '交通', '问路、换乘、延误和购票。', 9),
  ('housing', '租房 / 住所', '看房、报修、邻里沟通。', 10),
  ('school', '学校', '课堂、老师、同学和校园事务。', 11),
  ('friend_chat', '朋友聊天', '朋友间自然口语。', 12),
  ('family', '家人', '家庭内轻松交流。', 13),
  ('travel', '旅行', '旅行中的询问、确认和请求。', 14),
  ('interview', '面试', '求职、面试和自我介绍。', 15),
  ('online_chat', '线上聊天', '消息、社交平台和轻量沟通。', 16),
  ('daily_life', '日常生活', '日常场景中的通用表达。', 17)
ON CONFLICT (name_en) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  updated_at = NOW();

INSERT INTO register_tags (name_en, name_zh, description, priority)
VALUES
  ('casual', '朋友口语', '朋友、家人和亲近关系中的随便表达。', 1),
  ('polite', '一般礼貌', '陌生人、店员、老师等多数日常场景可用。', 2),
  ('business', '商务', '公司、客户、上司和正式工作沟通。', 3),
  ('formal', '正式', '手续、演讲、公文和郑重说明。', 4),
  ('written', '书面', '邮件、公告、文章和书面说明。', 5),
  ('customer', '店员 / 客服用语', '服务提供方对客户的礼貌表达。', 6),
  ('academic', '学术', '报告、论文和课堂说明。', 7),
  ('news', '新闻', '新闻、报道和客观转述。', 8),
  ('rough', '粗鲁 / 很随便', '亲密或粗鲁语气，普通学习者需谨慎使用。', 9),
  ('soft', '柔和表达', '缓和语气、减少直接感和压力。', 10)
ON CONFLICT (name_en) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  updated_at = NOW();

WITH grammar_seed(seed_key, grammar_point, reading, category_slug, sub_category, core_meaning, natural_translation, structure, practicality, spoken_or_written, notes, jlpt_level, common_mistakes) AS (
  VALUES
    ('gp_te_kudasai', '〜てください', '〜てください', 'requests-permission-advice', '基本请求', '请对方做某事。', '请……', 'Vて + ください', 'S', 'spoken', '常用但比较直接，对上级或客户时可换成更柔和的请求。', 'N5', '["对上级直接用会显得命令感较强"]'::jsonb),
    ('gp_te_moraemasu_ka', '〜てもらえますか', '〜てもらえますか', 'requests-permission-advice', '礼貌请求', '请求对方为自己做某事。', '可以请你……吗？', 'Vて + もらえますか', 'S', 'spoken', '日常礼貌请求非常实用，比〜てください柔和。', 'N4', '["对医生、老师、客户时，〜ていただけますか更稳妥", "句尾变成〜てもらえる？会明显变随便"]'::jsonb),
    ('gp_te_itadakemasu_ka', '〜ていただけますか', '〜ていただけますか', 'requests-permission-advice', '郑重请求', '更礼貌地请求对方为自己做某事。', '能否请您……？', 'Vて + いただけますか', 'S', 'spoken', '适合医生、老师、客户、上司、邮件等场景。', 'N4', '["滥用会显得过分郑重，但多数正式场景安全"]'::jsonb),
    ('gp_te_mo_ii_desu_ka', '〜てもいいですか', '〜てもいいですか', 'requests-permission-advice', '请求许可', '询问自己是否可以做某事。', '可以……吗？', 'Vて + もいいですか', 'S', 'spoken', '日常、学校、公司都常用。', 'N5', '[]'::jsonb),
    ('gp_naide_kudasai', '〜ないでください', '〜ないでください', 'requests-permission-advice', '禁止请求', '请求对方不要做某事。', '请不要……', 'Vない + でください', 'S', 'spoken', '语气直接，正式提醒可用〜ないようお願いいたします。', 'N5', '[]'::jsonb),
    ('gp_te_wa_ikemasen', '〜てはいけません', '〜てはいけません', 'requests-permission-advice', '禁止规则', '表示不可以做某事，常用于规则说明。', '不可以……', 'Vて + はいけません', 'A', 'both', '比〜ないでください更像规则或说明。', 'N5', '[]'::jsonb),
    ('gp_ta_hou_ga_ii', '〜たほうがいい', '〜たほうがいい', 'requests-permission-advice', '建议', '建议对方最好做某事。', '最好……', 'Vた + ほうがいい', 'S', 'spoken', '对上级直接建议时要加缓冲表达。', 'N5', '[]'::jsonb),
    ('gp_nai_hou_ga_ii', '〜ないほうがいい', '〜ないほうがいい', 'requests-permission-advice', '否定建议', '建议对方最好不要做某事。', '最好不要……', 'Vない + ほうがいい', 'S', 'spoken', '带有提醒或劝告感。', 'N5', '[]'::jsonb),
    ('gp_mashou_ka', '〜ましょうか', '〜ましょうか', 'requests-permission-advice', '主动帮忙', '提出自己为对方做某事。', '我来……吧？', 'Vます去ます + ましょうか', 'S', 'spoken', '服务、朋友、同事场景常用。', 'N5', '[]'::jsonb),
    ('gp_te_moratte_mo_ii_desu_ka', '〜てもらってもいいですか', '〜てもらってもいいですか', 'requests-permission-advice', '柔和请求', '用更绕、更柔和的方式请求对方做事。', '可以请你……吗？', 'Vて + もらってもいいですか', 'A', 'spoken', '比〜てもらえますか更像征求对方方便。', 'N4', '[]'::jsonb),
    ('gp_te_kureru', '〜てくれる', '〜てくれる', 'giving-receiving-benefit', '别人为我方做', '别人主动为我或我方做某事，表达受益。', '为我……', 'Vて + くれる', 'S', 'spoken', '主语通常是对方或第三者，受益方偏向说话人。', 'N4', '[]'::jsonb),
    ('gp_te_morau', '〜てもらう', '〜てもらう', 'giving-receiving-benefit', '我方请别人做', '我方请别人做某事并从中受益。', '请别人帮我……', 'Vて + もらう', 'S', 'spoken', '比〜てくれる更强调我方安排或请求。', 'N4', '[]'::jsonb),
    ('gp_te_ageru', '〜てあげる', '〜てあげる', 'giving-receiving-benefit', '我为别人做', '我为别人做某事，让对方受益。', '帮别人……', 'Vて + あげる', 'A', 'spoken', '对本人直接说可能有施恩感，需谨慎。', 'N4', '["对当事人直接说〜てあげます有时显得居高临下"]'::jsonb),
    ('gp_te_itadaku', '〜ていただく', '〜ていただく', 'giving-receiving-benefit', '郑重受益', '郑重表达自己得到对方帮助。', '承蒙您……', 'Vて + いただく', 'S', 'both', '商务邮件和正式场景高频。', 'N4', '[]'::jsonb),
    ('gp_sasete_morau', '〜させてもらう', '〜させてもらう', 'giving-receiving-benefit', '获得许可', '得到对方允许而做某事。', '让我……', 'V使役形 + てもらう', 'A', 'spoken', '比直接说我要做更有对方许可的感觉。', 'N3', '[]'::jsonb),
    ('gp_sasete_itadaku', '〜させていただく', '〜させていただく', 'giving-receiving-benefit', '郑重获得许可', '郑重表达承蒙允许做某事。', '请允许我……', 'V使役形 + ていただく', 'A', 'both', '商务常用，但过度使用会显得模板化。', 'N3', '[]'::jsonb),
    ('gp_te_kurete_arigatou', '〜てくれてありがとう', '〜てくれてありがとう', 'giving-receiving-benefit', '感谢受益', '感谢对方为自己做了某事。', '谢谢你帮我……', 'Vて + くれて + ありがとう', 'S', 'spoken', '朋友、同事、家人都自然。', 'N4', '[]'::jsonb),
    ('gp_te_moratte_tasukarimashita', '〜てもらって助かりました', '〜てもらってたすかりました', 'giving-receiving-benefit', '感谢帮助', '表达因为对方帮助而很受益。', '你帮我……，太帮忙了。', 'Vて + もらって + 助かりました', 'S', 'spoken', '比单纯ありがとう更具体。', 'N4', '[]'::jsonb),
    ('gp_te_itadaki_arigatou', '〜ていただきありがとうございます', '〜ていただきありがとうございます', 'giving-receiving-benefit', '正式感谢', '郑重感谢对方为自己做某事。', '感谢您……', 'Vて + いただき + ありがとうございます', 'S', 'both', '邮件、客服、商务高频。', 'N4', '[]'::jsonb),
    ('gp_shite_moraenai_deshouka', '〜してもらえないでしょうか', '〜してもらえないでしょうか', 'giving-receiving-benefit', '非常柔和请求', '用否定疑问和推量缓和请求。', '不知能否请您……？', 'Vて + もらえないでしょうか', 'A', 'both', '适合正式请求，口语中略显郑重。', 'N3', '[]'::jsonb),
    ('gp_to_omou', '〜と思う', '〜とおもう', 'guessing-judgment-source', '主观想法', '表达自己的想法、判断或意见。', '我觉得……', '普通形 + と思う', 'S', 'spoken', '商务中常用〜と思います缓和断言。', 'N5', '[]'::jsonb),
    ('gp_kamoshirenai', '〜かもしれない', '〜かもしれない', 'guessing-judgment-source', '低确定度可能', '表示可能性存在，但不确定。', '也许……', '普通形 + かもしれない', 'S', 'spoken', '比〜でしょう更不确定。', 'N4', '[]'::jsonb),
    ('gp_deshou', '〜でしょう', '〜でしょう', 'guessing-judgment-source', '推量或确认', '表示推测，或向对方确认共识。', '大概……吧 / 是吧', '普通形 + でしょう', 'A', 'both', '句尾升调时常用于确认。', 'N5', '[]'::jsonb),
    ('gp_hazu', '〜はず', '〜はず', 'guessing-judgment-source', '有根据判断', '根据事实或常识判断理应如此。', '应该……', '普通形 + はず', 'A', 'spoken', '比单纯と思う更有依据。', 'N4', '[]'::jsonb),
    ('gp_ni_chigainai', '〜に違いない', '〜にちがいない', 'guessing-judgment-source', '强判断', '非常确信自己的判断。', '一定是……', '普通形 + に違いない', 'B', 'written', '较硬，日常口语可用〜と思います或〜はずです。', 'N3', '[]'::jsonb),
    ('gp_you_da', '〜ようだ', '〜ようだ', 'guessing-judgment-source', '基于迹象', '根据观察到的迹象做判断。', '好像……', '普通形 + ようだ', 'A', 'both', '偏书面或说明，口语常用みたい。', 'N4', '[]'::jsonb),
    ('gp_mitai_da', '〜みたいだ', '〜みたいだ', 'guessing-judgment-source', '口语好像', '口语中根据感觉、观察或听说判断。', '好像……', '普通形 + みたいだ', 'S', 'spoken', '比〜ようだ更口语。', 'N4', '[]'::jsonb),
    ('gp_sou_da', '〜そうだ', '〜そうだ', 'guessing-judgment-source', '样态或传闻', '可表示看起来要发生，也可表示听说。', '看起来…… / 听说……', 'Vます去ます/い形容词词干 + そうだ；普通形 + そうだ', 'A', 'both', '样态和传闻接续不同，容易混淆。', 'N4', '["雨が降るそうだ是传闻，雨が降りそうだ是看起来要下雨"]'::jsonb),
    ('gp_rashii', '〜らしい', '〜らしい', 'guessing-judgment-source', '传闻或典型性', '表示听说的信息，或很有某种典型特征。', '听说…… / 很像……', '普通形 + らしい', 'A', 'both', '传闻时信息来源感比〜そうだ弱一些。', 'N4', '[]'::jsonb),
    ('gp_tono_koto', '〜とのこと', '〜とのこと', 'guessing-judgment-source', '正式转述', '正式转述收到的信息。', '据说 / 对方表示……', '普通形 + とのこと', 'B', 'written', '邮件、通知、客服记录常用。', 'N3', '[]'::jsonb),
    ('gp_n_desu', '〜んです', '〜んです', 'sentence-final-nuance', '解释背景', '说明原因、背景或补充信息。', '是因为…… / 其实……', '普通形 + んです', 'S', 'spoken', '让说明更自然，但不能滥用。', 'N4', '[]'::jsonb),
    ('gp_n_desu_ga', '〜んですが', '〜んですが', 'sentence-final-nuance', '铺垫请求', '先说明情况，再柔和引出请求或问题。', '是这样的……', '普通形 + んですが', 'S', 'spoken', '在店铺、医院、电话中特别自然。', 'N4', '[]'::jsonb),
    ('gp_kana', '〜かな', '〜かな', 'sentence-final-nuance', '自言自语疑问', '轻轻表达疑问、犹豫或期待。', '……吗 / 不知道会不会……', '普通形 + かな', 'A', 'spoken', '对别人直接要求回答时不够礼貌。', 'N4', '[]'::jsonb),
    ('gp_kamo', '〜かも', '〜かも', 'sentence-final-nuance', '口语也许', '口语中轻量表达可能性。', '可能吧', '普通形 + かも', 'S', 'spoken', '比〜かもしれません更随便。', 'N4', '[]'::jsonb),
    ('gp_yo', '〜よ', '〜よ', 'sentence-final-nuance', '提醒或告知', '把信息告诉对方，带提醒感。', '……哦', '句子 + よ', 'S', 'spoken', '语气过强时会显得推人。', 'N5', '[]'::jsonb),
    ('gp_ne', '〜ね', '〜ね', 'sentence-final-nuance', '共感确认', '寻求共感、确认或柔和收尾。', '……呢 / 对吧', '句子 + ね', 'S', 'spoken', '比〜よ更柔和。', 'N5', '[]'::jsonb),
    ('gp_yo_ne', '〜よね', '〜よね', 'sentence-final-nuance', '带信息的确认', '提出自己认为正确的信息并请求确认。', '是……吧？', '句子 + よね', 'S', 'spoken', '比ね更有自己判断。', 'N5', '[]'::jsonb),
    ('gp_janai_desu_ka', '〜じゃないですか', '〜じゃないですか', 'sentence-final-nuance', '确认共同认知', '把对方也应知道的信息拿出来确认。', '不是……吗？', '普通形 + じゃないですか', 'A', 'spoken', '使用不当会显得强行要求对方认同。', 'N4', '[]'::jsonb),
    ('gp_tte', '〜って', '〜って', 'sentence-final-nuance', '口语引用或主题', '口语中表示引用、听说、主题提示。', '说是…… / 关于……', '普通形/名词 + って', 'A', 'spoken', '很口语，正式邮件不要用。', 'N4', '[]'::jsonb),
    ('gp_to_iu_kanji_desu', '〜という感じです', '〜というかんじです', 'sentence-final-nuance', '模糊描述', '用柔和方式描述整体感觉。', '大概是……的感觉', '普通形/名词 + という感じです', 'A', 'spoken', '适合说明难以精确表达的感受。', 'N3', '[]'::jsonb),
    ('gp_kara_reason', '〜から', '〜から', 'reason-explanation', '直接原因', '说明原因或理由，语气较直接。', '因为……', '普通形 + から', 'S', 'spoken', '解释自己行为时常用，但正式场合可换ので。', 'N5', '[]'::jsonb),
    ('gp_node', '〜ので', '〜ので', 'reason-explanation', '柔和原因', '说明原因，语气比から柔和客观。', '因为……所以……', '普通形 + ので', 'S', 'both', '请求、道歉、说明情况时很自然。', 'N5', '[]'::jsonb),
    ('gp_te_reason', '〜て', '〜て', 'reason-explanation', '自然原因', '用て形连接自然发生的原因和结果。', '因为……而……', 'Vて / い形容词くて / な形容词で', 'A', 'spoken', '常用于感情、状态变化，不适合强意志结果。', 'N5', '[]'::jsonb),
    ('gp_tame', '〜ため', '〜ため', 'reason-explanation', '正式原因', '正式说明原因或目的。', '由于…… / 为了……', '普通形 + ため', 'A', 'written', '书面、通知、新闻中自然。', 'N3', '[]'::jsonb),
    ('gp_okagede', '〜おかげで', '〜おかげで', 'reason-explanation', '正面归因', '把好结果归因于某人或某事。', '多亏……', '普通形/名词の + おかげで', 'S', 'spoken', '感谢语境很自然。', 'N3', '[]'::jsonb),
    ('gp_seide', '〜せいで', '〜せいで', 'reason-explanation', '负面归因', '把坏结果归因于某人或某事。', '都怪……', '普通形/名词の + せいで', 'A', 'spoken', '可能带责备感，正式场合谨慎。', 'N3', '[]'::jsonb),
    ('gp_mono_dakara', '〜ものだから', '〜ものだから', 'reason-explanation', '解释理由', '用来解释自己的行为原因，带一点辩解感。', '因为……嘛', '普通形 + ものだから', 'B', 'spoken', '口语解释迟到、失误等原因时用。', 'N3', '[]'::jsonb),
    ('gp_to_iu_riyuu_de', '〜という理由で', '〜というりゆうで', 'reason-explanation', '以某理由', '以某个理由作为依据或原因。', '以……为理由', '普通形 + という理由で', 'B', 'written', '较说明性，适合文章和正式解释。', 'N3', '[]'::jsonb),
    ('gp_nazenara_kara', 'なぜなら〜からです', 'なぜなら〜からです', 'reason-explanation', '强调理由', '先提出结论，再说明原因。', '因为理由是……', 'なぜなら + 理由 + からです', 'B', 'written', '口语中略显作文式。', 'N4', '[]'::jsonb),
    ('gp_wake_desu', '〜わけです', '〜わけです', 'reason-explanation', '总结解释', '根据前文推导出结论或解释。', '也就是说……', '普通形 + わけです', 'B', 'both', '用于说明来龙去脉。', 'N3', '[]'::jsonb),
    ('gp_tara', '〜たら', '〜たら', 'conditions-assumptions', '普通条件', '如果某事发生，就进行后项。', '如果……就……', 'Vた形 + ら', 'S', 'spoken', '日常最常用的条件表达之一。', 'N4', '[]'::jsonb),
    ('gp_ba', '〜ば', '〜ば', 'conditions-assumptions', '一般条件', '表示一般条件、假设或建议条件。', '如果……的话', 'ば形', 'A', 'both', '后项为意志表达时有一些限制。', 'N4', '[]'::jsonb),
    ('gp_to_condition', '〜と', '〜と', 'conditions-assumptions', '自然结果', '表示一发生前项，后项自然发生。', '一……就……', '辞书形 + と', 'A', 'both', '不适合接请求、命令等意志表达。', 'N5', '[]'::jsonb),
    ('gp_nara', '〜なら', '〜なら', 'conditions-assumptions', '针对话题条件', '承接对方话题，提出条件或建议。', '如果说……的话', '普通形/名词 + なら', 'S', 'spoken', '对话中非常实用。', 'N4', '[]'::jsonb),
    ('gp_baai', '〜場合', '〜ばあい', 'conditions-assumptions', '正式情况', '表示在某种情况下。', '在……的情况下', '普通形/名词の + 場合', 'A', 'written', '手续、客服说明常用。', 'N4', '[]'::jsonb),
    ('gp_kagiri', '〜限り', '〜かぎり', 'conditions-assumptions', '范围条件', '只要条件成立，就保持后项。', '只要……就……', '普通形 + 限り', 'B', 'written', '常见于说明和承诺。', 'N3', '[]'::jsonb),
    ('gp_sae_ba', '〜さえ〜ば', '〜さえ〜ば', 'conditions-assumptions', '最低条件', '只要满足最低条件就可以。', '只要……就……', '名词 + さえ + ば形', 'B', 'both', '强调唯一关键条件。', 'N3', '[]'::jsonb),
    ('gp_toshitemo', '〜としても', '〜としても', 'conditions-assumptions', '即使假设', '即使前项成立，后项也不变。', '即使……也……', '普通形 + としても', 'B', 'written', '正式讨论中常用。', 'N3', '[]'::jsonb),
    ('gp_ni_shitemo', '〜にしても', '〜にしても', 'conditions-assumptions', '即便如此', '承认某情况后提出评价或转折。', '即使……也……', '普通形/名词 + にしても', 'B', 'spoken', '带评价感。', 'N3', '[]'::jsonb),
    ('gp_nai_kagiri', '〜ない限り', '〜ないかぎり', 'conditions-assumptions', '除非', '如果不满足前项，后项不会发生。', '除非……否则……', 'Vない + 限り', 'B', 'both', '常用于规则、承诺和说明。', 'N3', '[]'::jsonb),
    ('gp_toki', '〜とき', '〜とき', 'time-sequence', '时间点', '表示某事发生的时候。', '……的时候', '普通形/名词の + とき', 'S', 'both', '注意前后动作时间关系。', 'N5', '[]'::jsonb),
    ('gp_mae_ni', '〜前に', '〜まえに', 'time-sequence', '之前', '在某动作或时间之前。', '在……之前', '辞书形/名词の + 前に', 'S', 'both', '动词前接辞书形。', 'N5', '[]'::jsonb),
    ('gp_ato_de', '〜後で', '〜あとで', 'time-sequence', '之后', '在某动作完成之后。', '在……之后', 'Vた形/名词の + 後で', 'S', 'both', '动词前接た形。', 'N5', '[]'::jsonb),
    ('gp_te_kara', '〜てから', '〜てから', 'time-sequence', '做完再做', '完成前项之后再做后项。', '……之后再……', 'Vて + から', 'S', 'spoken', '强调顺序，常用于安排。', 'N5', '[]'::jsonb),
    ('gp_nagara', '〜ながら', '〜ながら', 'time-sequence', '同时进行', '一边做前项一边做后项。', '一边……一边……', 'Vます去ます + ながら', 'A', 'spoken', '主语通常相同。', 'N5', '[]'::jsonb),
    ('gp_aida', '〜間', '〜あいだ', 'time-sequence', '整个期间', '在某期间一直发生后项。', '在……期间一直……', '普通形/名词の + 間', 'A', 'both', '强调整个时间段。', 'N4', '[]'::jsonb),
    ('gp_aida_ni', '〜間に', '〜あいだに', 'time-sequence', '期间某时点', '在某期间内发生一次或完成某事。', '趁……期间', '普通形/名词の + 間に', 'A', 'both', '强调期间内某个点或完成。', 'N4', '[]'::jsonb),
    ('gp_uchi_ni', '〜うちに', '〜うちに', 'time-sequence', '趁还在', '趁某状态还持续时做某事。', '趁着……', '普通形/名词の + うちに', 'A', 'spoken', '常用于机会、状态变化前。', 'N3', '[]'::jsonb),
    ('gp_tabi_ni', '〜たびに', '〜たびに', 'time-sequence', '每当', '每次发生前项，都会发生后项。', '每当……就……', '辞书形/名词の + たびに', 'A', 'both', '用于反复经验。', 'N3', '[]'::jsonb),
    ('gp_shidai', '〜次第', '〜しだい', 'time-sequence', '一……就', '前项完成后马上做后项。', '一……就……', 'Vます去ます + 次第', 'B', 'written', '商务邮件常用。', 'N3', '[]'::jsonb),
    ('gp_wa', 'は', 'は', 'particles-relationships', '主题', '提示话题或对比。', '至于…… / ……是', '名词 + は', 'S', 'both', '常和が混淆，は更像谈论主题。', 'N5', '["把所有主语都写成は会不自然"]'::jsonb),
    ('gp_ga', 'が', 'が', 'particles-relationships', '主语或焦点', '标记主语、发现对象或强调焦点。', '……（主语）', '名词 + が', 'S', 'both', '新信息、能力对象、喜好对象常用が。', 'N5', '["需要强调谁/什么时误用は会弱化焦点"]'::jsonb),
    ('gp_wo', 'を', 'を', 'particles-relationships', '动作对象', '标记他动词的直接对象。', '把 / 对……', '名词 + を + 他动词', 'S', 'both', '移动经过也可用を。', 'N5', '[]'::jsonb),
    ('gp_ni', 'に', 'に', 'particles-relationships', '方向、时间、对象', '标记到达点、时间点、存在地点或间接对象。', '到 / 在 / 给', '名词 + に', 'S', 'both', '意义多，需要结合动词判断。', 'N5', '[]'::jsonb),
    ('gp_de', 'で', 'で', 'particles-relationships', '地点、工具、范围', '标记动作地点、手段工具或范围。', '在 / 用 / 以', '名词 + で', 'S', 'both', '存在地点用に，动作地点用で。', 'N5', '[]'::jsonb),
    ('gp_e', 'へ', 'へ', 'particles-relationships', '方向', '表示移动方向。', '向……', '名词 + へ', 'A', 'both', '比に更强调方向而非到达点。', 'N5', '[]'::jsonb),
    ('gp_to_particle', 'と', 'と', 'particles-relationships', '共同对象或引用', '表示和谁一起、列举、引用内容。', '和 / 与 / 说', '名词 + と；句子 + と', 'S', 'both', '语境不同功能差异大。', 'N5', '[]'::jsonb),
    ('gp_kara_particle', 'から', 'から', 'particles-relationships', '起点', '表示时间、地点或材料的起点。', '从……', '名词 + から', 'S', 'both', '也可以表示原因，需看后续结构。', 'N5', '[]'::jsonb),
    ('gp_made', 'まで', 'まで', 'particles-relationships', '终点', '表示时间、地点或范围终点。', '到……为止', '名词 + まで', 'S', 'both', '和から搭配表示从……到……。', 'N5', '[]'::jsonb),
    ('gp_yori', 'より', 'より', 'particles-relationships', '比较基准', '表示比较的基准或起点。', '比……', '名词 + より', 'A', 'both', '比较句常和ほうが搭配。', 'N5', '[]'::jsonb)
)
INSERT INTO grammar_points (
  seed_key,
  grammar_point,
  reading,
  category_id,
  sub_category,
  core_meaning,
  natural_translation,
  structure,
  practicality,
  spoken_or_written,
  notes,
  jlpt_level,
  common_mistakes,
  is_mvp
)
SELECT
  grammar_seed.seed_key,
  grammar_seed.grammar_point,
  grammar_seed.reading,
  grammar_categories.id,
  grammar_seed.sub_category,
  grammar_seed.core_meaning,
  grammar_seed.natural_translation,
  grammar_seed.structure,
  grammar_seed.practicality,
  grammar_seed.spoken_or_written,
  grammar_seed.notes,
  grammar_seed.jlpt_level,
  grammar_seed.common_mistakes,
  TRUE
FROM grammar_seed
JOIN grammar_categories ON grammar_categories.slug = grammar_seed.category_slug
ON CONFLICT (seed_key) DO UPDATE SET
  grammar_point = EXCLUDED.grammar_point,
  reading = EXCLUDED.reading,
  category_id = EXCLUDED.category_id,
  sub_category = EXCLUDED.sub_category,
  core_meaning = EXCLUDED.core_meaning,
  natural_translation = EXCLUDED.natural_translation,
  structure = EXCLUDED.structure,
  practicality = EXCLUDED.practicality,
  spoken_or_written = EXCLUDED.spoken_or_written,
  notes = EXCLUDED.notes,
  jlpt_level = EXCLUDED.jlpt_level,
  common_mistakes = EXCLUDED.common_mistakes,
  is_mvp = EXCLUDED.is_mvp,
  updated_at = NOW();

INSERT INTO grammar_point_scene_tags (grammar_point_id, scene_tag_id)
SELECT grammar_points.id, scene_tags.id
FROM grammar_points
CROSS JOIN scene_tags
WHERE grammar_points.is_mvp = TRUE
  AND scene_tags.name_en = 'daily_life'
ON CONFLICT DO NOTHING;

INSERT INTO grammar_point_register_tags (grammar_point_id, register_tag_id)
SELECT grammar_points.id, register_tags.id
FROM grammar_points
CROSS JOIN register_tags
WHERE grammar_points.is_mvp = TRUE
  AND register_tags.name_en = 'polite'
ON CONFLICT DO NOTHING;

WITH scene_seed(seed_key, tag_name_en) AS (
  VALUES
    ('gp_te_moraemasu_ka', 'hospital'),
    ('gp_te_moraemasu_ka', 'restaurant'),
    ('gp_te_moraemasu_ka', 'workplace'),
    ('gp_te_itadakemasu_ka', 'hospital'),
    ('gp_te_itadakemasu_ka', 'workplace'),
    ('gp_te_itadakemasu_ka', 'email'),
    ('gp_te_mo_ii_desu_ka', 'school'),
    ('gp_te_mo_ii_desu_ka', 'workplace'),
    ('gp_n_desu_ga', 'hospital'),
    ('gp_n_desu_ga', 'phone_call'),
    ('gp_n_desu_ga', 'government_office'),
    ('gp_te_itadaki_arigatou', 'email'),
    ('gp_te_itadaki_arigatou', 'customer_service'),
    ('gp_shidai', 'email'),
    ('gp_shidai', 'workplace'),
    ('gp_baai', 'customer_service'),
    ('gp_baai', 'government_office'),
    ('gp_tono_koto', 'email'),
    ('gp_tono_koto', 'customer_service'),
    ('gp_tte', 'friend_chat'),
    ('gp_kana', 'friend_chat'),
    ('gp_kamo', 'online_chat')
)
INSERT INTO grammar_point_scene_tags (grammar_point_id, scene_tag_id)
SELECT grammar_points.id, scene_tags.id
FROM scene_seed
JOIN grammar_points ON grammar_points.seed_key = scene_seed.seed_key
JOIN scene_tags ON scene_tags.name_en = scene_seed.tag_name_en
ON CONFLICT DO NOTHING;

WITH register_seed(seed_key, tag_name_en) AS (
  VALUES
    ('gp_te_kudasai', 'customer'),
    ('gp_te_moraemasu_ka', 'business'),
    ('gp_te_moraemasu_ka', 'soft'),
    ('gp_te_itadakemasu_ka', 'business'),
    ('gp_te_itadakemasu_ka', 'formal'),
    ('gp_te_itadakemasu_ka', 'soft'),
    ('gp_te_moratte_mo_ii_desu_ka', 'soft'),
    ('gp_te_itadaku', 'business'),
    ('gp_te_itadaki_arigatou', 'business'),
    ('gp_te_itadaki_arigatou', 'written'),
    ('gp_shite_moraenai_deshouka', 'formal'),
    ('gp_tono_koto', 'written'),
    ('gp_tono_koto', 'business'),
    ('gp_shidai', 'business'),
    ('gp_shidai', 'written'),
    ('gp_kana', 'casual'),
    ('gp_kamo', 'casual'),
    ('gp_tte', 'casual'),
    ('gp_yo', 'casual'),
    ('gp_ne', 'casual')
)
INSERT INTO grammar_point_register_tags (grammar_point_id, register_tag_id)
SELECT grammar_points.id, register_tags.id
FROM register_seed
JOIN grammar_points ON grammar_points.seed_key = register_seed.seed_key
JOIN register_tags ON register_tags.name_en = register_seed.tag_name_en
ON CONFLICT DO NOTHING;

WITH example_seed(seed_key, jp, zh, scene_name_en, register_name_en, difficulty, naturalness_score, notes) AS (
  VALUES
    ('gp_te_moraemasu_ka', 'すみません、もう一度説明してもらえますか。', '不好意思，可以请您再说明一遍吗？', 'hospital', 'polite', 1, 5, '医院里对医生可用，一般礼貌。'),
    ('gp_te_moraemasu_ka', 'この席を少し移動してもらえますか。', '可以请你把这个座位稍微挪一下吗？', 'restaurant', 'polite', 1, 5, '对店员或同桌都自然。'),
    ('gp_te_itadakemasu_ka', '恐れ入りますが、資料を確認していただけますか。', '不好意思，能请您确认一下资料吗？', 'workplace', 'business', 2, 5, '商务场景安全。'),
    ('gp_te_itadakemasu_ka', 'お手数ですが、こちらにご記入いただけますか。', '麻烦您在这里填写一下好吗？', 'government_office', 'formal', 2, 5, '手续场景自然。'),
    ('gp_te_mo_ii_desu_ka', 'ここで写真を撮ってもいいですか。', '可以在这里拍照吗？', 'travel', 'polite', 1, 5, '请求许可。'),
    ('gp_naide_kudasai', 'すみません、ここに荷物を置かないでください。', '不好意思，请不要把行李放在这里。', 'transportation', 'polite', 1, 4, '直接提醒。'),
    ('gp_ta_hou_ga_ii', '熱があるなら、今日は早く帰ったほうがいいですよ。', '如果发烧的话，今天最好早点回去。', 'workplace', 'polite', 1, 5, '带关心感的建议。'),
    ('gp_mashou_ka', '重そうですね。持ちましょうか。', '看起来很重，我来帮你拿吧？', 'daily_life', 'polite', 1, 5, '主动帮忙。'),
    ('gp_te_kureru', '友だちが駅まで迎えに来てくれました。', '朋友来车站接我了。', 'daily_life', 'polite', 1, 5, '别人为我做。'),
    ('gp_te_morau', '同僚に資料を直してもらいました。', '我请同事帮我改了资料。', 'workplace', 'polite', 1, 5, '我方请别人做。'),
    ('gp_te_ageru', '妹に日本語の宿題を見てあげました。', '我帮妹妹看了日语作业。', 'family', 'casual', 1, 4, '对第三者说明较自然。'),
    ('gp_te_itadaki_arigatou', 'ご確認いただきありがとうございます。', '感谢您确认。', 'email', 'business', 1, 5, '邮件高频。'),
    ('gp_kamoshirenai', '電車が遅れているので、少し遅れるかもしれません。', '电车晚点了，所以我可能会稍微迟到。', 'workplace', 'polite', 1, 5, '低确定度可能。'),
    ('gp_hazu', '予約してあるので、名前を言えば入れるはずです。', '已经预约了，所以报名字应该就能进去。', 'restaurant', 'polite', 2, 5, '有根据的判断。'),
    ('gp_sou_da', '空が暗いので、雨が降りそうです。', '天空很暗，看起来要下雨。', 'daily_life', 'polite', 1, 5, '样态。'),
    ('gp_rashii', '天気予報によると、明日は雨らしいです。', '据天气预报说，明天好像下雨。', 'daily_life', 'polite', 1, 5, '传闻。'),
    ('gp_n_desu', 'すみません、電車が遅れているんです。', '不好意思，是电车晚点了。', 'workplace', 'polite', 1, 5, '解释背景。'),
    ('gp_n_desu_ga', '予約を変更したいんですが。', '我想改一下预约。', 'phone_call', 'polite', 1, 5, '柔和引出请求。'),
    ('gp_kana', '明日、雨が降るかな。', '明天会不会下雨呢。', 'friend_chat', 'casual', 1, 5, '自言自语式疑问。'),
    ('gp_yo_ne', '集合時間は10時ですよね。', '集合时间是10点，对吧？', 'daily_life', 'polite', 1, 5, '带自己判断的确认。'),
    ('gp_node', '体調が悪いので、今日は早めに帰ります。', '因为身体不舒服，今天我早点回去。', 'workplace', 'polite', 1, 5, '柔和说明原因。'),
    ('gp_okagede', '手伝ってくれたおかげで、早く終わりました。', '多亏你帮忙，早点结束了。', 'workplace', 'polite', 1, 5, '正面归因。'),
    ('gp_seide', '雨のせいで、靴が濡れてしまいました。', '都怪下雨，鞋子湿了。', 'daily_life', 'polite', 1, 4, '负面归因。'),
    ('gp_tara', '駅に着いたら、電話してください。', '到了车站请给我打电话。', 'daily_life', 'polite', 1, 5, '普通条件。'),
    ('gp_nara', '京都へ行くなら、このお店がおすすめです。', '如果去京都的话，推荐这家店。', 'travel', 'polite', 1, 5, '承接话题给建议。'),
    ('gp_baai', '遅れる場合は、事前にご連絡ください。', '如果会迟到，请提前联系。', 'workplace', 'business', 2, 5, '正式情况说明。'),
    ('gp_toki', '病院へ行くとき、保険証を持って行ってください。', '去医院的时候，请带上保险证。', 'hospital', 'polite', 1, 5, '时间点。'),
    ('gp_te_kara', '申込書を書いてから、窓口に出してください。', '填完申请表之后，请交到窗口。', 'government_office', 'polite', 1, 5, '顺序。'),
    ('gp_uchi_ni', '日本にいるうちに、いろいろな場所へ行きたいです。', '趁在日本期间，我想去各种地方。', 'travel', 'polite', 2, 5, '趁状态还持续。'),
    ('gp_shidai', '確認でき次第、ご連絡いたします。', '确认后会马上联系您。', 'email', 'business', 2, 5, '商务邮件高频。'),
    ('gp_wa', '私は中国から来ました。', '我来自中国。', 'daily_life', 'polite', 1, 5, '提示主题。'),
    ('gp_ga', 'この店は雰囲気がいいです。', '这家店氛围很好。', 'restaurant', 'polite', 1, 5, '描述属性主语。'),
    ('gp_de', '駅で友だちと会います。', '我在车站和朋友见面。', 'transportation', 'polite', 1, 5, '动作地点。'),
    ('gp_ni', '先生にメールを送りました。', '我给老师发了邮件。', 'school', 'polite', 1, 5, '间接对象。')
)
INSERT INTO example_sentences (grammar_point_id, jp, zh, scene_tag_id, register_tag_id, difficulty, naturalness_score, notes)
SELECT
  grammar_points.id,
  example_seed.jp,
  example_seed.zh,
  scene_tags.id,
  register_tags.id,
  example_seed.difficulty,
  example_seed.naturalness_score,
  example_seed.notes
FROM example_seed
JOIN grammar_points ON grammar_points.seed_key = example_seed.seed_key
LEFT JOIN scene_tags ON scene_tags.name_en = example_seed.scene_name_en
LEFT JOIN register_tags ON register_tags.name_en = example_seed.register_name_en
WHERE NOT EXISTS (
  SELECT 1
  FROM example_sentences
  WHERE example_sentences.grammar_point_id = grammar_points.id
    AND example_sentences.jp = example_seed.jp
);

WITH similar_seed(seed_key, similar_seed_key, difference_summary, example_a, example_b, notes) AS (
  VALUES
    ('gp_te_moraemasu_ka', 'gp_te_itadakemasu_ka', '〜てもらえますか是一般礼貌请求；〜ていただけますか更郑重，适合医生、老师、客户或上司。', 'もう一度説明してもらえますか。', 'もう一度説明していただけますか。', '同样是请求，对象越正式越适合いただく。'),
    ('gp_te_kureru', 'gp_te_morau', '〜てくれる强调对方主动为我做；〜てもらう强调我请别人做并受益。', '友だちが手伝ってくれました。', '友だちに手伝ってもらいました。', '主语和视角不同。'),
    ('gp_sou_da', 'gp_rashii', '样态的〜そうだ根据眼前迹象判断；〜らしい多用于听说或间接信息。', '雨が降りそうです。', '明日は雨らしいです。', '注意接续差异。'),
    ('gp_you_da', 'gp_mitai_da', '〜ようだ较书面或说明；〜みたいだ更口语自然。', '彼は忙しいようです。', '彼は忙しいみたいです。', '口语会话中みたい更轻。'),
    ('gp_kara_reason', 'gp_node', '〜から原因表达更直接；〜ので更柔和客观，适合请求、道歉、说明情况。', '時間がないから、先に行きます。', '時間がないので、先に失礼します。', '礼貌场景优先ので。'),
    ('gp_tara', 'gp_ba', '〜たら最通用、口语自然；〜ば更像一般条件或规则，后项限制更多。', '駅に着いたら電話してください。', '時間があれば行きます。', '对话中不知道选什么时，たら常更安全。'),
    ('gp_toki', 'gp_te_kara', '〜とき表示某个时候；〜てから强调前项完成后再做后项。', '寝るとき、電気を消します。', '歯を磨いてから寝ます。', '一个是时间点，一个是顺序。'),
    ('gp_wa', 'gp_ga', 'は提示话题或对比；が标记主语、焦点或新信息。', '私は学生です。', '私がやります。', '中文学习者最容易直接按“主语”误选。')
)
INSERT INTO similar_grammar_relations (grammar_point_id, similar_grammar_point_id, difference_summary, example_a, example_b, notes)
SELECT
  grammar_points.id,
  similar_points.id,
  similar_seed.difference_summary,
  similar_seed.example_a,
  similar_seed.example_b,
  similar_seed.notes
FROM similar_seed
JOIN grammar_points ON grammar_points.seed_key = similar_seed.seed_key
JOIN grammar_points AS similar_points ON similar_points.seed_key = similar_seed.similar_seed_key
ON CONFLICT (grammar_point_id, similar_grammar_point_id) DO UPDATE SET
  difference_summary = EXCLUDED.difference_summary,
  example_a = EXCLUDED.example_a,
  example_b = EXCLUDED.example_b,
  notes = EXCLUDED.notes,
  updated_at = NOW();
`;
