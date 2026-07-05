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

CREATE TABLE IF NOT EXISTS grammar_category_groups (
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

CREATE TABLE IF NOT EXISTS grammar_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  group_id UUID REFERENCES grammar_category_groups(id),
  name_zh TEXT NOT NULL,
  name_en TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  example_expressions JSONB NOT NULL DEFAULT '[]'::jsonb,
  priority INTEGER NOT NULL DEFAULT 0,
  is_mvp BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE grammar_categories
  ADD COLUMN IF NOT EXISTS group_id UUID REFERENCES grammar_category_groups(id),
  ADD COLUMN IF NOT EXISTS example_expressions JSONB NOT NULL DEFAULT '[]'::jsonb;

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

CREATE INDEX IF NOT EXISTS idx_grammar_categories_group
  ON grammar_categories (group_id, priority, name_zh);

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

INSERT INTO grammar_category_groups (slug, name_zh, name_en, description, priority, is_mvp)
VALUES
  ('expressive_functions', '表达功能', 'Expressive functions', '按真实沟通意图组织语法：请求、原因、条件、推测、敬语等。', 1, TRUE),
  ('morphology_conjugation_tense_aspect', '形态、活用与时间体系统', 'Morphology, conjugation, tense, and aspect', '系统学习词形变化、时态、否定、持续、完成和派生形。', 2, TRUE),
  ('sentence_structure_components', '句子结构与成分系统', 'Sentence structure and components', '学习日语句子如何组合：主题、谓语、修饰、从句、省略和语序。', 3, TRUE),
  ('particle_system', '助词系统', 'Particle system', '系统整理助词的关系标记、限定、终助词和复合助词。', 4, TRUE),
  ('register_honorific_social', '语体、敬语与社会关系系统', 'Register, honorifics, and social relations', '按说话对象、上下关系、内外关系和正式程度组织语体知识。', 5, TRUE),
  ('discourse_connection_organization', '连接与篇章组织', 'Discourse connection and organization', '学习句子之间如何连接成自然段落、邮件和说明文。', 6, TRUE),
  ('lexical_collocations_constructions', '词汇搭配与构式', 'Lexical collocations and constructions', '把高频搭配、固定构式和自然表达块作为学习对象。', 7, TRUE),
  ('confusing_grammar_contrasts', '易混语法对比', 'Confusing grammar contrasts', '专门比较中文意思接近但日语用法不同的表达。', 8, TRUE),
  ('error_diagnosis_correction', '错误诊断与纠错', 'Error diagnosis and correction', '把学习者常见错误转成可复习、可练习的诊断项目。', 9, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  priority = EXCLUDED.priority,
  is_mvp = EXCLUDED.is_mvp,
  updated_at = NOW();

INSERT INTO grammar_categories (slug, name_zh, name_en, description, example_expressions, priority, is_mvp)
VALUES
  ('basic_sentence_patterns', '基础句型', 'Basic sentence patterns', '用于构建最基本的日语句子。', '["AはBです","Aがあります / います","Aになります","Aにします"]'::jsonb, 1, TRUE),
  ('particles_and_relations', '助词与关系', 'Particles and relations', '表示句子中各成分之间的关系。', '["は","が","を","に","で","へ","と","から","まで","より"]'::jsonb, 2, TRUE),
  ('time_and_sequence', '时间与顺序', 'Time and sequence', '表达动作发生的时间、前后顺序、期间。', '["〜とき","〜前に","〜後で","〜てから","〜ながら","〜うちに"]'::jsonb, 3, TRUE),
  ('reasons_and_explanations', '原因与解释', 'Reasons and explanations', '说明原因、理由、背景。', '["〜から","〜ので","〜ため","〜おかげで","〜せいで"]'::jsonb, 4, TRUE),
  ('conditions_and_hypotheses', '条件与假设', 'Conditions and hypotheses', '表达如果、当……时、在某种条件下。', '["〜たら","〜ば","〜と","〜なら","〜場合"]'::jsonb, 5, TRUE),
  ('purpose_and_plans', '目的与计划', 'Purpose and plans', '表达目的、打算、决定、计划。', '["〜ために","〜ように","〜つもり","〜予定","〜ことにする"]'::jsonb, 6, TRUE),
  ('requests_permission_advice', '请求、许可与建议', 'Requests, permission, and advice', '用于请求别人、询问许可、给建议。', '["〜てください","〜てもらえますか","〜てもいいですか","〜たほうがいい"]'::jsonb, 7, TRUE),
  ('giving_receiving_benefit', '授受与受益表达', 'Giving, receiving, and benefit', '表达谁为谁做了什么、谁受益。', '["〜てあげる","〜てくれる","〜てもらう","〜ていただく"]'::jsonb, 8, TRUE),
  ('inference_judgment_sources', '推测、判断与信息来源', 'Inference, judgment, and sources', '表达不确定、听说、看起来、应该是。', '["〜そうだ","〜らしい","〜ようだ","〜みたいだ","〜はず","〜かもしれない"]'::jsonb, 9, TRUE),
  ('comparison_degree_scope', '比较、程度与范围', 'Comparison, degree, and scope', '表达比较、程度、限定、范围。', '["〜より","〜ほど","〜くらい","〜だけ","〜しか〜ない","〜ばかり"]'::jsonb, 10, TRUE),
  ('contrast_concession_comparison', '转折、让步与对比', 'Contrast, concession, and comparison', '表达虽然、但是、即使、另一方面。', '["〜けど","〜が","〜のに","〜ても","〜一方で","〜ものの"]'::jsonb, 11, TRUE),
  ('sentence_final_nuance', '句尾语气与自然表达', 'Sentence-final nuance', '让句子更自然、更口语、更柔和。', '["〜んです","〜んですが","〜かな","〜かも","〜よ","〜ね","〜よね"]'::jsonb, 12, TRUE),
  ('collocations_and_idioms', '搭配与惯用表达', 'Collocations and idioms', '处理现实中高频出现的固定搭配。', '["不安を抱く","疑問を持つ","影響を受ける","迷惑をかける","予約を取る"]'::jsonb, 13, TRUE),
  ('ability_potential_difficulty', '能力、可能与难易', 'Ability, potential, and difficulty', '表达能不能、是否容易、是否困难。', '["〜できる","〜られる","〜やすい","〜にくい","〜づらい"]'::jsonb, 14, TRUE),
  ('obligation_necessity_unnecessity', '义务、必要与不必要', 'Obligation, necessity, and unnecessity', '表达必须、不必、应该、规定。', '["〜なければならない","〜ないといけない","〜なくてもいい","〜べき"]'::jsonb, 15, TRUE),
  ('change_start_continuation_end', '变化、开始、持续与结束', 'Change, start, continuation, and end', '表达状态变化、动作开始、持续、完成。', '["〜になる","〜にする","〜てくる","〜ていく","〜始める","〜続ける","〜終わる"]'::jsonb, 16, TRUE),
  ('quotation_reporting_topic', '引用、转述与话题展开', 'Quotation, reporting, and topic development', '表达别人说了什么、我认为、关于某事。', '["〜と言う","〜と思う","〜って","〜という","〜について","〜によると"]'::jsonb, 17, TRUE),
  ('honorifics_and_politeness', '敬语与礼貌表达', 'Honorifics and politeness', '处理敬语、商务表达、客服表达、正式表达。', '["〜ていただけますか","〜させていただきます","〜ております","〜でございます","お願いいたします"]'::jsonb, 18, TRUE)
ON CONFLICT (slug) DO UPDATE SET
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  example_expressions = EXCLUDED.example_expressions,
  priority = EXCLUDED.priority,
  is_mvp = EXCLUDED.is_mvp,
  updated_at = NOW();

UPDATE grammar_categories
SET group_id = (SELECT id FROM grammar_category_groups WHERE slug = 'expressive_functions')
WHERE slug IN (
    'basic_sentence_patterns',
    'particles_and_relations',
    'time_and_sequence',
    'reasons_and_explanations',
    'conditions_and_hypotheses',
    'purpose_and_plans',
    'requests_permission_advice',
    'giving_receiving_benefit',
    'inference_judgment_sources',
    'comparison_degree_scope',
    'contrast_concession_comparison',
    'sentence_final_nuance',
    'collocations_and_idioms',
    'ability_potential_difficulty',
    'obligation_necessity_unnecessity',
    'change_start_continuation_end',
    'quotation_reporting_topic',
    'honorifics_and_politeness'
);

WITH category_seed(slug, name_zh, name_en, description, example_expressions, group_slug, priority) AS (
  VALUES
  ('verb_conjugation_basics', '动词活用基础', 'Verb conjugation basics', '辞书形、ます形、て形等动词基础形。', '["辞書形","ます形","て形"]'::jsonb, 'morphology_conjugation_tense_aspect', 1),
  ('adjective_noun_conjugation', '形容词与名词活用', 'Adjective and noun conjugation', 'い形容词、な形容词和名词句的过去、否定与礼貌形。', '["高かった","静かだった","学生ではありません"]'::jsonb, 'morphology_conjugation_tense_aspect', 2),
  ('tense_and_negation', '时态与否定', 'Tense and negation', '非过去、过去、否定、过去否定及礼貌体对应关系。', '["食べた","食べない","食べなかった","食べませんでした"]'::jsonb, 'morphology_conjugation_tense_aspect', 3),
  ('progressive_state_experience_completion', '进行、状态、经验与完成', 'Progressive, state, experience, and completion', '〜ている、〜てある、〜たことがある、〜たばかり等体系统。', '["〜ている","〜てある","〜たことがある","〜たばかり"]'::jsonb, 'morphology_conjugation_tense_aspect', 4),
  ('derived_forms_potential_passive_causative', '派生形：可能、被动、使役', 'Derived forms: potential, passive, and causative', '可能形、受身形、使役形和使役受身形。', '["行ける","読まれる","読ませる","読ませられる"]'::jsonb, 'morphology_conjugation_tense_aspect', 5),
  ('modification_connection_nominalization', '修饰、连接与名词化', 'Modification, connection, and nominalization', '连体修饰、连用连接、こと/の 名词化。', '["私が買った本","読むこと","読むの"]'::jsonb, 'morphology_conjugation_tense_aspect', 6),
  ('topic_subject_predicate', '主题、主语与谓语', 'Topic, subject, and predicate', '区分话题、焦点、谓语核心和句子骨架。', '["私は学生です","雨が降る"]'::jsonb, 'sentence_structure_components', 7),
  ('noun_modifying_clauses', '名词修饰从句', 'Noun-modifying clauses', '用一个小句修饰名词。', '["私が昨日買った本"]'::jsonb, 'sentence_structure_components', 8),
  ('main_subordinate_clauses', '主句与从句', 'Main and subordinate clauses', '理解主句、从句和因果、条件、时间从句。', '["雨が降ったので行きません"]'::jsonb, 'sentence_structure_components', 9),
  ('ellipsis_context', '省略与语境补全', 'Ellipsis and context recovery', '理解日语中常省略的主语、宾语和已知信息。', '["行きます","お願いします"]'::jsonb, 'sentence_structure_components', 10),
  ('word_order_focus', '语序与信息焦点', 'Word order and information focus', '学习日语基本语序和强调焦点。', '["誰がやりますか","私はそれを昨日買いました"]'::jsonb, 'sentence_structure_components', 11),
  ('case_particles', '格助词', 'Case particles', '系统学习が、を、に、で、へ、と等格关系。', '["が","を","に","で"]'::jsonb, 'particle_system', 12),
  ('topic_contrast_particles', '主题与对比助词', 'Topic and contrast particles', 'は、も、こそ等主题、追加和强调关系。', '["は","も","こそ"]'::jsonb, 'particle_system', 13),
  ('adverbial_particles', '副助词', 'Adverbial particles', 'だけ、しか、さえ、ばかり、ほど等限定和程度。', '["だけ","しか","さえ","ばかり"]'::jsonb, 'particle_system', 14),
  ('sentence_final_particles', '终助词', 'Sentence-final particles', 'よ、ね、よね、かな等句尾语气。', '["よ","ね","よね","かな"]'::jsonb, 'particle_system', 15),
  ('compound_particles', '复合助词', 'Compound particles', 'について、に対して、として、によって等复合关系。', '["について","に対して","として","によって"]'::jsonb, 'particle_system', 16),
  ('plain_polite_register', '普通体与丁宁体', 'Plain and polite register', '普通体、丁宁体和不同场景的切换。', '["行く / 行きます","だった / でした"]'::jsonb, 'register_honorific_social', 17),
  ('casual_spoken_register', 'くだけた口语', 'Casual spoken register', '朋友、家人和线上聊天中的自然口语。', '["じゃん","だよ","かも"]'::jsonb, 'register_honorific_social', 18),
  ('honorific_humble_language', '尊敬语与谦让语', 'Honorific and humble language', '尊敬语、谦让语和丁重语的角色分工。', '["いらっしゃる","伺う","申します"]'::jsonb, 'register_honorific_social', 19),
  ('social_in_out_relationships', '内外关系与上下关系', 'In-group/out-group and hierarchy', '商务和服务场景中的内外、上下、亲疏关系。', '["弊社","御社","先生に伺う"]'::jsonb, 'register_honorific_social', 20),
  ('sequence_connectors', '顺接与推进', 'Sequence and progression connectors', '连接连续动作和话题推进。', '["そして","それから"]'::jsonb, 'discourse_connection_organization', 21),
  ('contrast_connectors', '逆接与转折连接', 'Contrastive connectors', '连接转折、反差和意外展开。', '["しかし","ところが"]'::jsonb, 'discourse_connection_organization', 22),
  ('cause_result_connectors', '原因结果连接', 'Cause-result connectors', '用连接词组织原因和结果。', '["だから","そのため"]'::jsonb, 'discourse_connection_organization', 23),
  ('example_summary_topic_shift', '举例、总结与话题转换', 'Examples, summary, and topic shift', '举例、换言、总结和切换话题。', '["例えば","つまり","ところで"]'::jsonb, 'discourse_connection_organization', 24),
  ('noun_verb_collocations', '名词 + 动词搭配', 'Noun-verb collocations', '予約を取る、影響を受ける等自然搭配。', '["予約を取る","影響を受ける"]'::jsonb, 'lexical_collocations_constructions', 25),
  ('noun_adjective_collocations', '名词 + 形容词搭配', 'Noun-adjective collocations', '人気がある、可能性が高い等高频评价搭配。', '["人気がある","可能性が高い"]'::jsonb, 'lexical_collocations_constructions', 26),
  ('adverb_predicate_collocations', '副词 + 谓语搭配', 'Adverb-predicate collocations', 'しっかり、きちんと等副词和谓语的自然组合。', '["しっかり確認する","きちんと伝える"]'::jsonb, 'lexical_collocations_constructions', 27),
  ('formulaic_scene_expressions', '场景固定表达', 'Formulaic scene expressions', '邮件、商务、服务场景的固定表达块。', '["お世話になる","よろしくお願いいたします"]'::jsonb, 'lexical_collocations_constructions', 28),
  ('particle_contrasts', '助词对比', 'Particle contrasts', 'は/が、に/で等助词选择对比。', '["は vs が","に vs で"]'::jsonb, 'confusing_grammar_contrasts', 29),
  ('condition_contrasts', '条件表达对比', 'Condition contrasts', 'たら、ば、と、なら 的边界。', '["たら vs ば vs と vs なら"]'::jsonb, 'confusing_grammar_contrasts', 30),
  ('reason_purpose_contrasts', '原因与目的对比', 'Reason and purpose contrasts', 'から/ので、ために/ように等。', '["から vs ので","ために vs ように"]'::jsonb, 'confusing_grammar_contrasts', 31),
  ('inference_source_contrasts', '推测与信息来源对比', 'Inference and source contrasts', 'そうだ、らしい、ようだ、みたいだ 的来源和确定度。', '["そうだ vs らしい","ようだ vs みたいだ"]'::jsonb, 'confusing_grammar_contrasts', 32),
  ('benefit_register_contrasts', '授受与语体对比', 'Benefit and register contrasts', 'てくれる/てもらう、もらえますか/いただけますか。', '["てくれる vs てもらう","もらえますか vs いただけますか"]'::jsonb, 'confusing_grammar_contrasts', 33),
  ('connection_errors', '接续错误', 'Connection errors', 'て形、た形、ない形等接续误用。', '["書きください → 書いてください"]'::jsonb, 'error_diagnosis_correction', 34),
  ('particle_errors', '助词错误', 'Particle errors', 'に/で、は/が、を/が等助词误用。', '["駅であります → 駅にあります"]'::jsonb, 'error_diagnosis_correction', 35),
  ('tense_errors', '时态错误', 'Tense errors', '过去、否定、过去否定和时间关系误用。', '["昨日行きます → 昨日行きました"]'::jsonb, 'error_diagnosis_correction', 36),
  ('register_errors', '语体不匹配', 'Register mismatch errors', '对医生、老师、客户等对象语气太随便或过度郑重。', '["もらえる？ → いただけますか"]'::jsonb, 'error_diagnosis_correction', 37),
  ('literal_translation_errors', '中文直译与不自然表达', 'Literal translation and unnatural expression', '中文结构直译导致的不自然日语。', '["不安を持つ → 不安を抱く"]'::jsonb, 'error_diagnosis_correction', 38)
)
INSERT INTO grammar_categories (slug, group_id, name_zh, name_en, description, example_expressions, priority, is_mvp)
SELECT
  category_seed.slug,
  grammar_category_groups.id,
  category_seed.name_zh,
  category_seed.name_en,
  category_seed.description,
  category_seed.example_expressions,
  category_seed.priority,
  TRUE
FROM category_seed
JOIN grammar_category_groups ON grammar_category_groups.slug = category_seed.group_slug
ON CONFLICT (slug) DO UPDATE SET
  group_id = EXCLUDED.group_id,
  name_zh = EXCLUDED.name_zh,
  name_en = EXCLUDED.name_en,
  description = EXCLUDED.description,
  example_expressions = EXCLUDED.example_expressions,
  priority = EXCLUDED.priority,
  is_mvp = EXCLUDED.is_mvp,
  updated_at = NOW();

WITH active_grammar_seed(seed_key) AS (
  VALUES
  ('gp_a_wa_b_desu'),
  ('gp_a_ga_arimasu'),
  ('gp_a_ga_imasu'),
  ('gp_a_ni_narimasu'),
  ('gp_a_ni_shimasu'),
  ('gp_wa'),
  ('gp_ga'),
  ('gp_wo'),
  ('gp_ni'),
  ('gp_de'),
  ('gp_toki'),
  ('gp_mae_ni'),
  ('gp_ato_de'),
  ('gp_te_kara'),
  ('gp_uchi_ni'),
  ('gp_kara_reason'),
  ('gp_node'),
  ('gp_tame'),
  ('gp_okagede'),
  ('gp_seide'),
  ('gp_tara'),
  ('gp_ba'),
  ('gp_to_condition'),
  ('gp_nara'),
  ('gp_baai'),
  ('gp_tame_ni'),
  ('gp_you_ni_purpose'),
  ('gp_tsumori'),
  ('gp_yotei'),
  ('gp_koto_ni_suru'),
  ('gp_te_kudasai'),
  ('gp_te_moraemasu_ka'),
  ('gp_te_mo_ii_desu_ka'),
  ('gp_ta_hou_ga_ii'),
  ('gp_naide_kudasai'),
  ('gp_te_ageru'),
  ('gp_te_kureru'),
  ('gp_te_morau'),
  ('gp_te_itadaku'),
  ('gp_sasete_morau'),
  ('gp_sou_da'),
  ('gp_rashii'),
  ('gp_you_da'),
  ('gp_mitai_da'),
  ('gp_kamoshirenai'),
  ('gp_yori_comparison'),
  ('gp_hodo'),
  ('gp_kurai'),
  ('gp_dake'),
  ('gp_shika_nai'),
  ('gp_kedo'),
  ('gp_ga_contrast'),
  ('gp_noni'),
  ('gp_temo'),
  ('gp_ippou_de'),
  ('gp_n_desu'),
  ('gp_n_desu_ga'),
  ('gp_kana'),
  ('gp_kamo'),
  ('gp_yo_ne'),
  ('gp_fuan_wo_idaku'),
  ('gp_gimon_wo_motsu'),
  ('gp_eikyo_wo_ukeru'),
  ('gp_meiwaku_wo_kakeru'),
  ('gp_yoyaku_wo_toru'),
  ('gp_dekiru'),
  ('gp_rareru_potential'),
  ('gp_yasui'),
  ('gp_nikui'),
  ('gp_zurai'),
  ('gp_nakereba_naranai'),
  ('gp_naito_ikenai'),
  ('gp_nakutemo_ii'),
  ('gp_beki'),
  ('gp_hitsuyou_ga_aru'),
  ('gp_ninaru_change'),
  ('gp_nisuru_change'),
  ('gp_tekuru'),
  ('gp_teiku'),
  ('gp_hajimeru'),
  ('gp_to_iu'),
  ('gp_to_omou'),
  ('gp_tte'),
  ('gp_ni_tsuite'),
  ('gp_ni_yoru_to'),
  ('gp_te_itadakemasu_ka'),
  ('gp_sasete_itadaku'),
  ('gp_te_orimasu'),
  ('gp_de_gozaimasu'),
  ('gp_onegai_itashimasu'),
  ('gp_dict_form'),
  ('gp_masu_form'),
  ('gp_te_form'),
  ('gp_i_adjective_past'),
  ('gp_na_adjective_past'),
  ('gp_noun_negative'),
  ('gp_ta_form'),
  ('gp_nai_form'),
  ('gp_nakatta_form'),
  ('gp_masen_deshita'),
  ('gp_te_iru'),
  ('gp_te_ita'),
  ('gp_te_aru'),
  ('gp_te_shimau'),
  ('gp_te_oku'),
  ('gp_ta_koto_ga_aru'),
  ('gp_ta_bakari'),
  ('gp_tokoro_da'),
  ('gp_potential_form'),
  ('gp_passive_form'),
  ('gp_causative_form'),
  ('gp_causative_passive_form'),
  ('gp_rentai_modifier'),
  ('gp_koto_nominalization'),
  ('gp_no_nominalization'),
  ('gp_topic_subject_structure'),
  ('gp_predicate_core'),
  ('gp_noun_clause_modifier'),
  ('gp_main_subordinate_clause'),
  ('gp_ellipsis'),
  ('gp_word_order_focus'),
  ('gp_mo_particle'),
  ('gp_koso_particle'),
  ('gp_sae_particle'),
  ('gp_bakari'),
  ('gp_ni_taishite'),
  ('gp_toshite_particle'),
  ('gp_plain_style'),
  ('gp_polite_style'),
  ('gp_casual_spoken'),
  ('gp_honorific_language'),
  ('gp_humble_language'),
  ('gp_uchisoto'),
  ('gp_soshite'),
  ('gp_shikashi'),
  ('gp_sono_tame'),
  ('gp_tatoeba'),
  ('gp_tsumari'),
  ('gp_tokorode'),
  ('gp_ninki_ga_aru'),
  ('gp_kanousei_ga_takai'),
  ('gp_shikkari_kakunin_suru'),
  ('gp_kichinto_tsutaeru'),
  ('gp_osewa_ni_naru'),
  ('gp_wa_vs_ga'),
  ('gp_ni_vs_de'),
  ('gp_condition_contrast'),
  ('gp_reason_contrast'),
  ('gp_purpose_contrast'),
  ('gp_inference_contrast'),
  ('gp_connection_error_te'),
  ('gp_particle_error_ni_de'),
  ('gp_tense_error_past'),
  ('gp_register_mismatch_error'),
  ('gp_literal_translation_error')
)
DELETE FROM grammar_points
WHERE is_mvp = TRUE
  AND seed_key IS NOT NULL
  AND seed_key NOT IN (SELECT seed_key FROM active_grammar_seed);

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
  ('gp_a_wa_b_desu', 'AはBです', 'AはBです', 'basic_sentence_patterns', '判断句', '说明 A 是 B，是最基础的名词判断句。', 'A 是 B。', 'A + は + B + です', 'S', 'both', '最基础句型之一；は提示主题，不等于所有中文“是”的位置都要照搬。', 'N5', '["只按中文意思套用「AはBです」，没有确认接续「A + は + B + です」。"]'::jsonb),
  ('gp_a_ga_arimasu', 'Aがあります', 'Aがあります', 'basic_sentence_patterns', '无生命存在', '表示有某物或无生命事物存在。', '有 A。', '名词 + が + あります', 'S', 'both', '用于物品、事情、活动等无生命或抽象对象。', 'N5', '["只按中文意思套用「Aがあります」，没有确认接续「名词 + が + あります」。"]'::jsonb),
  ('gp_a_ga_imasu', 'Aがいます', 'Aがいます', 'basic_sentence_patterns', '有生命存在', '表示人或动物存在。', '有 A / A 在。', '人/动物 + が + います', 'S', 'both', '用于人和动物；地点通常用に标记。', 'N5', '["只按中文意思套用「Aがいます」，没有确认接续「人/动物 + が + います」。"]'::jsonb),
  ('gp_a_ni_narimasu', 'Aになります', 'Aになります', 'basic_sentence_patterns', '变成 / 决定为', '表示变成某种状态，也可用于结果被确定。', '变成 A / 定为 A。', '名词/な形容词 + に + なります；い形容词く + なります', 'S', 'both', '主归基础句型；变化功能详见「〜になる」。', 'N5', '["容易和「Aにします」混淆：なる强调自然变化或结果，する强调人为选择。"]'::jsonb),
  ('gp_a_ni_shimasu', 'Aにします', 'Aにします', 'basic_sentence_patterns', '选择 / 使变成', '表示选择某项，或人为使其变成某状态。', '选 A / 使其成为 A。', '名词/な形容词 + に + します；い形容词く + します', 'S', 'both', '主归基础句型；也和变化表达有关，强调说话人或人为决定。', 'N5', '["不要把自然变化都说成「にします」；没有人为决定时多用「になります」。"]'::jsonb),
  ('gp_wa', 'は', 'は', 'particles_and_relations', '主题', '提示话题或形成对比。', '至于…… / ……是', '名词 + は', 'S', 'both', 'は是主题标记，不只是中文的“主语”。', 'N5', '["把所有主语都写成は会不自然；新信息或焦点常用が。"]'::jsonb),
  ('gp_ga', 'が', 'が', 'particles_and_relations', '主语 / 焦点', '标记主语、新信息、能力或喜好对象。', '……（主语/焦点）', '名词 + が', 'S', 'both', 'が常用于强调“谁/什么”以及第一次出现的信息。', 'N5', '["需要强调焦点时误用は，会让句子重点不清。"]'::jsonb),
  ('gp_wo', 'を', 'を', 'particles_and_relations', '动作对象', '标记他动词的直接对象，也可表示经过点。', '把 / 对……', '名词 + を + 他动词', 'S', 'both', '多数时候标记动作作用对象。', 'N5', '["自动词前通常不用を标记对象；先确认动词是否为他动词。"]'::jsonb),
  ('gp_ni', 'に', 'に', 'particles_and_relations', '时间 / 到达点 / 对象', '标记时间点、到达点、存在地点或间接对象。', '在 / 到 / 给', '名词 + に', 'S', 'both', 'に的功能多，需要结合动词判断。', 'N5', '["动作发生地点多用で，存在地点多用に。"]'::jsonb),
  ('gp_de', 'で', 'で', 'particles_and_relations', '动作地点 / 手段', '标记动作地点、工具、方式或范围。', '在 / 用 / 以', '名词 + で', 'S', 'both', '动作在哪里发生通常用で。', 'N5', '["表示存在位置时不要误用で，应多用に。"]'::jsonb),
  ('gp_toki', '〜とき', '〜とき', 'time_and_sequence', '时间点', '表示某动作或状态发生的时候。', '……的时候', '普通形/名词の + とき', 'S', 'both', '注意前后动作的时间先后会影响前项时态。', 'N5', '["只按中文意思套用「〜とき」，没有确认接续「普通形/名词の + とき」。"]'::jsonb),
  ('gp_mae_ni', '〜前に', '〜前に', 'time_and_sequence', '之前', '表示在某动作或时间之前。', '在……之前', '辞书形/名词の + 前に', 'S', 'both', '动词前接辞书形，不接た形。', 'N5', '["不要说「寝た前に」；动词要用辞书形接前に。"]'::jsonb),
  ('gp_ato_de', '〜後で', '〜後で', 'time_and_sequence', '之后', '表示某动作完成之后再做后项。', '在……之后', 'Vた形/名词の + 後で', 'S', 'both', '动词前接た形，强调前项完成后。', 'N5', '["不要说「食べる後で」；动词要用た形接後で。"]'::jsonb),
  ('gp_te_kara', '〜てから', '〜てから', 'time_and_sequence', '做完再做', '强调完成前项之后再做后项。', '……之后再……', 'Vて + から', 'S', 'spoken', '比後で更强调动作顺序。', 'N5', '["只按中文意思套用「〜てから」，没有确认接续「Vて + から」。"]'::jsonb),
  ('gp_uchi_ni', '〜うちに', '〜うちに', 'time_and_sequence', '趁还在', '趁某状态还持续时做某事，或在期间发生变化。', '趁着……', '普通形/名词の + うちに', 'A', 'both', '常用于机会、状态变化前。', 'N3', '["不要把「うちに」当作单纯的「あとで」；它强调状态持续期间。"]'::jsonb),
  ('gp_kara_reason', '〜から', '〜から', 'reasons_and_explanations', '直接原因', '说明原因或理由，语气较直接。', '因为……', '普通形 + から', 'S', 'spoken', '解释自己行为时常用；正式说明可换ので。', 'N5', '["对客户或上级说明原因时，から可能偏直接，可考虑ので。"]'::jsonb),
  ('gp_node', '〜ので', '〜ので', 'reasons_and_explanations', '柔和原因', '较客观、柔和地说明原因。', '因为……所以……', '普通形 + ので', 'S', 'both', '请求、道歉、说明情况时很自然。', 'N5', '["只按中文意思套用「〜ので」，没有确认接续「普通形 + ので」。"]'::jsonb),
  ('gp_tame', '〜ため', '〜ため', 'reasons_and_explanations', '正式原因', '正式说明原因，也可表示目的。', '由于…… / 为了……', '普通形/名词の + ため', 'A', 'written', '本条主归原因与解释；目的用法可对照「〜ために」。', 'N3', '["「ため」可表原因也可表目的，要通过前后句判断，不要只按“因为”理解。"]'::jsonb),
  ('gp_okagede', '〜おかげで', '〜おかげで', 'reasons_and_explanations', '正面归因', '把好结果归因于某人或某事。', '多亏……', '普通形/名词の + おかげで', 'S', 'spoken', '适合感谢、正面结果。', 'N3', '["只按中文意思套用「〜おかげで」，没有确认接续「普通形/名词の + おかげで」。"]'::jsonb),
  ('gp_seide', '〜せいで', '〜せいで', 'reasons_and_explanations', '负面归因', '把坏结果归因于某人或某事。', '都怪……', '普通形/名词の + せいで', 'A', 'spoken', '带责备感，正式场景谨慎。', 'N3', '["不要把好结果说成「せいで」；好结果通常用「おかげで」。"]'::jsonb),
  ('gp_tara', '〜たら', '〜たら', 'conditions_and_hypotheses', '普通条件', '如果某事发生，就进行或出现后项。', '如果……就……', 'Vた形 + ら', 'S', 'spoken', '日常最通用的条件表达之一。', 'N4', '["只按中文意思套用「〜たら」，没有确认接续「Vた形 + ら」。"]'::jsonb),
  ('gp_ba', '〜ば', '〜ば', 'conditions_and_hypotheses', '一般条件', '表示一般条件、假设或建议条件。', '如果……的话', 'ば形', 'A', 'both', '后项为意志表达时有限制。', 'N4', '["只按中文意思套用「〜ば」，没有确认接续「ば形」。"]'::jsonb),
  ('gp_to_condition', '〜と', '〜と', 'conditions_and_hypotheses', '自然结果', '表示前项发生后，后项自然发生。', '一……就……', '辞书形 + と', 'A', 'both', '不适合接请求、命令等意志表达。', 'N5', '["不要说「押すと、押してください」；と后面一般不接命令请求。"]'::jsonb),
  ('gp_nara', '〜なら', '〜なら', 'conditions_and_hypotheses', '针对话题条件', '承接话题并提出条件、判断或建议。', '如果说……的话', '普通形/名词 + なら', 'S', 'spoken', '对话中承接对方话题很自然。', 'N4', '["只按中文意思套用「〜なら」，没有确认接续「普通形/名词 + なら」。"]'::jsonb),
  ('gp_baai', '〜場合', '〜場合', 'conditions_and_hypotheses', '正式情况', '表示在某种情况下。', '在……的情况下', '普通形/名词の + 場合', 'A', 'written', '手续、客服、规则说明常用。', 'N4', '["只按中文意思套用「〜場合」，没有确认接续「普通形/名词の + 場合」。"]'::jsonb),
  ('gp_tame_ni', '〜ために', '〜ために', 'purpose_and_plans', '目的', '表示为了某目的而做后项。', '为了……', '辞书形/名词の + ために', 'S', 'both', '主语前后一致时最自然；原因用法可对照「〜ため」。', 'N4', '["不要把所有「ため」都理解成目的；结果不可控时常用「ように」。"]'::jsonb),
  ('gp_you_ni_purpose', '〜ように', '〜ように', 'purpose_and_plans', '目标状态', '表示为了达到某状态或避免某情况。', '为了能…… / 以免……', '辞书形/ない形 + ように', 'S', 'both', '常用于能力、可能、状态目标。', 'N4', '["只按中文意思套用「〜ように」，没有确认接续「辞书形/ない形 + ように」。"]'::jsonb),
  ('gp_tsumori', '〜つもり', '〜つもり', 'purpose_and_plans', '打算', '表达说话人的打算或计划。', '打算……', '辞书形/ない形 + つもり', 'S', 'spoken', '比予定更主观。', 'N4', '["只按中文意思套用「〜つもり」，没有确认接续「辞书形/ない形 + つもり」。"]'::jsonb),
  ('gp_yotei', '〜予定', '〜予定', 'purpose_and_plans', '计划安排', '表示已经安排好的计划。', '计划……', '辞书形/名词の + 予定', 'S', 'both', '比つもり更像客观安排。', 'N4', '["只按中文意思套用「〜予定」，没有确认接续「辞书形/名词の + 予定」。"]'::jsonb),
  ('gp_koto_ni_suru', '〜ことにする', '〜ことにする', 'purpose_and_plans', '决定', '表示自己决定做某事。', '决定……', '辞书形/ない形 + ことにする', 'S', 'spoken', '强调决定是自己做出的。', 'N4', '["只按中文意思套用「〜ことにする」，没有确认接续「辞书形/ない形 + ことにする」。"]'::jsonb),
  ('gp_te_kudasai', '〜てください', '〜てください', 'requests_permission_advice', '基本请求', '请对方做某事。', '请……', 'Vて + ください', 'S', 'spoken', '常用但比较直接，对上级或客户可换成更柔和请求。', 'N5', '["对上级或客户直接用可能有命令感，可换「〜ていただけますか」。"]'::jsonb),
  ('gp_te_moraemasu_ka', '〜てもらえますか', '〜てもらえますか', 'requests_permission_advice', '礼貌请求', '请求对方为自己做某事。', '可以请你……吗？', 'Vて + もらえますか', 'S', 'spoken', '请求表达，也和授受表达「〜てもらう」有关；日常礼貌请求非常实用。', 'N4', '["句尾变成「〜てもらえる？」会明显变随便；对医生、老师、客户时可改用「〜ていただけますか」。"]'::jsonb),
  ('gp_te_mo_ii_desu_ka', '〜てもいいですか', '〜てもいいですか', 'requests_permission_advice', '请求许可', '询问自己是否可以做某事。', '可以……吗？', 'Vて + もいいですか', 'S', 'spoken', '日常、学校、公司都常用。', 'N5', '["只按中文意思套用「〜てもいいですか」，没有确认接续「Vて + もいいですか」。"]'::jsonb),
  ('gp_ta_hou_ga_ii', '〜たほうがいい', '〜たほうがいい', 'requests_permission_advice', '建议', '建议对方最好做某事。', '最好……', 'Vた + ほうがいい', 'S', 'spoken', '对上级直接建议时要加缓冲表达。', 'N5', '["只按中文意思套用「〜たほうがいい」，没有确认接续「Vた + ほうがいい」。"]'::jsonb),
  ('gp_naide_kudasai', '〜ないでください', '〜ないでください', 'requests_permission_advice', '禁止请求', '请求对方不要做某事。', '请不要……', 'Vない + でください', 'S', 'spoken', '语气直接，正式提醒可用更郑重表达。', 'N5', '["提醒客户或上级时直接使用可能偏硬，可以加「恐れ入りますが」。"]'::jsonb),
  ('gp_te_ageru', '〜てあげる', '〜てあげる', 'giving_receiving_benefit', '我为别人做', '我为别人做某事，让对方受益。', '帮别人……', 'Vて + あげる', 'A', 'spoken', '对本人直接说可能有施恩感，需谨慎。', 'N4', '["对受益本人直接说「〜てあげます」有时显得居高临下。"]'::jsonb),
  ('gp_te_kureru', '〜てくれる', '〜てくれる', 'giving_receiving_benefit', '别人为我方做', '别人主动为我或我方做某事。', '为我……', 'Vて + くれる', 'S', 'spoken', '主语通常是对方或第三者，受益方偏向说话人。', 'N4', '["只按中文意思套用「〜てくれる」，没有确认接续「Vて + くれる」。"]'::jsonb),
  ('gp_te_morau', '〜てもらう', '〜てもらう', 'giving_receiving_benefit', '我方请别人做', '我方请别人做某事并从中受益。', '请别人帮我……', 'Vて + もらう', 'S', 'spoken', '授受核心表达，也常参与请求表达，如「〜てもらえますか」。', 'N4', '["不要和「〜てくれる」混淆；もらう强调我方请求或安排。"]'::jsonb),
  ('gp_te_itadaku', '〜ていただく', '〜ていただく', 'giving_receiving_benefit', '郑重受益', '郑重表达自己得到对方帮助。', '承蒙您……', 'Vて + いただく', 'S', 'both', '商务邮件和正式场景高频。', 'N4', '["只按中文意思套用「〜ていただく」，没有确认接续「Vて + いただく」。"]'::jsonb),
  ('gp_sasete_morau', '〜させてもらう', '〜させてもらう', 'giving_receiving_benefit', '获得许可', '得到对方允许而做某事。', '让我……', 'V使役形 + てもらう', 'A', 'spoken', '比直接说我要做更有对方许可的感觉。', 'N3', '["只按中文意思套用「〜させてもらう」，没有确认接续「V使役形 + てもらう」。"]'::jsonb),
  ('gp_sou_da', '〜そうだ', '〜そうだ', 'inference_judgment_sources', '样态', '根据眼前迹象判断“看起来要……”。', '看起来……', 'Vます去ます/い形容词去い/な形容词 + そうだ', 'S', 'spoken', '本条主归样态判断；传闻「そうだ」接续不同，需要分开记。', 'N4', '["样态「そうだ」和传闻「そうだ」接续不同，不要混用。"]'::jsonb),
  ('gp_rashii', '〜らしい', '〜らしい', 'inference_judgment_sources', '传闻 / 典型性', '表示听说的信息或典型特征。', '听说…… / 像是……', '普通形 + らしい', 'A', 'both', '信息来源不一定亲眼确认。', 'N4', '["只按中文意思套用「〜らしい」，没有确认接续「普通形 + らしい」。"]'::jsonb),
  ('gp_you_da', '〜ようだ', '〜ようだ', 'inference_judgment_sources', '根据判断', '根据情况判断好像如此，语气较说明性。', '好像……', '普通形/名词の/な形容词な + ようだ', 'A', 'both', '比みたいだ更书面或说明。', 'N4', '["只按中文意思套用「〜ようだ」，没有确认接续「普通形/名词の/な形容词な + ようだ」。"]'::jsonb),
  ('gp_mitai_da', '〜みたいだ', '〜みたいだ', 'inference_judgment_sources', '口语判断', '口语中表示看起来、好像。', '好像……', '普通形/名词 + みたいだ', 'S', 'spoken', '比ようだ更口语自然。', 'N4', '["只按中文意思套用「〜みたいだ」，没有确认接续「普通形/名词 + みたいだ」。"]'::jsonb),
  ('gp_kamoshirenai', '〜かもしれない', '〜かもしれない', 'inference_judgment_sources', '低确定度可能', '表示可能性存在，但不确定。', '也许……', '普通形 + かもしれない', 'S', 'spoken', '比でしょう更不确定。', 'N4', '["只按中文意思套用「〜かもしれない」，没有确认接续「普通形 + かもしれない」。"]'::jsonb),
  ('gp_yori_comparison', '〜より', '〜より', 'comparison_degree_scope', '比较基准', '表示比较的基准。', '比……', '名词 + より', 'S', 'both', '主归比较程度；作为助词也和关系表达有关。', 'N5', '["比较句中常和「ほうが」搭配，不要漏掉比较对象。"]'::jsonb),
  ('gp_hodo', '〜ほど', '〜ほど', 'comparison_degree_scope', '程度 / 比较', '表示程度，也可用于“不如……”。', '到……程度 / 不如……', '名词/普通形 + ほど', 'A', 'both', '常用于否定比较「Aほど〜ない」。', 'N4', '["只按中文意思套用「〜ほど」，没有确认接续「名词/普通形 + ほど」。"]'::jsonb),
  ('gp_kurai', '〜くらい', '〜くらい', 'comparison_degree_scope', '大约 / 程度', '表示大致数量或程度。', '大约 / 到……程度', '数量/普通形 + くらい', 'S', 'spoken', '口语中非常常用，也写作ぐらい。', 'N5', '["只按中文意思套用「〜くらい」，没有确认接续「数量/普通形 + くらい」。"]'::jsonb),
  ('gp_dake', '〜だけ', '〜だけ', 'comparison_degree_scope', '限定', '表示只限定于某范围。', '只……', '名词/普通形 + だけ', 'S', 'both', '强调范围限定，不一定带负面感。', 'N5', '["只按中文意思套用「〜だけ」，没有确认接续「名词/普通形 + だけ」。"]'::jsonb),
  ('gp_shika_nai', '〜しか〜ない', '〜しか〜ない', 'comparison_degree_scope', '限定少量', '表示“只有……”，常带不足感。', '只有……', '名词 + しか + 否定', 'S', 'both', '后面必须接否定形式。', 'N5', '["「しか」后面必须用否定，不要说「しかあります」。"]'::jsonb),
  ('gp_kedo', '〜けど', '〜けど', 'contrast_concession_comparison', '口语转折', '口语中表示但是、铺垫或柔和引出话题。', '但是……', '普通形 + けど', 'S', 'spoken', '比が更口语。', 'N5', '["只按中文意思套用「〜けど」，没有确认接续「普通形 + けど」。"]'::jsonb),
  ('gp_ga_contrast', '〜が', '〜が', 'contrast_concession_comparison', '礼貌转折', '表示转折，也可柔和引出请求。', '但是……', '普通形 + が', 'S', 'both', '比けど更正式一些。', 'N5', '["只按中文意思套用「〜が」，没有确认接续「普通形 + が」。"]'::jsonb),
  ('gp_noni', '〜のに', '〜のに', 'contrast_concession_comparison', '意外转折', '表示与预期相反，带遗憾或惊讶。', '明明……却……', '普通形/名词な + のに', 'A', 'spoken', '带说话人的情绪。', 'N4', '["只按中文意思套用「〜のに」，没有确认接续「普通形/名词な + のに」。"]'::jsonb),
  ('gp_temo', '〜ても', '〜ても', 'contrast_concession_comparison', '让步', '即使前项成立，后项仍成立。', '即使……也……', 'Vて/い形容词くて/な形容词で + も', 'A', 'both', '常用于让步和假设。', 'N4', '["只按中文意思套用「〜ても」，没有确认接续「Vて/い形容词くて/な形容词で + も」。"]'::jsonb),
  ('gp_ippou_de', '〜一方で', '〜一方で', 'contrast_concession_comparison', '另一方面', '表示同一事物的两个对比侧面。', '另一方面……', '普通形/名词である + 一方で', 'B', 'written', '说明文、商务讨论中常用。', 'N3', '["只按中文意思套用「〜一方で」，没有确认接续「普通形/名词である + 一方で」。"]'::jsonb),
  ('gp_n_desu', '〜んです', '〜んです', 'sentence_final_nuance', '解释背景', '说明背景、理由或补充语气，让句子更自然。', '是因为…… / 其实……', '普通形 + んです', 'S', 'spoken', '会话中非常高频，用来补充背景。', 'N4', '["只按中文意思套用「〜んです」，没有确认接续「普通形 + んです」。"]'::jsonb),
  ('gp_n_desu_ga', '〜んですが', '〜んですが', 'sentence_final_nuance', '柔和铺垫', '用解释背景的方式柔和引出请求或问题。', '是这样的……', '普通形 + んですが', 'S', 'spoken', '电话、医院、窗口咨询都很自然。', 'N4', '["只按中文意思套用「〜んですが」，没有确认接续「普通形 + んですが」。"]'::jsonb),
  ('gp_kana', '〜かな', '〜かな', 'sentence_final_nuance', '自问 / 柔和疑问', '表示自言自语式疑问或柔和不确定。', '会不会……呢', '普通形 + かな', 'A', 'spoken', '偏口语，正式场景少用。', 'N4', '["只按中文意思套用「〜かな」，没有确认接续「普通形 + かな」。"]'::jsonb),
  ('gp_kamo', '〜かも', '〜かも', 'sentence_final_nuance', '轻量可能', '口语中柔和表达“也许”。', '也许……', '普通形 + かも', 'A', 'spoken', '比かもしれない更短更口语。', 'N4', '["只按中文意思套用「〜かも」，没有确认接续「普通形 + かも」。"]'::jsonb),
  ('gp_yo_ne', '〜よね', '〜よね', 'sentence_final_nuance', '确认共识', '带有自己判断的确认语气。', '是……对吧', '普通形 + よね', 'S', 'spoken', '对对方确认自己理解是否一致。', 'N5', '["只按中文意思套用「〜よね」，没有确认接续「普通形 + よね」。"]'::jsonb),
  ('gp_fuan_wo_idaku', '不安を抱く', '不安を抱く', 'collocations_and_idioms', '情绪搭配', '自然表达心里怀有不安。', '怀有不安', '不安 + を + 抱く', 'S', 'both', '比直译“持有不安”更自然。', 'N3', '["不要直译成「不安を持つ」；常见自然搭配是「不安を抱く」。"]'::jsonb),
  ('gp_gimon_wo_motsu', '疑問を持つ', '疑問を持つ', 'collocations_and_idioms', '疑问搭配', '表示对某事产生疑问。', '持有疑问 / 感到疑问', '疑問 + を + 持つ', 'S', 'both', '说明不理解或怀疑时很常用。', 'N3', '["只按中文意思套用「疑問を持つ」，没有确认接续「疑問 + を + 持つ」。"]'::jsonb),
  ('gp_eikyo_wo_ukeru', '影響を受ける', '影響を受ける', 'collocations_and_idioms', '影响搭配', '表示受到某人或某事影响。', '受到影响', '影響 + を + 受ける', 'S', 'both', '受ける和影響固定搭配高频。', 'N3', '["只按中文意思套用「影響を受ける」，没有确认接续「影響 + を + 受ける」。"]'::jsonb),
  ('gp_meiwaku_wo_kakeru', '迷惑をかける', '迷惑をかける', 'collocations_and_idioms', '道歉搭配', '表示给别人添麻烦。', '添麻烦', '迷惑 + を + かける', 'S', 'both', '道歉场景非常高频。', 'N4', '["只按中文意思套用「迷惑をかける」，没有确认接续「迷惑 + を + かける」。"]'::jsonb),
  ('gp_yoyaku_wo_toru', '予約を取る', '予約を取る', 'collocations_and_idioms', '预约搭配', '表示预约、订位、挂号。', '预约', '予約 + を + 取る', 'S', 'spoken', '餐厅、医院、电话预约高频。', 'N5', '["只按中文意思套用「予約を取る」，没有确认接续「予約 + を + 取る」。"]'::jsonb),
  ('gp_dekiru', '〜できる', '〜できる', 'ability_potential_difficulty', '能力 / 可能', '表示能够做某事。', '能……', '名词/动词性名词 + が + できる', 'S', 'both', '名词化动作常用「Nができる」。', 'N5', '["只按中文意思套用「〜できる」，没有确认接续「名词/动词性名词 + が + できる」。"]'::jsonb),
  ('gp_rareru_potential', '〜られる', '〜られる', 'ability_potential_difficulty', '可能形', '用动词可能形表达能够做。', '能……', '一段动词去る + られる；五段动词变え段 + る', 'S', 'both', '口语中一段动词有时会省ら，但学习阶段先掌握标准形。', 'N4', '["不要把所有动词都直接加られる；五段动词要变可能形。"]'::jsonb),
  ('gp_yasui', '〜やすい', '〜やすい', 'ability_potential_difficulty', '容易', '表示容易做某事。', '容易……', 'Vます去ます + やすい', 'S', 'both', '常评价物品、说明、动作难易。', 'N4', '["只按中文意思套用「〜やすい」，没有确认接续「Vます去ます + やすい」。"]'::jsonb),
  ('gp_nikui', '〜にくい', '〜にくい', 'ability_potential_difficulty', '困难', '表示不容易做某事。', '难以……', 'Vます去ます + にくい', 'S', 'both', '比づらい更中性。', 'N4', '["只按中文意思套用「〜にくい」，没有确认接续「Vます去ます + にくい」。"]'::jsonb),
  ('gp_zurai', '〜づらい', '〜づらい', 'ability_potential_difficulty', '心理或实际困难', '表示做起来困难，常带心理负担。', '难以……', 'Vます去ます + づらい', 'A', 'spoken', '常用于相談しづらい、言いづらい等。', 'N3', '["づらい常带心理或身体负担，不要和中性的にくい完全等同。"]'::jsonb),
  ('gp_nakereba_naranai', '〜なければならない', '〜なければならない', 'obligation_necessity_unnecessity', '必须', '表示必须做某事。', '必须……', 'Vない去い + ければならない', 'S', 'both', '较标准、书面一些。', 'N4', '["只按中文意思套用「〜なければならない」，没有确认接续「Vない去い + ければならない」。"]'::jsonb),
  ('gp_naito_ikenai', '〜ないといけない', '〜ないといけない', 'obligation_necessity_unnecessity', '必须', '口语中表示必须做某事。', '必须……', 'Vない + といけない', 'S', 'spoken', '比なければならない更口语。', 'N4', '["只按中文意思套用「〜ないといけない」，没有确认接续「Vない + といけない」。"]'::jsonb),
  ('gp_nakutemo_ii', '〜なくてもいい', '〜なくてもいい', 'obligation_necessity_unnecessity', '不必', '表示不做某事也可以。', '不必……', 'Vない去い + くてもいい', 'S', 'spoken', '给许可或说明不必要时常用。', 'N5', '["只按中文意思套用「〜なくてもいい」，没有确认接续「Vない去い + くてもいい」。"]'::jsonb),
  ('gp_beki', '〜べき', '〜べき', 'obligation_necessity_unnecessity', '应该', '表示道理上应该做某事。', '应该……', '辞书形 + べき', 'A', 'written', '语气较强，直接对人说可能像批评。', 'N3', '["对上级或客户直接用べき可能过强，可换更柔和表达。"]'::jsonb),
  ('gp_hitsuyou_ga_aru', '〜必要がある', '〜必要がある', 'obligation_necessity_unnecessity', '有必要', '表示有做某事的必要。', '有必要……', '辞书形 + 必要がある', 'S', 'both', '比べき更客观。', 'N4', '["只按中文意思套用「〜必要がある」，没有确认接续「辞书形 + 必要がある」。"]'::jsonb),
  ('gp_ninaru_change', '〜になる', '〜になる', 'change_start_continuation_end', '变化', '表示自然变化或状态变化。', '变得……', '名词/な形容词 + に + なる；い形容词く + なる', 'S', 'both', '主归变化表达；基础句型中也有「Aになります」。', 'N5', '["和「〜にする」不同，なる强调自然变化或结果，不强调人为决定。"]'::jsonb),
  ('gp_nisuru_change', '〜にする', '〜にする', 'change_start_continuation_end', '人为变化 / 决定', '表示人为使状态变化或做出选择。', '使……变成 / 选……', '名词/な形容词 + に + する；い形容词く + する', 'S', 'both', '和基础句型「Aにします」相连，强调人为选择或处理。', 'N5', '["只按中文意思套用「〜にする」，没有确认接续「名词/な形容词 + に + する；い形容词く + する」。"]'::jsonb),
  ('gp_tekuru', '〜てくる', '〜てくる', 'change_start_continuation_end', '变化到现在', '表示变化向现在靠近，或动作后回来。', '变得……起来 / ……来', 'Vて + くる', 'S', 'spoken', '常用于状态逐渐显现。', 'N4', '["不要只按“来”理解；它常表示变化从过去发展到现在。"]'::jsonb),
  ('gp_teiku', '〜ていく', '〜ていく', 'change_start_continuation_end', '持续到以后', '表示变化朝未来继续，或动作后离开。', '继续……下去 / ……去', 'Vて + いく', 'S', 'spoken', '常用于今后持续变化。', 'N4', '["只按中文意思套用「〜ていく」，没有确认接续「Vて + いく」。"]'::jsonb),
  ('gp_hajimeru', '〜始める', '〜始める', 'change_start_continuation_end', '开始', '表示动作或变化开始。', '开始……', 'Vます去ます + 始める', 'S', 'both', '常用于雨が降り始める、勉強し始める。', 'N4', '["只按中文意思套用「〜始める」，没有确认接续「Vます去ます + 始める」。"]'::jsonb),
  ('gp_to_iu', '〜と言う', '〜と言う', 'quotation_reporting_topic', '引用', '引用别人说的话或内容。', '说……', '引用内容 + と + 言う', 'S', 'both', '直接或间接引用都常用。', 'N5', '["只按中文意思套用「〜と言う」，没有确认接续「引用内容 + と + 言う」。"]'::jsonb),
  ('gp_to_omou', '〜と思う', '〜と思う', 'quotation_reporting_topic', '想法判断', '表达自己的想法、判断或意见。', '我觉得……', '普通形 + と思う', 'S', 'spoken', '也能表示推测判断；本条主归引用与转述。', 'N5', '["只按中文意思套用「〜と思う」，没有确认接续「普通形 + と思う」。"]'::jsonb),
  ('gp_tte', '〜って', '〜って', 'quotation_reporting_topic', '口语引用 / 话题', '口语中表示引用、传闻或提出话题。', '说是…… / 关于……', '普通形/名词 + って', 'A', 'spoken', '很口语，正式邮件不要用。', 'N4', '["只按中文意思套用「〜って」，没有确认接续「普通形/名词 + って」。"]'::jsonb),
  ('gp_ni_tsuite', '〜について', '〜について', 'quotation_reporting_topic', '关于', '提出谈论、学习、询问的主题。', '关于……', '名词 + について', 'S', 'both', '报告、询问、说明都高频。', 'N4', '["只按中文意思套用「〜について」，没有确认接续「名词 + について」。"]'::jsonb),
  ('gp_ni_yoru_to', '〜によると', '〜によると', 'quotation_reporting_topic', '信息来源', '表示信息来源。', '据……', '名词 + によると', 'A', 'both', '新闻、说明、转述中常用。', 'N3', '["只按中文意思套用「〜によると」，没有确认接续「名词 + によると」。"]'::jsonb),
  ('gp_te_itadakemasu_ka', '〜ていただけますか', '〜ていただけますか', 'honorifics_and_politeness', '郑重请求', '更礼貌地请求对方为自己做某事。', '能否请您……？', 'Vて + いただけますか', 'S', 'spoken', '敬语请求，也可视为请求表达的郑重形式。', 'N4', '["对亲密朋友频繁使用会显得过分郑重；正式场景则很安全。"]'::jsonb),
  ('gp_sasete_itadaku', '〜させていただきます', '〜させていただきます', 'honorifics_and_politeness', '请允许我', '郑重表达承蒙允许而做某事。', '请允许我……', 'V使役形 + ていただきます', 'A', 'both', '商务中常用，但过度使用会显得模板化。', 'N3', '["只按中文意思套用「〜させていただきます」，没有确认接续「V使役形 + ていただきます」。"]'::jsonb),
  ('gp_te_orimasu', '〜ております', '〜ております', 'honorifics_and_politeness', '郑重进行 / 状态', '「〜ています」的郑重表达。', '正在…… / 已……', 'Vて + おります', 'S', 'both', '客服、商务邮件、公告中高频。', 'N3', '["只按中文意思套用「〜ております」，没有确认接续「Vて + おります」。"]'::jsonb),
  ('gp_de_gozaimasu', '〜でございます', '〜でございます', 'honorifics_and_politeness', '郑重判断', '「です」的郑重表达。', '是……', '名词 + でございます', 'A', 'both', '客服、酒店、正式介绍中常用。', 'N4', '["只按中文意思套用「〜でございます」，没有确认接续「名词 + でございます」。"]'::jsonb),
  ('gp_onegai_itashimasu', 'お願いいたします', 'お願いいたします', 'honorifics_and_politeness', '郑重请求结尾', '用于正式请求、邮件结尾和客服表达。', '拜托您 / 请您……', '名词/ご確認 + を + お願いいたします', 'S', 'both', '邮件、商务、客服中非常实用。', 'N4', '["只按中文意思套用「お願いいたします」，没有确认接续「名词/ご確認 + を + お願いいたします」。"]'::jsonb),
  ('gp_dict_form', '辞書形', '辞書形', 'verb_conjugation_basics', '基本形', '动词的基本形，用于词典、普通体非过去和许多接续。', '食べる / 行く 这类基本形。', '动词基本形', 'S', 'both', '很多句型接辞书形，如前に、ために、つもり。', 'N5', '["只记住中文意思，忽略「动词基本形」的形式和接续。"]'::jsonb),
  ('gp_masu_form', 'ます形', 'ます形', 'verb_conjugation_basics', '礼貌动词形', '动词的礼貌非过去形式，也是很多复合表达的连接基础。', '做…… / 会……', 'Vます', 'S', 'spoken', 'ます形去掉ます后可接ながら、始める、たい等。', 'N5', '["只记住中文意思，忽略「Vます」的形式和接续。"]'::jsonb),
  ('gp_te_form', 'て形', 'て形', 'verb_conjugation_basics', '连接形', '连接动作、请求、许可、进行体等的核心形式。', '……然后 / 请…… / 正在……', 'Vて', 'S', 'both', 'て形是请求、连接和体表达的基础。', 'N5', '["五段动词て形变化不规则，不要把「書く」说成「書きて」。"]'::jsonb),
  ('gp_i_adjective_past', 'い形容词过去形', 'い形容词过去形', 'adjective_noun_conjugation', 'い形容词过去', '表示い形容词的过去状态。', '以前很……', 'い形容词去い + かった', 'S', 'both', '礼貌形可用「高かったです」。', 'N5', '["不要说「高いでした」；应说「高かったです」。"]'::jsonb),
  ('gp_na_adjective_past', 'な形容词过去形', 'な形容词过去形', 'adjective_noun_conjugation', 'な形容词过去', '表示な形容词的过去状态。', '以前很……', 'な形容词 + だった / でした', 'S', 'both', '普通体用だった，礼貌体用でした。', 'N5', '["只记住中文意思，忽略「な形容词 + だった / でした」的形式和接续。"]'::jsonb),
  ('gp_noun_negative', '名词句否定形', '名词句否定形', 'adjective_noun_conjugation', '名词否定', '表示“不是某人/某物/某身份”。', '不是……', '名词 + ではない / ではありません', 'S', 'both', '口语中也常用じゃない、じゃありません。', 'N5', '["只记住中文意思，忽略「名词 + ではない / ではありません」的形式和接续。"]'::jsonb),
  ('gp_ta_form', '〜た形', '〜た形', 'tense_and_negation', '过去形', '表示动作完成或过去发生，也用于许多接续。', '做了……', 'Vた', 'S', 'both', 'た形既表示过去，也参与条件、经验、后续接续。', 'N5', '["不要只把た形理解为过去；它也能构成たら、たことがある等。"]'::jsonb),
  ('gp_nai_form', '〜ない形', '〜ない形', 'tense_and_negation', '否定形', '表示不做某事，也用于禁止、义务和目的表达。', '不……', 'Vない', 'S', 'both', 'ない形是ないでください、なければならない等表达的基础。', 'N5', '["只记住中文意思，忽略「Vない」的形式和接续。"]'::jsonb),
  ('gp_nakatta_form', '〜なかった', '〜なかった', 'tense_and_negation', '过去否定', '表示过去没有做或过去不是某状态。', '没有……', 'Vない去い + かった', 'S', 'both', '礼貌体可用ませんでした。', 'N5', '["只记住中文意思，忽略「Vない去い + かった」的形式和接续。"]'::jsonb),
  ('gp_masen_deshita', '〜ませんでした', '〜ませんでした', 'tense_and_negation', '礼貌过去否定', '丁宁体中的过去否定。', '没有…… / 没……', 'Vます去ます + ませんでした', 'S', 'spoken', '比なかったです更标准礼貌。', 'N5', '["只记住中文意思，忽略「Vます去ます + ませんでした」的形式和接续。"]'::jsonb),
  ('gp_te_iru', '〜ている', '〜ている', 'progressive_state_experience_completion', '进行 / 结果状态', '表示正在做，或动作后留下的结果状态。', '正在…… / 处于……状态', 'Vて + いる', 'S', 'both', '穿着、结婚、知道等常表示状态，不是正在做。', 'N5', '["「結婚しています」通常是已婚状态，不是“正在结婚”。"]'::jsonb),
  ('gp_te_ita', '〜ていた', '〜ていた', 'progressive_state_experience_completion', '过去进行 / 过去状态', '表示过去正在做或过去持续的状态。', '当时正在…… / 曾处于……状态', 'Vて + いた', 'A', 'both', '和过去时间点搭配时很常用。', 'N4', '["只记住中文意思，忽略「Vて + いた」的形式和接续。"]'::jsonb),
  ('gp_te_aru', '〜てある', '〜てある', 'progressive_state_experience_completion', '人为结果状态', '表示有人有目的地做了某动作，结果状态保留下来。', '已经……好了', '他动词て形 + ある', 'A', 'both', '常用于准备、布置、写好、放好。', 'N4', '["只记住中文意思，忽略「他动词て形 + ある」的形式和接续。"]'::jsonb),
  ('gp_te_shimau', '〜てしまう', '〜てしまう', 'progressive_state_experience_completion', '完成 / 遗憾', '表示动作完成，也可表达遗憾、后悔。', '做完了 / 不小心……了', 'Vて + しまう', 'A', 'spoken', '口语常缩成ちゃう、じゃう。', 'N4', '["只记住中文意思，忽略「Vて + しまう」的形式和接续。"]'::jsonb),
  ('gp_te_oku', '〜ておく', '〜ておく', 'progressive_state_experience_completion', '预先做好', '为了之后方便而提前做某事。', '先……好', 'Vて + おく', 'S', 'spoken', '口语常缩成とく。', 'N4', '["只记住中文意思，忽略「Vて + おく」的形式和接续。"]'::jsonb),
  ('gp_ta_koto_ga_aru', '〜たことがある', '〜たことがある', 'progressive_state_experience_completion', '经验', '表示曾经有过某种经历。', '曾经……过', 'Vた + ことがある', 'S', 'spoken', '强调人生或过去经验，不表示刚刚做完。', 'N4', '["只记住中文意思，忽略「Vた + ことがある」的形式和接续。"]'::jsonb),
  ('gp_ta_bakari', '〜たばかり', '〜たばかり', 'progressive_state_experience_completion', '刚刚', '表示刚做完不久，带主观“刚刚”的感觉。', '刚刚……', 'Vた + ばかり', 'A', 'spoken', '时间长短取决于说话人的感觉。', 'N4', '["只记住中文意思，忽略「Vた + ばかり」的形式和接续。"]'::jsonb),
  ('gp_tokoro_da', '〜ところだ', '〜ところだ', 'progressive_state_experience_completion', '动作阶段', '表示正要、正在、刚刚处于某动作阶段。', '正要 / 正在 / 刚刚……', 'V辞書形/ている/た + ところだ', 'A', 'spoken', '前接形式不同，时间阶段不同。', 'N4', '["只记住中文意思，忽略「V辞書形/ている/た + ところだ」的形式和接续。"]'::jsonb),
  ('gp_potential_form', '可能形', '可能形', 'derived_forms_potential_passive_causative', '可能', '把动词变成“能够做”的形式。', '能……', '五段动词え段 + る；一段动词られる', 'S', 'both', '一段动词可能形和被动形常同形，需要看语境。', 'N4', '["只记住中文意思，忽略「五段动词え段 + る；一段动词られる」的形式和接续。"]'::jsonb),
  ('gp_passive_form', '受身形', '受身形', 'derived_forms_potential_passive_causative', '被动', '表示被做某事，也可表示受害感。', '被……', '五段动词あ段 + れる；一段动词られる', 'A', 'both', '日语被动常带受害或影响。', 'N4', '["只记住中文意思，忽略「五段动词あ段 + れる；一段动词られる」的形式和接续。"]'::jsonb),
  ('gp_causative_form', '使役形', '使役形', 'derived_forms_potential_passive_causative', '使役', '表示让某人做某事，或使某事发生。', '让……做', '五段动词あ段 + せる；一段动词させる', 'A', 'both', '注意自动词/他动词和对象助词。', 'N4', '["只记住中文意思，忽略「五段动词あ段 + せる；一段动词させる」的形式和接续。"]'::jsonb),
  ('gp_causative_passive_form', '使役受身形', '使役受身形', 'derived_forms_potential_passive_causative', '被迫', '表示被迫做某事。', '被迫……', '使役形 + られる', 'B', 'both', '常带不情愿感。', 'N3', '["只记住中文意思，忽略「使役形 + られる」的形式和接续。"]'::jsonb),
  ('gp_rentai_modifier', '連体修飾', '連体修飾', 'modification_connection_nominalization', '名词修饰', '用词或句子直接修饰名词。', '修饰名词的结构', '修饰语 + 名词', 'S', 'both', '日语修饰语放在名词前，长句阅读要先找到被修饰名词。', 'N5', '["只记住中文意思，忽略「修饰语 + 名词」的形式和接续。"]'::jsonb),
  ('gp_koto_nominalization', '〜こと', '〜こと', 'modification_connection_nominalization', '名词化', '把动作或句子变成名词性内容。', '……这件事 / 做……', '普通形 + こと', 'S', 'both', '常用于能力、经验、决定、兴趣等抽象内容。', 'N5', '["只记住中文意思，忽略「普通形 + こと」的形式和接续。"]'::jsonb),
  ('gp_no_nominalization', '〜の', '〜の', 'modification_connection_nominalization', '口语名词化', '把动作或句子名词化，口语感较强。', '……这件事 / 做……', '普通形 + の', 'S', 'spoken', '感知、喜好、具体事件中常用。', 'N5', '["只记住中文意思，忽略「普通形 + の」的形式和接续。"]'::jsonb),
  ('gp_topic_subject_structure', '主題と主語', '主題と主語', 'topic_subject_predicate', '主题和主语', '区分は提示的话题和が标记的主语/焦点。', '主题 vs 主语', '名词 + は / が', 'S', 'both', '这是日语句子结构的核心，不只是助词选择。', 'N5', '["只记住中文意思，忽略「名词 + は / が」的形式和接续。"]'::jsonb),
  ('gp_predicate_core', '述語', '述語', 'topic_subject_predicate', '谓语核心', '理解句末谓语决定句子的时态、语体和极性。', '句末谓语', '句子核心 + 述語', 'S', 'both', '日语重要信息常落在句尾。', 'N5', '["只记住中文意思，忽略「句子核心 + 述語」的形式和接续。"]'::jsonb),
  ('gp_noun_clause_modifier', '名词修饰从句', '名词修饰从句', 'noun_modifying_clauses', '从句修饰名词', '用一个小句修饰后面的名词。', '……的名词', '普通形小句 + 名词', 'S', 'both', '中文母语者容易把「的」硬翻出来。', 'N4', '["只记住中文意思，忽略「普通形小句 + 名词」的形式和接续。"]'::jsonb),
  ('gp_main_subordinate_clause', '主句と従属節', '主句と従属節', 'main_subordinate_clauses', '主从句', '区分主句和说明原因、条件、时间的从句。', '主句与从句', '从句 + 主句', 'A', 'both', '长句阅读时先找句末主句。', 'N4', '["只记住中文意思，忽略「从句 + 主句」的形式和接续。"]'::jsonb),
  ('gp_ellipsis', '省略', '省略', 'ellipsis_context', '语境省略', '日语常省略上下文已知的主语、宾语或话题。', '省略已知信息', '语境 + 省略成分', 'A', 'spoken', '理解省略能显著提升听力和对话理解。', 'N5', '["只记住中文意思，忽略「语境 + 省略成分」的形式和接续。"]'::jsonb),
  ('gp_word_order_focus', '語順と焦点', '語順と焦点', 'word_order_focus', '语序焦点', '日语基本语序相对灵活，但焦点通常由助词和位置共同提示。', '语序与重点', '话题 + 时间/地点 + 对象 + 谓语', 'A', 'both', '不要完全按中文语序组织长句。', 'N5', '["只记住中文意思，忽略「话题 + 时间/地点 + 对象 + 谓语」的形式和接续。"]'::jsonb),
  ('gp_mo_particle', 'も', 'も', 'topic_contrast_particles', '追加', '表示“也”、追加同类信息。', '也……', '名词 + も', 'S', 'both', '可替代は/が/を的位置，表示追加。', 'N5', '["只记住中文意思，忽略「名词 + も」的形式和接续。"]'::jsonb),
  ('gp_koso_particle', 'こそ', 'こそ', 'topic_contrast_particles', '强调', '强调“正是……”。', '正是……', '名词 + こそ', 'B', 'both', '语气强，常用于感谢、强调和对比。', 'N3', '["只记住中文意思，忽略「名词 + こそ」的形式和接续。"]'::jsonb),
  ('gp_sae_particle', 'さえ', 'さえ', 'adverbial_particles', '极端例示', '举出极端例子，表示连……都。', '连……都', '名词 + さえ', 'B', 'both', '常与ば搭配成「さえ〜ば」。', 'N3', '["只记住中文意思，忽略「名词 + さえ」的形式和接续。"]'::jsonb),
  ('gp_bakari', '〜ばかり', '〜ばかり', 'adverbial_particles', '偏多 / 刚做', '表示净是、总是，或刚刚做完。', '光是…… / 刚……', '名词/て形/た形 + ばかり', 'A', 'spoken', '含义取决于接续。', 'N4', '["只记住中文意思，忽略「名词/て形/た形 + ばかり」的形式和接续。"]'::jsonb),
  ('gp_ni_taishite', '〜に対して', '〜に対して', 'compound_particles', '对象 / 对比', '表示动作、态度或评价的对象，也可表示对比。', '对于…… / 与……相对', '名词 + に対して', 'A', 'written', '比について更有“针对对象”的感觉。', 'N3', '["只记住中文意思，忽略「名词 + に対して」的形式和接续。"]'::jsonb),
  ('gp_toshite_particle', '〜として', '〜として', 'compound_particles', '身份 / 立场', '表示以某身份、资格或立场。', '作为……', '名词 + として', 'A', 'both', '商务、自我介绍、说明文中常用。', 'N3', '["只记住中文意思，忽略「名词 + として」的形式和接续。"]'::jsonb),
  ('gp_plain_style', '普通体', '普通体', 'plain_polite_register', '普通体', '朋友、日记、论文引用等场景使用的常体。', '普通说法', '普通形句末', 'S', 'both', '对陌生人直接用普通体可能显得随便。', 'N5', '["只记住中文意思，忽略「普通形句末」的形式和接续。"]'::jsonb),
  ('gp_polite_style', '丁寧体', '丁寧体', 'plain_polite_register', '丁宁体', 'です/ます 结尾的礼貌语体。', '礼貌说法', 'です / ます', 'S', 'spoken', '多数日常对陌生人安全。', 'N5', '["只记住中文意思，忽略「です / ます」的形式和接续。"]'::jsonb),
  ('gp_casual_spoken', 'くだけた口语', 'くだけた口语', 'casual_spoken_register', '随便口语', '朋友和亲近关系中的轻松口语。', '随便说法', '普通体 + 口语句尾', 'A', 'spoken', '不适合医院、客户、上司等正式对象。', 'N4', '["只记住中文意思，忽略「普通体 + 口语句尾」的形式和接续。"]'::jsonb),
  ('gp_honorific_language', '尊敬語', '尊敬語', 'honorific_humble_language', '尊敬语', '抬高对方动作或状态的敬语。', '尊敬表达', '尊敬动词 / お〜になる', 'A', 'both', '尊敬语用于对方或第三者，不用于自己。', 'N4', '["只记住中文意思，忽略「尊敬动词 / お〜になる」的形式和接续。"]'::jsonb),
  ('gp_humble_language', '謙譲語', '謙譲語', 'honorific_humble_language', '谦让语', '降低自己或己方动作以表示对对方的敬意。', '谦让表达', '謙譲動詞 / お〜する', 'A', 'both', '谦让语用于自己或己方动作。', 'N4', '["只记住中文意思，忽略「謙譲動詞 / お〜する」的形式和接续。"]'::jsonb),
  ('gp_uchisoto', '内外関係', '内外関係', 'social_in_out_relationships', '内外关系', '商务中区分自己公司/外部客户的表达立场。', '内外关系', '己方下げ + 外方敬う', 'B', 'both', '对客户说自己上司时也通常不加尊敬。', 'N3', '["只记住中文意思，忽略「己方下げ + 外方敬う」的形式和接续。"]'::jsonb),
  ('gp_soshite', 'そして', 'そして', 'sequence_connectors', '顺接', '连接连续事件或追加说明。', '然后 / 而且', '句子。+ そして + 句子。', 'S', 'both', '不要每句都用そして，长文中要换连接方式。', 'N5', '["只记住中文意思，忽略「句子。+ そして + 句子。」的形式和接续。"]'::jsonb),
  ('gp_shikashi', 'しかし', 'しかし', 'contrast_connectors', '正式逆接', '较正式地连接转折内容。', '但是', '句子。+ しかし + 句子。', 'A', 'written', '口语中でも更自然，正式文中しかし更稳。', 'N4', '["只记住中文意思，忽略「句子。+ しかし + 句子。」的形式和接续。"]'::jsonb),
  ('gp_sono_tame', 'そのため', 'そのため', 'cause_result_connectors', '因此', '连接前文原因和后文结果。', '因此 / 所以', '原因。+ そのため + 結果。', 'A', 'written', '比だから更书面正式。', 'N3', '["只记住中文意思，忽略「原因。+ そのため + 結果。」的形式和接续。"]'::jsonb),
  ('gp_tatoeba', '例えば', '例えば', 'example_summary_topic_shift', '举例', '提出具体例子。', '例如', '例えば + 例', 'S', 'both', '说明抽象内容时很有用。', 'N5', '["只记住中文意思，忽略「例えば + 例」的形式和接续。"]'::jsonb),
  ('gp_tsumari', 'つまり', 'つまり', 'example_summary_topic_shift', '换言总结', '把前文换句话总结。', '也就是说', '説明。+ つまり + 要点。', 'A', 'both', '适合说明重点，不适合随便硬接无关内容。', 'N3', '["只记住中文意思，忽略「説明。+ つまり + 要点。」的形式和接续。"]'::jsonb),
  ('gp_tokorode', 'ところで', 'ところで', 'example_summary_topic_shift', '话题转换', '转换话题或引出新问题。', '话说 / 对了', 'ところで + 新话题', 'A', 'spoken', '用于换话题，不是单纯的“但是”。', 'N4', '["只记住中文意思，忽略「ところで + 新话题」的形式和接续。"]'::jsonb),
  ('gp_ninki_ga_aru', '人気がある', '人気がある', 'noun_adjective_collocations', '人气搭配', '自然表达有人气、受欢迎。', '有人气 / 受欢迎', '名词 + は/が + 人気がある', 'S', 'both', '不要直译成「人気です」处理所有场景。', 'N5', '["只记住中文意思，忽略「名词 + は/が + 人気がある」的形式和接续。"]'::jsonb),
  ('gp_kanousei_ga_takai', '可能性が高い', '可能性が高い', 'noun_adjective_collocations', '可能性搭配', '表示某事发生的可能性高。', '可能性高', '可能性 + が + 高い', 'A', 'both', '新闻、商务说明中常用。', 'N3', '["只记住中文意思，忽略「可能性 + が + 高い」的形式和接续。"]'::jsonb),
  ('gp_shikkari_kakunin_suru', 'しっかり確認する', 'しっかり確認する', 'adverb_predicate_collocations', '确认搭配', '表示认真、充分地确认。', '好好确认', 'しっかり + 確認する', 'S', 'spoken', '比ただの確認する更有认真感。', 'N4', '["只记住中文意思，忽略「しっかり + 確認する」的形式和接续。"]'::jsonb),
  ('gp_kichinto_tsutaeru', 'きちんと伝える', 'きちんと伝える', 'adverb_predicate_collocations', '传达搭配', '表示清楚、合适地传达。', '好好传达', 'きちんと + 伝える', 'A', 'spoken', '常用于工作和说明场景。', 'N4', '["只记住中文意思，忽略「きちんと + 伝える」的形式和接续。"]'::jsonb),
  ('gp_osewa_ni_naru', 'お世話になる', 'お世話になる', 'formulaic_scene_expressions', '固定寒暄', '表示受到照顾，也用于商务寒暄。', '承蒙照顾', 'お世話 + に + なる', 'S', 'both', '邮件和商务沟通中高频。', 'N4', '["只记住中文意思，忽略「お世話 + に + なる」的形式和接续。"]'::jsonb),
  ('gp_wa_vs_ga', 'は vs が', 'は vs が', 'particle_contrasts', '主题与焦点对比', '对比は的话题功能和が的焦点/主语功能。', 'は 和 が 的区别', 'は提示主题；が标记焦点/主语', 'S', 'both', '这是中文母语者最高频易混点。', 'N5', '["只记住中文意思，忽略「は提示主题；が标记焦点/主语」的形式和接续。"]'::jsonb),
  ('gp_ni_vs_de', 'に vs で', 'に vs で', 'particle_contrasts', '地点助词对比', '区分存在地点に和动作地点で。', 'に 和 で 的区别', '存在地点 + に；动作地点 + で', 'S', 'both', '动词类型决定助词选择。', 'N5', '["只记住中文意思，忽略「存在地点 + に；动作地点 + で」的形式和接续。"]'::jsonb),
  ('gp_condition_contrast', 'たら vs ば vs と vs なら', 'たら vs ば vs と vs なら', 'condition_contrasts', '条件对比', '比较四种常见条件表达的使用边界。', '如果的不同说法', 'たら/ば/と/なら', 'S', 'both', '日常对话不知道选哪个时，たら常最安全。', 'N4', '["只记住中文意思，忽略「たら/ば/と/なら」的形式和接续。"]'::jsonb),
  ('gp_reason_contrast', 'から vs ので', 'から vs ので', 'reason_purpose_contrasts', '原因对比', '比较直接原因から和柔和客观ので。', '因为的不同说法', '普通形 + から / ので', 'S', 'both', '礼貌请求和说明情况时ので更自然。', 'N5', '["只记住中文意思，忽略「普通形 + から / ので」的形式和接续。"]'::jsonb),
  ('gp_purpose_contrast', 'ために vs ように', 'ために vs ように', 'reason_purpose_contrasts', '目的对比', '比较意志目的ために和状态目标ように。', '为了的不同说法', '辞書形 + ために；可能/ない + ように', 'A', 'both', '结果不可控时常用ように。', 'N4', '["只记住中文意思，忽略「辞書形 + ために；可能/ない + ように」的形式和接续。"]'::jsonb),
  ('gp_inference_contrast', 'そうだ vs らしい', 'そうだ vs らしい', 'inference_source_contrasts', '样态与传闻对比', '比较眼前迹象そうだ和间接信息らしい。', '看起来 vs 听说', '样态そうだ / 传闻らしい', 'A', 'both', '注意信息来源和接续不同。', 'N4', '["只记住中文意思，忽略「样态そうだ / 传闻らしい」的形式和接续。"]'::jsonb),
  ('gp_connection_error_te', 'て形接续错误', 'て形接续错误', 'connection_errors', '接续诊断', '识别该用て形却误用ます词干或辞书形的错误。', '接续错了', 'Vて + 后续表达', 'S', 'both', '常见于〜てください、〜てもいい、〜ている。', 'N5', '["只记住中文意思，忽略「Vて + 后续表达」的形式和接续。"]'::jsonb),
  ('gp_particle_error_ni_de', '助词に/で错误', '助词に/で错误', 'particle_errors', '助词诊断', '识别存在地点和动作地点混淆。', 'に/で 用错', '存在地点に；动作地点で', 'S', 'both', '先看动词是存在还是动作。', 'N5', '["只记住中文意思，忽略「存在地点に；动作地点で」的形式和接续。"]'::jsonb),
  ('gp_tense_error_past', '时态错误', '时态错误', 'tense_errors', '时态诊断', '识别过去时间却使用非过去形式的错误。', '时态不匹配', '过去时间 + 过去形', 'S', 'both', '昨日、先週、さっき等时间词常要求过去形。', 'N5', '["只记住中文意思，忽略「过去时间 + 过去形」的形式和接续。"]'::jsonb),
  ('gp_register_mismatch_error', '语体不匹配', '语体不匹配', 'register_errors', '语体诊断', '识别对象正式但句子过于随便，或语体混杂。', '语气不合适', '场景 + 合适语体', 'S', 'spoken', '医院、客户、上司场景要避免过随便。', 'N4', '["只记住中文意思，忽略「场景 + 合适语体」的形式和接续。"]'::jsonb),
  ('gp_literal_translation_error', '中文直译', '中文直译', 'literal_translation_errors', '自然度诊断', '识别按中文词序或搭配硬翻导致的不自然日语。', '中式日语', '自然搭配 + 日语语序', 'S', 'both', '优先记自然搭配和日语句型。', 'N4', '["只记住中文意思，忽略「自然搭配 + 日语语序」的形式和接续。"]'::jsonb)
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

WITH active_category_slugs(slug) AS (
  VALUES
  ('basic_sentence_patterns'),
  ('particles_and_relations'),
  ('time_and_sequence'),
  ('reasons_and_explanations'),
  ('conditions_and_hypotheses'),
  ('purpose_and_plans'),
  ('requests_permission_advice'),
  ('giving_receiving_benefit'),
  ('inference_judgment_sources'),
  ('comparison_degree_scope'),
  ('contrast_concession_comparison'),
  ('sentence_final_nuance'),
  ('collocations_and_idioms'),
  ('ability_potential_difficulty'),
  ('obligation_necessity_unnecessity'),
  ('change_start_continuation_end'),
  ('quotation_reporting_topic'),
  ('honorifics_and_politeness'),
  ('verb_conjugation_basics'),
  ('adjective_noun_conjugation'),
  ('tense_and_negation'),
  ('progressive_state_experience_completion'),
  ('derived_forms_potential_passive_causative'),
  ('modification_connection_nominalization'),
  ('topic_subject_predicate'),
  ('noun_modifying_clauses'),
  ('main_subordinate_clauses'),
  ('ellipsis_context'),
  ('word_order_focus'),
  ('case_particles'),
  ('topic_contrast_particles'),
  ('adverbial_particles'),
  ('sentence_final_particles'),
  ('compound_particles'),
  ('plain_polite_register'),
  ('casual_spoken_register'),
  ('honorific_humble_language'),
  ('social_in_out_relationships'),
  ('sequence_connectors'),
  ('contrast_connectors'),
  ('cause_result_connectors'),
  ('example_summary_topic_shift'),
  ('noun_verb_collocations'),
  ('noun_adjective_collocations'),
  ('adverb_predicate_collocations'),
  ('formulaic_scene_expressions'),
  ('particle_contrasts'),
  ('condition_contrasts'),
  ('reason_purpose_contrasts'),
  ('inference_source_contrasts'),
  ('benefit_register_contrasts'),
  ('connection_errors'),
  ('particle_errors'),
  ('tense_errors'),
  ('register_errors'),
  ('literal_translation_errors')
)
DELETE FROM grammar_categories
WHERE is_mvp = TRUE
  AND slug NOT IN (SELECT slug FROM active_category_slugs);

DELETE FROM similar_grammar_relations
USING grammar_points
WHERE grammar_points.is_mvp = TRUE
  AND (
    similar_grammar_relations.grammar_point_id = grammar_points.id
    OR similar_grammar_relations.similar_grammar_point_id = grammar_points.id
  );

DELETE FROM example_sentences
USING grammar_points
WHERE example_sentences.grammar_point_id = grammar_points.id
  AND grammar_points.is_mvp = TRUE;

DELETE FROM grammar_point_scene_tags
USING grammar_points
WHERE grammar_point_scene_tags.grammar_point_id = grammar_points.id
  AND grammar_points.is_mvp = TRUE;

DELETE FROM grammar_point_register_tags
USING grammar_points
WHERE grammar_point_register_tags.grammar_point_id = grammar_points.id
  AND grammar_points.is_mvp = TRUE;

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
  ('gp_te_kara', 'government_office'),
  ('gp_baai', 'customer_service'),
  ('gp_baai', 'government_office'),
  ('gp_te_moraemasu_ka', 'hospital'),
  ('gp_te_moraemasu_ka', 'restaurant'),
  ('gp_te_moraemasu_ka', 'workplace'),
  ('gp_te_mo_ii_desu_ka', 'school'),
  ('gp_te_mo_ii_desu_ka', 'workplace'),
  ('gp_te_mo_ii_desu_ka', 'travel'),
  ('gp_ta_hou_ga_ii', 'hospital'),
  ('gp_ta_hou_ga_ii', 'workplace'),
  ('gp_n_desu_ga', 'phone_call'),
  ('gp_n_desu_ga', 'hospital'),
  ('gp_n_desu_ga', 'government_office'),
  ('gp_kana', 'friend_chat'),
  ('gp_kana', 'online_chat'),
  ('gp_kamo', 'friend_chat'),
  ('gp_kamo', 'online_chat'),
  ('gp_yoyaku_wo_toru', 'restaurant'),
  ('gp_yoyaku_wo_toru', 'hospital'),
  ('gp_yoyaku_wo_toru', 'phone_call'),
  ('gp_tte', 'friend_chat'),
  ('gp_tte', 'online_chat'),
  ('gp_te_itadakemasu_ka', 'hospital'),
  ('gp_te_itadakemasu_ka', 'workplace'),
  ('gp_te_itadakemasu_ka', 'email'),
  ('gp_te_itadakemasu_ka', 'customer_service')
)
INSERT INTO grammar_point_scene_tags (grammar_point_id, scene_tag_id)
SELECT grammar_points.id, scene_tags.id
FROM scene_seed
JOIN grammar_points ON grammar_points.seed_key = scene_seed.seed_key
JOIN scene_tags ON scene_tags.name_en = scene_seed.tag_name_en
ON CONFLICT DO NOTHING;

WITH register_seed(seed_key, tag_name_en) AS (
  VALUES
  ('gp_tame', 'written'),
  ('gp_tame', 'formal'),
  ('gp_baai', 'business'),
  ('gp_baai', 'formal'),
  ('gp_yotei', 'business'),
  ('gp_te_kudasai', 'customer'),
  ('gp_te_moraemasu_ka', 'soft'),
  ('gp_te_moraemasu_ka', 'business'),
  ('gp_te_ageru', 'casual'),
  ('gp_te_itadaku', 'business'),
  ('gp_te_itadaku', 'formal'),
  ('gp_te_itadaku', 'written'),
  ('gp_mitai_da', 'casual'),
  ('gp_kedo', 'casual'),
  ('gp_ga_contrast', 'business'),
  ('gp_ga_contrast', 'formal'),
  ('gp_ippou_de', 'written'),
  ('gp_ippou_de', 'business'),
  ('gp_kana', 'casual'),
  ('gp_kana', 'soft'),
  ('gp_kamo', 'casual'),
  ('gp_kamo', 'soft'),
  ('gp_meiwaku_wo_kakeru', 'business'),
  ('gp_meiwaku_wo_kakeru', 'formal'),
  ('gp_nakereba_naranai', 'formal'),
  ('gp_nakereba_naranai', 'written'),
  ('gp_tte', 'casual'),
  ('gp_ni_tsuite', 'business'),
  ('gp_ni_tsuite', 'written'),
  ('gp_ni_yoru_to', 'news'),
  ('gp_ni_yoru_to', 'academic'),
  ('gp_ni_yoru_to', 'written'),
  ('gp_te_itadakemasu_ka', 'business'),
  ('gp_te_itadakemasu_ka', 'formal'),
  ('gp_te_itadakemasu_ka', 'soft'),
  ('gp_sasete_itadaku', 'business'),
  ('gp_sasete_itadaku', 'formal'),
  ('gp_sasete_itadaku', 'written'),
  ('gp_te_orimasu', 'business'),
  ('gp_te_orimasu', 'customer'),
  ('gp_te_orimasu', 'formal'),
  ('gp_te_orimasu', 'written'),
  ('gp_de_gozaimasu', 'customer'),
  ('gp_de_gozaimasu', 'formal'),
  ('gp_de_gozaimasu', 'business'),
  ('gp_onegai_itashimasu', 'business'),
  ('gp_onegai_itashimasu', 'formal'),
  ('gp_onegai_itashimasu', 'written'),
  ('gp_onegai_itashimasu', 'customer')
)
INSERT INTO grammar_point_register_tags (grammar_point_id, register_tag_id)
SELECT grammar_points.id, register_tags.id
FROM register_seed
JOIN grammar_points ON grammar_points.seed_key = register_seed.seed_key
JOIN register_tags ON register_tags.name_en = register_seed.tag_name_en
ON CONFLICT DO NOTHING;

WITH example_seed(seed_key, jp, zh, scene_name_en, register_name_en, difficulty, naturalness_score, notes) AS (
  VALUES
  ('gp_a_wa_b_desu', '私は会社員です。', '我是公司职员。', 'daily_life', 'polite', 1, 5, 'AはBです 的自然例句。'),
  ('gp_a_wa_b_desu', 'これは日本語の辞書です。', '这是日语词典。', 'daily_life', 'polite', 2, 5, 'AはBです 的自然例句。'),
  ('gp_a_ga_arimasu', '机の上に資料があります。', '桌子上有资料。', 'daily_life', 'polite', 1, 5, 'Aがあります 的自然例句。'),
  ('gp_a_ga_arimasu', '近くに駅があります。', '附近有车站。', 'daily_life', 'polite', 2, 5, 'Aがあります 的自然例句。'),
  ('gp_a_ga_imasu', 'ロビーに先生がいます。', '大厅里有老师。', 'daily_life', 'polite', 1, 5, 'Aがいます 的自然例句。'),
  ('gp_a_ga_imasu', '公園に子どもがいます。', '公园里有孩子。', 'daily_life', 'polite', 2, 5, 'Aがいます 的自然例句。'),
  ('gp_a_ni_narimasu', '来月から社会人になります。', '下个月开始成为社会人。', 'daily_life', 'polite', 1, 5, 'Aになります 的自然例句。'),
  ('gp_a_ni_narimasu', '会議は午後三時になります。', '会议定在下午三点。', 'daily_life', 'polite', 2, 5, 'Aになります 的自然例句。'),
  ('gp_a_ni_shimasu', '飲み物はお茶にします。', '饮料我选茶。', 'daily_life', 'polite', 1, 5, 'Aにします 的自然例句。'),
  ('gp_a_ni_shimasu', '部屋を静かにします。', '把房间弄安静。', 'daily_life', 'polite', 2, 5, 'Aにします 的自然例句。'),
  ('gp_wa', '私は中国から来ました。', '我来自中国。', 'daily_life', 'polite', 1, 5, 'は 的自然例句。'),
  ('gp_wa', 'この本はわかりやすいです。', '这本书很容易懂。', 'daily_life', 'polite', 2, 5, 'は 的自然例句。'),
  ('gp_ga', '雨が降っています。', '正在下雨。', 'daily_life', 'polite', 1, 5, 'が 的自然例句。'),
  ('gp_ga', '誰が担当しますか。', '谁来负责？', 'daily_life', 'polite', 2, 5, 'が 的自然例句。'),
  ('gp_wo', 'コーヒーを飲みます。', '喝咖啡。', 'daily_life', 'polite', 1, 5, 'を 的自然例句。'),
  ('gp_wo', '駅前を歩きます。', '走过车站前。', 'daily_life', 'polite', 2, 5, 'を 的自然例句。'),
  ('gp_ni', '先生にメールを送りました。', '给老师发了邮件。', 'daily_life', 'polite', 1, 5, 'に 的自然例句。'),
  ('gp_ni', '七時に起きます。', '七点起床。', 'daily_life', 'polite', 2, 5, 'に 的自然例句。'),
  ('gp_de', '図書館で勉強します。', '在图书馆学习。', 'daily_life', 'polite', 1, 5, 'で 的自然例句。'),
  ('gp_de', '電車で会社へ行きます。', '坐电车去公司。', 'daily_life', 'polite', 2, 5, 'で 的自然例句。'),
  ('gp_toki', '日本へ行くとき、パスポートを持って行きます。', '去日本的时候会带护照。', 'daily_life', 'polite', 1, 5, '〜とき 的自然例句。'),
  ('gp_toki', '子どものとき、よく泳ぎました。', '小时候经常游泳。', 'daily_life', 'polite', 2, 5, '〜とき 的自然例句。'),
  ('gp_mae_ni', '寝る前に、歯を磨きます。', '睡觉前刷牙。', 'daily_life', 'polite', 1, 5, '〜前に 的自然例句。'),
  ('gp_mae_ni', '会議の前に資料を読みます。', '会议前读资料。', 'daily_life', 'polite', 2, 5, '〜前に 的自然例句。'),
  ('gp_ato_de', '昼ご飯を食べた後で、散歩します。', '吃完午饭后散步。', 'daily_life', 'polite', 1, 5, '〜後で 的自然例句。'),
  ('gp_ato_de', '授業の後で質問しました。', '课后提问了。', 'daily_life', 'polite', 2, 5, '〜後で 的自然例句。'),
  ('gp_te_kara', '手を洗ってから、ご飯を食べます。', '洗手后再吃饭。', 'government_office', 'polite', 1, 5, '〜てから 的自然例句。'),
  ('gp_te_kara', '申請書を書いてから窓口に出します。', '填完申请表后交到窗口。', 'government_office', 'polite', 2, 5, '〜てから 的自然例句。'),
  ('gp_uchi_ni', '若いうちにたくさん旅行したいです。', '趁年轻想多旅行。', 'daily_life', 'polite', 1, 5, '〜うちに 的自然例句。'),
  ('gp_uchi_ni', '雨が降らないうちに帰りましょう。', '趁还没下雨回去吧。', 'daily_life', 'polite', 2, 5, '〜うちに 的自然例句。'),
  ('gp_kara_reason', '雨が降っているから、出かけません。', '因为正在下雨，所以不出门。', 'daily_life', 'polite', 1, 5, '〜から 的自然例句。'),
  ('gp_kara_reason', '時間がないから急ぎましょう。', '因为没时间，快一点吧。', 'daily_life', 'polite', 2, 5, '〜から 的自然例句。'),
  ('gp_node', '体調が悪いので、早めに帰ります。', '因为身体不舒服，我早点回去。', 'daily_life', 'polite', 1, 5, '〜ので 的自然例句。'),
  ('gp_node', '電車が遅れたので、少し遅れます。', '因为电车晚点，会稍微迟到。', 'daily_life', 'polite', 2, 5, '〜ので 的自然例句。'),
  ('gp_tame', '台風のため、電車が止まりました。', '由于台风，电车停运了。', 'daily_life', 'written', 1, 5, '〜ため 的自然例句。'),
  ('gp_tame', '安全確認のため、少々お待ちください。', '为了安全确认，请稍等。', 'daily_life', 'written', 2, 5, '〜ため 的自然例句。'),
  ('gp_okagede', '先生のおかげで合格できました。', '多亏老师，我合格了。', 'daily_life', 'polite', 1, 5, '〜おかげで 的自然例句。'),
  ('gp_okagede', '手伝ってくれたおかげで早く終わりました。', '多亏你帮忙，早点结束了。', 'daily_life', 'polite', 2, 5, '〜おかげで 的自然例句。'),
  ('gp_seide', '雨のせいで靴が濡れました。', '都怪下雨，鞋子湿了。', 'daily_life', 'polite', 1, 5, '〜せいで 的自然例句。'),
  ('gp_seide', '寝不足のせいで集中できません。', '因为睡眠不足，无法集中。', 'daily_life', 'polite', 2, 5, '〜せいで 的自然例句。'),
  ('gp_tara', '駅に着いたら電話してください。', '到了车站请给我打电话。', 'daily_life', 'polite', 1, 5, '〜たら 的自然例句。'),
  ('gp_tara', '時間があったら映画を見ます。', '有时间的话看电影。', 'daily_life', 'polite', 2, 5, '〜たら 的自然例句。'),
  ('gp_ba', '春になれば桜が咲きます。', '到了春天樱花会开。', 'daily_life', 'polite', 1, 5, '〜ば 的自然例句。'),
  ('gp_ba', 'わからなければ聞いてください。', '不懂的话请问。', 'daily_life', 'polite', 2, 5, '〜ば 的自然例句。'),
  ('gp_to_condition', 'このボタンを押すとドアが開きます。', '一按这个按钮门就会开。', 'daily_life', 'polite', 1, 5, '〜と 的自然例句。'),
  ('gp_to_condition', '右へ曲がると駅があります。', '向右拐就有车站。', 'daily_life', 'polite', 2, 5, '〜と 的自然例句。'),
  ('gp_nara', '京都へ行くならこの店がおすすめです。', '如果去京都，推荐这家店。', 'daily_life', 'polite', 1, 5, '〜なら 的自然例句。'),
  ('gp_nara', '日本語を勉強するなら毎日聞くといいです。', '如果学日语，每天听比较好。', 'daily_life', 'polite', 2, 5, '〜なら 的自然例句。'),
  ('gp_baai', '遅れる場合は連絡してください。', '如果会迟到，请联系。', 'customer_service', 'business', 1, 5, '〜場合 的自然例句。'),
  ('gp_baai', '雨の場合、イベントは中止です。', '下雨的情况下，活动取消。', 'customer_service', 'business', 2, 5, '〜場合 的自然例句。'),
  ('gp_tame_ni', '日本で働くために勉強しています。', '为了在日本工作而学习。', 'daily_life', 'polite', 1, 5, '〜ために 的自然例句。'),
  ('gp_tame_ni', '健康のために毎日歩きます。', '为了健康每天走路。', 'daily_life', 'polite', 2, 5, '〜ために 的自然例句。'),
  ('gp_you_ni_purpose', '忘れないようにメモします。', '为了不忘而记笔记。', 'daily_life', 'polite', 1, 5, '〜ように 的自然例句。'),
  ('gp_you_ni_purpose', '聞こえるように大きな声で話してください。', '请大声说，以便能听见。', 'daily_life', 'polite', 2, 5, '〜ように 的自然例句。'),
  ('gp_tsumori', '週末は家で勉強するつもりです。', '周末打算在家学习。', 'daily_life', 'polite', 1, 5, '〜つもり 的自然例句。'),
  ('gp_tsumori', '来年、日本へ行くつもりです。', '明年打算去日本。', 'daily_life', 'polite', 2, 5, '〜つもり 的自然例句。'),
  ('gp_yotei', '来週、面接を受ける予定です。', '下周计划参加面试。', 'daily_life', 'business', 1, 5, '〜予定 的自然例句。'),
  ('gp_yotei', '会議は午後三時に始まる予定です。', '会议计划下午三点开始。', 'daily_life', 'business', 2, 5, '〜予定 的自然例句。'),
  ('gp_koto_ni_suru', '毎朝日本語を聞くことにしました。', '决定每天早上听日语。', 'daily_life', 'polite', 1, 5, '〜ことにする 的自然例句。'),
  ('gp_koto_ni_suru', '今日は早く帰ることにします。', '今天决定早点回去。', 'daily_life', 'polite', 2, 5, '〜ことにする 的自然例句。'),
  ('gp_te_kudasai', 'ここに名前を書いてください。', '请在这里写名字。', 'daily_life', 'customer', 1, 5, '〜てください 的自然例句。'),
  ('gp_te_kudasai', '少し待ってください。', '请稍等。', 'daily_life', 'customer', 2, 5, '〜てください 的自然例句。'),
  ('gp_te_moraemasu_ka', 'すみません、もう一度説明してもらえますか。', '不好意思，可以请您再说明一遍吗？', 'hospital', 'polite', 1, 5, '医院里对医生可用，一般礼貌。'),
  ('gp_te_moraemasu_ka', 'この席を少し移動してもらえますか。', '可以请你把这个座位稍微挪一下吗？', 'restaurant', 'polite', 2, 5, '对店员或同桌都自然。'),
  ('gp_te_mo_ii_desu_ka', 'ここで写真を撮ってもいいですか。', '可以在这里拍照吗？', 'school', 'polite', 1, 5, '〜てもいいですか 的自然例句。'),
  ('gp_te_mo_ii_desu_ka', '窓を開けてもいいですか。', '可以打开窗户吗？', 'school', 'polite', 2, 5, '〜てもいいですか 的自然例句。'),
  ('gp_ta_hou_ga_ii', '早く病院へ行ったほうがいいです。', '最好早点去医院。', 'hospital', 'polite', 1, 5, '〜たほうがいい 的自然例句。'),
  ('gp_ta_hou_ga_ii', '無理しないほうがいいです。', '最好不要勉强。', 'hospital', 'polite', 2, 5, '〜たほうがいい 的自然例句。'),
  ('gp_naide_kudasai', 'ここでタバコを吸わないでください。', '请不要在这里吸烟。', 'daily_life', 'polite', 1, 5, '〜ないでください 的自然例句。'),
  ('gp_naide_kudasai', '大きな声で話さないでください。', '请不要大声说话。', 'daily_life', 'polite', 2, 5, '〜ないでください 的自然例句。'),
  ('gp_te_ageru', '弟に宿題を教えてあげました。', '我帮弟弟教了作业。', 'daily_life', 'casual', 1, 5, '〜てあげる 的自然例句。'),
  ('gp_te_ageru', '友だちに駅まで案内してあげました。', '我帮朋友带路到车站。', 'daily_life', 'casual', 2, 5, '〜てあげる 的自然例句。'),
  ('gp_te_kureru', '友だちが手伝ってくれました。', '朋友帮了我。', 'daily_life', 'polite', 1, 5, '〜てくれる 的自然例句。'),
  ('gp_te_kureru', '先生が詳しく説明してくれました。', '老师详细说明给我听了。', 'daily_life', 'polite', 2, 5, '〜てくれる 的自然例句。'),
  ('gp_te_morau', '同僚に資料を確認してもらいました。', '我请同事确认了资料。', 'daily_life', 'polite', 1, 5, '〜てもらう 的自然例句。'),
  ('gp_te_morau', '友だちに駅まで来てもらいました。', '我请朋友来车站。', 'daily_life', 'polite', 2, 5, '〜てもらう 的自然例句。'),
  ('gp_te_itadaku', '先生に推薦状を書いていただきました。', '承蒙老师给我写了推荐信。', 'daily_life', 'business', 1, 5, '〜ていただく 的自然例句。'),
  ('gp_te_itadaku', 'お客様にアンケートに答えていただきました。', '请客户回答了问卷。', 'daily_life', 'business', 2, 5, '〜ていただく 的自然例句。'),
  ('gp_sasete_morau', '今日は早く帰らせてもらいました。', '今天让我早点回去了。', 'daily_life', 'polite', 1, 5, '〜させてもらう 的自然例句。'),
  ('gp_sasete_morau', '会議で発表させてもらいました。', '让我在会议上发表了。', 'daily_life', 'polite', 2, 5, '〜させてもらう 的自然例句。'),
  ('gp_sou_da', '雨が降りそうです。', '看起来要下雨。', 'daily_life', 'polite', 1, 5, '〜そうだ 的自然例句。'),
  ('gp_sou_da', 'このケーキはおいしそうです。', '这个蛋糕看起来很好吃。', 'daily_life', 'polite', 2, 5, '〜そうだ 的自然例句。'),
  ('gp_rashii', '明日は雨らしいです。', '听说明天会下雨。', 'daily_life', 'polite', 1, 5, '〜らしい 的自然例句。'),
  ('gp_rashii', 'あの店は有名らしいです。', '听说那家店很有名。', 'daily_life', 'polite', 2, 5, '〜らしい 的自然例句。'),
  ('gp_you_da', '外は寒いようです。', '外面好像很冷。', 'daily_life', 'polite', 1, 5, '〜ようだ 的自然例句。'),
  ('gp_you_da', '彼は忙しいようです。', '他好像很忙。', 'daily_life', 'polite', 2, 5, '〜ようだ 的自然例句。'),
  ('gp_mitai_da', '電車が遅れているみたいです。', '电车好像晚点了。', 'daily_life', 'casual', 1, 5, '〜みたいだ 的自然例句。'),
  ('gp_mitai_da', 'この道で合っているみたいです。', '这条路好像是对的。', 'daily_life', 'casual', 2, 5, '〜みたいだ 的自然例句。'),
  ('gp_kamoshirenai', '少し遅れるかもしれません。', '也许会稍微迟到。', 'daily_life', 'polite', 1, 5, '〜かもしれない 的自然例句。'),
  ('gp_kamoshirenai', 'これは必要かもしれません。', '这个也许有必要。', 'daily_life', 'polite', 2, 5, '〜かもしれない 的自然例句。'),
  ('gp_yori_comparison', '東京は大阪より人が多いです。', '东京比大阪人多。', 'daily_life', 'polite', 1, 5, '〜より 的自然例句。'),
  ('gp_yori_comparison', '電車よりバスのほうが安いです。', '公交比电车便宜。', 'daily_life', 'polite', 2, 5, '〜より 的自然例句。'),
  ('gp_hodo', '今日は昨日ほど寒くないです。', '今天没有昨天那么冷。', 'daily_life', 'polite', 1, 5, '〜ほど 的自然例句。'),
  ('gp_hodo', '思ったほど難しくありませんでした。', '没有想象中那么难。', 'daily_life', 'polite', 2, 5, '〜ほど 的自然例句。'),
  ('gp_kurai', '十分くらい待ちました。', '等了大约十分钟。', 'daily_life', 'polite', 1, 5, '〜くらい 的自然例句。'),
  ('gp_kurai', '泣きたいくらい嬉しかったです。', '高兴到想哭。', 'daily_life', 'polite', 2, 5, '〜くらい 的自然例句。'),
  ('gp_dake', '水だけ飲みました。', '只喝了水。', 'daily_life', 'polite', 1, 5, '〜だけ 的自然例句。'),
  ('gp_dake', '今日は一時間だけ勉強します。', '今天只学习一小时。', 'daily_life', 'polite', 2, 5, '〜だけ 的自然例句。'),
  ('gp_shika_nai', '財布に千円しかありません。', '钱包里只有一千日元。', 'daily_life', 'polite', 1, 5, '〜しか〜ない 的自然例句。'),
  ('gp_shika_nai', '今は待つしかありません。', '现在只能等。', 'daily_life', 'polite', 2, 5, '〜しか〜ない 的自然例句。'),
  ('gp_kedo', '行きたいけど、時間がありません。', '想去，但是没有时间。', 'daily_life', 'casual', 1, 5, '〜けど 的自然例句。'),
  ('gp_kedo', 'すみません、質問があるんですけど。', '不好意思，我有个问题。', 'daily_life', 'casual', 2, 5, '〜けど 的自然例句。'),
  ('gp_ga_contrast', '便利ですが、少し高いです。', '很方便，但是有点贵。', 'daily_life', 'polite', 1, 5, '〜が 的自然例句。'),
  ('gp_ga_contrast', '予約したいのですが、空いていますか。', '我想预约，请问有空位吗？', 'daily_life', 'polite', 2, 5, '〜が 的自然例句。'),
  ('gp_noni', 'たくさん勉強したのに、忘れてしまいました。', '明明学了很多，却忘了。', 'daily_life', 'polite', 1, 5, '〜のに 的自然例句。'),
  ('gp_noni', '雨なのに出かけました。', '明明下雨却出门了。', 'daily_life', 'polite', 2, 5, '〜のに 的自然例句。'),
  ('gp_temo', '雨が降っても行きます。', '即使下雨也去。', 'daily_life', 'polite', 1, 5, '〜ても 的自然例句。'),
  ('gp_temo', '高くても買いたいです。', '即使贵也想买。', 'daily_life', 'polite', 2, 5, '〜ても 的自然例句。'),
  ('gp_ippou_de', '都会は便利な一方で、家賃が高いです。', '城市方便，另一方面房租很高。', 'daily_life', 'written', 1, 5, '〜一方で 的自然例句。'),
  ('gp_ippou_de', 'この仕事は大変な一方で、やりがいがあります。', '这份工作辛苦，但也有价值。', 'daily_life', 'written', 2, 5, '〜一方で 的自然例句。'),
  ('gp_n_desu', '実は道に迷ったんです。', '其实我迷路了。', 'daily_life', 'polite', 1, 5, '〜んです 的自然例句。'),
  ('gp_n_desu', '頭が痛いんです。', '我头痛。', 'daily_life', 'polite', 2, 5, '〜んです 的自然例句。'),
  ('gp_n_desu_ga', '予約を変更したいんですが。', '我想改预约。', 'phone_call', 'polite', 1, 5, '〜んですが 的自然例句。'),
  ('gp_n_desu_ga', '少し聞きたいんですが。', '我想稍微问一下。', 'phone_call', 'polite', 2, 5, '〜んですが 的自然例句。'),
  ('gp_kana', '明日は晴れるかな。', '明天会不会晴呢。', 'friend_chat', 'casual', 1, 5, '〜かな 的自然例句。'),
  ('gp_kana', 'これで大丈夫かな。', '这样可以吗。', 'friend_chat', 'casual', 2, 5, '〜かな 的自然例句。'),
  ('gp_kamo', '少し遅れるかも。', '也许会稍微迟到。', 'friend_chat', 'casual', 1, 5, '〜かも 的自然例句。'),
  ('gp_kamo', 'それはいいかも。', '那也许不错。', 'friend_chat', 'casual', 2, 5, '〜かも 的自然例句。'),
  ('gp_yo_ne', '明日の集合は九時ですよね。', '明天集合是九点，对吧？', 'daily_life', 'polite', 1, 5, '〜よね 的自然例句。'),
  ('gp_yo_ne', 'この道で合っていますよね。', '这条路是对的吧？', 'daily_life', 'polite', 2, 5, '〜よね 的自然例句。'),
  ('gp_fuan_wo_idaku', '将来に不安を抱いています。', '对未来怀有不安。', 'daily_life', 'polite', 1, 5, '不安を抱く 的自然例句。'),
  ('gp_fuan_wo_idaku', '多くの人が生活に不安を抱いています。', '很多人对生活怀有不安。', 'daily_life', 'polite', 2, 5, '不安を抱く 的自然例句。'),
  ('gp_gimon_wo_motsu', '説明に疑問を持ちました。', '对说明产生了疑问。', 'daily_life', 'polite', 1, 5, '疑問を持つ 的自然例句。'),
  ('gp_gimon_wo_motsu', 'その結果に疑問を持つ人もいます。', '也有人对那个结果有疑问。', 'daily_life', 'polite', 2, 5, '疑問を持つ 的自然例句。'),
  ('gp_eikyo_wo_ukeru', '天気の影響を受けました。', '受到了天气影响。', 'daily_life', 'polite', 1, 5, '影響を受ける 的自然例句。'),
  ('gp_eikyo_wo_ukeru', '子どもは周りの人から影響を受けます。', '孩子会受到周围人的影响。', 'daily_life', 'polite', 2, 5, '影響を受ける 的自然例句。'),
  ('gp_meiwaku_wo_kakeru', 'ご迷惑をかけてすみません。', '给您添麻烦了，对不起。', 'daily_life', 'polite', 1, 5, '迷惑をかける 的自然例句。'),
  ('gp_meiwaku_wo_kakeru', '近所の人に迷惑をかけないようにします。', '我会注意不给邻居添麻烦。', 'daily_life', 'polite', 2, 5, '迷惑をかける 的自然例句。'),
  ('gp_yoyaku_wo_toru', '明日の七時に予約を取りました。', '预约了明天七点。', 'restaurant', 'polite', 1, 5, '予約を取る 的自然例句。'),
  ('gp_yoyaku_wo_toru', '病院の予約を取りたいです。', '我想预约医院。', 'restaurant', 'polite', 2, 5, '予約を取る 的自然例句。'),
  ('gp_dekiru', '日本語で簡単な会話ができます。', '能用日语进行简单会话。', 'daily_life', 'polite', 1, 5, '〜できる 的自然例句。'),
  ('gp_dekiru', 'このアプリで復習ができます。', '可以用这个应用复习。', 'daily_life', 'polite', 2, 5, '〜できる 的自然例句。'),
  ('gp_rareru_potential', 'この店では新鮮な魚が食べられます。', '这家店能吃到新鲜鱼。', 'daily_life', 'polite', 1, 5, '〜られる 的自然例句。'),
  ('gp_rareru_potential', 'ここから富士山が見られます。', '从这里能看到富士山。', 'daily_life', 'polite', 2, 5, '〜られる 的自然例句。'),
  ('gp_yasui', 'この本は読みやすいです。', '这本书容易读。', 'daily_life', 'polite', 1, 5, '〜やすい 的自然例句。'),
  ('gp_yasui', 'この靴は歩きやすいです。', '这双鞋容易走路。', 'daily_life', 'polite', 2, 5, '〜やすい 的自然例句。'),
  ('gp_nikui', 'この漢字は覚えにくいです。', '这个汉字难记。', 'daily_life', 'polite', 1, 5, '〜にくい 的自然例句。'),
  ('gp_nikui', 'この説明は少しわかりにくいです。', '这个说明有点难懂。', 'daily_life', 'polite', 2, 5, '〜にくい 的自然例句。'),
  ('gp_zurai', '忙しくて相談しづらいです。', '因为忙，很难找人商量。', 'daily_life', 'polite', 1, 5, '〜づらい 的自然例句。'),
  ('gp_zurai', 'その話は本人に言いづらいです。', '那件事很难对本人说。', 'daily_life', 'polite', 2, 5, '〜づらい 的自然例句。'),
  ('gp_nakereba_naranai', '明日までに提出しなければなりません。', '必须在明天前提交。', 'daily_life', 'formal', 1, 5, '〜なければならない 的自然例句。'),
  ('gp_nakereba_naranai', '薬を飲まなければなりません。', '必须吃药。', 'daily_life', 'formal', 2, 5, '〜なければならない 的自然例句。'),
  ('gp_naito_ikenai', 'そろそろ帰らないといけません。', '差不多必须回去了。', 'daily_life', 'polite', 1, 5, '〜ないといけない 的自然例句。'),
  ('gp_naito_ikenai', '予約を確認しないといけません。', '必须确认预约。', 'daily_life', 'polite', 2, 5, '〜ないといけない 的自然例句。'),
  ('gp_nakutemo_ii', '今日は来なくてもいいです。', '今天不来也可以。', 'daily_life', 'polite', 1, 5, '〜なくてもいい 的自然例句。'),
  ('gp_nakutemo_ii', '全部書かなくてもいいです。', '不用全部写也可以。', 'daily_life', 'polite', 2, 5, '〜なくてもいい 的自然例句。'),
  ('gp_beki', '約束は守るべきです。', '约定应该遵守。', 'daily_life', 'polite', 1, 5, '〜べき 的自然例句。'),
  ('gp_beki', '大事なことは早めに相談すべきです。', '重要的事应该早点商量。', 'daily_life', 'polite', 2, 5, '〜べき 的自然例句。'),
  ('gp_hitsuyou_ga_aru', '申請書を出す必要があります。', '有必要提交申请书。', 'daily_life', 'polite', 1, 5, '〜必要がある 的自然例句。'),
  ('gp_hitsuyou_ga_aru', 'もう一度確認する必要があります。', '有必要再确认一次。', 'daily_life', 'polite', 2, 5, '〜必要がある 的自然例句。'),
  ('gp_ninaru_change', '春になると暖かくなります。', '到了春天会变暖。', 'daily_life', 'polite', 1, 5, '〜になる 的自然例句。'),
  ('gp_ninaru_change', '来月から新しい担当になります。', '下个月起会成为新的负责人。', 'daily_life', 'polite', 2, 5, '〜になる 的自然例句。'),
  ('gp_nisuru_change', '部屋をきれいにします。', '把房间弄干净。', 'daily_life', 'polite', 1, 5, '〜にする 的自然例句。'),
  ('gp_nisuru_change', '次の会議を金曜日にします。', '把下次会议定在周五。', 'daily_life', 'polite', 2, 5, '〜にする 的自然例句。'),
  ('gp_tekuru', '少し寒くなってきました。', '稍微变冷起来了。', 'daily_life', 'polite', 1, 5, '〜てくる 的自然例句。'),
  ('gp_tekuru', '日本語がわかってきました。', '开始懂日语了。', 'daily_life', 'polite', 2, 5, '〜てくる 的自然例句。'),
  ('gp_teiku', 'これからも勉強を続けていきます。', '今后也会继续学习下去。', 'daily_life', 'polite', 1, 5, '〜ていく 的自然例句。'),
  ('gp_teiku', '少しずつ慣れていきます。', '会一点点习惯下去。', 'daily_life', 'polite', 2, 5, '〜ていく 的自然例句。'),
  ('gp_hajimeru', '雨が降り始めました。', '开始下雨了。', 'daily_life', 'polite', 1, 5, '〜始める 的自然例句。'),
  ('gp_hajimeru', '最近、漢字を勉強し始めました。', '最近开始学汉字了。', 'daily_life', 'polite', 2, 5, '〜始める 的自然例句。'),
  ('gp_to_iu', '先生は明日テストがあると言いました。', '老师说明天有考试。', 'daily_life', 'polite', 1, 5, '〜と言う 的自然例句。'),
  ('gp_to_iu', '友だちは後で来ると言っています。', '朋友说等会儿来。', 'daily_life', 'polite', 2, 5, '〜と言う 的自然例句。'),
  ('gp_to_omou', 'この方法がいいと思います。', '我觉得这个方法好。', 'daily_life', 'polite', 1, 5, '〜と思う 的自然例句。'),
  ('gp_to_omou', '明日は晴れると思います。', '我觉得明天会晴。', 'daily_life', 'polite', 2, 5, '〜と思う 的自然例句。'),
  ('gp_tte', '田中さんって親切ですね。', '田中先生这个人很亲切呢。', 'friend_chat', 'casual', 1, 5, '〜って 的自然例句。'),
  ('gp_tte', '明日休みだって聞きました。', '听说明天休息。', 'friend_chat', 'casual', 2, 5, '〜って 的自然例句。'),
  ('gp_ni_tsuite', '日本の文化について勉強しています。', '正在学习关于日本文化的内容。', 'daily_life', 'polite', 1, 5, '〜について 的自然例句。'),
  ('gp_ni_tsuite', '料金について質問があります。', '关于费用有问题。', 'daily_life', 'polite', 2, 5, '〜について 的自然例句。'),
  ('gp_ni_yoru_to', 'ニュースによると、明日は雨です。', '据新闻说，明天有雨。', 'daily_life', 'news', 1, 5, '〜によると 的自然例句。'),
  ('gp_ni_yoru_to', '先生によると、この表現は自然です。', '据老师说，这个表达很自然。', 'daily_life', 'news', 2, 5, '〜によると 的自然例句。'),
  ('gp_te_itadakemasu_ka', '恐れ入りますが、確認していただけますか。', '不好意思，能请您确认一下吗？', 'workplace', 'business', 1, 5, '商务场景安全。'),
  ('gp_te_itadakemasu_ka', 'もう一度説明していただけますか。', '能否请您再说明一遍？', 'hospital', 'formal', 2, 5, '比「もらえますか」更郑重。'),
  ('gp_sasete_itadaku', '本日は私が説明させていただきます。', '今天请允许我来说明。', 'daily_life', 'business', 1, 5, '〜させていただきます 的自然例句。'),
  ('gp_sasete_itadaku', '後ほど連絡させていただきます。', '稍后我会联系您。', 'daily_life', 'business', 2, 5, '〜させていただきます 的自然例句。'),
  ('gp_te_orimasu', 'ただいま確認しております。', '现在正在确认。', 'daily_life', 'business', 1, 5, '〜ております 的自然例句。'),
  ('gp_te_orimasu', 'ご来店をお待ちしております。', '恭候您的光临。', 'daily_life', 'business', 2, 5, '〜ております 的自然例句。'),
  ('gp_de_gozaimasu', 'こちらが資料でございます。', '这是资料。', 'daily_life', 'customer', 1, 5, '〜でございます 的自然例句。'),
  ('gp_de_gozaimasu', '受付は二階でございます。', '接待处在二楼。', 'daily_life', 'customer', 2, 5, '〜でございます 的自然例句。'),
  ('gp_onegai_itashimasu', 'ご確認をお願いいたします。', '请您确认。', 'daily_life', 'business', 1, 5, 'お願いいたします 的自然例句。'),
  ('gp_onegai_itashimasu', '明日までにご返信をお願いいたします。', '请在明天前回复。', 'daily_life', 'business', 2, 5, 'お願いいたします 的自然例句。'),
  ('gp_dict_form', '毎日日本語を勉強する。', '每天学习日语。', 'daily_life', 'polite', 1, 5, '辞書形 的自然例句。'),
  ('gp_dict_form', '寝る前に本を読みます。', '睡前读书。', 'daily_life', 'polite', 2, 5, '辞書形 的自然例句。'),
  ('gp_masu_form', '毎朝七時に起きます。', '每天早上七点起床。', 'daily_life', 'polite', 1, 5, 'ます形 的自然例句。'),
  ('gp_masu_form', '駅まで歩きます。', '走到车站。', 'daily_life', 'polite', 2, 5, 'ます形 的自然例句。'),
  ('gp_te_form', '窓を開けてください。', '请打开窗户。', 'daily_life', 'polite', 1, 5, 'て形 的自然例句。'),
  ('gp_te_form', '朝ご飯を食べて、学校へ行きます。', '吃早饭后去学校。', 'daily_life', 'polite', 2, 5, 'て形 的自然例句。'),
  ('gp_i_adjective_past', '昨日は寒かったです。', '昨天很冷。', 'daily_life', 'polite', 1, 5, 'い形容词过去形 的自然例句。'),
  ('gp_i_adjective_past', 'この映画は面白かったです。', '这部电影很有趣。', 'daily_life', 'polite', 2, 5, 'い形容词过去形 的自然例句。'),
  ('gp_na_adjective_past', '昔、この町は静かでした。', '以前这个城市很安静。', 'daily_life', 'polite', 1, 5, 'な形容词过去形 的自然例句。'),
  ('gp_na_adjective_past', '説明は丁寧でした。', '说明很仔细。', 'daily_life', 'polite', 2, 5, 'な形容词过去形 的自然例句。'),
  ('gp_noun_negative', '私は学生ではありません。', '我不是学生。', 'daily_life', 'polite', 1, 5, '名词句否定形 的自然例句。'),
  ('gp_noun_negative', 'これは私の荷物ではないです。', '这不是我的行李。', 'daily_life', 'polite', 2, 5, '名词句否定形 的自然例句。'),
  ('gp_ta_form', '昨日、映画を見ました。', '昨天看了电影。', 'daily_life', 'polite', 1, 5, '〜た形 的自然例句。'),
  ('gp_ta_form', '駅に着いたら電話します。', '到了车站就打电话。', 'daily_life', 'polite', 2, 5, '〜た形 的自然例句。'),
  ('gp_nai_form', '今日はお酒を飲みません。', '今天不喝酒。', 'daily_life', 'polite', 1, 5, '〜ない形 的自然例句。'),
  ('gp_nai_form', '忘れないようにメモします。', '为了不忘而记笔记。', 'daily_life', 'polite', 2, 5, '〜ない形 的自然例句。'),
  ('gp_nakatta_form', '昨日は勉強しませんでした。', '昨天没有学习。', 'daily_life', 'polite', 1, 5, '〜なかった 的自然例句。'),
  ('gp_nakatta_form', '子どものころ、野菜が好きではなかったです。', '小时候不喜欢蔬菜。', 'daily_life', 'polite', 2, 5, '〜なかった 的自然例句。'),
  ('gp_masen_deshita', '昨日は学校へ行きませんでした。', '昨天没有去学校。', 'daily_life', 'polite', 1, 5, '〜ませんでした 的自然例句。'),
  ('gp_masen_deshita', 'メールを確認しませんでした。', '没有确认邮件。', 'daily_life', 'polite', 2, 5, '〜ませんでした 的自然例句。'),
  ('gp_te_iru', '今、資料を読んでいます。', '现在正在读资料。', 'daily_life', 'polite', 1, 5, '〜ている 的自然例句。'),
  ('gp_te_iru', '窓が開いています。', '窗户开着。', 'daily_life', 'polite', 2, 5, '〜ている 的自然例句。'),
  ('gp_te_ita', '昨日の夜、雨が降っていました。', '昨晚正在下雨。', 'daily_life', 'polite', 1, 5, '〜ていた 的自然例句。'),
  ('gp_te_ita', 'その時、駅で友だちを待っていました。', '那时正在车站等朋友。', 'daily_life', 'polite', 2, 5, '〜ていた 的自然例句。'),
  ('gp_te_aru', '資料は机の上に置いてあります。', '资料已经放在桌上了。', 'daily_life', 'polite', 1, 5, '〜てある 的自然例句。'),
  ('gp_te_aru', '窓に注意書きが貼ってあります。', '窗户上贴着注意事项。', 'daily_life', 'polite', 2, 5, '〜てある 的自然例句。'),
  ('gp_te_shimau', '宿題を全部やってしまいました。', '作业全部做完了。', 'daily_life', 'polite', 1, 5, '〜てしまう 的自然例句。'),
  ('gp_te_shimau', '大事な書類を忘れてしまいました。', '把重要资料忘了。', 'daily_life', 'polite', 2, 5, '〜てしまう 的自然例句。'),
  ('gp_te_oku', '会議の前に資料を読んでおきます。', '会议前先读好资料。', 'daily_life', 'polite', 1, 5, '〜ておく 的自然例句。'),
  ('gp_te_oku', '明日の準備をしておきました。', '已经为明天做好准备。', 'daily_life', 'polite', 2, 5, '〜ておく 的自然例句。'),
  ('gp_ta_koto_ga_aru', '日本へ行ったことがあります。', '去过日本。', 'daily_life', 'polite', 1, 5, '〜たことがある 的自然例句。'),
  ('gp_ta_koto_ga_aru', 'この映画を見たことがあります。', '看过这部电影。', 'daily_life', 'polite', 2, 5, '〜たことがある 的自然例句。'),
  ('gp_ta_bakari', 'さっき昼ご飯を食べたばかりです。', '刚刚吃过午饭。', 'daily_life', 'polite', 1, 5, '〜たばかり 的自然例句。'),
  ('gp_ta_bakari', '日本に来たばかりで、まだ慣れていません。', '刚来日本，还不习惯。', 'daily_life', 'polite', 2, 5, '〜たばかり 的自然例句。'),
  ('gp_tokoro_da', '今から出かけるところです。', '现在正要出门。', 'daily_life', 'polite', 1, 5, '〜ところだ 的自然例句。'),
  ('gp_tokoro_da', '今、確認しているところです。', '现在正在确认。', 'daily_life', 'polite', 2, 5, '〜ところだ 的自然例句。'),
  ('gp_potential_form', '日本語が少し話せます。', '会说一点日语。', 'daily_life', 'polite', 1, 5, '可能形 的自然例句。'),
  ('gp_potential_form', 'この店で魚が食べられます。', '这家店能吃到鱼。', 'daily_life', 'polite', 2, 5, '可能形 的自然例句。'),
  ('gp_passive_form', '先生に名前を呼ばれました。', '被老师叫了名字。', 'daily_life', 'polite', 1, 5, '受身形 的自然例句。'),
  ('gp_passive_form', '雨に降られて困りました。', '被雨淋了，很困扰。', 'daily_life', 'polite', 2, 5, '受身形 的自然例句。'),
  ('gp_causative_form', '子どもに野菜を食べさせます。', '让孩子吃蔬菜。', 'daily_life', 'polite', 1, 5, '使役形 的自然例句。'),
  ('gp_causative_form', '部下を出張させました。', '让下属出差了。', 'daily_life', 'polite', 2, 5, '使役形 的自然例句。'),
  ('gp_causative_passive_form', '子どものころ、毎日ピアノを練習させられました。', '小时候每天被迫练钢琴。', 'daily_life', 'polite', 1, 5, '使役受身形 的自然例句。'),
  ('gp_causative_passive_form', '急に残業させられました。', '突然被迫加班。', 'daily_life', 'polite', 2, 5, '使役受身形 的自然例句。'),
  ('gp_rentai_modifier', '私が昨日買った本を読みました。', '读了我昨天买的书。', 'daily_life', 'polite', 1, 5, '連体修飾 的自然例句。'),
  ('gp_rentai_modifier', '駅に近い部屋を探しています。', '正在找离车站近的房间。', 'daily_life', 'polite', 2, 5, '連体修飾 的自然例句。'),
  ('gp_koto_nominalization', '日本語を話すことができます。', '能说日语。', 'daily_life', 'polite', 1, 5, '〜こと 的自然例句。'),
  ('gp_koto_nominalization', '毎日続けることが大切です。', '每天坚持很重要。', 'daily_life', 'polite', 2, 5, '〜こと 的自然例句。'),
  ('gp_no_nominalization', '料理を作るのが好きです。', '喜欢做饭。', 'daily_life', 'polite', 1, 5, '〜の 的自然例句。'),
  ('gp_no_nominalization', '彼が来るのを待っています。', '正在等他来。', 'daily_life', 'polite', 2, 5, '〜の 的自然例句。'),
  ('gp_topic_subject_structure', '私は学生です。', '我是学生。', 'daily_life', 'polite', 1, 5, '主題と主語 的自然例句。'),
  ('gp_topic_subject_structure', '私が説明します。', '我来说明。', 'daily_life', 'polite', 2, 5, '主題と主語 的自然例句。'),
  ('gp_predicate_core', 'この店は便利です。', '这家店很方便。', 'daily_life', 'polite', 1, 5, '述語 的自然例句。'),
  ('gp_predicate_core', '明日は学校へ行きません。', '明天不去学校。', 'daily_life', 'polite', 2, 5, '述語 的自然例句。'),
  ('gp_noun_clause_modifier', '昨日買った本を読みました。', '读了昨天买的书。', 'daily_life', 'polite', 1, 5, '名词修饰从句 的自然例句。'),
  ('gp_noun_clause_modifier', '友だちが住んでいる町へ行きます。', '去朋友住的城市。', 'daily_life', 'polite', 2, 5, '名词修饰从句 的自然例句。'),
  ('gp_main_subordinate_clause', '雨が降ったので、出かけませんでした。', '因为下雨，没有出门。', 'daily_life', 'polite', 1, 5, '主句と従属節 的自然例句。'),
  ('gp_main_subordinate_clause', '時間があれば、手伝います。', '有时间的话会帮忙。', 'daily_life', 'polite', 2, 5, '主句と従属節 的自然例句。'),
  ('gp_ellipsis', 'もう食べました。', '已经吃了。', 'daily_life', 'polite', 1, 5, '省略 的自然例句。'),
  ('gp_ellipsis', 'お願いします。', '拜托您了。', 'daily_life', 'polite', 2, 5, '省略 的自然例句。'),
  ('gp_word_order_focus', '私は昨日駅で友だちに会いました。', '我昨天在车站见了朋友。', 'daily_life', 'polite', 1, 5, '語順と焦点 的自然例句。'),
  ('gp_word_order_focus', '誰がこの資料を作りましたか。', '谁做了这份资料？', 'daily_life', 'polite', 2, 5, '語順と焦点 的自然例句。'),
  ('gp_mo_particle', '私も行きます。', '我也去。', 'daily_life', 'polite', 1, 5, 'も 的自然例句。'),
  ('gp_mo_particle', 'コーヒーも飲みました。', '咖啡也喝了。', 'daily_life', 'polite', 2, 5, 'も 的自然例句。'),
  ('gp_koso_particle', 'こちらこそありがとうございます。', '我才要感谢您。', 'daily_life', 'polite', 1, 5, 'こそ 的自然例句。'),
  ('gp_koso_particle', '今こそ始めるべきです。', '正是现在应该开始。', 'daily_life', 'polite', 2, 5, 'こそ 的自然例句。'),
  ('gp_sae_particle', '名前さえ書けば大丈夫です。', '只要写名字就没问题。', 'daily_life', 'polite', 1, 5, 'さえ 的自然例句。'),
  ('gp_sae_particle', '子どもでさえ知っています。', '连孩子都知道。', 'daily_life', 'polite', 2, 5, 'さえ 的自然例句。'),
  ('gp_bakari', '甘いものばかり食べています。', '总是吃甜食。', 'daily_life', 'polite', 1, 5, '〜ばかり 的自然例句。'),
  ('gp_bakari', '帰ってきたばかりです。', '刚回来。', 'daily_life', 'polite', 2, 5, '〜ばかり 的自然例句。'),
  ('gp_ni_taishite', 'お客様に対して丁寧に説明します。', '对客户礼貌说明。', 'daily_life', 'polite', 1, 5, '〜に対して 的自然例句。'),
  ('gp_ni_taishite', '兄に対して、弟は静かです。', '和哥哥相比，弟弟很安静。', 'daily_life', 'polite', 2, 5, '〜に対して 的自然例句。'),
  ('gp_toshite_particle', '通訳として働いています。', '作为口译工作。', 'daily_life', 'polite', 1, 5, '〜として 的自然例句。'),
  ('gp_toshite_particle', '学生として責任があります。', '作为学生有责任。', 'daily_life', 'polite', 2, 5, '〜として 的自然例句。'),
  ('gp_plain_style', '明日、学校へ行く。', '明天去学校。', 'daily_life', 'polite', 1, 5, '普通体 的自然例句。'),
  ('gp_plain_style', '昨日は雨だった。', '昨天是雨天。', 'daily_life', 'polite', 2, 5, '普通体 的自然例句。'),
  ('gp_polite_style', '明日、学校へ行きます。', '明天去学校。', 'daily_life', 'polite', 1, 5, '丁寧体 的自然例句。'),
  ('gp_polite_style', '昨日は雨でした。', '昨天是雨天。', 'daily_life', 'polite', 2, 5, '丁寧体 的自然例句。'),
  ('gp_casual_spoken', 'それ、いいかも。', '那个也许不错。', 'daily_life', 'polite', 1, 5, 'くだけた口语 的自然例句。'),
  ('gp_casual_spoken', '明日行くよ。', '明天去哦。', 'daily_life', 'polite', 2, 5, 'くだけた口语 的自然例句。'),
  ('gp_honorific_language', '先生がいらっしゃいました。', '老师来了。', 'daily_life', 'polite', 1, 5, '尊敬語 的自然例句。'),
  ('gp_honorific_language', '社長がお話しになります。', '社长会讲话。', 'daily_life', 'polite', 2, 5, '尊敬語 的自然例句。'),
  ('gp_humble_language', '明日、伺います。', '明天我去拜访。', 'daily_life', 'polite', 1, 5, '謙譲語 的自然例句。'),
  ('gp_humble_language', '資料をお送りします。', '我会发送资料。', 'daily_life', 'polite', 2, 5, '謙譲語 的自然例句。'),
  ('gp_uchisoto', '弊社の田中が参ります。', '我司田中会过去。', 'daily_life', 'polite', 1, 5, '内外関係 的自然例句。'),
  ('gp_uchisoto', '御社のご担当者様に伺います。', '向贵司负责人请教。', 'daily_life', 'polite', 2, 5, '内外関係 的自然例句。'),
  ('gp_soshite', '朝ご飯を食べました。そして、学校へ行きました。', '吃了早饭。然后去了学校。', 'daily_life', 'polite', 1, 5, 'そして 的自然例句。'),
  ('gp_soshite', 'この町は静かです。そして、便利です。', '这个城市安静，而且方便。', 'daily_life', 'polite', 2, 5, 'そして 的自然例句。'),
  ('gp_shikashi', '値段は安いです。しかし、品質はいいです。', '价格便宜。但是质量很好。', 'daily_life', 'polite', 1, 5, 'しかし 的自然例句。'),
  ('gp_shikashi', '準備しました。しかし、問題が起きました。', '准备了。但是出了问题。', 'daily_life', 'polite', 2, 5, 'しかし 的自然例句。'),
  ('gp_sono_tame', '台風が近づいています。そのため、電車が止まりました。', '台风正在接近。因此电车停运了。', 'daily_life', 'polite', 1, 5, 'そのため 的自然例句。'),
  ('gp_sono_tame', '参加者が少ないです。そのため、延期します。', '参加者很少。因此延期。', 'daily_life', 'polite', 2, 5, 'そのため 的自然例句。'),
  ('gp_tatoeba', '日本料理、例えば寿司が好きです。', '喜欢日本料理，比如寿司。', 'daily_life', 'polite', 1, 5, '例えば 的自然例句。'),
  ('gp_tatoeba', '毎日少し練習します。例えば、音読します。', '每天练一点。比如朗读。', 'daily_life', 'polite', 2, 5, '例えば 的自然例句。'),
  ('gp_tsumari', '彼は来ません。つまり、会議は中止です。', '他不来。也就是说，会议取消。', 'daily_life', 'polite', 1, 5, 'つまり 的自然例句。'),
  ('gp_tsumari', '毎日使います。つまり、とても大切です。', '每天用。也就是说很重要。', 'daily_life', 'polite', 2, 5, 'つまり 的自然例句。'),
  ('gp_tokorode', 'ところで、明日の予定は決まりましたか。', '对了，明天的计划定了吗？', 'daily_life', 'polite', 1, 5, 'ところで 的自然例句。'),
  ('gp_tokorode', 'ところで、資料は届きましたか。', '话说，资料到了吗？', 'daily_life', 'polite', 2, 5, 'ところで 的自然例句。'),
  ('gp_ninki_ga_aru', 'この店は人気があります。', '这家店很受欢迎。', 'daily_life', 'polite', 1, 5, '人気がある 的自然例句。'),
  ('gp_ninki_ga_aru', '若い人に人気があります。', '受年轻人欢迎。', 'daily_life', 'polite', 2, 5, '人気がある 的自然例句。'),
  ('gp_kanousei_ga_takai', '明日は雨の可能性が高いです。', '明天下雨的可能性高。', 'daily_life', 'polite', 1, 5, '可能性が高い 的自然例句。'),
  ('gp_kanousei_ga_takai', '成功する可能性が高いと思います。', '我认为成功的可能性高。', 'daily_life', 'polite', 2, 5, '可能性が高い 的自然例句。'),
  ('gp_shikkari_kakunin_suru', '提出前にしっかり確認します。', '提交前好好确认。', 'daily_life', 'polite', 1, 5, 'しっかり確認する 的自然例句。'),
  ('gp_shikkari_kakunin_suru', '内容をしっかり確認してください。', '请认真确认内容。', 'daily_life', 'polite', 2, 5, 'しっかり確認する 的自然例句。'),
  ('gp_kichinto_tsutaeru', '変更点をきちんと伝えます。', '会好好传达变更点。', 'daily_life', 'polite', 1, 5, 'きちんと伝える 的自然例句。'),
  ('gp_kichinto_tsutaeru', '理由をきちんと伝えてください。', '请好好说明理由。', 'daily_life', 'polite', 2, 5, 'きちんと伝える 的自然例句。'),
  ('gp_osewa_ni_naru', 'いつもお世話になっております。', '一直承蒙关照。', 'daily_life', 'polite', 1, 5, 'お世話になる 的自然例句。'),
  ('gp_osewa_ni_naru', '日本では先生にお世話になりました。', '在日本受到了老师照顾。', 'daily_life', 'polite', 2, 5, 'お世話になる 的自然例句。'),
  ('gp_wa_vs_ga', '私は学生です。', '我是学生。', 'daily_life', 'polite', 1, 5, 'は vs が 的自然例句。'),
  ('gp_wa_vs_ga', '私がやります。', '我来做。', 'daily_life', 'polite', 2, 5, 'は vs が 的自然例句。'),
  ('gp_ni_vs_de', '駅にコンビニがあります。', '车站有便利店。', 'daily_life', 'polite', 1, 5, 'に vs で 的自然例句。'),
  ('gp_ni_vs_de', '駅で友だちに会います。', '在车站见朋友。', 'daily_life', 'polite', 2, 5, 'に vs で 的自然例句。'),
  ('gp_condition_contrast', '駅に着いたら電話してください。', '到了车站请打电话。', 'daily_life', 'polite', 1, 5, 'たら vs ば vs と vs なら 的自然例句。'),
  ('gp_condition_contrast', '右へ曲がると駅があります。', '向右拐就有车站。', 'daily_life', 'polite', 2, 5, 'たら vs ば vs と vs なら 的自然例句。'),
  ('gp_reason_contrast', '時間がないから急ぎます。', '因为没时间所以赶紧。', 'daily_life', 'polite', 1, 5, 'から vs ので 的自然例句。'),
  ('gp_reason_contrast', '体調が悪いので、早めに帰ります。', '因为身体不舒服，早点回去。', 'daily_life', 'polite', 2, 5, 'から vs ので 的自然例句。'),
  ('gp_purpose_contrast', '合格するために勉強します。', '为了合格而学习。', 'daily_life', 'polite', 1, 5, 'ために vs ように 的自然例句。'),
  ('gp_purpose_contrast', '忘れないようにメモします。', '为了不忘而记笔记。', 'daily_life', 'polite', 2, 5, 'ために vs ように 的自然例句。'),
  ('gp_inference_contrast', '雨が降りそうです。', '看起来要下雨。', 'daily_life', 'polite', 1, 5, 'そうだ vs らしい 的自然例句。'),
  ('gp_inference_contrast', '明日は雨らしいです。', '听说明天下雨。', 'daily_life', 'polite', 2, 5, 'そうだ vs らしい 的自然例句。'),
  ('gp_connection_error_te', '誤：ここに名前を書きください。', '错：请在这里写名字。', 'daily_life', 'polite', 1, 5, 'て形接续错误 的自然例句。'),
  ('gp_connection_error_te', '正：ここに名前を書いてください。', '正：请在这里写名字。', 'daily_life', 'polite', 2, 5, 'て形接续错误 的自然例句。'),
  ('gp_particle_error_ni_de', '誤：駅でコンビニがあります。', '错：车站有便利店。', 'daily_life', 'polite', 1, 5, '助词に/で错误 的自然例句。'),
  ('gp_particle_error_ni_de', '正：駅にコンビニがあります。', '正：车站有便利店。', 'daily_life', 'polite', 2, 5, '助词に/で错误 的自然例句。'),
  ('gp_tense_error_past', '誤：昨日、学校へ行きます。', '错：昨天去学校。', 'daily_life', 'polite', 1, 5, '时态错误 的自然例句。'),
  ('gp_tense_error_past', '正：昨日、学校へ行きました。', '正：昨天去了学校。', 'daily_life', 'polite', 2, 5, '时态错误 的自然例句。'),
  ('gp_register_mismatch_error', '誤：先生、もう一度説明してもらえる？', '错：医生/老师，能再说一次？', 'daily_life', 'polite', 1, 5, '语体不匹配 的自然例句。'),
  ('gp_register_mismatch_error', '正：すみません、もう一度説明していただけますか。', '正：不好意思，能请您再说明一遍吗？', 'daily_life', 'polite', 2, 5, '语体不匹配 的自然例句。'),
  ('gp_literal_translation_error', '誤：不安を持っています。', '错：持有不安。', 'daily_life', 'polite', 1, 5, '中文直译 的自然例句。'),
  ('gp_literal_translation_error', '正：不安を抱いています。', '正：怀有不安。', 'daily_life', 'polite', 2, 5, '中文直译 的自然例句。')
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
LEFT JOIN register_tags ON register_tags.name_en = example_seed.register_name_en;

WITH similar_seed(seed_key, similar_seed_key, difference_summary, example_a, example_b, notes) AS (
  VALUES
  ('gp_te_moraemasu_ka', 'gp_te_itadakemasu_ka', '「〜てもらえますか」是一般礼貌请求；「〜ていただけますか」更郑重，适合医生、老师、客户或上司。', 'もう一度説明してもらえますか。', 'もう一度説明していただけますか。', '同样是请求，对象越正式越适合いただく。'),
  ('gp_te_morau', 'gp_te_kureru', '「〜てもらう」强调我方请别人做；「〜てくれる」强调对方主动为我方做。', '友だちに手伝ってもらいました。', '友だちが手伝ってくれました。', '主语和视角不同。'),
  ('gp_tame', 'gp_tame_ni', '「〜ため」可表示原因或目的；「〜ために」更明确表示目的。', '台風のため電車が止まりました。', '合格するために勉強します。', '看后项是否是有意志的目的行为。'),
  ('gp_sou_da', 'gp_rashii', '样态「〜そうだ」根据眼前迹象判断；「〜らしい」多用于听说或间接信息。', '雨が降りそうです。', '明日は雨らしいです。', '注意接续和信息来源。'),
  ('gp_you_da', 'gp_mitai_da', '「〜ようだ」较书面或说明；「〜みたいだ」更口语自然。', '彼は忙しいようです。', '彼は忙しいみたいです。', '正式说明优先ようだ，会话可用みたいだ。'),
  ('gp_yori_comparison', 'gp_hodo', '「〜より」直接设定比较基准；「〜ほど」常用于程度或否定比较。', '大阪より東京のほうが人が多いです。', '昨日ほど寒くないです。', '一个比谁更，一个到什么程度。'),
  ('gp_ninaru_change', 'gp_a_ni_narimasu', '「〜になる」强调变化功能；「Aになります」是基础句型中的礼貌形。', '寒くなります。', '会議は三時になります。', '功能相连，学习入口不同。'),
  ('gp_wa', 'gp_ga', 'は提示话题或对比；が标记主语、焦点或新信息。', '私は学生です。', '私がやります。', '中文学习者最容易直接按“主语”误选。'),
  ('gp_kara_reason', 'gp_node', '「〜から」原因表达更直接；「〜ので」更柔和客观，适合请求、道歉、说明情况。', '時間がないから、先に行きます。', '時間がないので、先に失礼します。', '礼貌场景优先ので。'),
  ('gp_tara', 'gp_ba', '「〜たら」最通用、口语自然；「〜ば」更像一般条件或规则。', '駅に着いたら電話してください。', '時間があれば行きます。', '不知道选什么时，日常对话中たら常更安全。'),
  ('gp_dekiru', 'gp_rareru_potential', '「〜できる」多接名词化动作；动词可能形「〜られる」直接改变动词形。', '日本語ができます。', '日本語が話せます。', '一个是名词性表达，一个是动词变形。'),
  ('gp_nakereba_naranai', 'gp_naito_ikenai', '「〜なければならない」更标准正式；「〜ないといけない」更口语。', '提出しなければなりません。', '提出しないといけません。', '语体选择不同。'),
  ('gp_to_iu', 'gp_to_omou', '「〜と言う」引用别人说的话；「〜と思う」表达自己的想法判断。', '先生は明日テストがあると言いました。', '明日は晴れると思います。', '引用来源不同。'),
  ('gp_ta_form', 'gp_nakatta_form', '「〜た形」表示过去或完成；「〜なかった」表示过去否定。', '昨日行きました。', '昨日行きませんでした。', '时态和肯否要同时看。'),
  ('gp_te_iru', 'gp_te_aru', '「〜ている」可表示自然状态或进行；「〜てある」强调有人有目的地做完后的结果状态。', '窓が開いています。', '窓が開けてあります。', '自动词/他动词和人为意图不同。'),
  ('gp_plain_style', 'gp_polite_style', '普通体适合亲近关系或文章体；丁宁体适合陌生人和一般礼貌场景。', '明日行く。', '明日行きます。', '场景和对象决定语体。'),
  ('gp_ni_vs_de', 'gp_ni', '「に vs で」是助词选择对比；「に」本身还可表示时间、对象、到达点等。', '駅にあります。', '先生に送ります。', '对比项和单个助词功能不同。'),
  ('gp_connection_error_te', 'gp_te_form', '错误诊断项指出问题；て形条目讲规则本身。', '書きください。', '書いてください。', '诊断和规则互相补充。')
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
