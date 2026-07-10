import {
  DEFAULT_GRAMMAR_USER_ID,
  DELETE_FAVORITE_SQL,
  INSERT_AI_FEEDBACK_SQL,
  INSERT_LEARNING_HISTORY_SQL,
  INSERT_USER_SENTENCE_SQL,
  SEARCH_GRAMMAR_POINTS_SQL,
  SELECT_GRAMMAR_CATEGORY_GROUPS_SQL,
  SELECT_EXAMPLES_FOR_GRAMMAR_POINT_SQL,
  SELECT_FAVORITES_SQL,
  SELECT_GRAMMAR_CATEGORIES_SQL,
  SELECT_GRAMMAR_PROGRESS_SQL,
  SELECT_GRAMMAR_POINT_DETAIL_SQL,
  SELECT_REGISTER_TAGS_SQL,
  SELECT_REVIEW_ITEMS_SQL,
  SELECT_SCENE_TAGS_SQL,
  SELECT_SIMILAR_GRAMMAR_FOR_POINT_SQL,
  SELECT_TAG_BY_KIND_AND_NAME_SQL,
  UPSERT_FAVORITE_SQL,
  UPSERT_REVIEW_RECORD_FOR_CORRECT_SQL,
  UPSERT_REVIEW_RECORD_FOR_MISTAKE_SQL,
} from "@/shared/db/sql/grammar.sql";
import { query } from "@/shared/db/query";
import type {
  AIFeedbackBetterVersion,
  GrammarCategory,
  GrammarCategoryGroup,
  GrammarExample,
  GrammarPointDetail,
  GrammarPointSummary,
  GrammarProgressGroup,
  GrammarReviewItem,
  GrammarTag,
  Practicality,
  ReviewStatus,
  SimilarGrammarRelation,
  SpokenOrWritten,
} from "@/shared/types/api";

type GrammarSummaryRow = {
  id: string;
  grammar_point: string;
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
  scene_tags: unknown;
  register_tags: unknown;
};

type GrammarDetailRow = GrammarSummaryRow & {
  notes: string | null;
  jlpt_level: string | null;
  common_mistakes: unknown;
};

type GrammarCategoryRow = {
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

type GrammarCategoryGroupRow = {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  description: string;
  priority: number | string;
  is_mvp: boolean;
};

type TagRow = {
  name_en: string;
  name_zh: string;
  description: string | null;
  priority: number | string | null;
};

type ExampleRow = {
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

type SimilarGrammarRow = {
  id: string;
  grammar_point_id: string;
  similar_grammar_point_id: string;
  similar_grammar_point_text: string;
  difference_summary: string;
  example_a: string | null;
  example_b: string | null;
  notes: string | null;
};

type InsertIdRow = {
  id: string;
};

type ReviewRow = GrammarSummaryRow & {
  review_record_id: string;
  status: string;
  mistake_count: number | string;
  next_review_at: string | Date | null;
  last_reviewed_at: string | Date | null;
  latest_sentence: string | null;
  latest_feedback: string | null;
  corrected_sentence: string | null;
  mistake_types: unknown;
};

type ProgressGroupRow = {
  id: string;
  slug: string;
  name_zh: string;
  name_en: string;
  description: string;
  priority: number | string;
  total_count: number | string;
  started_count: number | string;
  mastered_count: number | string;
  review_count: number | string;
  favorite_count: number | string;
};

type StoredFeedback = {
  isCorrect: boolean;
  grammarScore: number;
  naturalnessScore: number;
  registerScore: number;
  sceneFitScore: number;
  feedbackText: string;
  correctedSentence?: string | null;
  betterVersions: AIFeedbackBetterVersion[];
  mistakeTypes: string[];
  nextPracticePrompt?: string | null;
  modelName?: string;
  rawAiResponse?: unknown;
};

function toInteger(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  return fallback;
}

function toIsoString(value: string | Date | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
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

function parseStringArray(value: unknown): string[] {
  return parseJsonArray(value).filter((item): item is string => typeof item === "string");
}

function parseTags(value: unknown): GrammarTag[] {
  const tags: GrammarTag[] = [];

  for (const item of parseJsonArray(value)) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const nameEn = typeof record.nameEn === "string" ? record.nameEn : "";
    const nameZh = typeof record.nameZh === "string" ? record.nameZh : "";

    if (!nameEn || !nameZh) {
      continue;
    }

    tags.push({
      nameEn,
      nameZh,
      description:
        typeof record.description === "string" ? record.description : undefined,
      priority: toInteger(
        typeof record.priority === "number" || typeof record.priority === "string"
          ? record.priority
          : undefined
      ),
    });
  }

  return tags.sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
}

function parseMistakeTypes(value: unknown): string[] {
  return parseStringArray(value);
}

function parsePracticality(value: string): Practicality {
  return value === "S" ||
    value === "A" ||
    value === "B" ||
    value === "C" ||
    value === "D"
    ? value
    : "B";
}

function parseSpokenOrWritten(value: string): SpokenOrWritten {
  return value === "spoken" || value === "written" || value === "both"
    ? value
    : "both";
}

function parseReviewStatus(value: string): ReviewStatus {
  return value === "new" ||
    value === "learning" ||
    value === "reviewing" ||
    value === "mastered"
    ? value
    : "new";
}

function mapTagRow(row: TagRow): GrammarTag {
  return {
    nameEn: row.name_en,
    nameZh: row.name_zh,
    description: row.description ?? undefined,
    priority: toInteger(row.priority),
  };
}

function mapSummaryRow(row: GrammarSummaryRow): GrammarPointSummary {
  return {
    id: row.id,
    grammarPoint: row.grammar_point,
    reading: row.reading,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryNameZh: row.category_name_zh,
    categoryNameEn: row.category_name_en,
    categoryGroupSlug: row.category_group_slug,
    categoryGroupNameZh: row.category_group_name_zh,
    categoryGroupNameEn: row.category_group_name_en,
    subCategory: row.sub_category,
    coreMeaning: row.core_meaning,
    naturalTranslation: row.natural_translation,
    structure: row.structure,
    practicality: parsePracticality(row.practicality),
    spokenOrWritten: parseSpokenOrWritten(row.spoken_or_written),
    sceneTags: parseTags(row.scene_tags),
    registerTags: parseTags(row.register_tags),
    isFavorite: row.is_favorite,
  };
}

export class GrammarRepository {
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
    groupSlug?: string;
    limit?: number;
    userId?: string;
  }): Promise<GrammarPointSummary[]> {
    const normalizedQuery = options?.query?.trim() ?? "";
    const normalizedLimit = Math.min(Math.max(options?.limit ?? 24, 1), 80);
    const categorySlug = options?.categorySlug?.trim() ?? "";
    const groupSlug = options?.groupSlug?.trim() ?? "";
    const rows = await query<GrammarSummaryRow>(SEARCH_GRAMMAR_POINTS_SQL, [
      normalizedQuery,
      `%${normalizedQuery}%`,
      normalizedLimit,
      options?.userId ?? DEFAULT_GRAMMAR_USER_ID,
      categorySlug,
      groupSlug,
    ]);

    return rows.map((row) => mapSummaryRow(row));
  }

  async findGrammarPointById(
    grammarPointId: string,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<GrammarPointDetail | null> {
    const rows = await query<GrammarDetailRow>(SELECT_GRAMMAR_POINT_DETAIL_SQL, [
      grammarPointId,
      userId,
    ]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    const [examples, similarGrammar] = await Promise.all([
      this.listExamples(grammarPointId),
      this.listSimilarGrammar(grammarPointId),
    ]);

    return {
      ...mapSummaryRow(row),
      notes: row.notes,
      jlptLevel: row.jlpt_level,
      commonMistakes: parseStringArray(row.common_mistakes),
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
      feedback.naturalnessScore,
      feedback.registerScore,
      feedback.sceneFitScore,
      feedback.isCorrect,
      feedback.feedbackText,
      feedback.correctedSentence ?? null,
      JSON.stringify(feedback.betterVersions),
      JSON.stringify(feedback.mistakeTypes),
      feedback.nextPracticePrompt ?? null,
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

    return rows.map((row) => ({
      reviewRecordId: row.review_record_id,
      grammarPoint: mapSummaryRow(row),
      status: parseReviewStatus(row.status),
      mistakeCount: toInteger(row.mistake_count),
      nextReviewAt: toIsoString(row.next_review_at),
      lastReviewedAt: toIsoString(row.last_reviewed_at),
      latestSentence: row.latest_sentence,
      latestFeedback: row.latest_feedback,
      correctedSentence: row.corrected_sentence,
      mistakeTypes: parseMistakeTypes(row.mistake_types),
    }));
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
      reviewCount: toInteger(row.review_count),
      favoriteCount: toInteger(row.favorite_count),
    }));
  }
}
