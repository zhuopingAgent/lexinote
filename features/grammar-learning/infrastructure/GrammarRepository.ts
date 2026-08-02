import {
  DEFAULT_GRAMMAR_USER_ID,
  DELETE_FAVORITE_SQL,
  INSERT_AI_FEEDBACK_SQL,
  INSERT_LEARNING_HISTORY_SQL,
  INSERT_USER_SENTENCE_SQL,
  SEARCH_GRAMMAR_POINTS_SQL,
  SELECT_COMPARISON_SETS_SQL,
  SELECT_COMPARISON_SETS_FOR_GRAMMAR_POINT_SQL,
  SELECT_ERROR_TYPES_SQL,
  SELECT_GRAMMAR_CATEGORY_GROUPS_SQL,
  SELECT_EXAMPLES_FOR_GRAMMAR_POINT_SQL,
  SELECT_FAVORITES_SQL,
  SELECT_GRAMMAR_CATEGORIES_SQL,
  SELECT_GRAMMAR_PROGRESS_TOTALS_SQL,
  SELECT_GRAMMAR_PROGRESS_SQL,
  SELECT_GRAMMAR_POINT_DETAIL_SQL,
  SELECT_KNOWLEDGE_DIMENSIONS_SQL,
  SELECT_LEARNING_MODULES_SQL,
  SELECT_LEARNING_STAGES_SQL,
  SELECT_REGISTER_TAGS_SQL,
  SELECT_OBJECTIVE_RECOMMENDATIONS_SQL,
  SELECT_REVIEW_AGGREGATIONS_SQL,
  SELECT_REVIEW_ITEMS_SQL,
  SELECT_SCENE_TAGS_SQL,
  SELECT_SIMILAR_GRAMMAR_FOR_POINT_SQL,
  SELECT_TAG_BY_KIND_AND_NAME_SQL,
  SELECT_TAXONOMY_NODES_SQL,
  UPSERT_FAVORITE_SQL,
  UPSERT_REVIEW_RECORD_FOR_CORRECT_SQL,
  UPSERT_REVIEW_RECORD_FOR_MISTAKE_SQL,
} from "@/shared/db/sql/grammar.sql";
import { query } from "@/shared/db/query";
import type {
  ComparisonSet,
  GrammarCategory,
  GrammarCategoryGroup,
  GrammarErrorType,
  GrammarExample,
  GrammarPointDetail,
  GrammarPointSummary,
  GrammarLearningObjective,
  GrammarObjectiveProgress,
  GrammarProgressGroup,
  GrammarReviewAggregations,
  GrammarObjectiveRecommendation,
  GrammarReviewItem,
  GrammarTag,
  KnowledgeDimension,
  LearningModule,
  LearningStage,
  SimilarGrammarRelation,
  TaxonomyNode,
} from "@/shared/types/grammar";
import {
  mapComparisonSetRow,
  mapSummaryRow,
  mapTagRow,
  parseConnections,
  parseFeedbackIssues,
  parseFormSiblings,
  parseMistakeTypes,
  parsePrerequisites,
  parseReviewAggregations,
  parseReviewStatus,
  parseStringArray,
  parseTaxonomyStatus,
  toInteger,
  toIsoString,
} from "@/features/grammar-learning/infrastructure/GrammarRepositoryMapper";
import type {
  ComparisonSetRow,
  ErrorTypeRow,
  ExampleRow,
  GrammarCategoryGroupRow,
  GrammarCategoryRow,
  GrammarDetailRow,
  GrammarSummaryRow,
  InsertIdRow,
  KnowledgeDimensionRow,
  LearningModuleRow,
  LearningStageRow,
  ProgressGroupRow,
  ProgressTotalsRow,
  ReviewAggregationsRow,
  ObjectiveRecommendationRow,
  ReviewRow,
  SimilarGrammarRow,
  StoredFeedback,
  TagRow,
  TaxonomyNodeRow,
} from "@/features/grammar-learning/infrastructure/GrammarRepositoryRows";

const GRAMMAR_LEARNING_OBJECTIVES = new Set<GrammarLearningObjective>([
  "meaning",
  "form_connection",
  "grammar_selection",
  "register_control",
  "collocation_naturalness",
  "discourse_function",
]);

type GrammarProgressTotals = {
  totalGrammarPoints: number;
  startedCount: number;
  masteredCount: number;
  pendingCompletionCount: number;
  dueReviewCount: number;
  reviewCount: number;
  favoriteCount: number;
};

function parseObjectiveProgress(value: unknown): GrammarObjectiveProgress[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    const learningObjective = record.learningObjective;
    if (
      typeof learningObjective !== "string" ||
      !GRAMMAR_LEARNING_OBJECTIVES.has(
        learningObjective as GrammarLearningObjective
      )
    ) {
      return [];
    }

    return [{
      learningObjective: learningObjective as GrammarLearningObjective,
      estimate: Number(record.estimate) || 0,
      confidence: Number(record.confidence) || 0,
      attempts: toInteger(record.attempts as number | string | null),
      assistedAttempts: toInteger(
        record.assistedAttempts as number | string | null
      ),
      exposureCount: toInteger(record.exposureCount as number | string | null),
      recentErrorCodes: parseStringArray(record.recentErrorCodes),
      nextReviewAt:
        typeof record.nextReviewAt === "string"
          ? toIsoString(record.nextReviewAt)
          : null,
    }];
  });
}

export class GrammarRepository {
  async getProgressTotals(userId: string): Promise<GrammarProgressTotals> {
    const rows = await query<ProgressTotalsRow>(
      SELECT_GRAMMAR_PROGRESS_TOTALS_SQL,
      [userId]
    );
    const row = rows[0];

    return {
      totalGrammarPoints: toInteger(row?.total_count ?? 0),
      startedCount: toInteger(row?.started_count ?? 0),
      masteredCount: toInteger(row?.mastered_count ?? 0),
      pendingCompletionCount: toInteger(row?.pending_completion_count ?? 0),
      dueReviewCount: toInteger(row?.due_review_count ?? 0),
      reviewCount: toInteger(row?.review_count ?? 0),
      favoriteCount: toInteger(row?.favorite_count ?? 0),
    };
  }

  async listKnowledgeDimensions(): Promise<KnowledgeDimension[]> {
    const rows = await query<KnowledgeDimensionRow>(
      SELECT_KNOWLEDGE_DIMENSIONS_SQL
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameZh: row.name_zh,
      nameEn: row.name_en,
      description: row.description,
      displayOrder: toInteger(row.display_order),
      status: parseTaxonomyStatus(row.status),
    }));
  }

  async listLearningStages(): Promise<LearningStage[]> {
    const rows = await query<LearningStageRow>(SELECT_LEARNING_STAGES_SQL);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameZh: row.name_zh,
      description: row.description,
      displayOrder: toInteger(row.display_order),
      status: parseTaxonomyStatus(row.status),
    }));
  }

  async listLearningModules(): Promise<LearningModule[]> {
    const rows = await query<LearningModuleRow>(SELECT_LEARNING_MODULES_SQL);

    return rows.map((row) => ({
      id: row.id,
      stageId: row.stage_id,
      stageSlug: row.stage_slug,
      stageNameZh: row.stage_name_zh,
      slug: row.slug,
      nameZh: row.name_zh,
      description: row.description,
      displayOrder: toInteger(row.display_order),
      status: parseTaxonomyStatus(row.status),
    }));
  }

  async listTaxonomyNodes(): Promise<TaxonomyNode[]> {
    const rows = await query<TaxonomyNodeRow>(SELECT_TAXONOMY_NODES_SQL);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      dimensionId: row.dimension_id,
      dimensionSlug: row.dimension_slug,
      dimensionNameZh: row.dimension_name_zh,
      dimensionNameEn: row.dimension_name_en,
      nameZh: row.name_zh,
      nameEn: row.name_en,
      description: row.description,
      exampleExpressions: parseStringArray(row.example_expressions),
      displayOrder: toInteger(row.display_order),
      status: parseTaxonomyStatus(row.status),
    }));
  }

  async listComparisonSets(): Promise<ComparisonSet[]> {
    const rows = await query<ComparisonSetRow>(SELECT_COMPARISON_SETS_SQL);

    return rows.map((row) => mapComparisonSetRow(row));
  }

  async listComparisonSetsForGrammarPoint(
    grammarPointId: string
  ): Promise<ComparisonSet[]> {
    const rows = await query<ComparisonSetRow>(
      SELECT_COMPARISON_SETS_FOR_GRAMMAR_POINT_SQL,
      [grammarPointId]
    );

    return rows.map((row) => mapComparisonSetRow(row));
  }

  async listErrorTypes(): Promise<GrammarErrorType[]> {
    const rows = await query<ErrorTypeRow>(SELECT_ERROR_TYPES_SQL);

    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      nameZh: row.name_zh,
      description: row.description,
      parentId: row.parent_id,
      defaultSeverity:
        row.default_severity === "low" ||
        row.default_severity === "high" ||
        row.default_severity === "critical"
          ? row.default_severity
          : "medium",
      status: parseTaxonomyStatus(row.status),
    }));
  }

  async listCategoryGroups(): Promise<GrammarCategoryGroup[]> {
    const rows = await query<GrammarCategoryGroupRow>(
      SELECT_GRAMMAR_CATEGORY_GROUPS_SQL
    );

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameZh: row.name_zh,
      nameEn: row.name_en,
      description: row.description,
      priority: toInteger(row.priority),
      isMvp: row.is_mvp,
    }));
  }

  async listCategories(): Promise<GrammarCategory[]> {
    const rows = await query<GrammarCategoryRow>(SELECT_GRAMMAR_CATEGORIES_SQL);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      groupId: row.group_id,
      groupSlug: row.group_slug,
      groupNameZh: row.group_name_zh,
      groupNameEn: row.group_name_en,
      groupDescription: row.group_description,
      groupPriority:
        row.group_priority === null || row.group_priority === undefined
          ? null
          : toInteger(row.group_priority),
      nameZh: row.name_zh,
      nameEn: row.name_en,
      description: row.description,
      exampleExpressions: parseStringArray(row.example_expressions),
      priority: toInteger(row.priority),
      isMvp: row.is_mvp,
    }));
  }

  async listSceneTags(): Promise<GrammarTag[]> {
    const rows = await query<TagRow>(SELECT_SCENE_TAGS_SQL);
    return rows.map((row) => mapTagRow(row));
  }

  async listRegisterTags(): Promise<GrammarTag[]> {
    const rows = await query<TagRow>(SELECT_REGISTER_TAGS_SQL);
    return rows.map((row) => mapTagRow(row));
  }

  async findTag(kind: "scene" | "register", nameEn?: string): Promise<GrammarTag | null> {
    const normalizedName = nameEn?.trim();
    if (!normalizedName) {
      return null;
    }

    const rows = await query<TagRow>(SELECT_TAG_BY_KIND_AND_NAME_SQL, [
      kind,
      normalizedName,
    ]);
    return rows[0] ? mapTagRow(rows[0]) : null;
  }

  async searchGrammarPoints(options?: {
    query?: string;
    categorySlug?: string;
    dimensionSlug?: string;
    stageSlug?: string;
    moduleSlug?: string;
    limit?: number;
    offset?: number;
    userId?: string;
  }): Promise<GrammarPointSummary[]> {
    const normalizedQuery = options?.query?.trim() ?? "";
    const normalizedLimit = Math.min(Math.max(options?.limit ?? 24, 1), 80);
    const normalizedOffset = Math.min(Math.max(options?.offset ?? 0, 0), 10_000);
    const categorySlug = options?.categorySlug?.trim() ?? "";
    const dimensionSlug = options?.dimensionSlug?.trim() ?? "";
    const stageSlug = options?.stageSlug?.trim() ?? "";
    const moduleSlug = options?.moduleSlug?.trim() ?? "";
    const rows = await query<GrammarSummaryRow>(SEARCH_GRAMMAR_POINTS_SQL, [
      normalizedQuery,
      `%${normalizedQuery}%`,
      normalizedLimit,
      options?.userId ?? DEFAULT_GRAMMAR_USER_ID,
      categorySlug,
      dimensionSlug,
      stageSlug,
      normalizedOffset,
      moduleSlug,
    ]);

    return rows.map((row) => mapSummaryRow(row));
  }

  async findGrammarPointById(
    grammarPointReference: string,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<GrammarPointDetail | null> {
    const rows = await query<GrammarDetailRow>(SELECT_GRAMMAR_POINT_DETAIL_SQL, [
      grammarPointReference,
      userId,
    ]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    const [examples, similarGrammar, comparisonSets] = await Promise.all([
      this.listExamples(row.id),
      this.listSimilarGrammar(row.id),
      this.listComparisonSetsForGrammarPoint(row.id),
    ]);

    return {
      ...mapSummaryRow(row),
      usage: row.usage_notes,
      notes: row.notes,
      jlptLevel: row.jlpt_level,
      commonMistakes: parseStringArray(row.common_mistakes),
      connections: parseConnections(row.connections),
      prerequisites: parsePrerequisites(row.prerequisites),
      formSiblings: parseFormSiblings(row.form_siblings),
      comparisonSets,
      examples,
      similarGrammar,
    };
  }

  async listExamples(grammarPointId: string): Promise<GrammarExample[]> {
    const rows = await query<ExampleRow>(SELECT_EXAMPLES_FOR_GRAMMAR_POINT_SQL, [
      grammarPointId,
    ]);

    return rows.map((row) => ({
      id: row.id,
      jp: row.jp,
      zh: row.zh,
      sceneTag:
        row.scene_name_en && row.scene_name_zh
          ? {
              nameEn: row.scene_name_en,
              nameZh: row.scene_name_zh,
              description: row.scene_description ?? undefined,
              priority: toInteger(row.scene_priority),
            }
          : null,
      registerTag:
        row.register_name_en && row.register_name_zh
          ? {
              nameEn: row.register_name_en,
              nameZh: row.register_name_zh,
              description: row.register_description ?? undefined,
              priority: toInteger(row.register_priority),
            }
          : null,
      difficulty: toInteger(row.difficulty, 1),
      naturalnessScore:
        row.naturalness_score === null ? null : toInteger(row.naturalness_score),
      notes: row.notes,
    }));
  }

  async listSimilarGrammar(grammarPointId: string): Promise<SimilarGrammarRelation[]> {
    const rows = await query<SimilarGrammarRow>(SELECT_SIMILAR_GRAMMAR_FOR_POINT_SQL, [
      grammarPointId,
    ]);

    return rows.map((row) => ({
      id: row.id,
      grammarPointId: row.grammar_point_id,
      similarGrammarPointId: row.similar_grammar_point_id,
      similarGrammarPointText: row.similar_grammar_point_text,
      differenceSummary: row.difference_summary,
      exampleA: row.example_a,
      exampleB: row.example_b,
      notes: row.notes,
    }));
  }

  async insertUserSentence(input: {
    userId: string;
    grammarPointId: string;
    sentence: string;
    sceneTag?: string;
    registerTag?: string;
    promptText?: string;
  }): Promise<string> {
    const rows = await query<InsertIdRow>(INSERT_USER_SENTENCE_SQL, [
      input.userId,
      input.grammarPointId,
      input.sentence,
      input.sceneTag ?? null,
      input.registerTag ?? null,
      input.promptText ?? null,
    ]);

    return rows[0]?.id ?? "";
  }

  async insertFeedback(userSentenceId: string, feedback: StoredFeedback): Promise<string> {
    const rows = await query<InsertIdRow>(INSERT_AI_FEEDBACK_SQL, [
      userSentenceId,
      feedback.grammarScore,
      feedback.meaningScore,
      feedback.naturalnessScore,
      feedback.registerScore,
      feedback.sceneFitScore,
      feedback.isCorrect,
      feedback.feedbackText,
      feedback.explanation,
      feedback.correctedSentence ?? null,
      JSON.stringify(feedback.betterVersions),
      JSON.stringify(feedback.mistakeTypes),
      JSON.stringify(feedback.issues),
      feedback.nextPracticePrompt ?? null,
      feedback.nextHint,
      feedback.modelName ?? null,
      JSON.stringify(feedback.rawAiResponse ?? {}),
    ]);

    return rows[0]?.id ?? "";
  }

  async updateReviewRecord(options: {
    userId: string;
    grammarPointId: string;
    hasMistake: boolean;
  }): Promise<void> {
    await query(
      options.hasMistake
        ? UPSERT_REVIEW_RECORD_FOR_MISTAKE_SQL
        : UPSERT_REVIEW_RECORD_FOR_CORRECT_SQL,
      [options.userId, options.grammarPointId]
    );
  }

  async logLearningHistory(input: {
    userId: string;
    grammarPointId?: string | null;
    activityType: string;
    metadata?: unknown;
  }): Promise<void> {
    await query(INSERT_LEARNING_HISTORY_SQL, [
      input.userId,
      input.grammarPointId ?? null,
      input.activityType,
      JSON.stringify(input.metadata ?? {}),
    ]);
  }

  async addFavorite(userId: string, grammarPointId: string): Promise<void> {
    await query(UPSERT_FAVORITE_SQL, [userId, grammarPointId]);
  }

  async removeFavorite(userId: string, grammarPointId: string): Promise<void> {
    await query(DELETE_FAVORITE_SQL, [userId, grammarPointId]);
  }

  async listFavorites(userId: string): Promise<GrammarPointSummary[]> {
    const rows = await query<GrammarSummaryRow>(SELECT_FAVORITES_SQL, [userId]);
    return rows.map((row) => mapSummaryRow(row));
  }

  async listReviewItems(userId: string): Promise<GrammarReviewItem[]> {
    const rows = await query<ReviewRow>(SELECT_REVIEW_ITEMS_SQL, [userId]);

    return rows.map((row) => {
      const issues = parseFeedbackIssues({
        issues: row.issues,
        mistakeTypes: row.mistake_types,
        fallbackExplanation: row.explanation ?? row.latest_feedback,
        fallbackCorrection: row.corrected_sentence,
        grammarPointId: row.id,
      });

      return {
        reviewRecordId: row.review_record_id,
        grammarPoint: mapSummaryRow(row),
        status: parseReviewStatus(row.review_status),
        mistakeCount: toInteger(row.mistake_count),
        nextReviewAt: toIsoString(row.next_review_at),
        lastReviewedAt: toIsoString(row.last_reviewed_at),
        latestSentence: row.latest_sentence,
        latestFeedback: row.latest_feedback,
        correctedSentence: row.corrected_sentence,
        mistakeTypes:
          issues.length > 0
            ? issues.map((issue) => issue.errorTypeCode)
            : parseMistakeTypes(row.mistake_types),
        issues,
        meaningScore:
          row.meaning_score === null ? null : toInteger(row.meaning_score),
        explanation: row.explanation,
        nextHint: row.next_hint,
        sceneTag:
          row.scene_name_en && row.scene_name_zh
            ? {
                nameEn: row.scene_name_en,
                nameZh: row.scene_name_zh,
                description: row.scene_description ?? undefined,
                priority: toInteger(row.scene_priority),
              }
            : null,
        registerTag:
          row.register_name_en && row.register_name_zh
            ? {
                nameEn: row.register_name_en,
                nameZh: row.register_name_zh,
                description: row.register_description ?? undefined,
                priority: toInteger(row.register_priority),
              }
            : null,
      };
    });
  }

  async getReviewAggregations(userId: string): Promise<GrammarReviewAggregations> {
    const rows = await query<ReviewAggregationsRow>(
      SELECT_REVIEW_AGGREGATIONS_SQL,
      [userId]
    );

    return parseReviewAggregations(rows[0]?.aggregations);
  }

  async listObjectiveRecommendations(
    userId: string
  ): Promise<GrammarObjectiveRecommendation[]> {
    const rows = await query<ObjectiveRecommendationRow>(
      SELECT_OBJECTIVE_RECOMMENDATIONS_SQL,
      [userId]
    );
    return rows.map((row) => {
      const attempts = toInteger(row.attempts);
      const assistedAttempts = toInteger(row.assisted_attempts);
      const exposureCount = toInteger(row.exposure_count);
      const estimate = Number(row.estimate);
      const recentErrorCodes = parseStringArray(row.recent_error_codes);
      const objectives = parseObjectiveProgress(row.objective_progress);
      const reasonZh = "尚未完成，建议完成一次练习并确认掌握。";
      return {
        grammarPointId: row.grammar_point_id,
        grammarPoint: row.grammar_point,
        coreMeaning: row.core_meaning,
        senseKey: row.sense_key,
        learningObjective: row.learning_objective as GrammarObjectiveRecommendation["learningObjective"],
        estimate,
        confidence: Number(row.confidence),
        attempts,
        assistedAttempts,
        exposureCount,
        recentErrorCodes,
        nextReviewAt: toIsoString(row.next_review_at),
        overallEstimate: Number(row.overall_estimate),
        overallConfidence: Number(row.overall_confidence),
        objectives,
        reasonZh,
      };
    });
  }

  async getProgress(userId: string): Promise<GrammarProgressGroup[]> {
    const rows = await query<ProgressGroupRow>(SELECT_GRAMMAR_PROGRESS_SQL, [
      userId,
    ]);

    return rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      nameZh: row.name_zh,
      nameEn: row.name_en,
      description: row.description,
      priority: toInteger(row.priority),
      totalCount: toInteger(row.total_count),
      startedCount: toInteger(row.started_count),
      masteredCount: toInteger(row.mastered_count),
      pendingCompletionCount: toInteger(row.pending_completion_count),
      dueReviewCount: toInteger(row.due_review_count),
      reviewCount: toInteger(row.review_count),
      favoriteCount: toInteger(row.favorite_count),
    }));
  }
}
