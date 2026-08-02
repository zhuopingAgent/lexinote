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
import { buildChoiceFeedback } from "@/features/grammar-learning/domain/practiceFeedback";
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
  PracticeGenerationMetrics,
  PracticeRevealResponse,
  PracticeSessionCreateRequest,
  PracticeSessionEntryMode,
  PracticeSessionResponse,
  PracticeSessionSummary,
} from "@/shared/types/practice";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";
import {
  isPracticeGenerationV2Enabled,
  resolveMasteryEvidence,
  passesAnswerContract,
  toPracticeRubricScores,
  type PracticeIntent,
} from "@/features/grammar-learning/domain/practiceV2";
import {
  buildPracticeSessionPlan,
  defaultPracticePlannerSource,
} from "@/features/grammar-learning/domain/practiceSessionPlanner";
import { GRAMMAR_PRACTICE_CONTENT_VERSION } from "@/features/grammar-learning/domain/practiceSpecializations";
import { toActivePracticeIntent } from "@/features/grammar-learning/domain/practiceFormats";

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

function comparisonSetIdForIntent(
  grammarPoint: GrammarPointDetail,
  intent: PracticeIntent
) {
  const requestedIds = new Set([
    grammarPoint.id,
    ...intent.comparisonGrammarPointIds,
  ]);
  return grammarPoint.comparisonSets.find(
    (set) =>
      set.members.length === requestedIds.size &&
      set.members.every((member) => requestedIds.has(member.grammarPointId))
  )?.id ?? grammarPoint.comparisonSets.find((set) =>
    set.members.some((member) =>
      intent.comparisonGrammarPointIds.includes(member.grammarPointId)
    )
  )?.id ?? null;
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
    learningStatus: grammarPoint.learningStatus,
  };
}

export class PracticeSessionService {
  constructor(
    private readonly practiceRepository: PracticeRepository,
    private readonly grammarRepository: GrammarRepository,
    private readonly grammarAiClient: GrammarAiClient,
    private readonly grammarLearningService: GrammarLearningService
  ) {}

  async getGenerationMetrics(since?: string): Promise<PracticeGenerationMetrics> {
    if (since && Number.isNaN(Date.parse(since))) {
      throw new ValidationError("since must be a valid date");
    }
    const raw = await this.practiceRepository.getGenerationMetrics(since ?? null);
    const numberValue = (value: unknown) => {
      const number = Number(value ?? 0);
      return Number.isFinite(number) ? number : 0;
    };
    const countRecord = (value: unknown) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return {};
      return Object.fromEntries(
        Object.entries(value).map(([key, count]) => [key, numberValue(count)])
      );
    };
    return {
      generatedItemCount: numberValue(raw.generatedItemCount),
      aiGeneratedItemCount: numberValue(raw.aiGeneratedItemCount),
      firstPassValidationRate: numberValue(raw.firstPassValidationRate),
      repairRate: numberValue(raw.repairRate),
      fallbackRate: numberValue(raw.fallbackRate),
      generationLatency: numberValue(raw.generationLatency),
      duplicateContextRate: numberValue(raw.duplicateContextRate),
      answerLeakCount: numberValue(raw.answerLeakCount),
      ambiguousChoiceCount: numberValue(raw.ambiguousChoiceCount),
      validationErrorCounts: countRecord(raw.validationErrorCounts),
      fallbackReasonCounts: countRecord(raw.fallbackReasonCounts),
    };
  }

  async createSession(
    input: Partial<PracticeSessionCreateRequest>
  ): Promise<PracticeSessionResponse> {
    const userId = normalizeUuid(input.userId, "userId", DEFAULT_GRAMMAR_USER_ID);
    const clientSessionKey = normalizeSessionKey(input.clientSessionKey);
    const entryMode = normalizeEntryMode(input.entryMode);
    const requestedGrammarPointId = input.grammarPointId
      ? normalizeUuid(input.grammarPointId, "grammarPointId")
      : null;
    const requestedComparisonSetId = input.comparisonSetId
      ? normalizeUuid(input.comparisonSetId, "comparisonSetId")
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
    const selectedComparisonSet = requestedComparisonSetId
      ? grammarPoint.comparisonSets.find(
          (comparisonSet) => comparisonSet.id === requestedComparisonSetId
        ) ?? null
      : null;
    if (requestedComparisonSetId && !selectedComparisonSet) {
      throw new ValidationError("这个对比组不包含当前语法点。");
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
    const plannedExerciseCount = normalizePlannedCount(input.plannedExerciseCount);
    let planSnapshot: PracticeIntent[] = [];
    const useV2 = isPracticeGenerationV2Enabled();
    if (useV2) {
      const [skillStates, objectiveStates, scenarioTemplate, plannerHistory] = await Promise.all([
        this.practiceRepository.listSkillStates(userId, grammarPoint.id),
        this.practiceRepository.listObjectiveStates(
          userId,
          grammarPoint.id,
          grammarPoint.senseKey
        ),
        this.practiceRepository.findScenarioTemplate(preferredScene),
        this.practiceRepository.getPlannerHistory(userId, grammarPoint.id),
      ]);
      if (!scenarioTemplate) {
        throw new Error("No active practice scenario template is available.");
      }
      const firstContext = buildPracticeContext({
        scenario: scenarioTemplate,
        preferredRegister,
        sequenceNumber: 1,
        variant: 0,
      });
      planSnapshot = buildPracticeSessionPlan({
        grammarPoint,
        context: firstContext,
        skillStates,
        objectiveStates,
        comparisonGrammarPointIds: selectedComparisonSet?.members.map(
          (member) => member.grammarPointId
        ),
        history: plannerHistory,
        count: plannedExerciseCount,
        source: defaultPracticePlannerSource,
      }).map((intent, index) => {
        const context = buildPracticeContext({
          scenario: scenarioTemplate,
          preferredRegister,
          sequenceNumber: index + 1,
          variant: index,
        });
        return {
          ...intent,
          communicativeGoal: context.communicativeGoal,
          context: {
            ...context,
            scenario: context.sceneLabel,
            participants: [context.speakerRole, context.listenerRole],
            relationship: `${context.socialDistance}/${context.hierarchy}`,
            register: context.registerLabel,
            previousTurn: context.knownContext,
          },
        };
      });
    }
    const sessionId = await this.practiceRepository.upsertSession({
      userId,
      clientSessionKey,
      entryMode,
      grammarPointId: grammarPoint.id,
      preferredScene,
      preferredRegister,
      plannedExerciseCount,
      metadata: {
        redesignVersion: useV2 ? 2 : 1,
        grammarPracticeContentVersion: useV2
          ? GRAMMAR_PRACTICE_CONTENT_VERSION
          : null,
        comparisonSetId: selectedComparisonSet?.id ?? null,
      },
      planSnapshot,
      plannerVersion: useV2 ? 2 : 1,
    });

    if (!sessionId) {
      throw new Error("Practice session could not be created.");
    }

    await this.grammarRepository.logLearningHistory({
      userId,
      grammarPointId: grammarPoint.id,
      activityType: "start_practice_session",
      metadata: {
        entryMode,
        preferredScene,
        preferredRegister,
        grammarPracticeContentVersion: useV2
          ? GRAMMAR_PRACTICE_CONTENT_VERSION
          : null,
      },
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
    if (session.plannerVersion === 2 && session.planSnapshot[session.generatedExerciseCount]) {
      return this.generateNextExerciseV2({
        session,
        grammarPoint,
        userId,
        intent: session.planSnapshot[session.generatedExerciseCount],
      });
    }
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
      const selectedOption = exercise.options.find((option) => option.id === selectedOptionId);
      const distractorReasons = exercise.expectedFeatures.distractorReasons;
      const selectedOptionReason =
        distractorReasons && typeof distractorReasons === "object" && !Array.isArray(distractorReasons)
          ? (distractorReasons as Record<string, unknown>)[selectedOptionId]
          : null;
      feedback = buildChoiceFeedback({
        isCorrect,
        grammarPoint,
        exerciseType: exercise.exerciseType === "contrast_choice"
          ? "contrast_choice"
          : "meaning_choice",
        selectedOptionLabel: selectedOption?.label ?? "当前选项",
        selectedOptionReason: typeof selectedOptionReason === "string"
          ? selectedOptionReason
          : null,
      });
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
        answerContract: exercise.answerContract ?? undefined,
        rubric: exercise.rubric ?? undefined,
      });
      legacyUserSentenceId = legacyFeedback.userSentenceId;
      legacyFeedbackId = legacyFeedback.feedbackId;
      feedback = legacyFeedback;
    }

    const rubricScores = exercise.answerContract
      ? toPracticeRubricScores({
          contract: exercise.answerContract,
          legacyScores: {
            grammar: feedback.grammarScore,
            meaning: feedback.meaningScore,
            naturalness: feedback.naturalnessScore,
            register: feedback.registerScore,
            contextFit: feedback.sceneFitScore,
          },
        })
      : null;
    if (
      exercise.answerContract &&
      rubricScores &&
      feedback.isCorrect &&
      !passesAnswerContract(exercise.answerContract, rubricScores)
    ) {
      feedback = {
        ...feedback,
        isCorrect: false,
        explanation: `${feedback.explanation} 但本题要求的关键维度还没有达到通过标准。`,
        feedbackText: `${feedback.feedbackText} 但本题要求的关键维度还没有达到通过标准。`,
      };
    }
    const masteryEvidence = exercise.practiceIntent
      ? resolveMasteryEvidence({
          isCorrect: feedback.isCorrect,
          responseMode: exercise.responseMode,
          transferLevel: exercise.practiceIntent.transferLevel,
          hintCount: exercise.hintsRevealed,
          attemptNumber,
        })
      : null;
    const evidenceScore = masteryEvidence
      ? masteryEvidence.weight
      : calculateEvidenceScore({
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
      independent: masteryEvidence
        ? masteryEvidence.kind === "independent"
        : attemptNumber === 1 && exercise.hintsRevealed === 0,
      contextNovelty: exercise.skillDimension === "transfer_naturalness" ? 1 : 0.8,
      rubricScores,
      evidenceKind: masteryEvidence?.kind ?? null,
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

  private async generateNextExerciseV2(input: {
    session: PracticeSessionRecord;
    grammarPoint: GrammarPointDetail;
    userId: string;
    intent: PracticeIntent;
  }): Promise<PracticeSessionResponse> {
    const sequenceNumber = input.session.generatedExerciseCount + 1;
    const plannedIntent = toActivePracticeIntent(
      input.intent,
      input.grammarPoint.comparisonSets.some((set) => set.members.length >= 2)
    );
    const recentSignatures = await this.practiceRepository.listRecentSignatures(
      input.userId,
      input.grammarPoint.id
    );
    const generationSeed = randomUUID();
    const generated = await this.grammarAiClient.generatePracticeItemV2({
      grammarPoint: input.grammarPoint,
      intent: plannedIntent,
      generationSeed,
    });
    const actualIntent = generated.intent;
    const blueprint = await this.practiceRepository.findBlueprint(generated.exerciseType);
    if (!blueprint) {
      throw new Error(`Practice blueprint ${generated.exerciseType} is unavailable.`);
    }
    let variant = 0;
    let contentSignature = buildPracticeContentSignature({
      grammarPointId: input.grammarPoint.id,
      blueprintSlug: generated.exerciseType,
      context: generated.context,
    });
    while (recentSignatures.includes(contentSignature) && variant < 12) {
      variant += 1;
      contentSignature = buildPracticeContentSignature({
        grammarPointId: input.grammarPoint.id,
        blueprintSlug: `${generated.exerciseType}:${variant}`,
        context: generated.context,
      });
    }
    const isChoice =
      generated.exerciseType === "meaning_choice" ||
      generated.exerciseType === "contrast_choice";
    const options = isChoice ? generated.choices : [];
    const comparisonSetId = generated.exerciseType === "contrast_choice"
      ? comparisonSetIdForIntent(input.grammarPoint, actualIntent)
      : null;
    const expectedFeatures = {
      requiredGrammarPointId: input.grammarPoint.id,
      canonicalForm: input.grammarPoint.canonicalForm,
      senseKey: input.grammarPoint.senseKey,
      correctOptionId: isChoice ? generated.correctChoiceId : undefined,
      distractorReasons: isChoice ? generated.distractorReasons : undefined,
      instructionZh: generated.instructionZh,
      hintPlan: generated.hints,
      itemSchema:
        generated.exerciseType === "form_repair"
          ? {
              incorrectSentence: generated.incorrectSentence,
              targetErrorType: generated.targetErrorType,
              errorSpan: generated.errorSpan,
              correctedSentence: generated.correctedSentence,
            }
          : generated.exerciseType === "register_rewrite"
            ? {
                sourceSentence: generated.sourceSentence,
                targetRegister: generated.targetRegister,
              }
            : generated.exerciseType === "guided_translation"
              ? { chineseSentence: generated.chineseSentence }
              : generated.exerciseType === "contextual_response"
                ? {
                    previousTurn: generated.previousTurn,
                    speakerRelationship: generated.speakerRelationship,
                    communicativeGoal: generated.communicativeGoal,
                    requiredInformation: generated.requiredInformation,
                  }
                : null,
    };
    const exerciseId = await this.practiceRepository.insertExercise({
      sessionId: input.session.id,
      blueprintSlug: generated.exerciseType,
      grammarPointId: input.grammarPoint.id,
      comparisonSetId,
      sequenceNumber,
      skillDimension: actualIntent.legacySkillDimension,
      exerciseType: generated.exerciseType,
      difficulty: Math.min(
        Math.max(actualIntent.difficulty, blueprint.minimumDifficulty),
        blueprint.maximumDifficulty
      ) as typeof actualIntent.difficulty,
      responseMode: actualIntent.answerPolicy.responseMode,
      context: generated.context,
      prompt: generated.prompt,
      options,
      expectedFeatures,
      referenceAnswers: generated.referenceAnswers,
      hintLadder: generated.hints.map((hint) => hint.content),
      source: generated.generationMetadata.generationSource,
      generationSeed,
      contentSignature,
      practiceIntent: actualIntent,
      answerContract: generated.answerContract,
      rubric: generated.rubric,
      generationMetadata: generated.generationMetadata,
    });
    const exercise = await this.practiceRepository.findExercise(exerciseId, input.userId);
    const session = await this.requireSession(input.session.id, input.userId);
    return this.buildSessionResponse(session, exercise, input.userId);
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
    const correctOptionId = exercise.expectedFeatures.correctOptionId;
    return {
      ...result,
      correctOptionId:
        exercise.responseMode === "choice" && typeof correctOptionId === "string"
          ? correctOptionId
          : null,
    };
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
          learningObjective: exercise.practiceIntent?.learningObjective,
          cognitiveOperation: exercise.practiceIntent?.cognitiveOperation,
          transferLevel: exercise.practiceIntent?.transferLevel,
          scaffoldLevel: exercise.practiceIntent?.scaffoldLevel,
          selectionReasonZh: exercise.practiceIntent?.selectionReasonZh,
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
    const objectiveSummaries = (await this.practiceRepository.getSessionObjectiveSummaries(
      session.id
    )) as NonNullable<PracticeSessionSummary["objectiveSummaries"]>;
    const nextObjective = [...objectiveSummaries].sort(
      (left, right) => left.estimate - right.estimate || left.confidence - right.confidence
    )[0];
    return {
      sessionId: session.id,
      grammarPoint: toGrammarPointSummary(grammarPoint),
      completedExerciseCount: session.completedExerciseCount,
      plannedExerciseCount: session.plannedExerciseCount,
      skillSummaries: await this.practiceRepository.getSessionSkillSummaries(
        session.id
      ),
      objectiveSummaries,
      nextRecommendation: nextObjective
        ? {
            learningObjective: nextObjective.learningObjective,
            reasonZh: nextObjective.evidenceCount < 2
              ? "本组有效证据还不够，下一次会继续观察同一目标。"
              : nextObjective.estimate < 0.6
                ? "这是本组相对薄弱的目标，建议优先再练一次。"
                : "当前表现已经稳定，下一次将用延迟回忆确认保持情况。",
          }
        : null,
    };
  }
}
