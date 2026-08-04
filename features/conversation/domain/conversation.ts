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
  /(?:当前|本次|这次)?对话主题(?:是|为)/,
  /用户(?:说|输入|询问|请求|要求)/,
  /帮助用户/,
  /包含.*(?:例文|例句|接续|接続|含义|意味)/,
  /助手(?:给出|回答|解释)/,
  /规则(?:涉及|要求)/,
  /(?:学习项|候选).*(?:提取|分析)/,
  /\b(?:grammar|vocabulary|expression)\b/i,
] as const;

const CONVERSATION_META_SUMMARY_PATTERNS = [
  /^(?:规则回顾|规则说明|提取规则|分析规则|学习项规则|系统规则|提示词(?:要求)?)[：:]/,
  /^(?:根据|按照)(?:上述|当前|本次)?(?:规则|提示词)[，,:：]?/,
  /(?:学习项|候选).*(?:最多|不超过)\s*\d+\s*(?:项|个)/,
  /\b(?:grammar|vocabulary|expression)\b/i,
] as const;

const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u;
const LEXICAL_HONORIFIC_FORMS = new Set([
  "おっしゃる",
  "いらっしゃる",
  "召し上がる",
  "ご覧になる",
  "なさる",
  "くださる",
]);

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
        !CONVERSATION_META_SUMMARY_PATTERNS.some((pattern) =>
          pattern.test(sentence)
        )
    )
    .join("")
    .slice(0, MAX_SUMMARY_LENGTH);
}

export function isConversationMode(value: unknown): value is ConversationMode {
  return typeof value === "string" &&
    CONVERSATION_MODES.includes(value as ConversationMode);
}

function canonicalizeGrammarSurface(value: string) {
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
  return exact;
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
          const rawKind = next.kind;
          const rawSurfaceForm = readString(next.surface_form, 200);
          if (
            (rawKind !== "vocabulary" &&
              rawKind !== "expression" &&
              rawKind !== "grammar") ||
            !rawSurfaceForm
          ) {
            return null;
          }
          const lexicalHonorific =
            rawKind === "grammar" &&
            LEXICAL_HONORIFIC_FORMS.has(normalizeGrammarForm(rawSurfaceForm));
          const contextualCollocation =
            rawKind === "grammar" &&
            !/^[~～〜]/u.test(rawSurfaceForm) &&
            /が(?:あります|ある)$/u.test(rawSurfaceForm);
          const kind = lexicalHonorific
            ? "vocabulary"
            : contextualCollocation
              ? "expression"
              : rawKind;
          const surfaceForm =
            kind === "grammar"
              ? canonicalizeGrammarSurface(rawSurfaceForm)
              : lexicalHonorific
                ? rawSurfaceForm.replace(/^[~～〜]+/u, "")
                : contextualCollocation
                  ? rawSurfaceForm.replace(/があります$/u, "がある")
                  : rawSurfaceForm;
          const meaningZh = readString(next.meaning_zh, 500);
          const explanationZh = readString(next.explanation_zh, 1_000);
          if (
            HANGUL_PATTERN.test(meaningZh) ||
            HANGUL_PATTERN.test(explanationZh) ||
            (kind === "grammar" &&
              (isLowValueStandaloneGrammar(surfaceForm) ||
                /[、。！？，,]/u.test(surfaceForm) ||
                /^(?:接续|接続)[：:]/u.test(meaningZh) ||
                /用于构成.*接续/u.test(explanationZh)))
          ) {
            return null;
          }
          return {
            kind,
            surfaceForm,
            reading: kind === "grammar" ? null : readJapaneseReading(next.reading),
            meaningZh,
            explanationZh,
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
    summary: sanitizeConversationSummary(record.summary),
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

type HighConfidenceGrammarPattern = {
  pattern: RegExp;
  coveredPattern: RegExp;
  assistantPattern: RegExp | null;
  surfaceForm: string;
  meaningZh: string;
  explanationZh: string;
  includeAssistantSource?: boolean;
};

const HIGH_CONFIDENCE_GRAMMAR_PATTERNS: readonly HighConfidenceGrammarPattern[] = [
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
  {
    pattern: /(?:た|だ)ほうがよさそう(?:です|だ)?/,
    coveredPattern: /(?:た|だ)?ほうが(?:よさそう(?:です|だ)?|いい)/,
    assistantPattern: null,
    surfaceForm: "〜たほうがいい",
    meaningZh: "最好……",
    explanationZh: "用过去形接「ほうがいい」，表示建议采取某个做法。",
  },
  {
    pattern: /(?:て|で)もよろしいでしょうか/,
    coveredPattern: /(?:て|で)もよろしいでしょうか/,
    assistantPattern: null,
    surfaceForm: "〜てもよろしいでしょうか",
    meaningZh: "可以……吗",
    explanationZh: "郑重询问自己或己方是否可以进行某个动作。",
    includeAssistantSource: true,
  },
  {
    pattern: /(?:て|で)いただけますか/,
    coveredPattern: /(?:て|で)いただけますか/,
    assistantPattern: null,
    surfaceForm: "〜ていただけますか",
    meaningZh: "能请您……吗",
    explanationZh: "以谦让授受形式郑重请求对方做某事。",
    includeAssistantSource: true,
  },
  {
    pattern: /ないことには/,
    coveredPattern: /ないことには/,
    assistantPattern: null,
    surfaceForm: "〜ないことには",
    meaningZh: "如果不……就不能……",
    explanationZh: "表示前项是后项成立的必要条件，后项通常是否定、困难或无法判断的内容。",
  },
] as const;

export function extractExplicitConversationGrammarForms(content: string) {
  const requests: Array<{ surfaceForm: string; sourceExcerpt: string }> = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/[「『]([~～〜][^」』\r\n]{1,60})[」』]/g)) {
    const sourceExcerpt = match[1]?.trim() ?? "";
    const surfaceForm = canonicalizeGrammarSurface(sourceExcerpt);
    const key = normalizeGrammarForm(surfaceForm);
    if (!surfaceForm || seen.has(key)) continue;
    seen.add(key);
    requests.push({ surfaceForm, sourceExcerpt });
  }
  return requests;
}

function extractExplicitGrammarRequests(userTexts: string[]) {
  return userTexts.flatMap(extractExplicitConversationGrammarForms);
}

function extractExplicitVocabularyRequests(
  userTexts: string[],
  assistantTexts: string[]
) {
  const meaningZh = assistantTexts
    .map(
      (content) =>
        content.match(
          /(?:中国語|中文)(?:で|是|叫)[「『“"]([^」』”"]{1,80})[」』”"]/
        )?.[1] ?? ""
    )
    .find(Boolean);
  const requests: Array<{
    surfaceForm: string;
    sourceExcerpt: string;
    meaningZh: string;
  }> = [];
  const seen = new Set<string>();
  for (const content of userTexts) {
    if (
      !/(?:中国語|中文|汉语).*(?:何と|怎么|如何|意思|意味)|(?:何と|怎么|如何).*(?:中国語|中文|汉语)/.test(
        content
      )
    ) {
      continue;
    }
    for (const match of content.matchAll(/[「『]([^」』\r\n]{1,60})[」』]/g)) {
      const surfaceForm = match[1]?.trim() ?? "";
      const key = surfaceForm.normalize("NFKC").toLowerCase();
      if (!surfaceForm || /^[~～〜]/.test(surfaceForm) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      requests.push({
        surfaceForm,
        sourceExcerpt: surfaceForm,
        meaningZh: meaningZh || "本轮明确询问的词汇",
      });
    }
  }
  return requests;
}

function isLowValueStandaloneGrammar(surfaceForm: string) {
  return new Set([
    "には",
    "必要です",
    "いただけますか",
    "をいただけますか",
    "があります",
    "ひとつの",
    "一つの",
  ]).has(
    normalizeGrammarForm(surfaceForm)
  );
}

function findNaAdjectivePastCorrection(
  userTexts: string[],
  assistantTexts: string[]
) {
  const incorrectEnding = "かったです";
  for (const userText of userTexts) {
    let searchFrom = 0;
    while (searchFrom < userText.length) {
      const index = userText.indexOf(incorrectEnding, searchFrom);
      if (index < 0) break;
      const correctedText = `${userText.slice(0, index)}でした${userText.slice(
        index + incorrectEnding.length
      )}`;
      if (assistantTexts.some((content) => content.includes(correctedText))) {
        return userText
          .slice(Math.max(0, index - 80), index + incorrectEnding.length)
          .trim();
      }
      searchFrom = index + incorrectEnding.length;
    }
  }
  return null;
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

  const filteredLearningItems = learningItems.filter(
    (item) =>
      item.kind !== "grammar" || !isLowValueStandaloneGrammar(item.surfaceForm)
  );
  if (filteredLearningItems.length !== learningItems.length) {
    learningItems = filteredLearningItems;
    changed = true;
  }

  for (const grammar of HIGH_CONFIDENCE_GRAMMAR_PATTERNS) {
    const sourceTexts = grammar.includeAssistantSource
      ? [...userTexts, ...assistantTexts]
      : userTexts;
    const sourceExcerpt = sourceTexts
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

  const naAdjectivePastSource = findNaAdjectivePastCorrection(
    userTexts,
    assistantTexts
  );
  if (naAdjectivePastSource) {
    learningItems = learningItems.filter((item) => {
      const values = [item.surfaceForm, item.sourceExcerpt, item.explanationZh];
      return !values.some(
        (value) =>
          /な形容[詞词].*过去/.test(value) ||
          (value.includes("かった") && value.includes("でした"))
      );
    });
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: "な形容词过去形",
      reading: null,
      meaningZh: "表示な形容词的过去状态",
      explanationZh: "词干后接「でした」；不能像い形容词一样变成「かったです」。",
      sourceExcerpt: naAdjectivePastSource,
    });
    changed = true;
  }

  for (const request of extractExplicitGrammarRequests(userTexts)) {
    const normalizedGrammar = normalizeGrammarForm(request.surfaceForm);
    const matchingItems = learningItems.filter(
      (item) =>
        item.kind === "grammar" &&
        normalizeGrammarForm(item.surfaceForm) === normalizedGrammar
    );
    if (matchingItems.length > 0) {
      const preferred = matchingItems[0];
      learningItems = learningItems.filter(
        (item) =>
          item.kind !== "grammar" ||
          normalizeGrammarForm(item.surfaceForm) !== normalizedGrammar
      );
      learningItems.unshift({
        ...preferred,
        surfaceForm: request.surfaceForm,
        reading: null,
        sourceExcerpt: request.sourceExcerpt,
      });
      changed =
        changed ||
        matchingItems.length > 1 ||
        preferred.surfaceForm !== request.surfaceForm ||
        preferred.reading !== null ||
        preferred.sourceExcerpt !== request.sourceExcerpt;
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

  const explicitVocabularyRequests = extractExplicitVocabularyRequests(
    userTexts,
    assistantTexts
  );
  if (explicitVocabularyRequests.length > 0) {
    const requestedSurfaces = new Set(
      explicitVocabularyRequests.map((request) =>
        request.surfaceForm.normalize("NFKC").toLowerCase()
      )
    );
    const requestedVocabularyOnly = learningItems.filter(
      (item) =>
        item.kind !== "vocabulary" ||
        requestedSurfaces.has(item.surfaceForm.normalize("NFKC").toLowerCase())
    );
    if (requestedVocabularyOnly.length !== learningItems.length) {
      learningItems = requestedVocabularyOnly;
      changed = true;
    }
  }

  for (const request of explicitVocabularyRequests) {
    const normalizedSurface = request.surfaceForm
      .normalize("NFKC")
      .toLowerCase();
    if (
      learningItems.some(
        (item) =>
          item.kind === "vocabulary" &&
          item.surfaceForm.normalize("NFKC").toLowerCase() === normalizedSurface
      )
    ) {
      continue;
    }
    learningItems.unshift({
      kind: "vocabulary",
      surfaceForm: request.surfaceForm,
      reading: null,
      meaningZh: request.meaningZh,
      explanationZh: "用户在本轮明确询问了这个词的中文含义。",
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
