import type { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import type { GrammarRepository } from "@/features/grammar-learning/infrastructure/GrammarRepository";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  GrammarDetailResponse,
  GrammarFavoritesResponse,
  GrammarProgressResponse,
  GrammarReviewResponse,
  GrammarSearchResponse,
  GrammarTaxonomyResponse,
  PracticeGenerateRequest,
  PracticeGenerateResponse,
  PracticeLevel,
  PracticeSubmitResponse,
  SentencePracticeInput,
} from "@/shared/types/api";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeUserId(userId?: string) {
  const normalized = userId?.trim() || DEFAULT_GRAMMAR_USER_ID;

  if (!UUID_PATTERN.test(normalized)) {
    throw new ValidationError("userId must be a valid UUID");
  }

  return normalized;
}

function normalizeGrammarPointId(grammarPointId: unknown) {
  if (typeof grammarPointId !== "string" || !grammarPointId.trim()) {
    throw new ValidationError("grammarPointId is required");
  }

  const normalized = grammarPointId.trim();
  if (!UUID_PATTERN.test(normalized)) {
    throw new ValidationError("grammarPointId must be a valid UUID");
  }

  return normalized;
}

function normalizeOptionalTag(value: unknown, fieldName: string) {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ValidationError(`${fieldName} must be a string`);
  }

  return value.trim() || undefined;
}

function normalizeLevel(value: unknown): PracticeLevel {
  const level =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : 2;

  if (!Number.isInteger(level) || level < 1 || level > 5) {
    throw new ValidationError("level must be an integer between 1 and 5");
  }

  return level as PracticeLevel;
}

function normalizeLimit(value: unknown) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number.parseInt(value, 10)
        : 24;

  if (!Number.isInteger(parsed)) {
    return 24;
  }

  return Math.min(Math.max(parsed, 1), 80);
}

function hasMistake(feedback: PracticeSubmitResponse) {
  return (
    !feedback.isCorrect ||
    feedback.grammarScore < 4 ||
    feedback.naturalnessScore < 4 ||
    feedback.registerScore < 4 ||
    feedback.sceneFitScore < 4 ||
    feedback.mistakeTypes.length > 0
  );
}

export class GrammarLearningService {
  constructor(
    private readonly repository: GrammarRepository,
    private readonly aiClient: GrammarAiClient
  ) {}

  async getTaxonomy(): Promise<GrammarTaxonomyResponse> {
    const [categoryGroups, categories, sceneTags, registerTags] = await Promise.all([
      this.repository.listCategoryGroups(),
      this.repository.listCategories(),
      this.repository.listSceneTags(),
      this.repository.listRegisterTags(),
    ]);

    return {
      categoryGroups,
      categories,
      sceneTags,
      registerTags,
    };
  }

  async searchGrammarPoints(options?: {
    query?: string;
    categorySlug?: string;
    groupSlug?: string;
    limit?: unknown;
    userId?: string;
  }): Promise<GrammarSearchResponse> {
    const userId = normalizeUserId(options?.userId);
    const items = await this.repository.searchGrammarPoints({
      query: options?.query,
      categorySlug: options?.categorySlug,
      groupSlug: options?.groupSlug,
      limit: normalizeLimit(options?.limit),
      userId,
    });

    return { items };
  }

  async getGrammarPointDetail(
    grammarPointId: string,
    userId?: string
  ): Promise<GrammarDetailResponse> {
    const normalizedGrammarPointId = normalizeGrammarPointId(grammarPointId);
    const normalizedUserId = normalizeUserId(userId);
    const grammarPoint = await this.repository.findGrammarPointById(
      normalizedGrammarPointId,
      normalizedUserId
    );

    if (!grammarPoint) {
      throw new NotFoundError("未找到这个语法点。");
    }

    await this.repository.logLearningHistory({
      userId: normalizedUserId,
      grammarPointId: normalizedGrammarPointId,
      activityType: "view_grammar",
    });

    return { grammarPoint };
  }

  async generatePractice(
    input: Partial<PracticeGenerateRequest>
  ): Promise<PracticeGenerateResponse> {
    const grammarPointId = normalizeGrammarPointId(input.grammarPointId);
    const sceneTag = normalizeOptionalTag(input.sceneTag, "sceneTag");
    const registerTag = normalizeOptionalTag(input.registerTag, "registerTag");
    const level = normalizeLevel(input.level);
    const grammarPoint = await this.repository.findGrammarPointById(grammarPointId);

    if (!grammarPoint) {
      throw new NotFoundError("未找到这个语法点。");
    }

    const [resolvedSceneTag, resolvedRegisterTag] = await Promise.all([
      this.repository.findTag("scene", sceneTag),
      this.repository.findTag("register", registerTag),
    ]);
    const generatedPractice = await this.aiClient.generatePractice({
      grammarPoint,
      sceneTag,
      sceneTagLabel: resolvedSceneTag?.nameZh,
      registerTag,
      registerTagLabel: resolvedRegisterTag?.nameZh,
      level,
    });

    await this.repository.logLearningHistory({
      userId: DEFAULT_GRAMMAR_USER_ID,
      grammarPointId,
      activityType: "start_practice",
      metadata: {
        sceneTag,
        registerTag,
        level,
        source: generatedPractice.source,
      },
    });

    return {
      prompt: generatedPractice.prompt,
      referenceAnswers: generatedPractice.referenceAnswers,
      hints: generatedPractice.hints,
      grammarPoint,
      sceneTag: resolvedSceneTag,
      registerTag: resolvedRegisterTag,
      source: generatedPractice.source,
    };
  }

  async submitSentence(
    input: Partial<SentencePracticeInput>
  ): Promise<PracticeSubmitResponse> {
    const userId = normalizeUserId(input.userId);
    const grammarPointId = normalizeGrammarPointId(input.grammarPointId);
    const sceneTag = normalizeOptionalTag(input.sceneTag, "sceneTag");
    const registerTag = normalizeOptionalTag(input.registerTag, "registerTag");

    if (typeof input.sentence !== "string" || !input.sentence.trim()) {
      throw new ValidationError("sentence is required");
    }

    if (input.promptText !== undefined && typeof input.promptText !== "string") {
      throw new ValidationError("promptText must be a string");
    }

    const sentence = input.sentence.trim();
    const promptText = input.promptText?.trim() || undefined;
    const grammarPoint = await this.repository.findGrammarPointById(grammarPointId, userId);

    if (!grammarPoint) {
      throw new NotFoundError("未找到这个语法点。");
    }

    const [resolvedSceneTag, resolvedRegisterTag, userSentenceId] = await Promise.all([
      this.repository.findTag("scene", sceneTag),
      this.repository.findTag("register", registerTag),
      this.repository.insertUserSentence({
        userId,
        grammarPointId,
        sentence,
        sceneTag,
        registerTag,
        promptText,
      }),
    ]);
    const feedback = await this.aiClient.evaluateSentence({
      grammarPoint,
      sentence,
      sceneTag,
      sceneTagLabel: resolvedSceneTag?.nameZh,
      registerTag,
      registerTagLabel: resolvedRegisterTag?.nameZh,
      promptText,
    });
    const feedbackId = await this.repository.insertFeedback(userSentenceId, {
      ...feedback,
      modelName: feedback.modelName,
      rawAiResponse: feedback.rawAiResponse,
    });
    const response: PracticeSubmitResponse = {
      userSentenceId,
      feedbackId,
      source: feedback.source,
      isCorrect: feedback.isCorrect,
      grammarScore: feedback.grammarScore,
      naturalnessScore: feedback.naturalnessScore,
      registerScore: feedback.registerScore,
      sceneFitScore: feedback.sceneFitScore,
      feedbackText: feedback.feedbackText,
      correctedSentence: feedback.correctedSentence,
      betterVersions: feedback.betterVersions,
      mistakeTypes: feedback.mistakeTypes,
      nextPracticePrompt: feedback.nextPracticePrompt,
    };

    await this.repository.updateReviewRecord({
      userId,
      grammarPointId,
      hasMistake: hasMistake(response),
    });
    await this.repository.logLearningHistory({
      userId,
      grammarPointId,
      activityType: "submit_sentence",
      metadata: {
        sceneTag,
        registerTag,
        source: feedback.source,
        isCorrect: feedback.isCorrect,
        mistakeTypes: feedback.mistakeTypes,
      },
    });

    return response;
  }

  async addFavorite(input: { userId?: string; grammarPointId?: string }): Promise<void> {
    const userId = normalizeUserId(input.userId);
    const grammarPointId = normalizeGrammarPointId(input.grammarPointId);
    const detail = await this.repository.findGrammarPointById(grammarPointId, userId);

    if (!detail) {
      throw new NotFoundError("未找到这个语法点。");
    }

    await this.repository.addFavorite(userId, grammarPointId);
    await this.repository.logLearningHistory({
      userId,
      grammarPointId,
      activityType: "favorite_grammar",
    });
  }

  async removeFavorite(input: { userId?: string; grammarPointId?: string }): Promise<void> {
    const userId = normalizeUserId(input.userId);
    const grammarPointId = normalizeGrammarPointId(input.grammarPointId);
    await this.repository.removeFavorite(userId, grammarPointId);
  }

  async listFavorites(userId?: string): Promise<GrammarFavoritesResponse> {
    return {
      items: await this.repository.listFavorites(normalizeUserId(userId)),
    };
  }

  async listReviewItems(userId?: string): Promise<GrammarReviewResponse> {
    return {
      items: await this.repository.listReviewItems(normalizeUserId(userId)),
    };
  }

  async getProgress(userId?: string): Promise<GrammarProgressResponse> {
    const groupProgress = await this.repository.getProgress(normalizeUserId(userId));

    return {
      totalGrammarPoints: groupProgress.reduce(
        (total, group) => total + group.totalCount,
        0
      ),
      startedCount: groupProgress.reduce(
        (total, group) => total + group.startedCount,
        0
      ),
      masteredCount: groupProgress.reduce(
        (total, group) => total + group.masteredCount,
        0
      ),
      reviewCount: groupProgress.reduce(
        (total, group) => total + group.reviewCount,
        0
      ),
      favoriteCount: groupProgress.reduce(
        (total, group) => total + group.favoriteCount,
        0
      ),
      groupProgress,
    };
  }
}
