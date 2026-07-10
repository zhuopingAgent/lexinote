import {
  normalizeFeedbackSeverity,
  normalizeGrammarErrorCode,
} from "@/features/grammar-learning/domain/feedback";
import type {
  AIFeedbackBetterVersion,
  AIFeedbackIssue,
  AIFeedbackResult,
  PracticeReferenceAnswer,
} from "@/shared/types/grammar";

type RawPracticeOutput = {
  task_zh?: unknown;
  reference_answers?: unknown;
  hints?: unknown;
};

type RawFeedbackOutput = {
  is_correct?: unknown;
  grammar_score?: unknown;
  meaning_score?: unknown;
  naturalness_score?: unknown;
  register_score?: unknown;
  scene_fit_score?: unknown;
  issues?: unknown;
  explanation_zh?: unknown;
  next_hint_zh?: unknown;
  feedback_text_zh?: unknown;
  corrected_sentence?: unknown;
  better_versions?: unknown;
  mistake_types?: unknown;
  next_practice_prompt_zh?: unknown;
};

export type GeneratedPractice = {
  prompt: string;
  referenceAnswers: PracticeReferenceAnswer[];
  hints: string[];
  source: "ai" | "fallback";
  rawAiResponse?: unknown;
};

export type EvaluatedSentence = AIFeedbackResult & {
  source: "ai" | "fallback";
  modelName?: string;
  rawAiResponse?: unknown;
};

export function extractJsonObject(text: string): unknown | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}
function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clampScore(value: unknown, fallback: number) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, 1), 5);
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => sanitizeText(item))
    .filter((item) => item.length > 0);
}

function parseReferenceAnswers(value: unknown): PracticeReferenceAnswer[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const jp = sanitizeText(record.jp);
      const zh = sanitizeText(record.zh);
      const noteZh = sanitizeText(record.note_zh);

      if (!jp || !zh) {
        return null;
      }

      return {
        jp,
        zh,
        noteZh: noteZh || "使用目标语法，语气自然。",
      };
    })
    .filter((item): item is PracticeReferenceAnswer => item !== null);
}

function parseBetterVersions(value: unknown): AIFeedbackBetterVersion[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const betterVersions: AIFeedbackBetterVersion[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const sentence = sanitizeText(record.sentence);
    const explanationZh = sanitizeText(record.explanation_zh);

    if (!sentence || !explanationZh) {
      continue;
    }

    betterVersions.push({
      sentence,
      registerTag: sanitizeText(record.register) || null,
      explanationZh,
    });
  }

  return betterVersions;
}

export function parsePracticeOutput(raw: unknown): Omit<GeneratedPractice, "source"> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as RawPracticeOutput;
  const prompt = sanitizeText(parsed.task_zh);
  const referenceAnswers = parseReferenceAnswers(parsed.reference_answers);
  const hints = parseStringArray(parsed.hints);

  if (!prompt || referenceAnswers.length === 0) {
    return null;
  }

  return {
    prompt,
    referenceAnswers,
    hints,
    rawAiResponse: raw,
  };
}

function parseFeedbackIssues(
  value: unknown,
  grammarPointId: string,
  fallbackExplanation: string,
  fallbackCorrection: string
): AIFeedbackIssue[] {
  const issues = new Map<string, AIFeedbackIssue>();

  for (const item of Array.isArray(value) ? value : []) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const errorTypeCode = normalizeGrammarErrorCode(
      record.error_type_code ?? record.errorTypeCode
    );
    if (!errorTypeCode || issues.has(errorTypeCode)) {
      continue;
    }

    const relatedId = sanitizeText(
      record.related_grammar_point_id ?? record.relatedGrammarPointId
    );
    issues.set(errorTypeCode, {
      errorTypeCode,
      severity: normalizeFeedbackSeverity(record.severity),
      explanation:
        sanitizeText(record.explanation) || fallbackExplanation,
      correction: sanitizeText(record.correction) || fallbackCorrection,
      relatedGrammarPointId: relatedId === grammarPointId ? relatedId : null,
    });
  }

  return Array.from(issues.values());
}

export function parseFeedbackOutput(
  raw: unknown,
  grammarPointId: string
): Omit<EvaluatedSentence, "source"> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as RawFeedbackOutput;
  const legacyFeedbackText = sanitizeText(parsed.feedback_text_zh);
  const explanation =
    sanitizeText(parsed.explanation_zh) || legacyFeedbackText;
  const correctedSentence = sanitizeText(parsed.corrected_sentence) || null;
  const betterVersions = parseBetterVersions(parsed.better_versions);

  if (!explanation) {
    return null;
  }

  const parsedIssues = parseFeedbackIssues(
    parsed.issues,
    grammarPointId,
    explanation,
    correctedSentence ?? ""
  );
  const issues =
    parsedIssues.length > 0
      ? parsedIssues
      : parseStringArray(parsed.mistake_types).flatMap((mistakeType) => {
          const errorTypeCode = normalizeGrammarErrorCode(mistakeType);
          return errorTypeCode
            ? [
                {
                  errorTypeCode,
                  severity: normalizeFeedbackSeverity(undefined),
                  explanation,
                  correction: correctedSentence ?? "",
                  relatedGrammarPointId: grammarPointId,
                } satisfies AIFeedbackIssue,
              ]
            : [];
        });
  const nextHint =
    sanitizeText(parsed.next_hint_zh) ||
    sanitizeText(parsed.next_practice_prompt_zh);

  return {
    isCorrect: parsed.is_correct === true && issues.length === 0,
    grammarScore: clampScore(parsed.grammar_score, 3),
    meaningScore: clampScore(parsed.meaning_score, 3),
    naturalnessScore: clampScore(parsed.naturalness_score, 3),
    registerScore: clampScore(parsed.register_score, 3),
    sceneFitScore: clampScore(parsed.scene_fit_score, 3),
    issues,
    explanation,
    nextHint,
    feedbackText: legacyFeedbackText || explanation,
    correctedSentence,
    betterVersions,
    mistakeTypes: issues.map((issue) => issue.errorTypeCode),
    nextPracticePrompt: nextHint || null,
    rawAiResponse: raw,
  };
}
