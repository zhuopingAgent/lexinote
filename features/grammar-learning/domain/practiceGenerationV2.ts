import { randomUUID } from "node:crypto";
import type { GrammarPointDetail, PracticeReferenceAnswer } from "@/shared/types/grammar";
import type { PracticeExerciseOption } from "@/shared/types/practice";
import {
  GENERATION_ERROR_CODES,
  PRACTICE_V2_SCHEMA_VERSION,
  assertAnswerContract,
  assertPracticeIntent,
  type AnswerContract,
  type GenerationErrorCode,
  type GenerationValidationResult,
  type PracticeGenerationMetadata,
  type PracticeHint,
  type PracticeIntent,
  type PracticeItemV2,
  type PracticeReviewerResult,
  type PracticeRubric,
  type ScaffoldLevel,
} from "@/features/grammar-learning/domain/practiceV2";

type CandidateInput = {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  answerContract: AnswerContract;
  metadata: PracticeGenerationMetadata;
};

const INTERNAL_LABEL_PATTERN = /\b(?:daily_life|customer_service|friend_chat|government_office|meaning_choice|form_repair|contrast_choice|register_rewrite|guided_translation|contextual_response|polite|business|casual|grammarPointId|senseKey|requiredEvidence)\b/i;
const MARKDOWN_PATTERN = /(?:\*\*|__|`{1,3}|^#{1,6}\s|^[-*+]\s|^>\s)/m;
const ABSTRACT_CHINESE_PATTERN = /(?:表达计划|确认信息|说明情况)[，,；;]?\s*(?:并|同时)?(?:提到|包含)|(?:中文意图|沟通目的|你的目的是)[^。？！]{0,40}(?:并提到|必须提到|包含)/;
const SCAFFOLD_LEVELS: ScaffoldLevel[] = ["options", "semantic_hint", "form_hint", "partial_sentence", "none"];

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function textValue(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.map(textValue).filter(Boolean)
    : [];
}

function parseReferences(value: unknown): PracticeReferenceAnswer[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const record = objectValue(item);
        if (!record) return [];
        const jp = textValue(record.jp);
        const zh = textValue(record.zh);
        const noteZh = textValue(record.note_zh ?? record.noteZh);
        return jp && zh ? [{ jp, zh, noteZh: noteZh || "符合本题教学契约。" }] : [];
      })
    : [];
}

function parseHints(value: unknown): PracticeHint[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (typeof item === "string") {
      return [{ level: "semantic_hint" as const, content: item.trim(), revealsForm: false, revealsAnswer: false }];
    }
    const record = objectValue(item);
    if (!record) return [];
    const level = textValue(record.level) as ScaffoldLevel;
    const content = textValue(record.content);
    return SCAFFOLD_LEVELS.includes(level) && content
      ? [{ level, content, revealsForm: record.reveals_form === true || record.revealsForm === true, revealsAnswer: record.reveals_answer === true || record.revealsAnswer === true }]
      : [];
  });
}

function parseChoices(value: unknown): PracticeExerciseOption[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const record = objectValue(item);
    if (!record) return [];
    const id = textValue(record.id);
    const label = textValue(record.label);
    return id && label ? [{ id, label }] : [];
  });
}

function parseReasons(value: unknown) {
  const record = objectValue(value);
  if (!record) return {};
  return Object.fromEntries(
    Object.entries(record).flatMap(([key, raw]) => {
      const reason = textValue(raw);
      return key && reason ? [[key, reason]] : [];
    })
  );
}

function baseItem(raw: Record<string, unknown>, input: CandidateInput) {
  const instructionZh = textValue(raw.instruction_zh ?? raw.instructionZh);
  const prompt = textValue(raw.prompt ?? raw.task_zh);
  const referenceAnswers = parseReferences(raw.reference_answers ?? raw.referenceAnswers);
  const hints = parseHints(raw.hints);
  if (!instructionZh || !prompt || referenceAnswers.length === 0) return null;
  const rubric: PracticeRubric = {
    primaryDimension: input.answerContract.assessedDimensions[0] ?? "grammar",
    assessedDimensions: input.answerContract.assessedDimensions,
    scoringNotes: input.intent.requiredEvidence,
  };
  return {
    id: randomUUID(),
    intent: input.intent,
    instructionZh,
    prompt,
    context: input.intent.context,
    referenceAnswers,
    answerContract: input.answerContract,
    rubric,
    hints,
    generationMetadata: input.metadata,
  };
}

export function parsePracticeItemV2(raw: unknown, input: CandidateInput): PracticeItemV2 | null {
  const record = objectValue(raw);
  if (!record || record.cannot_generate === true) return null;
  const exerciseType = textValue(record.exercise_type ?? record.exerciseType);
  if (exerciseType !== input.intent.exerciseType) return null;
  const base = baseItem(record, input);
  if (!base) return null;

  if (exerciseType === "meaning_choice" || exerciseType === "contrast_choice") {
    const choices = parseChoices(record.choices ?? record.options);
    const correctChoiceId = textValue(record.correct_choice_id ?? record.correctChoiceId);
    const distractorReasons = parseReasons(record.distractor_reasons ?? record.distractorReasons);
    if (choices.length < 3 || choices.length > 4 || !choices.some((choice) => choice.id === correctChoiceId)) return null;
    return { ...base, exerciseType, choices, correctChoiceId, distractorReasons };
  }
  if (exerciseType === "form_repair") {
    const incorrectSentence = textValue(record.incorrect_sentence ?? record.incorrectSentence);
    const targetErrorType = textValue(record.target_error_type ?? record.targetErrorType);
    const errorSpan = textValue(record.error_span ?? record.errorSpan);
    const correctedSentence = textValue(record.corrected_sentence ?? record.correctedSentence);
    if (!incorrectSentence || !targetErrorType || !errorSpan || !correctedSentence || !incorrectSentence.includes(errorSpan)) return null;
    return { ...base, exerciseType, incorrectSentence, targetErrorType, errorSpan, correctedSentence };
  }
  if (exerciseType === "register_rewrite") {
    const sourceSentence = textValue(record.source_sentence ?? record.sourceSentence);
    const targetRegister = textValue(record.target_register ?? record.targetRegister);
    if (!sourceSentence || !["casual", "polite", "business"].includes(targetRegister)) return null;
    return { ...base, exerciseType, sourceSentence, targetRegister: targetRegister as "casual" | "polite" | "business" };
  }
  if (exerciseType === "guided_translation") {
    const chineseSentence = textValue(record.chinese_sentence ?? record.chineseSentence);
    if (!chineseSentence) return null;
    return { ...base, exerciseType, chineseSentence };
  }
  const previousTurn = textValue(record.previous_turn ?? record.previousTurn);
  const speakerRelationship = textValue(record.speaker_relationship ?? record.speakerRelationship);
  const communicativeGoal = textValue(record.communicative_goal ?? record.communicativeGoal);
  const requiredInformation = stringArray(record.required_information ?? record.requiredInformation);
  if (!previousTurn || !speakerRelationship || !communicativeGoal || requiredInformation.length === 0) return null;
  return { ...base, exerciseType: "contextual_response", previousTurn, speakerRelationship, communicativeGoal, requiredInformation };
}

export function buildAnswerContract(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
}): AnswerContract {
  const isChoice = input.intent.answerPolicy.responseMode === "choice";
  const assessedDimensions: AnswerContract["assessedDimensions"] =
    input.intent.learningObjective === "register_control"
      ? ["grammar", "meaning", "register", "contextFit"]
      : input.intent.learningObjective === "meaning"
        ? ["meaning"]
        : input.intent.learningObjective === "form_connection"
          ? ["grammar", "meaning"]
          : ["grammar", "meaning", "naturalness", "contextFit"];
  const contract: AnswerContract = {
    requiredMeaningSlots: [input.intent.context.requiredDetail, input.intent.communicativeGoal].filter(Boolean),
    requiredGrammarFeatures: [
      `grammar_point:${input.grammarPoint.id}`,
      `sense:${input.grammarPoint.senseKey}`,
      ...input.grammarPoint.connections.slice(0, 3).map((connection) => `connection:${connection.requiredForm}:${connection.pattern}`),
    ],
    allowedVariants: input.grammarPoint.examples.slice(0, 4).map((example) => example.jp),
    allowedRegisterRange: [input.intent.context.registerPreset],
    prohibitedPatterns: input.intent.targetMisconceptionCode ? [input.intent.targetMisconceptionCode] : [],
    acceptableAlternativePolicy: isChoice ? "exact" : "natural_variants",
    assessedDimensions,
    passCriteria: {
      minimumDimensionScore: 2,
      requiredDimensions: assessedDimensions.filter((dimension) => dimension !== "naturalness"),
      fatalErrorCodes: ["connection_error", "semantic_error"],
    },
  };
  return assertAnswerContract(contract);
}

function normalizeComparable(value: string) {
  return value.normalize("NFKC").replace(/[\s*_`「」『』【】（）()\[\]。、，：；！？!?]/g, "").trim();
}

function formFragments(value: string) {
  const form = value
    .replace(/[〜~]/g, "")
    .replace(/[A-ZＡ-Ｚ][^ぁ-んァ-ン一-龯]*/g, "");
  const predicateForm = form.replace(/^[はがをにへでとからまでより]+/, "");
  return Array.from(new Set([predicateForm, form, value.replace(/[〜~]/g, "")]))
    .map(normalizeComparable)
    .filter((fragment) => fragment.length >= 2);
}

function validateSchema(item: PracticeItemV2): GenerationValidationResult {
  const errors: GenerationErrorCode[] = [];
  if (!item.referenceAnswers.length || !item.prompt || !item.instructionZh) errors.push("SCHEMA_INVALID");
  if (item.hints.some((hint, index) => index > 0 && SCAFFOLD_LEVELS.indexOf(hint.level) < SCAFFOLD_LEVELS.indexOf(item.hints[index - 1].level))) errors.push("SCHEMA_INVALID");
  if ((item.exerciseType === "meaning_choice" || item.exerciseType === "contrast_choice") && !item.choices.some((choice) => choice.id === item.correctChoiceId)) errors.push("SCHEMA_INVALID");
  return { valid: errors.length === 0, errorCodes: errors, details: errors.map(() => "题目结构不完整。"), stage: "schema" };
}

function validateStatic(item: PracticeItemV2): GenerationValidationResult {
  const errors = new Set<GenerationErrorCode>();
  const visible = [
    item.instructionZh,
    item.prompt,
    ...(item.exerciseType === "meaning_choice" || item.exerciseType === "contrast_choice"
      ? item.choices.map((choice) => choice.label)
      : []),
    ...item.hints.filter((hint) => !hint.revealsAnswer).map((hint) => hint.content),
  ];
  const allDisplayText = [
    ...visible,
    ...item.referenceAnswers.flatMap((answer) => [answer.jp, answer.zh, answer.noteZh]),
  ];
  if (allDisplayText.some((text) => MARKDOWN_PATTERN.test(text))) errors.add("MARKDOWN_NOT_ALLOWED");
  if (allDisplayText.some((text) => INTERNAL_LABEL_PATTERN.test(text))) errors.add("INTERNAL_LABEL_EXPOSED");
  const visibleNormalized = visible.map(normalizeComparable);
  if (item.referenceAnswers.some((answer) => visibleNormalized.some((text) => text.includes(normalizeComparable(answer.jp))))) errors.add("ANSWER_LEAK");
  if (item.hints.some((hint) => hint.revealsAnswer)) errors.add("ANSWER_LEAK");
  if (ABSTRACT_CHINESE_PATTERN.test(item.prompt)) errors.add("FAKE_CONTEXT_VARIATION");
  if (item.exerciseType === "guided_translation") {
    if (item.chineseSentence.length < 6 || !/[。？！!?]$/.test(item.chineseSentence) || ABSTRACT_CHINESE_PATTERN.test(item.chineseSentence)) errors.add("INCOMPLETE_CHINESE_PROMPT");
    if (/[ぁ-んァ-ン]/.test(item.chineseSentence)) errors.add("INCOMPLETE_CHINESE_PROMPT");
    if (!item.prompt.includes(item.chineseSentence)) errors.add("CONTEXT_MISMATCH");
  }
  if (item.exerciseType === "form_repair" && !item.prompt.includes(item.incorrectSentence)) errors.add("CONTEXT_MISMATCH");
  if (item.exerciseType === "register_rewrite" && !item.prompt.includes(item.sourceSentence)) errors.add("CONTEXT_MISMATCH");
  if (item.exerciseType === "contextual_response" && !item.prompt.includes(item.previousTurn)) errors.add("CONTEXT_MISMATCH");
  if (item.exerciseType === "meaning_choice" || item.exerciseType === "contrast_choice") {
    const labels = item.choices.map((choice) => normalizeComparable(choice.label));
    if (new Set(labels).size !== labels.length) errors.add("DUPLICATE_CHOICES");
    if (item.choices.filter((choice) => choice.id === item.correctChoiceId).length !== 1) errors.add("AMBIGUOUS_CHOICES");
    if (item.choices.some((choice) => choice.id !== item.correctChoiceId && !item.distractorReasons[choice.id])) errors.add("AMBIGUOUS_CHOICES");
  }
  return { valid: errors.size === 0, errorCodes: Array.from(errors), details: Array.from(errors).map((code) => `静态校验失败：${code}`), stage: "static" };
}

function validateContract(item: PracticeItemV2, grammarPoint: GrammarPointDetail): GenerationValidationResult {
  const errors = new Set<GenerationErrorCode>();
  if (item.intent.targetSenseKey !== grammarPoint.senseKey || item.intent.targetGrammarPointId !== grammarPoint.id) errors.add("TARGET_SENSE_MISMATCH");
  const fragments = [
    ...formFragments(grammarPoint.canonicalForm ?? grammarPoint.grammarPoint),
    ...(item.exerciseType === "contrast_choice"
      ? grammarPoint.comparisonSets
          .flatMap((set) => set.members)
          .filter((member) => item.intent.comparisonGrammarPointIds.includes(member.grammarPointId))
          .flatMap((member) => formFragments(member.canonicalForm || member.grammarPoint))
      : []),
  ];
  if (
    fragments.length > 0 &&
    !item.referenceAnswers.every((answer) =>
      fragments.some((fragment) => normalizeComparable(answer.jp).includes(fragment)) ||
      item.answerContract.allowedVariants.some(
        (variant) => normalizeComparable(variant) === normalizeComparable(answer.jp)
      )
    )
  ) errors.add("TARGET_FORM_MISSING");
  if (item.context.registerPreset !== item.intent.context.registerPreset) errors.add("REGISTER_MISMATCH");
  if (item.context.sceneSlug !== item.intent.context.sceneSlug) errors.add("CONTEXT_MISMATCH");
  if (item.exerciseType === "form_repair" && item.incorrectSentence === item.correctedSentence) errors.add("MULTIPLE_PRIMARY_ERRORS");
  if (
    item.exerciseType === "form_repair" &&
    /[,，、/]|\band\b/i.test(item.targetErrorType)
  ) errors.add("MULTIPLE_PRIMARY_ERRORS");
  if (
    item.intent.difficulty <= 2 &&
    item.referenceAnswers.some(
      (answer) => answer.jp.length > 42 + item.intent.vocabularyBudget.maxNewWords * 12
    )
  ) errors.add("DIFFICULTY_MISMATCH");
  return { valid: errors.size === 0, errorCodes: Array.from(errors), details: Array.from(errors).map((code) => `教学契约校验失败：${code}`), stage: "contract" };
}

export function validatePracticeItemV2(item: PracticeItemV2, grammarPoint: GrammarPointDetail) {
  const results = [validateSchema(item), validateStatic(item), validateContract(item, grammarPoint)];
  return { valid: results.every((result) => result.valid), results, errorCodes: Array.from(new Set(results.flatMap((result) => result.errorCodes))) };
}

export function reviewPracticeItemLocally(item: PracticeItemV2): PracticeReviewerResult {
  const errorCodes: GenerationErrorCode[] = [];
  if (item.exerciseType === "guided_translation" && ABSTRACT_CHINESE_PATTERN.test(item.chineseSentence)) errorCodes.push("INCOMPLETE_CHINESE_PROMPT");
  if (item.exerciseType === "contextual_response" && (item.previousTurn.length < 4 || item.requiredInformation.length === 0)) errorCodes.push("CONTEXT_MISMATCH");
  if (item.exerciseType === "register_rewrite" && item.sourceSentence === item.referenceAnswers[0]?.jp) errorCodes.push("ANSWER_LEAK");
  if ((item.exerciseType === "meaning_choice" || item.exerciseType === "contrast_choice") && Object.keys(item.distractorReasons).length < item.choices.length - 1) errorCodes.push("AMBIGUOUS_CHOICES");
  return {
    valid: errorCodes.length === 0,
    errorCodes,
    repairInstructions: errorCodes.map((code) => `只修复 ${code}，保留目标用法、语体和事实。`),
    confidence: errorCodes.length === 0 ? 0.98 : 0.95,
  };
}

export function parseReviewerResult(raw: unknown): PracticeReviewerResult | null {
  const record = objectValue(raw);
  if (!record || typeof record.valid !== "boolean") return null;
  const errorCodes = stringArray(record.error_codes ?? record.errorCodes).filter(
    (code): code is GenerationErrorCode => GENERATION_ERROR_CODES.includes(code as GenerationErrorCode)
  );
  const confidence = Number(record.confidence);
  const normalizedConfidence = Number.isFinite(confidence)
    ? Math.min(1, Math.max(0, confidence))
    : 0;
  return {
    valid: record.valid && errorCodes.length === 0 && normalizedConfidence >= 0.7,
    errorCodes,
    repairInstructions: stringArray(record.repair_instructions ?? record.repairInstructions),
    confidence: normalizedConfidence,
  };
}

export function buildEmptyGenerationMetadata(input: Partial<PracticeGenerationMetadata> = {}): PracticeGenerationMetadata {
  return {
    promptId: input.promptId ?? "practice.local_fallback",
    promptVersion: input.promptVersion ?? 2,
    schemaVersion: PRACTICE_V2_SCHEMA_VERSION,
    grammarContentVersion: input.grammarContentVersion ?? "grammar-content-v3",
    model: input.model ?? null,
    generationSource: input.generationSource ?? "fallback",
    validationResults: input.validationResults ?? [],
    reviewerResult: input.reviewerResult ?? null,
    generationRetryCount: input.generationRetryCount ?? 0,
    networkRetryCount: input.networkRetryCount ?? 0,
    fallbackReason: input.fallbackReason ?? null,
    degradationReason: input.degradationReason ?? null,
    latencyMs: input.latencyMs ?? 0,
  };
}

export function assertPracticeGenerationInput(intent: PracticeIntent, contract: AnswerContract) {
  assertPracticeIntent(intent);
  assertAnswerContract(contract);
}
