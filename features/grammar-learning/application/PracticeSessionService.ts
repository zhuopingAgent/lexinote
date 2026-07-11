import { randomUUID } from "node:crypto";
import {
  calculateEvidenceScore,
  normalizeRegisterPreset,
  planPracticeExercise,
} from "@/features/grammar-learning/domain/practice";
import {
  buildPracticeContentSignature,
  buildPracticeContext,
  buildDeterministicChoiceExercise,
} from "@/features/grammar-learning/domain/practiceExercise";
import {
  buildChoiceFeedback,
  sanitizeIncorrectFeedback,
} from "@/features/grammar-learning/domain/practiceFeedback";
import type { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import type { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import type { GrammarRepository } from "@/features/grammar-learning/infrastructure/GrammarRepository";
import type {
  PracticeExerciseRecord,
  PracticeRepository,
  PracticeSessionRecord,
} from "@/features/grammar-learning/infrastructure/PracticeRepository";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  AIFeedbackResult,
  GrammarPointDetail,
  GrammarPointSummary,
} from "@/shared/types/grammar";
import type {
  PracticeAttemptRequest,
  PracticeAttemptResponse,
  PracticeExercise,
  PracticeHintResponse,
  PracticeRevealResponse,
  PracticeSessionCreateRequest,
  PracticeSessionEntryMode,
  PracticeSessionResponse,
  PracticeSessionSummary,
} from "@/shared/types/practice";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_KEY_PATTERN = /^[a-z0-9][a-z0-9_.:-]{0,127}$/i;

function normalizeUuid(value: unknown, fieldName: string, fallback?: string) {
  const normalized =
    typeof value === "string" && value.trim() ? value.trim() : fallback;
  if (!normalized || !UUID_PATTERN.test(normalized)) {
    throw new ValidationError(`${fieldName} must be a valid UUID`);
  }
  return normalized;
}

function normalizeSessionKey(value: unknown) {
  if (typeof value !== "string" || !SAFE_KEY_PATTERN.test(value.trim())) {
    throw new ValidationError("clientSessionKey is required and must be a stable key");
  }
  return value.trim();
}

function normalizeEntryMode(value: unknown): PracticeSessionEntryMode {
  return value === "daily" || value === "review" || value === "focus"
    ? value
    : "focus";
}

function normalizePlannedCount(value: unknown) {
  const count = typeof value === "number" ? value : Number(value ?? 5);
  if (!Number.isInteger(count)) {
    throw new ValidationError("plannedExerciseCount must be an integer");
  }
  return Math.min(Math.max(count, 1), 10);
}

function normalizeOptionalSlug(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }
  const normalized = value.trim();
  return SAFE_KEY_PATTERN.test(normalized) ? normalized : undefined;
}

function toGrammarPointSummary(grammarPoint: GrammarPointDetail): GrammarPointSummary {
  return {
    id: grammarPoint.id,
    grammarPoint: grammarPoint.grammarPoint,
    pointType: grammarPoint.pointType,
    canonicalForm: grammarPoint.canonicalForm,
    senseKey: grammarPoint.senseKey,
    formGroupSlug: grammarPoint.formGroupSlug,
    status: grammarPoint.status,
    primaryCategory: grammarPoint.primaryCategory,
    taxonomyTags: grammarPoint.taxonomyTags,
    curriculum: grammarPoint.curriculum,
    migrationTarget: grammarPoint.migrationTarget,
    reading: grammarPoint.reading,
    categoryId: grammarPoint.categoryId,
    categorySlug: grammarPoint.categorySlug,
    categoryNameZh: grammarPoint.categoryNameZh,
    categoryNameEn: grammarPoint.categoryNameEn,
    categoryGroupSlug: grammarPoint.categoryGroupSlug,
    categoryGroupNameZh: grammarPoint.categoryGroupNameZh,
    categoryGroupNameEn: grammarPoint.categoryGroupNameEn,
    subCategory: grammarPoint.subCategory,
    coreMeaning: grammarPoint.coreMeaning,
    naturalTranslation: grammarPoint.naturalTranslation,
    structure: grammarPoint.structure,
    practicality: grammarPoint.practicality,
    spokenOrWritten: grammarPoint.spokenOrWritten,
    sceneTags: grammarPoint.sceneTags,
    registerTags: grammarPoint.registerTags,
    isFavorite: grammarPoint.isFavorite,
  };
}

export class PracticeSessionService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly grammarRepository: GrammarRepository,
    private readonly grammarAiClient: GrammarAiClient,
    private readonly grammarLearningService: GrammarLearningService
  ) {}

  async createSession(
    input: Partial<PracticeSessionCreateRequest>
  ): Promise<PracticeSessionResponse> {
    const userId = normalizeUuid(input.userId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const clientSessionKey = normalizeSessionKey(input.clientSessionKey);
    const entryMode = normalizeEntryMode(input.entryMode);
    const requestedGrammarPointId = input.grammarPointId
      ? normalizeUuid(input.grammarPointId, "grammarPointId")
      : null;
    const grammarPointId =
      requestedGrammarPointId ??
      (await this.practiceRepository.findRecommendedGrammarPointId(userId));

    if (!grammarPointId) {
      throw new NotFoundError("暂时没有可练习的语法点。");
    }

    const grammarPoint = await this.grammarRepository.findGrammarPointById(
      grammarPointId,
      userId
    );
    if (!grammarPoint) {
      throw new NotFoundError("未找到这个语法点。");
    }

    const preferredScene =
      normalizeOptionalSlug(input.preferredScene) ??
      (grammarPoint.grammarPoint === "〜てもらえますか"
        ? "hospital"
        : grammarPoint.sceneTags[0]?.nameEn ?? "daily_life");
    const preferredRegister = normalizeRegisterPreset(
      normalizeOptionalSlug(input.preferredRegister) ??
        grammarPoint.registerTags[0]?.nameEn
    );
    const sessionId = await this.practiceRepository.upsertSession({
      userId,
      clientSessionKey,
      entryMode,
      grammarPointId: grammarPoint.id,
      preferredScene,
      preferredRegister,
      plannedExerciseCount: normalizePlannedCount(input.plannedExerciseCount),
      metadata: { redesignVersion: 1 },
    });

    if (!sessionId) {
      throw new Error("Practice session could not be created.");
    }

    await this.grammarRepository.logLearningHistory({
      userId,
      grammarPointId: grammarPoint.id,
      activityType: "start_practice_session",
      metadata: { entryMode, preferredScene, preferredRegister },
    });

    return this.nextExercise(sessionId, userId);
  }

  async getSession(sessionId: string, requestedUserId?: string) {
    const userId = normalizeUuid(requestedUserId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const normalizedSessionId = normalizeUuid(sessionId, "sessionId");
    const session = await this.requireSession(normalizedSessionId, userId);
    const activeExerciseId = await this.practiceRepository.findActiveExerciseId(
      session.id,
      userId
    );
    const exercise = activeExerciseId
      ? await this.practiceRepository.findExercise(activeExerciseId, userId)
      : null;

    return this.buildSessionResponse(session, exercise, userId);
  }

  async nextExercise(sessionId: string, requestedUserId?: string) {
    const userId = normalizeUuid(requestedUserId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const normalizedSessionId = normalizeUuid(sessionId, "sessionId");
    let session = await this.requireSession(normalizedSessionId, userId);
    const activeExerciseId = await this.practiceRepository.findActiveExerciseId(
      session.id,
      userId
    );

    if (activeExerciseId) {
      const activeExercise = await this.practiceRepository.findExercise(
        activeExerciseId,
        userId
      );
      return this.buildSessionResponse(session, activeExercise, userId);
    }

    if (
      session.status !== "active" ||
      session.generatedExerciseCount >= session.plannedExerciseCount
    ) {
      if (session.status === "active") {
        await this.practiceRepository.completeSession(session.id, userId);
        session = await this.requireSession(session.id, userId);
      }
      return this.buildSessionResponse(session, null, userId);
    }

    const grammarPoint = await this.requireGrammarPoint(
      session.focusGrammarPointId,
      userId
    );
    const [skillStates, scenarioTemplate, recentSignatures] = await Promise.all([
      this.practiceRepository.listSkillStates(userId, grammarPoint.id),
      this.practiceRepository.findScenarioTemplate(
        session.preferredScene ?? "daily_life"
      ),
      this.practiceRepository.listRecentSignatures(userId, grammarPoint.id),
    ]);
    if (!scenarioTemplate) {
      throw new Error("No active practice scenario template is available.");
    }

    const sequenceNumber = session.generatedExerciseCount + 1;
    const plan = planPracticeExercise({ grammarPoint, sequenceNumber, skillStates });
    const blueprint = await this.practiceRepository.findBlueprint(plan.blueprintSlug);
    if (!blueprint) {
      throw new Error(`Practice blueprint ${plan.blueprintSlug} is unavailable.`);
    }

    let variant = 0;
    let context = buildPracticeContext({
      scenario: scenarioTemplate,
      preferredRegister: session.preferredRegister,
      sequenceNumber,
      variant,
    });
    let contentSignature = buildPracticeContentSignature({
      grammarPointId: grammarPoint.id,
      blueprintSlug: plan.blueprintSlug,
      context,
    });
    while (recentSignatures.includes(contentSignature) && variant < 12) {
      variant += 1;
      context = buildPracticeContext({
        scenario: scenarioTemplate,
        preferredRegister: session.preferredRegister,
        sequenceNumber,
        variant,
      });
      contentSignature = buildPracticeContentSignature({
        grammarPointId: grammarPoint.id,
        blueprintSlug: plan.blueprintSlug,
        context,
      });
    }

    const generationSeed = randomUUID();
    const generated =
      plan.responseMode === "choice"
        ? buildDeterministicChoiceExercise({
            grammarPoint,
            context,
            sequenceNumber,
            exerciseType: plan.exerciseType,
          })
        : await this.grammarAiClient.generatePlannedExercise({
            grammarPoint,
            skillDimension: plan.skillDimension,
            exerciseType: plan.exerciseType,
            difficulty: plan.difficulty,
            context,
            generationSeed,
          });
    const comparisonSetId =
      "comparisonSetId" in generated ? generated.comparisonSetId : null;
    const expectedFeatures =
      "expectedFeatures" in generated
        ? generated.expectedFeatures
        : {
            requiredGrammarPointId: grammarPoint.id,
            canonicalForm: grammarPoint.canonicalForm,
            senseKey: grammarPoint.senseKey,
          };
    const exerciseId = await this.practiceRepository.insertExercise({
      sessionId: session.id,
      blueprintSlug: plan.blueprintSlug,
      grammarPointId: grammarPoint.id,
      comparisonSetId,
      sequenceNumber,
      skillDimension: plan.skillDimension,
      exerciseType: plan.exerciseType,
      difficulty: Math.min(
        Math.max(plan.difficulty, blueprint.minimumDifficulty),
        blueprint.maximumDifficulty
      ) as typeof plan.difficulty,
      responseMode: plan.responseMode,
      context,
      prompt: generated.prompt,
      options: "options" in generated ? generated.options : [],
      expectedFeatures,
      referenceAnswers: generated.referenceAnswers,
      hintLadder: "hints" in generated ? generated.hints : generated.hintLadder,
      source: generated.source,
      generationSeed,
      contentSignature,
    });
    const exercise = await this.practiceRepository.findExercise(exerciseId, userId);
    session = await this.requireSession(session.id, userId);

    return this.buildSessionResponse(session, exercise, userId);
  }

  async submitAttempt(
    exerciseId: string,
    input: Partial<PracticeAttemptRequest>
  ): Promise<PracticeAttemptResponse> {
    const userId = normalizeUuid(input.userId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const exercise = await this.requireActiveExercise(exerciseId, userId);
    const grammarPoint = await this.requireGrammarPoint(exercise.grammarPointId, userId);
    const attemptNumber = exercise.attemptCount + 1;
    let feedback: AIFeedbackResult;
    let legacyUserSentenceId: string | null = null;
    let legacyFeedbackId: string | null = null;
    let answer = "";
    let selectedOptionId: string | null = null;

    if (exercise.responseMode === "choice") {
      selectedOptionId = this.normalizeSelectedOption(input.selectedOptionId, exercise);
      const correctOptionId = exercise.expectedFeatures.correctOptionId;
      const isCorrect =
        typeof correctOptionId === "string" && selectedOptionId === correctOptionId;
      feedback = buildChoiceFeedback({ isCorrect, grammarPoint });
      await Promise.all([
        this.grammarRepository.updateReviewRecord({
          userId,
          grammarPointId: grammarPoint.id,
          hasMistake: !isCorrect,
        }),
        this.grammarRepository.logLearningHistory({
          userId,
          grammarPointId: grammarPoint.id,
          activityType: "submit_practice_choice",
          metadata: {
            exerciseId: exercise.id,
            skillDimension: exercise.skillDimension,
            isCorrect,
          },
        }),
      ]);
    } else {
      if (typeof input.answer !== "string" || !input.answer.trim()) {
        throw new ValidationError("answer is required");
      }
      answer = input.answer.trim();
      const legacyFeedback = await this.grammarLearningService.submitSentence({
        userId,
        grammarPointId: grammarPoint.id,
        sentence: answer,
        sceneTag: exercise.context.sceneSlug,
        registerTag: exercise.context.registerPreset,
        promptText: exercise.prompt,
      });
      legacyUserSentenceId = legacyFeedback.userSentenceId;
      legacyFeedbackId = legacyFeedback.feedbackId;
      feedback = sanitizeIncorrectFeedback(legacyFeedback);
    }

    const evidenceScore = calculateEvidenceScore({
      isCorrect: feedback.isCorrect,
      attemptNumber,
      hintCount: exercise.hintsRevealed,
      skillDimension: exercise.skillDimension,
    });
    const evidence = await this.practiceRepository.recordAttempt({
      exerciseId: exercise.id,
      userId,
      attemptNumber,
      answer,
      selectedOptionId,
      hintCount: exercise.hintsRevealed,
      isCorrect: feedback.isCorrect,
      grammarScore: feedback.grammarScore,
      meaningScore: feedback.meaningScore,
      naturalnessScore: feedback.naturalnessScore,
      registerScore: feedback.registerScore,
      sceneFitScore: feedback.sceneFitScore,
      issues: feedback.issues,
      explanation: feedback.explanation,
      nextHint: feedback.nextHint,
      legacyUserSentenceId,
      legacyFeedbackId,
      evidenceScore,
      independent: attemptNumber === 1 && exercise.hintsRevealed === 0,
      contextNovelty: exercise.skillDimension === "transfer_naturalness" ? 1 : 0.8,
    });

    return {
      attemptId: evidence.attemptId,
      feedback,
      canRetry: !feedback.isCorrect && attemptNumber < 2,
      canReveal: !feedback.isCorrect,
      exerciseCompleted: feedback.isCorrect,
      referenceAnswers: feedback.isCorrect ? exercise.referenceAnswers : [],
      evidence,
    };
  }

  async revealHint(
    exerciseId: string,
    requestedUserId?: string
  ): Promise<PracticeHintResponse> {
    const userId = normalizeUuid(requestedUserId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const normalizedExerciseId = normalizeUuid(exerciseId, "exerciseId");
    const result = await this.practiceRepository.revealNextHint(
      normalizedExerciseId,
      userId
    );
    if (!result) {
      throw new NotFoundError("没有可显示的下一条提示。");
    }
    return result;
  }

  async revealAnswer(
    exerciseId: string,
    requestedUserId?: string
  ): Promise<PracticeRevealResponse> {
    const userId = normalizeUuid(requestedUserId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const exercise = await this.requireActiveExercise(exerciseId, userId);
    const result = await this.practiceRepository.revealAnswer(exercise.id, userId);
    if (!result) {
      throw new NotFoundError("这道练习不能再揭示答案。");
    }
    await Promise.all([
      exercise.attemptCount === 0
        ? this.grammarRepository.updateReviewRecord({
            userId,
            grammarPointId: exercise.grammarPointId,
            hasMistake: true,
          })
        : Promise.resolve(),
      this.grammarRepository.logLearningHistory({
        userId,
        grammarPointId: exercise.grammarPointId,
        activityType: "reveal_practice_answer",
        metadata: {
          exerciseId: exercise.id,
          skillDimension: exercise.skillDimension,
        },
      }),
    ]);
    return result;
  }

  private async requireSession(sessionId: string, userId: string) {
    const session = await this.practiceRepository.findSession(sessionId, userId);
    if (!session) {
      throw new NotFoundError("未找到这个练习会话。");
    }
    return session;
  }

  private async requireGrammarPoint(grammarPointId: string, userId: string) {
    const grammarPoint = await this.grammarRepository.findGrammarPointById(
      grammarPointId,
      userId
    );
    if (!grammarPoint) {
      throw new NotFoundError("未找到这个语法点。");
    }
    return grammarPoint;
  }

  private async requireActiveExercise(exerciseId: string, userId: string) {
    const normalizedExerciseId = normalizeUuid(exerciseId, "exerciseId");
    const exercise = await this.practiceRepository.findExercise(
      normalizedExerciseId,
      userId
    );
    if (!exercise || exercise.status !== "active") {
      throw new NotFoundError("未找到可作答的练习。");
    }
    return exercise;
  }

  private normalizeSelectedOption(
    value: unknown,
    exercise: PracticeExerciseRecord
  ) {
    if (typeof value !== "string") {
      throw new ValidationError("selectedOptionId is required");
    }
    const selectedOptionId = value.trim();
    if (!exercise.options.some((option) => option.id === selectedOptionId)) {
      throw new ValidationError("selectedOptionId is not a valid option");
    }
    return selectedOptionId;
  }

  private async buildSessionResponse(
    session: PracticeSessionRecord,
    exercise: PracticeExerciseRecord | null,
    userId: string
  ): Promise<PracticeSessionResponse> {
    const grammarPoint = await this.requireGrammarPoint(
      session.focusGrammarPointId,
      userId
    );
    const summary =
      session.status === "completed"
        ? await this.buildSummary(session, grammarPoint)
        : null;
    const publicExercise: PracticeExercise | null = exercise
      ? {
          id: exercise.id,
          sessionId: exercise.sessionId,
          sequenceNumber: exercise.sequenceNumber,
          skillDimension: exercise.skillDimension,
          exerciseType: exercise.exerciseType,
          difficulty: exercise.difficulty,
          responseMode: exercise.responseMode,
          status: exercise.status,
          prompt: exercise.prompt,
          context: exercise.context,
          options: exercise.options,
          hintsRevealed: exercise.hintsRevealed,
          hasMoreHints: exercise.hintsRevealed < exercise.hintLadder.length,
          attemptCount: exercise.attemptCount,
          source: exercise.generationSource,
          grammarPoint: {
            id: grammarPoint.id,
            grammarPoint: grammarPoint.grammarPoint,
            pointType: grammarPoint.pointType,
            practicality: grammarPoint.practicality,
            primaryCategory: grammarPoint.primaryCategory,
          },
        }
      : null;

    return {
      session: {
        id: session.id,
        entryMode: session.entryMode,
        status: session.status,
        focusGrammarPointId: session.focusGrammarPointId,
        plannedExerciseCount: session.plannedExerciseCount,
        completedExerciseCount: session.completedExerciseCount,
        startedAt: session.startedAt,
        completedAt: session.completedAt,
      },
      progress: {
        current: publicExercise?.sequenceNumber ?? session.completedExerciseCount,
        completed: session.completedExerciseCount,
        total: session.plannedExerciseCount,
      },
      exercise: publicExercise,
      summary,
    };
  }

  private async buildSummary(
    session: PracticeSessionRecord,
    grammarPoint: GrammarPointDetail
  ): Promise<PracticeSessionSummary> {
    return {
      sessionId: session.id,
      grammarPoint: toGrammarPointSummary(grammarPoint),
      completedExerciseCount: session.completedExerciseCount,
      plannedExerciseCount: session.plannedExerciseCount,
      skillSummaries: await this.practiceRepository.getSessionSkillSummaries(
        session.id
      ),
    };
  }
}
