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
};

export type PracticeSummaryRow = {
  summary: unknown;
};
