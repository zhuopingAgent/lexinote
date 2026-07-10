import type {
  FeedbackIssueSeverity,
  GrammarErrorCode,
} from "@/shared/types/api";

export const GRAMMAR_ERROR_CODES: readonly GrammarErrorCode[] = [
  "conjugation_error",
  "connection_error",
  "particle_error",
  "tense_aspect_error",
  "giving_receiving_direction_error",
  "semantic_error",
  "register_mismatch",
  "collocation_error",
  "literal_translation",
  "unnatural_expression",
];

const GRAMMAR_ERROR_CODE_SET = new Set<string>(GRAMMAR_ERROR_CODES);

const LEGACY_ERROR_CODE_ALIASES: Record<string, GrammarErrorCode> = {
  wrong_register: "register_mismatch",
  tense_mismatch: "tense_aspect_error",
  missing_target_grammar: "semantic_error",
  wrong_particle: "particle_error",
  wrong_connection: "connection_error",
};

export function normalizeGrammarErrorCode(value: unknown): GrammarErrorCode | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  if (GRAMMAR_ERROR_CODE_SET.has(normalized)) {
    return normalized as GrammarErrorCode;
  }

  return LEGACY_ERROR_CODE_ALIASES[normalized] ?? null;
}

export function normalizeFeedbackSeverity(
  value: unknown,
  fallback: FeedbackIssueSeverity = "medium"
): FeedbackIssueSeverity {
  return value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "critical"
    ? value
    : fallback;
}
