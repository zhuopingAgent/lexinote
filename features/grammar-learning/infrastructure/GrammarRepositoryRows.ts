import type {
  AIFeedbackBetterVersion,
  AIFeedbackIssue,
} from "@/shared/types/grammar";

export type GrammarSummaryRow = {
  id: string;
  grammar_point: string;
  point_type: string;
  canonical_form: string;
  sense_key: string;
  form_group_slug: string | null;
  status: string;
  primary_category: unknown;
  taxonomy_tags: unknown;
  curriculum: unknown;
  migration_target: unknown;
  reading: string | null;
  category_id: string | null;
  category_slug: string | null;
  category_name_zh: string | null;
  category_name_en: string | null;
  category_group_slug: string | null;
  category_group_name_zh: string | null;
  category_group_name_en: string | null;
  sub_category: string | null;
  core_meaning: string;
  natural_translation: string | null;
  structure: string | null;
  practicality: string;
  spoken_or_written: string;
  is_favorite: boolean;
  learning_status: string | null;
  scene_tags: unknown;
  register_tags: unknown;
};
export type GrammarDetailRow = GrammarSummaryRow & {
  usage_notes: string | null;
  notes: string | null;
  jlpt_level: string | null;
  common_mistakes: unknown;
  connections: unknown;
  prerequisites: unknown;
  form_siblings: unknown;
};

export type GrammarCategoryRow = {
  id: string;
  slug: string;
  group_id: string | null;
  group_slug: string | null;
  group_name_zh: string | null;
  group_name_en: string | null;
  group_description: string | null;
  group_priority: number | string | null;
  name_zh: string;
  name_en: string;
  description: string;
  example_expressions: unknown;
  priority: number | string;
  is_mvp: boolean;
};

export type GrammarCategoryGroupRow = {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  description: string;
  priority: number | string;
  is_mvp: boolean;
};

export type KnowledgeDimensionRow = {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  description: string;
  display_order: number | string;
  status: string;
};

export type LearningStageRow = {
  id: string;
  slug: string;
  name_zh: string;
  description: string;
  display_order: number | string;
  status: string;
};

export type LearningModuleRow = {
  id: string;
  stage_id: string;
  stage_slug: string;
  stage_name_zh: string;
  slug: string;
  name_zh: string;
  description: string;
  display_order: number | string;
  status: string;
};

export type TaxonomyNodeRow = {
  id: string;
  slug: string;
  dimension_id: string;
  dimension_slug: string;
  dimension_name_zh: string;
  dimension_name_en: string;
  name_zh: string;
  name_en: string;
  description: string;
  example_expressions: unknown;
  display_order: number | string;
  status: string;
};

export type ComparisonSetRow = {
  id: string;
  slug: string;
  name_zh: string;
  summary: string;
  common_meaning: string;
  decision_rules: unknown;
  connection_differences: unknown;
  register_differences: unknown;
  interchangeable_cases: unknown;
  non_interchangeable_cases: unknown;
  minimal_pair_examples: unknown;
  learner_mistakes: unknown;
  status: string;
  members: unknown;
};

export type ErrorTypeRow = {
  id: string;
  code: string;
  name_zh: string;
  description: string;
  parent_id: string | null;
  default_severity: string;
  status: string;
};

export type TagRow = {
  name_en: string;
  name_zh: string;
  description: string | null;
  priority: number | string | null;
};

export type ExampleRow = {
  id: string;
  jp: string;
  zh: string | null;
  difficulty: number | string;
  naturalness_score: number | string | null;
  notes: string | null;
  scene_name_en: string | null;
  scene_name_zh: string | null;
  scene_description: string | null;
  scene_priority: number | string | null;
  register_name_en: string | null;
  register_name_zh: string | null;
  register_description: string | null;
  register_priority: number | string | null;
};

export type SimilarGrammarRow = {
  id: string;
  grammar_point_id: string;
  similar_grammar_point_id: string;
  similar_grammar_point_text: string;
  difference_summary: string;
  example_a: string | null;
  example_b: string | null;
  notes: string | null;
};

export type InsertIdRow = {
  id: string;
};

export type ReviewRow = GrammarSummaryRow & {
  review_record_id: string;
  review_status: string;
  mistake_count: number | string;
  next_review_at: string | Date | null;
  last_reviewed_at: string | Date | null;
  latest_sentence: string | null;
  latest_feedback: string | null;
  corrected_sentence: string | null;
  mistake_types: unknown;
  issues: unknown;
  meaning_score: number | string | null;
  explanation: string | null;
  next_hint: string | null;
  scene_name_en: string | null;
  scene_name_zh: string | null;
  scene_description: string | null;
  scene_priority: number | string | null;
  register_name_en: string | null;
  register_name_zh: string | null;
  register_description: string | null;
  register_priority: number | string | null;
};

export type ReviewAggregationsRow = {
  aggregations: unknown;
};

export type ObjectiveRecommendationRow = {
  grammar_point_id: string;
  grammar_point: string;
  core_meaning: string;
  sense_key: string;
  learning_objective: string;
  estimate: number | string;
  confidence: number | string;
  attempts: number | string;
  assisted_attempts: number | string;
  exposure_count: number | string;
  recent_error_codes: unknown;
  next_review_at: string | Date | null;
  overall_estimate: number | string;
  overall_confidence: number | string;
  objective_progress: unknown;
};

export type ProgressGroupRow = {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  description: string;
  priority: number | string;
  total_count: number | string;
  started_count: number | string;
  mastered_count: number | string;
  pending_completion_count: number | string;
  due_review_count: number | string;
  review_count: number | string;
  favorite_count: number | string;
};

export type ProgressTotalsRow = {
  total_count: number | string;
  started_count: number | string;
  mastered_count: number | string;
  pending_completion_count: number | string;
  due_review_count: number | string;
  review_count: number | string;
  favorite_count: number | string;
};

export type StoredFeedback = {
  isCorrect: boolean;
  grammarScore: number;
  meaningScore: number;
  naturalnessScore: number;
  registerScore: number;
  sceneFitScore: number;
  issues: AIFeedbackIssue[];
  explanation: string;
  nextHint: string;
  feedbackText: string;
  correctedSentence?: string | null;
  betterVersions: AIFeedbackBetterVersion[];
  mistakeTypes: string[];
  nextPracticePrompt?: string | null;
  modelName?: string;
  rawAiResponse?: unknown;
};
