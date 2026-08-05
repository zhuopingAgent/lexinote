import type {
  ConversationGrammarCandidate,
  ConversationLearningItemKind,
  ConversationMessage,
  ConversationMode,
} from "@/shared/types/conversation";

export const CONVERSATION_MODES: ConversationMode[] = [
  "chat",
  "auto",
  "zh_to_ja",
  "ja_to_zh",
  "polish_ja",
  "explain_ja",
];

export const MAX_CONVERSATION_INPUT_LENGTH = 8_000;
export const MAX_CONVERSATION_RESPONSE_LENGTH = 8_000;
export const MAX_CONTEXT_MESSAGES = 16;
export const MAX_CONTEXT_CHARACTERS = 16_000;
export const MAX_SUMMARY_LENGTH = 2_000;
export const MAX_ANALYSIS_ITEMS = 5;

export function isConversationMode(value: unknown): value is ConversationMode {
  return (
    typeof value === "string" &&
    CONVERSATION_MODES.includes(value as ConversationMode)
  );
}

export function canonicalizeConversationGrammarSurface(value: string) {
  const normalized = value
    .normalize("NFKC")
    .replace(/[~～]/g, "〜")
    .replace(/\s+/g, "")
    .trim();
  const withoutPrefix = normalized.replace(/^〜+/, "");
  if (/^[てで]もら(?:いました|います|いますか|った|っている)$/u.test(withoutPrefix)) {
    return "〜てもらう";
  }
  if (/^ことになってい(?:ます|ました)$/u.test(withoutPrefix)) {
    return "〜ことになっている";
  }
  if (/^ことにしてい(?:ます|ました)$/u.test(withoutPrefix)) {
    return "〜ことにしている";
  }
  if (/^わけでは(?:ありません|なかった)$/u.test(withoutPrefix)) {
    return "〜わけではない";
  }
  return normalized;
}

export function normalizeConversationGrammarForm(value: string) {
  return canonicalizeConversationGrammarSurface(value).replace(/^〜+/, "");
}

export function isLowValueConversationGrammar(surfaceForm: string) {
  return new Set([
    "には",
    "必要です",
    "いただけますか",
    "をいただけますか",
    "があります",
    "が入っていないか",
    "ひとつの",
    "一つの",
    "ており",
  ]).has(normalizeConversationGrammarForm(surfaceForm));
}

export function buildConversationGrammarSearchQuery(surfaceForm: string) {
  return normalizeConversationGrammarForm(surfaceForm);
}

export function buildConversationFallbackTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 32) return normalized;
  return `${normalized.slice(0, 31)}…`;
}

export function conversationLearningItemKey(
  kind: ConversationLearningItemKind,
  surfaceForm: string,
  meaningZh: string
) {
  const normalizedSurface =
    kind === "grammar"
      ? normalizeConversationGrammarForm(surfaceForm)
      : surfaceForm.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
  const normalizedMeaning = meaningZh
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  return JSON.stringify([kind, normalizedSurface, normalizedMeaning]);
}

export function selectConversationGrammarCandidates(
  surfaceForm: string,
  candidates: ConversationGrammarCandidate[]
) {
  const normalizedSurface = normalizeConversationGrammarForm(surfaceForm);
  return candidates.filter(
    (candidate) =>
      normalizeConversationGrammarForm(candidate.canonicalForm) ===
        normalizedSurface ||
      normalizeConversationGrammarForm(candidate.grammarPoint) ===
        normalizedSurface
  );
}

export function trimConversationContextMessages(
  messages: ConversationMessage[]
): ConversationMessage[] {
  const selected: ConversationMessage[] = [];
  let characters = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (selected.length >= MAX_CONTEXT_MESSAGES) break;
    const remaining = MAX_CONTEXT_CHARACTERS - characters;
    if (remaining <= 0) break;
    const content = message.content.slice(-remaining);
    selected.unshift({ ...message, content });
    characters += content.length;
  }

  return selected;
}
