export type PracticeSessionRow = {
  id: string;
  user_id: string;
  entry_mode: string;
  focus_grammar_point_id: string;
  status: string;
  planned_exercise_count: number | string;
  completed_exercise_count: number | string;
  generated_exercise_count: number | string;
  started_at: string | Date;
  completed_at: string | Date | null;
  preferred_scene: string | null;
  preferred_register: string | null;
  plan_snapshot: unknown;
  planner_version: number | string;
};

export type PracticeBlueprintRow = {
  id: string;
  slug: string;
  name_zh: string;
  description: string;
  skill_dimension: string;
  exercise_type: string;
  response_mode: string;
  supported_point_types: unknown;
  minimum_difficulty: number | string;
  maximum_difficulty: number | string;
  planner_config: unknown;
  rubric_template: unknown;
  grammar_point_id: string | null;
  sense_key: string | null;
  blueprint_version: number | string;
  learning_objective: string | null;
  cognitive_operation: string | null;
  supported_transfer_levels: unknown;
  supported_registers: unknown;
  supported_scenarios: unknown;
  misconception_codes: unknown;
  context_requirements: unknown;
  difficulty_rules: unknown;
  answer_policy: unknown;
  hint_plan: unknown;
};

export type PracticeScenarioTemplateRow = {
  id: string;
  slug: string;
  name_zh: string;
  scene_slug: string;
  scene_label: string;
  register_slug: string;
  register_label: string;
  speaker_role: string;
  listener_role: string;
  social_distance: string;
  hierarchy: string;
  request_burden: string;
  medium: string;
  communicative_goals: unknown;
  known_contexts: unknown;
  detail_pool: unknown;
  compatible_function_tags: unknown;
};

export type PracticeExerciseRow = {
  id: string;
  practice_session_id: string;
  user_id: string;
  grammar_point_id: string;
  comparison_set_id: string | null;
  sequence_number: number | string;
  skill_dimension: string;
  exercise_type: string;
  difficulty: number | string;
  response_mode: string;
  context_snapshot: unknown;
  prompt: string;
  options: unknown;
  expected_features: unknown;
  reference_answers: unknown;
  hint_ladder: unknown;
  hints_revealed: number | string;
  generation_source: string;
  status: string;
  attempt_count: number | string;
  practice_intent_snapshot: unknown;
  answer_contract: unknown;
  rubric: unknown;
  blueprint_version: number | string;
  prompt_id: string | null;
  prompt_version: number | string | null;
  schema_version: number | string;
  grammar_content_version: string | null;
  model: string | null;
  validation_results: unknown;
  reviewer_result: unknown;
  generation_retry_count: number | string;
  network_retry_count: number | string;
  fallback_reason: string | null;
  degradation_reason: string | null;
  generation_latency_ms: number | string;
};

export type PracticePlannerHistoryRow = {
  is_correct: boolean | null;
  issues: unknown;
  prerequisite_ready: boolean;
};

export type PracticeSkillStateRow = {
  grammar_point_id: string;
  skill_dimension: string;
  estimate: number | string;
  confidence: number | string;
  attempts: number | string;
  recent_error_codes: unknown;
  last_practiced_at: string | Date | null;
  next_review_at: string | Date | null;
};

export type PracticeEvidenceResultRow = {
  id: string;
  estimate: number | string;
  confidence: number | string;
  next_review_at: string | Date;
};

export type PracticeRevealRow = {
  reference_answers: unknown;
  hints_revealed: number | string;
  estimate: number | string;
  confidence: number | string;
  next_review_at: string | Date;
  skill_dimension: string;
  learning_objective: string | null;
};

export type PracticeSummaryRow = {
  summary: unknown;
};
