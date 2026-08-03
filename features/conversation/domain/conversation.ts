import type {
  ConversationGrammarCandidate,
  ConversationLearningItemKind,
  ConversationMemoryKind,
  ConversationMemoryScope,
  ConversationMessageDetails,
  ConversationMessage,
  ConversationMode,
} from "@/shared/types/conversation";

export const CONVERSATION_MODES: ConversationMode[] = [
  "auto",
  "zh_to_ja",
  "ja_to_zh",
  "polish_ja",
  "explain_ja",
];

export const MAX_CONVERSATION_INPUT_LENGTH = 8_000;
export const MAX_CONTEXT_MESSAGES = 16;
export const MAX_CONTEXT_CHARACTERS = 16_000;
export const MAX_SUMMARY_LENGTH = 2_000;
export const MAX_ANALYSIS_ITEMS = 5;

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

export type ConversationAnalysisOutput = {
  title: string | null;
  summary: string;
  details: ConversationMessageDetails;
  memories: ConversationAnalysisMemory[];
  learningItems: ConversationAnalysisLearningItem[];
};

const CONVERSATION_META_MEMORY_PATTERNS = [
  /(?:当前|本|这)(?:一)?轮对话/,
  /用户(?:说|输入|询问)/,
  /助手(?:给出|回答|解释)/,
  /规则(?:涉及|要求)/,
  /(?:学习项|候选).*(?:提取|分析)/,
  /\b(?:grammar|vocabulary|expression)\b/i,
] as const;

function readString(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function readStringArray(value: unknown, limit: number, maxLength: number) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => readString(item, maxLength))
    .filter(Boolean)
    .slice(0, limit);
}

export function isConversationMode(value: unknown): value is ConversationMode {
  return typeof value === "string" &&
    CONVERSATION_MODES.includes(value as ConversationMode);
}

function canonicalizeGrammarSurface(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[~～]/g, "〜")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeGrammarForm(value: string) {
  return canonicalizeGrammarSurface(value).replace(/^〜+/, "");
}

export function buildConversationFallbackTitle(content: string) {
  const normalized = content.trim().replace(/\s+/g, " ");
  if (normalized.length <= 32) {
    return normalized;
  }
  return `${normalized.slice(0, 31)}…`;
}

export function conversationLearningItemKey(
  kind: ConversationLearningItemKind,
  surfaceForm: string,
  meaningZh: string
) {
  const normalizedSurface =
    kind === "grammar"
      ? normalizeGrammarForm(surfaceForm)
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
  const normalizedSurface = normalizeGrammarForm(surfaceForm);
  const exact = candidates.filter(
    (candidate) =>
      normalizeGrammarForm(candidate.canonicalForm) === normalizedSurface ||
      normalizeGrammarForm(candidate.grammarPoint) === normalizedSurface
  );
  return exact.length > 0 ? exact : candidates;
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

export function parseConversationAnalysisOutput(
  raw: string
): ConversationAnalysisOutput | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  const detailsRecord =
    record.details && typeof record.details === "object"
      ? (record.details as Record<string, unknown>)
      : {};
  const literalTranslation = readString(detailsRecord.literal_translation, 2_000);
  const memories = Array.isArray(record.memories)
    ? record.memories
        .map((item): ConversationAnalysisMemory | null => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const next = item as Record<string, unknown>;
          const scope = next.scope;
          const kind = next.kind;
          const content = readString(next.content, 300);
          if (
            (scope !== "global" && scope !== "session") ||
            (kind !== "preference" && kind !== "context" && kind !== "goal") ||
            !content
          ) {
            return null;
          }
          return { scope, kind, content };
        })
        .filter((item): item is ConversationAnalysisMemory => item !== null)
        .slice(0, 3)
    : [];
  const learningItems = Array.isArray(record.learning_items)
    ? record.learning_items
        .map((item): ConversationAnalysisLearningItem | null => {
          if (!item || typeof item !== "object") {
            return null;
          }
          const next = item as Record<string, unknown>;
          const kind = next.kind;
          const rawSurfaceForm = readString(next.surface_form, 200);
          if (
            (kind !== "vocabulary" &&
              kind !== "expression" &&
              kind !== "grammar") ||
            !rawSurfaceForm
          ) {
            return null;
          }
          const surfaceForm =
            kind === "grammar"
              ? canonicalizeGrammarSurface(rawSurfaceForm)
              : rawSurfaceForm;
          const reading = readString(next.reading, 200);
          return {
            kind,
            surfaceForm,
            reading: reading || null,
            meaningZh: readString(next.meaning_zh, 500),
            explanationZh: readString(next.explanation_zh, 1_000),
            sourceExcerpt: readString(next.source_excerpt, 500),
          };
        })
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
        .slice(0, MAX_ANALYSIS_ITEMS)
    : [];

  return {
    title: readString(record.title, 80) || null,
    summary: readString(record.summary, MAX_SUMMARY_LENGTH),
    details: {
      literalTranslation: literalTranslation || null,
      nuanceNotes: readStringArray(detailsRecord.nuance_notes, 5, 500),
      keyPoints: readStringArray(detailsRecord.key_points, 5, 500),
    },
    memories,
    learningItems,
  };
}

export function validateConversationAnalysisReferences(
  analysis: ConversationAnalysisOutput,
  messages: Array<{ content: string }>
): ConversationAnalysisOutput {
  const sourceTexts = messages.map((message) => message.content);
  return {
    ...analysis,
    memories: analysis.memories.filter(
      (memory) =>
        !CONVERSATION_META_MEMORY_PATTERNS.some((pattern) =>
          pattern.test(memory.content)
        )
    ),
    learningItems: analysis.learningItems.filter(
      (item) =>
        Boolean(item.sourceExcerpt) &&
        sourceTexts.some((content) => content.includes(item.sourceExcerpt))
    ),
  };
}

const HIGH_CONFIDENCE_GRAMMAR_PATTERNS = [
  {
    pattern:
      /(?:て|で)み(?:ませんでした|ました|ません|ます|なかった|ない|よう|たい|る|た|て)(?:よ|ね)?/,
    coveredPattern:
      /(?:て|で)み(?:ませんでした|ました|ません|ます|なかった|ない|よう|たい|る|た|て)(?:よ|ね)?/,
    assistantPattern: null,
    surfaceForm: "〜てみる",
    meaningZh: "试着……",
    explanationZh: "接在动词て形后，表示尝试做某事并观察结果。",
  },
  {
    pattern: /[^\s。、！？「」]{1,20}いでした/,
    coveredPattern: /(?:いでした|かったです|い形容[詞词].*过去)/,
    assistantPattern: /かったです/,
    surfaceForm: "い形容词过去形",
    meaningZh: "表示い形容词的过去状态",
    explanationZh: "将词尾「い」变为「かった」，礼貌表达再接「です」。",
  },
  {
    pattern: /[~～〜]わけではない/,
    coveredPattern: /[~～〜]?わけではない/,
    assistantPattern: null,
    surfaceForm: "〜わけではない",
    meaningZh: "并不是……/并非……",
    explanationZh: "否定从前文可能推导出的过度结论，表示并非完全如此。",
  },
] as const;

function extractExplicitGrammarRequests(userTexts: string[]) {
  const requests: Array<{ surfaceForm: string; sourceExcerpt: string }> = [];
  for (const content of userTexts) {
    for (const match of content.matchAll(/[「『]([~～〜][^」』\r\n]{1,60})[」』]/g)) {
      const sourceExcerpt = match[1]?.trim() ?? "";
      const surfaceForm = canonicalizeGrammarSurface(sourceExcerpt);
      if (!surfaceForm) continue;
      requests.push({ surfaceForm, sourceExcerpt });
    }
  }
  return requests;
}

export function reconcileConversationGrammarLearningItems(
  analysis: ConversationAnalysisOutput,
  messages: ConversationMessage[]
): ConversationAnalysisOutput {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const assistantTexts = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content);
  let learningItems = [...analysis.learningItems];
  let changed = false;

  for (const grammar of HIGH_CONFIDENCE_GRAMMAR_PATTERNS) {
    const sourceExcerpt = userTexts
      .map((content) => content.match(grammar.pattern)?.[0] ?? "")
      .find(Boolean);
    if (!sourceExcerpt) continue;
    if (
      grammar.assistantPattern &&
      !assistantTexts.some((content) => grammar.assistantPattern?.test(content))
    ) {
      continue;
    }

    const normalizedGrammar = normalizeGrammarForm(grammar.surfaceForm);
    learningItems = learningItems.filter((item) => {
      if (
        item.kind === "grammar" &&
        (normalizeGrammarForm(item.surfaceForm) === normalizedGrammar ||
          [item.surfaceForm, item.sourceExcerpt, item.explanationZh].some(
            (value) => grammar.coveredPattern.test(value)
          ))
      ) {
        return false;
      }
      if (item.kind !== "expression" && item.kind !== "vocabulary") {
        return true;
      }
      return ![item.surfaceForm, item.sourceExcerpt].some((value) =>
        grammar.coveredPattern.test(value)
      );
    });
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: grammar.surfaceForm,
      reading: null,
      meaningZh: grammar.meaningZh,
      explanationZh: grammar.explanationZh,
      sourceExcerpt,
    });
    changed = true;
  }

  for (const request of extractExplicitGrammarRequests(userTexts)) {
    const normalizedGrammar = normalizeGrammarForm(request.surfaceForm);
    if (
      learningItems.some(
        (item) =>
          item.kind === "grammar" &&
          normalizeGrammarForm(item.surfaceForm) === normalizedGrammar
      )
    ) {
      continue;
    }
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: request.surfaceForm,
      reading: null,
      meaningZh: "本轮明确询问的语法",
      explanationZh: "用户明确询问了该语法的用法，可绑定现有语法义项继续复习。",
      sourceExcerpt: request.sourceExcerpt,
    });
    changed = true;
  }

  if (!changed) {
    return analysis;
  }

  return {
    ...analysis,
    learningItems: learningItems.slice(0, MAX_ANALYSIS_ITEMS),
  };
}
