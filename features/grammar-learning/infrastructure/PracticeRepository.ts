import { query } from "@/shared/db/query";
import {
  COMPLETE_PRACTICE_SESSION_SQL,
  INSERT_EXERCISE_INSTANCE_SQL,
  RECORD_PRACTICE_ATTEMPT_SQL,
  REVEAL_EXERCISE_ANSWER_SQL,
  REVEAL_NEXT_EXERCISE_HINT_SQL,
  SELECT_ACTIVE_SESSION_EXERCISE_SQL,
  SELECT_EXERCISE_INSTANCE_SQL,
  SELECT_LEARNER_SKILL_STATES_SQL,
  SELECT_PRACTICE_BLUEPRINT_SQL,
  SELECT_PRACTICE_PLANNER_HISTORY_SQL,
  SELECT_PRACTICE_SESSION_SQL,
  SELECT_PRACTICE_SESSION_SUMMARY_SQL,
  SELECT_PRACTICE_GENERATION_METRICS_SQL,
  SELECT_PRACTICE_SESSION_OBJECTIVE_SUMMARY_SQL,
  SELECT_RECENT_EXERCISE_SIGNATURES_SQL,
  SELECT_RECOMMENDED_PRACTICE_GRAMMAR_SQL,
  SELECT_SCENARIO_TEMPLATE_SQL,
  UPSERT_PRACTICE_SESSION_SQL,
} from "@/shared/db/sql/practice.sql";
import type { AIFeedbackIssue, PracticeReferenceAnswer } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeDifficulty,
  PracticeExerciseOption,
  PracticeExerciseStatus,
  PracticeExerciseType,
  PracticeMasteryEvidence,
  PracticeResponseMode,
  PracticeSession,
  PracticeSessionEntryMode,
  PracticeSessionSkillSummary,
  PracticeSkillDimension,
  PracticeSkillState,
} from "@/shared/types/practice";
import type {
  AnswerContract,
  PracticeGenerationMetadata,
  PracticeIntent,
  PracticeRubric,
  PracticeRubricScores,
  MasteryEvidenceKind,
  LearningObjective,
  CognitiveOperation,
  TransferLevel,
  ScaffoldLevel,
} from "@/features/grammar-learning/domain/practiceV2";
import type {
  PracticeBlueprintRow,
  PracticeEvidenceResultRow,
  PracticeExerciseRow,
  PracticeRevealRow,
  PracticeScenarioTemplateRow,
  PracticePlannerHistoryRow,
  PracticeSessionRow,
  PracticeSkillStateRow,
  PracticeSummaryRow,
} from "@/features/grammar-learning/infrastructure/PracticeRepositoryRows";

type IdRow = { id: string };
type SignatureRow = { content_signature: string };
type HintRow = {
  hints_revealed: number | string;
  hint: string | null;
  has_more_hints: boolean;
};

function toNumber(value: number | string, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function toIsoString(value: string | Date | null) {
  return value === null ? null : new Date(value).toISOString();
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  return {};
}

function parseStringArray(value: unknown) {
  return parseJsonArray(value).filter((item): item is string => typeof item === "string");
}

function parseOptions(value: unknown): PracticeExerciseOption[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    const id = typeof record.id === "string" ? record.id : "";
    const label = typeof record.label === "string" ? record.label : "";
    return id && label ? [{ id, label }] : [];
  });
}

function parseReferenceAnswers(value: unknown): PracticeReferenceAnswer[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    const jp = typeof record.jp === "string" ? record.jp : "";
    const zh = typeof record.zh === "string" ? record.zh : "";
    const noteZh = typeof record.noteZh === "string" ? record.noteZh : "";
    return jp && zh ? [{ jp, zh, noteZh }] : [];
  });
}

export type PracticeBlueprintRecord = {
  id: string;
  slug: string;
  nameZh: string;
  description: string;
  skillDimension: PracticeSkillDimension;
  exerciseType: PracticeExerciseType;
  responseMode: PracticeResponseMode;
  minimumDifficulty: PracticeDifficulty;
  maximumDifficulty: PracticeDifficulty;
  plannerConfig: Record<string, unknown>;
  rubricTemplate: Record<string, unknown>;
  grammarPointId: string | null;
  senseKey: string | null;
  blueprintVersion: number;
  learningObjective: LearningObjective | null;
  cognitiveOperation: CognitiveOperation | null;
  supportedTransferLevels: TransferLevel[];
  supportedRegisters: string[];
  supportedScenarios: string[];
  misconceptionCodes: string[];
  contextRequirements: string[];
  difficultyRules: Record<string, unknown>;
  answerPolicy: Record<string, unknown>;
  hintPlan: ScaffoldLevel[];
};

export type ScenarioTemplateRecord = {
  id: string;
  slug: string;
  nameZh: string;
  sceneSlug: string;
  sceneLabel: string;
  registerSlug: string;
  registerLabel: string;
  speakerRole: string;
  listenerRole: string;
  socialDistance: PracticeContext["socialDistance"];
  hierarchy: PracticeContext["hierarchy"];
  requestBurden: PracticeContext["requestBurden"];
  medium: PracticeContext["medium"];
  communicativeGoals: string[];
  knownContexts: string[];
  detailPool: string[];
  compatibleFunctionTags: string[];
};

export type PracticeSessionRecord = PracticeSession & {
  userId: string;
  generatedExerciseCount: number;
  preferredScene: string | null;
  preferredRegister: string | null;
  planSnapshot: PracticeIntent[];
  plannerVersion: number;
};

export type PracticeExerciseRecord = {
  id: string;
  sessionId: string;
  userId: string;
  grammarPointId: string;
  comparisonSetId: string | null;
  sequenceNumber: number;
  skillDimension: PracticeSkillDimension;
  exerciseType: PracticeExerciseType;
  difficulty: PracticeDifficulty;
  responseMode: PracticeResponseMode;
  context: PracticeContext;
  prompt: string;
  options: PracticeExerciseOption[];
  expectedFeatures: Record<string, unknown>;
  referenceAnswers: PracticeReferenceAnswer[];
  hintLadder: string[];
  hintsRevealed: number;
  generationSource: "ai" | "fallback" | "deterministic";
  status: PracticeExerciseStatus;
  attemptCount: number;
  practiceIntent: PracticeIntent | null;
  answerContract: AnswerContract | null;
  rubric: PracticeRubric | null;
  generationMetadata: PracticeGenerationMetadata | null;
};

function mapSession(row: PracticeSessionRow): PracticeSessionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    entryMode: row.entry_mode as PracticeSessionEntryMode,
    focusGrammarPointId: row.focus_grammar_point_id,
    status: row.status as PracticeSession["status"],
    plannedExerciseCount: toNumber(row.planned_exercise_count),
    completedExerciseCount: toNumber(row.completed_exercise_count),
    generatedExerciseCount: toNumber(row.generated_exercise_count),
    startedAt: new Date(row.started_at).toISOString(),
    completedAt: toIsoString(row.completed_at),
    preferredScene: row.preferred_scene,
    preferredRegister: row.preferred_register,
    planSnapshot: parseJsonArray(row.plan_snapshot) as PracticeIntent[],
    plannerVersion: toNumber(row.planner_version, 1),
  };
}

function mapExercise(row: PracticeExerciseRow): PracticeExerciseRecord {
  return {
    id: row.id,
    sessionId: row.practice_session_id,
    userId: row.user_id,
    grammarPointId: row.grammar_point_id,
    comparisonSetId: row.comparison_set_id,
    sequenceNumber: toNumber(row.sequence_number),
    skillDimension: row.skill_dimension as PracticeSkillDimension,
    exerciseType: row.exercise_type as PracticeExerciseType,
    difficulty: toNumber(row.difficulty, 1) as PracticeDifficulty,
    responseMode: row.response_mode as PracticeResponseMode,
    context: parseJsonObject(row.context_snapshot) as PracticeContext,
    prompt: row.prompt,
    options: parseOptions(row.options),
    expectedFeatures: parseJsonObject(row.expected_features),
    referenceAnswers: parseReferenceAnswers(row.reference_answers),
    hintLadder: parseStringArray(row.hint_ladder),
    hintsRevealed: toNumber(row.hints_revealed),
    generationSource: row.generation_source as PracticeExerciseRecord["generationSource"],
    status: row.status as PracticeExerciseStatus,
    attemptCount: toNumber(row.attempt_count),
    practiceIntent: Object.keys(parseJsonObject(row.practice_intent_snapshot)).length
      ? (parseJsonObject(row.practice_intent_snapshot) as PracticeIntent)
      : null,
    answerContract: Object.keys(parseJsonObject(row.answer_contract)).length
      ? (parseJsonObject(row.answer_contract) as AnswerContract)
      : null,
    rubric: Object.keys(parseJsonObject(row.rubric)).length
      ? (parseJsonObject(row.rubric) as PracticeRubric)
      : null,
    generationMetadata: row.prompt_id
      ? {
          promptId: row.prompt_id,
          promptVersion: toNumber(row.prompt_version ?? 1, 1),
          schemaVersion: toNumber(row.schema_version, 1),
          grammarContentVersion: row.grammar_content_version ?? "legacy",
          model: row.model,
          generationSource: row.generation_source as PracticeGenerationMetadata["generationSource"],
          validationResults: parseJsonArray(row.validation_results) as PracticeGenerationMetadata["validationResults"],
          reviewerResult: Object.keys(parseJsonObject(row.reviewer_result)).length
            ? (parseJsonObject(row.reviewer_result) as PracticeGenerationMetadata["reviewerResult"])
            : null,
          generationRetryCount: toNumber(row.generation_retry_count),
          networkRetryCount: toNumber(row.network_retry_count),
          fallbackReason: row.fallback_reason,
          degradationReason: row.degradation_reason,
          latencyMs: toNumber(row.generation_latency_ms),
        }
      : null,
  };
}

export class PracticeRepository {
  async findRecommendedGrammarPointId(userId: string) {
    const rows = await query<IdRow>(SELECT_RECOMMENDED_PRACTICE_GRAMMAR_SQL, [userId]);
    return rows[0]?.id ?? null;
  }

  async upsertSession(input: {
    userId: string;
    clientSessionKey: string;
    entryMode: PracticeSessionEntryMode;
    grammarPointId: string;
    preferredScene: string;
    preferredRegister: string;
    plannedExerciseCount: number;
    metadata?: unknown;
    planSnapshot?: PracticeIntent[];
    plannerVersion?: number;
  }) {
    const rows = await query<IdRow>(UPSERT_PRACTICE_SESSION_SQL, [
      input.userId,
      input.clientSessionKey,
      input.entryMode,
      input.grammarPointId,
      input.preferredScene,
      input.preferredRegister,
      input.plannedExerciseCount,
      JSON.stringify(input.metadata ?? {}),
      JSON.stringify(input.planSnapshot ?? []),
      input.plannerVersion ?? 1,
    ]);
    return rows[0]?.id ?? "";
  }

  async findSession(sessionId: string, userId: string) {
    const rows = await query<PracticeSessionRow>(SELECT_PRACTICE_SESSION_SQL, [
      sessionId,
      userId,
    ]);
    return rows[0] ? mapSession(rows[0]) : null;
  }

  async findActiveExerciseId(sessionId: string, userId: string) {
    const rows = await query<IdRow>(SELECT_ACTIVE_SESSION_EXERCISE_SQL, [
      sessionId,
      userId,
    ]);
    return rows[0]?.id ?? null;
  }

  async findBlueprint(slug: string): Promise<PracticeBlueprintRecord | null> {
    const rows = await query<PracticeBlueprintRow>(SELECT_PRACTICE_BLUEPRINT_SQL, [slug]);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          nameZh: row.name_zh,
          description: row.description,
          skillDimension: row.skill_dimension as PracticeSkillDimension,
          exerciseType: row.exercise_type as PracticeExerciseType,
          responseMode: row.response_mode as PracticeResponseMode,
          minimumDifficulty: toNumber(row.minimum_difficulty, 1) as PracticeDifficulty,
          maximumDifficulty: toNumber(row.maximum_difficulty, 4) as PracticeDifficulty,
          plannerConfig: parseJsonObject(row.planner_config),
          rubricTemplate: parseJsonObject(row.rubric_template),
          grammarPointId: row.grammar_point_id,
          senseKey: row.sense_key,
          blueprintVersion: toNumber(row.blueprint_version, 1),
          learningObjective: row.learning_objective as LearningObjective | null,
          cognitiveOperation: row.cognitive_operation as CognitiveOperation | null,
          supportedTransferLevels: parseStringArray(row.supported_transfer_levels) as TransferLevel[],
          supportedRegisters: parseStringArray(row.supported_registers),
          supportedScenarios: parseStringArray(row.supported_scenarios),
          misconceptionCodes: parseStringArray(row.misconception_codes),
          contextRequirements: parseStringArray(row.context_requirements),
          difficultyRules: parseJsonObject(row.difficulty_rules),
          answerPolicy: parseJsonObject(row.answer_policy),
          hintPlan: parseStringArray(row.hint_plan) as ScaffoldLevel[],
        }
      : null;
  }

  async findScenarioTemplate(slug: string): Promise<ScenarioTemplateRecord | null> {
    const rows = await query<PracticeScenarioTemplateRow>(SELECT_SCENARIO_TEMPLATE_SQL, [slug]);
    const row = rows[0];
    return row
      ? {
          id: row.id,
          slug: row.slug,
          nameZh: row.name_zh,
          sceneSlug: row.scene_slug,
          sceneLabel: row.scene_label,
          registerSlug: row.register_slug,
          registerLabel: row.register_label,
          speakerRole: row.speaker_role,
          listenerRole: row.listener_role,
          socialDistance: row.social_distance as PracticeContext["socialDistance"],
          hierarchy: row.hierarchy as PracticeContext["hierarchy"],
          requestBurden: row.request_burden as PracticeContext["requestBurden"],
          medium: row.medium as PracticeContext["medium"],
          communicativeGoals: parseStringArray(row.communicative_goals),
          knownContexts: parseStringArray(row.known_contexts),
          detailPool: parseStringArray(row.detail_pool),
          compatibleFunctionTags: parseStringArray(row.compatible_function_tags),
        }
      : null;
  }

  async listSkillStates(userId: string, grammarPointId: string): Promise<PracticeSkillState[]> {
    const rows = await query<PracticeSkillStateRow>(SELECT_LEARNER_SKILL_STATES_SQL, [
      userId,
      grammarPointId,
    ]);
    return rows.map((row) => ({
      grammarPointId: row.grammar_point_id,
      skillDimension: row.skill_dimension as PracticeSkillDimension,
      estimate: toNumber(row.estimate),
      confidence: toNumber(row.confidence),
      attempts: toNumber(row.attempts),
      recentErrorCodes: parseStringArray(row.recent_error_codes),
      lastPracticedAt: toIsoString(row.last_practiced_at),
      nextReviewAt: toIsoString(row.next_review_at),
    }));
  }

  async getPlannerHistory(userId: string, grammarPointId: string) {
    const rows = await query<PracticePlannerHistoryRow>(
      SELECT_PRACTICE_PLANNER_HISTORY_SQL,
      [userId, grammarPointId]
    );
    const attempts = rows.filter((row) => row.is_correct !== null);
    let consecutiveFailures = 0;
    for (const row of attempts) {
      if (row.is_correct) break;
      consecutiveFailures += 1;
    }
    const recentErrorCodes = Array.from(
      new Set(
        attempts.flatMap((row) =>
          parseJsonArray(row.issues).flatMap((issue) => {
            const record = parseJsonObject(issue);
            return typeof record.errorTypeCode === "string"
              ? [record.errorTypeCode]
              : [];
          })
        )
      )
    );
    return {
      consecutiveFailures,
      recentErrorCodes,
      prerequisiteReady: rows[0]?.prerequisite_ready ?? true,
    };
  }

  async listRecentSignatures(userId: string, grammarPointId: string) {
    const rows = await query<SignatureRow>(SELECT_RECENT_EXERCISE_SIGNATURES_SQL, [
      userId,
      grammarPointId,
    ]);
    return rows.map((row) => row.content_signature);
  }

  async insertExercise(input: {
    sessionId: string;
    blueprintSlug: string;
    grammarPointId: string;
    comparisonSetId?: string | null;
    sequenceNumber: number;
    skillDimension: PracticeSkillDimension;
    exerciseType: PracticeExerciseType;
    difficulty: PracticeDifficulty;
    responseMode: PracticeResponseMode;
    context: PracticeContext;
    prompt: string;
    options: PracticeExerciseOption[];
    expectedFeatures: Record<string, unknown>;
    referenceAnswers: PracticeReferenceAnswer[];
    hintLadder: string[];
    source: PracticeExerciseRecord["generationSource"];
    generationSeed: string;
    contentSignature: string;
    practiceIntent?: PracticeIntent | null;
    answerContract?: AnswerContract | null;
    rubric?: PracticeRubric | null;
    generationMetadata?: PracticeGenerationMetadata | null;
  }) {
    const rows = await query<IdRow>(INSERT_EXERCISE_INSTANCE_SQL, [
      input.sessionId,
      input.blueprintSlug,
      input.grammarPointId,
      input.comparisonSetId ?? null,
      input.sequenceNumber,
      input.skillDimension,
      input.exerciseType,
      input.difficulty,
      input.responseMode,
      JSON.stringify(input.context),
      input.prompt,
      JSON.stringify(input.options),
      JSON.stringify(input.expectedFeatures),
      JSON.stringify(input.referenceAnswers),
      JSON.stringify(input.hintLadder),
      input.source,
      input.generationSeed,
      input.contentSignature,
      JSON.stringify(input.practiceIntent ?? {}),
      JSON.stringify(input.answerContract ?? {}),
      JSON.stringify(input.rubric ?? {}),
      input.practiceIntent?.blueprintVersion ?? 1,
      input.generationMetadata?.promptId ?? null,
      input.generationMetadata?.promptVersion ?? null,
      input.generationMetadata?.schemaVersion ?? 1,
      input.generationMetadata?.grammarContentVersion ?? null,
      input.generationMetadata?.model ?? null,
      JSON.stringify(input.generationMetadata?.validationResults ?? []),
      input.generationMetadata?.reviewerResult
        ? JSON.stringify(input.generationMetadata.reviewerResult)
        : null,
      input.generationMetadata?.generationRetryCount ?? 0,
      input.generationMetadata?.networkRetryCount ?? 0,
      input.generationMetadata?.fallbackReason ?? null,
      input.generationMetadata?.degradationReason ?? null,
      input.generationMetadata?.latencyMs ?? 0,
    ]);
    return rows[0]?.id ?? "";
  }

  async findExercise(exerciseId: string, userId: string) {
    const rows = await query<PracticeExerciseRow>(SELECT_EXERCISE_INSTANCE_SQL, [
      exerciseId,
      userId,
    ]);
    return rows[0] ? mapExercise(rows[0]) : null;
  }

  async revealNextHint(exerciseId: string, userId: string) {
    const rows = await query<HintRow>(REVEAL_NEXT_EXERCISE_HINT_SQL, [
      exerciseId,
      userId,
    ]);
    const row = rows[0];
    return row
      ? {
          hint: row.hint,
          hintsRevealed: toNumber(row.hints_revealed),
          hasMoreHints: row.has_more_hints,
        }
      : null;
  }

  async recordAttempt(input: {
    exerciseId: string;
    userId: string;
    attemptNumber: number;
    answer: string;
    selectedOptionId?: string | null;
    hintCount: number;
    isCorrect: boolean;
    grammarScore: number;
    meaningScore: number;
    naturalnessScore: number;
    registerScore: number;
    sceneFitScore: number;
    issues: AIFeedbackIssue[];
    explanation: string;
    nextHint: string;
    legacyUserSentenceId?: string | null;
    legacyFeedbackId?: string | null;
    evidenceScore: number;
    independent: boolean;
    contextNovelty: number;
    rubricScores?: PracticeRubricScores | null;
    evidenceKind?: MasteryEvidenceKind | null;
  }): Promise<PracticeMasteryEvidence & { attemptId: string }> {
    const rows = await query<PracticeEvidenceResultRow>(RECORD_PRACTICE_ATTEMPT_SQL, [
      input.exerciseId,
      input.userId,
      input.attemptNumber,
      input.answer,
      input.selectedOptionId ?? null,
      input.hintCount,
      input.isCorrect,
      input.grammarScore,
      input.meaningScore,
      input.naturalnessScore,
      input.registerScore,
      input.sceneFitScore,
      JSON.stringify(input.issues),
      input.explanation,
      input.nextHint,
      input.legacyUserSentenceId ?? null,
      input.legacyFeedbackId ?? null,
      input.evidenceScore,
      input.independent,
      input.contextNovelty,
      JSON.stringify(input.issues.map((issue) => issue.errorTypeCode)),
      JSON.stringify(input.rubricScores ?? {}),
      input.evidenceKind ?? null,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error("Practice attempt could not be persisted.");
    }
    const exercise = await this.findExercise(input.exerciseId, input.userId);
    if (!exercise) {
      throw new Error("Practice exercise disappeared after attempt persistence.");
    }
    return {
      attemptId: row.id,
      skillDimension: exercise.skillDimension,
      score: input.evidenceScore,
      independent: input.independent,
      hintCount: input.hintCount,
      attemptNumber: input.attemptNumber,
      contextNovelty: input.contextNovelty,
      estimate: toNumber(row.estimate),
      confidence: toNumber(row.confidence),
      nextReviewAt: new Date(row.next_review_at).toISOString(),
      learningObjective: exercise.practiceIntent?.learningObjective,
      evidenceKind: input.evidenceKind ?? undefined,
      rubricScores: input.rubricScores ?? undefined,
    };
  }

  async revealAnswer(exerciseId: string, userId: string) {
    const rows = await query<PracticeRevealRow>(REVEAL_EXERCISE_ANSWER_SQL, [
      exerciseId,
      userId,
    ]);
    const row = rows[0];
    return row
      ? {
          referenceAnswers: parseReferenceAnswers(row.reference_answers),
          evidence: {
            skillDimension: row.skill_dimension as PracticeSkillDimension,
            score: 0.2,
            independent: false,
            hintCount: toNumber(row.hints_revealed),
            attemptNumber: 0,
            contextNovelty: 1,
            estimate: toNumber(row.estimate),
            confidence: toNumber(row.confidence),
            nextReviewAt: new Date(row.next_review_at).toISOString(),
            learningObjective: row.learning_objective as PracticeMasteryEvidence["learningObjective"],
            evidenceKind: "exposure",
          } satisfies PracticeMasteryEvidence,
        }
      : null;
  }

  async completeSession(sessionId: string, userId: string) {
    const rows = await query<IdRow>(COMPLETE_PRACTICE_SESSION_SQL, [sessionId, userId]);
    return Boolean(rows[0]);
  }

  async getSessionSkillSummaries(sessionId: string) {
    const rows = await query<PracticeSummaryRow>(SELECT_PRACTICE_SESSION_SUMMARY_SQL, [
      sessionId,
    ]);
    const summary = parseJsonObject(rows[0]?.summary);
    return parseJsonArray(summary.skillSummaries).flatMap((item) => {
      const record = parseJsonObject(item);
      const skillDimension = record.skillDimension;
      if (typeof skillDimension !== "string") {
        return [];
      }
      return [
        {
          skillDimension: skillDimension as PracticeSkillDimension,
          evidenceCount: toNumber(record.evidenceCount as number | string),
          averageScore: toNumber(record.averageScore as number | string),
          estimate: toNumber(record.estimate as number | string),
          confidence: toNumber(record.confidence as number | string),
        } satisfies PracticeSessionSkillSummary,
      ];
    });
  }

  async getGenerationMetrics(since?: string | null) {
    const rows = await query<{ metrics: unknown }>(
      SELECT_PRACTICE_GENERATION_METRICS_SQL,
      [since ?? null]
    );
    return parseJsonObject(rows[0]?.metrics);
  }

  async getSessionObjectiveSummaries(sessionId: string) {
    const rows = await query<{
      learning_objective: string;
      evidence_count: number | string;
      average_score: number | string;
      estimate: number | string | null;
      confidence: number | string | null;
    }>(SELECT_PRACTICE_SESSION_OBJECTIVE_SUMMARY_SQL, [sessionId]);
    return rows.map((row) => ({
      learningObjective: row.learning_objective,
      evidenceCount: toNumber(row.evidence_count),
      averageScore: toNumber(row.average_score),
      estimate: toNumber(row.estimate ?? 0),
      confidence: toNumber(row.confidence ?? 0),
    }));
  }
}
