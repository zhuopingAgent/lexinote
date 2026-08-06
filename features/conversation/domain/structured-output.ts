import {
  MAX_ANALYSIS_ITEMS,
  MAX_SUMMARY_LENGTH,
  canonicalizeConversationGrammarSurface,
  conversationLearningItemKey,
  isLowValueConversationGrammar,
  normalizeConversationGrammarForm,
} from "@/features/conversation/domain/model";
import type {
  ConversationLearningItemKind,
  ConversationMemoryKind,
  ConversationMemoryScope,
} from "@/shared/types/conversation";

export type ConversationAnalysisLearningItem = {
  kind: ConversationLearningItemKind;
  surfaceForm: string;
  reading: string | null;
  meaningZh: string;
  explanationZh: string;
  sourceExcerpt: string;
};

export type ConversationAnalysisMemory = {
  scope: ConversationMemoryScope;
  kind: ConversationMemoryKind;
  content: string;
};

export type ConversationLearningAnalysisOutput = {
  overview: string;
  learningItems: ConversationAnalysisLearningItem[];
};

export type ConversationMaintenanceOutput = {
  title: string | null;
  summary: string;
  memories: ConversationAnalysisMemory[];
};

const META_MEMORY_PATTERNS = [
  /(?:当前|本|这)(?:一)?轮对话/,
  /(?:当前|本次|这次)?对话主题(?:是|为)/,
  /用户(?:说|输入|询问|请求|要求)/,
  /帮助用户/,
  /包含.*(?:例文|例句|接续|接続|含义|意味)/,
  /助手(?:给出|回答|解释)/,
  /规则(?:涉及|要求)/,
  /(?:学习项|候选).*(?:提取|分析)/,
  /\b(?:grammar|vocabulary|expression)\b/i,
] as const;

const META_SUMMARY_PATTERNS = [
  /^(?:规则回顾|规则说明|提取规则|分析规则|学习项规则|系统规则|提示词(?:要求)?)[：:]/,
  /^(?:根据|按照)(?:上述|当前|本次)?(?:规则|提示词)[，,:：]?/,
  /(?:学习项|候选).*(?:最多|不超过)\s*\d+\s*(?:项|个)/,
  /\b(?:grammar|vocabulary|expression)\b/i,
] as const;

const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u;
const JAPANESE_KANA_PATTERN = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const LEXICAL_HONORIFIC_FORMS = new Set([
  "おっしゃる",
  "いらっしゃる",
  "召し上がる",
  "ご覧になる",
  "なさる",
  "くださる",
]);
const LEXICAL_POLITE_NOUNS = new Set(["お水"]);
const CONTEXTUAL_RESPONSE_EXPRESSIONS = new Set(["大丈夫です", "結構です"]);
const LEXICAL_HONORIFIC_INFLECTIONS = new Map([
  ["おっしゃった", "おっしゃる"],
  ["おっしゃいます", "おっしゃる"],
  ["おっしゃいました", "おっしゃる"],
  ["いらっしゃった", "いらっしゃる"],
  ["いらっしゃいます", "いらっしゃる"],
  ["いらっしゃいました", "いらっしゃる"],
  ["召し上がった", "召し上がる"],
  ["召し上がります", "召し上がる"],
  ["召し上がりました", "召し上がる"],
  ["ご覧になった", "ご覧になる"],
  ["ご覧になります", "ご覧になる"],
  ["ご覧になりました", "ご覧になる"],
  ["なさった", "なさる"],
  ["なさいます", "なさる"],
  ["なさいました", "なさる"],
  ["くださった", "くださる"],
  ["くださいます", "くださる"],
  ["くださいました", "くださる"],
]);

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readJapaneseReading(value: unknown) {
  const reading = readString(value, 200);
  if (
    !reading ||
    !/[\u3040-\u30ff]/u.test(reading) ||
    /[\u3400-\u9fff\uf900-\ufaff]/u.test(reading)
  ) {
    return null;
  }
  return reading;
}

function sanitizeConversationSummary(value: unknown) {
  const summary = readString(value, MAX_SUMMARY_LENGTH);
  const sentences = summary.match(/[^。！？\n]+[。！？]?/g) ?? [];
  return sentences
    .map((sentence) => sentence.trim())
    .filter(
      (sentence) =>
        sentence &&
        !META_SUMMARY_PATTERNS.some((pattern) => pattern.test(sentence))
    )
    .join("")
    .slice(0, MAX_SUMMARY_LENGTH);
}

function canonicalizeLexicalHonorificSurface(value: string) {
  const normalized = normalizeConversationGrammarForm(value);
  return LEXICAL_HONORIFIC_INFLECTIONS.get(normalized) ?? normalized;
}

function parseConversationLearningItem(
  value: unknown
): ConversationAnalysisLearningItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const rawKind = item.kind;
  const rawSurfaceForm = readString(item.surface_form, 200);
  if (
    (rawKind !== "vocabulary" &&
      rawKind !== "expression" &&
      rawKind !== "grammar") ||
    !rawSurfaceForm
  ) {
    return null;
  }

  const lexicalHonorificSurface =
    canonicalizeLexicalHonorificSurface(rawSurfaceForm);
  const lexicalHonorific =
    rawKind === "grammar" &&
    LEXICAL_HONORIFIC_FORMS.has(lexicalHonorificSurface);
  const lexicalPoliteNoun =
    rawKind === "grammar" &&
    LEXICAL_POLITE_NOUNS.has(normalizeConversationGrammarForm(rawSurfaceForm));
  const contextualCollocation =
    rawKind === "grammar" &&
    !/^[~～〜]/u.test(rawSurfaceForm) &&
    /が(?:あります|ある)$/u.test(rawSurfaceForm);
  const contextualResponseExpression =
    rawKind === "vocabulary" &&
    CONTEXTUAL_RESPONSE_EXPRESSIONS.has(
      rawSurfaceForm.normalize("NFKC").trim()
    );
  const kind =
    lexicalHonorific || lexicalPoliteNoun
      ? "vocabulary"
      : contextualCollocation || contextualResponseExpression
        ? "expression"
        : rawKind;
  const surfaceForm =
    kind === "grammar"
      ? canonicalizeConversationGrammarSurface(rawSurfaceForm)
      : lexicalHonorific
        ? lexicalHonorificSurface
        : lexicalPoliteNoun
          ? rawSurfaceForm.replace(/^[~～〜]+/u, "")
          : contextualCollocation
            ? rawSurfaceForm.replace(/があります$/u, "がある")
            : rawSurfaceForm;
  const meaningZh = readString(item.meaning_zh, 500);
  const explanationZh = readString(item.explanation_zh, 1_000);
  const sourceExcerpt = readString(item.source_excerpt, 500);
  if (
    !meaningZh ||
    !explanationZh ||
    !sourceExcerpt ||
    HANGUL_PATTERN.test(meaningZh) ||
    HANGUL_PATTERN.test(explanationZh) ||
    /[。！？?!]/u.test(surfaceForm) ||
    (kind === "grammar" &&
      (!JAPANESE_KANA_PATTERN.test(surfaceForm) ||
        isLowValueConversationGrammar(surfaceForm) ||
        /[、，,\/／→⇒]/u.test(surfaceForm) ||
        /^(?:接续|接続)[：:]/u.test(meaningZh) ||
        /用于构成.*接续/u.test(explanationZh)))
  ) {
    return null;
  }
  const reading =
    kind === "grammar"
      ? null
      : lexicalHonorific &&
          /^[\u3040-\u30ffー]+$/u.test(lexicalHonorificSurface)
        ? lexicalHonorificSurface
        : readJapaneseReading(item.reading);
  return {
    kind,
    surfaceForm,
    reading,
    meaningZh,
    explanationZh,
    sourceExcerpt,
  };
}

export function parseConversationLearningAnalysisOutput(
  raw: string
): ConversationLearningAnalysisOutput | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.overview !== "string" ||
    !Array.isArray(record.learning_items)
  ) {
    return null;
  }
  const learningItems = record.learning_items
    .map(parseConversationLearningItem)
    .filter((item): item is ConversationAnalysisLearningItem => item !== null)
    .filter(
      (item, index, items) =>
        items.findIndex(
          (candidate) =>
            conversationLearningItemKey(
              candidate.kind,
              candidate.surfaceForm,
              candidate.meaningZh
            ) ===
            conversationLearningItemKey(
              item.kind,
              item.surfaceForm,
              item.meaningZh
            )
        ) === index
    )
    .slice(0, MAX_ANALYSIS_ITEMS);
  return {
    overview: readString(record.overview, 2_000),
    learningItems,
  };
}

export function parseConversationMaintenanceOutput(
  raw: string
): ConversationMaintenanceOutput | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  if (
    (record.title !== null && typeof record.title !== "string") ||
    typeof record.summary !== "string" ||
    !Array.isArray(record.memories)
  ) {
    return null;
  }
  const memories = record.memories
    .map((item): ConversationAnalysisMemory | null => {
      if (!item || typeof item !== "object") return null;
      const memory = item as Record<string, unknown>;
      if (
        (memory.scope !== "session" && memory.scope !== "global") ||
        (memory.kind !== "preference" &&
          memory.kind !== "context" &&
          memory.kind !== "goal")
      ) {
        return null;
      }
      const content = readString(memory.content, 300);
      return content
        ? { scope: memory.scope, kind: memory.kind, content }
        : null;
    })
    .filter((item): item is ConversationAnalysisMemory => item !== null)
    .filter(
      (memory, index, items) =>
        items.findIndex(
          (candidate) =>
            candidate.content.trim().toLowerCase() ===
            memory.content.trim().toLowerCase()
        ) === index
    )
    .slice(0, 3);
  return {
    title: readString(record.title, 80) || null,
    summary: sanitizeConversationSummary(record.summary),
    memories: memories.filter(
      (memory) =>
        !META_MEMORY_PATTERNS.some((pattern) => pattern.test(memory.content))
    ),
  };
}

export function validateConversationAnalysisReferences<
  T extends {
    learningItems: ConversationAnalysisLearningItem[];
    memories?: ConversationAnalysisMemory[];
  },
>(
  analysis: T,
  messages: Array<{ content: string }>
): Omit<T, "learningItems"> & {
  learningItems: ConversationAnalysisLearningItem[];
} {
  const sourceTexts = messages.map((message) => message.content);
  const memories = analysis.memories?.filter(
    (memory) =>
      !META_MEMORY_PATTERNS.some((pattern) => pattern.test(memory.content))
  );
  return {
    ...analysis,
    ...(memories ? { memories } : {}),
    learningItems: analysis.learningItems.filter(
      (item) =>
        sourceTexts.some((content) => content.includes(item.sourceExcerpt)) &&
        (item.kind !== "grammar" ||
          grammarFormHasSourceEvidence(item.surfaceForm, item.sourceExcerpt))
    ),
  };
}

function grammarFormHasSourceEvidence(
  surfaceForm: string,
  sourceExcerpt: string
) {
  const grammarForm = normalizeConversationGrammarForm(surfaceForm)
    .normalize("NFKC")
    .replace(/\s+/g, "");
  const source = sourceExcerpt.normalize("NFKC").replace(/\s+/g, "");
  if (!grammarForm || !source) return false;
  if (source.includes(grammarForm)) return true;

  const evidenceLength = grammarForm.length <= 3 ? 2 : 3;
  if (grammarForm.length < evidenceLength) return source.includes(grammarForm);
  for (let index = 0; index <= grammarForm.length - evidenceLength; index += 1) {
    const fragment = grammarForm.slice(index, index + evidenceLength);
    if (
      /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]+$/u.test(
        fragment
      ) && source.includes(fragment)
    ) {
      return true;
    }
  }
  return false;
}
