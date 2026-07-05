import { buildPracticeGenerationPrompt } from "@/features/grammar-learning/prompts/practiceGeneration";
import { buildSentenceFeedbackPrompt } from "@/features/grammar-learning/prompts/sentenceFeedback";
import type {
  AIFeedbackBetterVersion,
  AIFeedbackResult,
  GrammarPointDetail,
  PracticeLevel,
  PracticeReferenceAnswer,
} from "@/shared/types/api";
import { throwIfOpenAiQuotaExhausted } from "@/shared/utils/ai-api-errors";
import { AiQuotaExhaustedError } from "@/shared/utils/errors";

type OpenAiTextItem = {
  type?: string;
  text?: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAiTextItem[];
  }>;
};

type RawPracticeOutput = {
  task_zh?: unknown;
  reference_answers?: unknown;
  hints?: unknown;
};

type RawFeedbackOutput = {
  is_correct?: unknown;
  grammar_score?: unknown;
  naturalness_score?: unknown;
  register_score?: unknown;
  scene_fit_score?: unknown;
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

const PRACTICE_MAX_OUTPUT_TOKENS = 620;
const FEEDBACK_MAX_OUTPUT_TOKENS = 760;

function resolveModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.4";
}

function buildRequestConfig(maxOutputTokens: number) {
  const model = resolveModel();

  if (model === "gpt-5-mini" || model === "gpt-5-nano") {
    return {
      model,
      max_output_tokens: maxOutputTokens,
      reasoning: {
        effort: "minimal",
      } as const,
    };
  }

  return {
    model,
    max_output_tokens: maxOutputTokens,
  };
}

function extractResponseText(data: OpenAiResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (
    data.output
      ?.flatMap((message) => message.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
}

function extractJsonObject(text: string): unknown | null {
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

function parsePracticeOutput(raw: unknown): Omit<GeneratedPractice, "source"> | null {
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

function parseFeedbackOutput(raw: unknown): Omit<EvaluatedSentence, "source"> | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const parsed = raw as RawFeedbackOutput;
  const feedbackText = sanitizeText(parsed.feedback_text_zh);
  const betterVersions = parseBetterVersions(parsed.better_versions);

  if (!feedbackText) {
    return null;
  }

  return {
    isCorrect: parsed.is_correct === true,
    grammarScore: clampScore(parsed.grammar_score, 3),
    naturalnessScore: clampScore(parsed.naturalness_score, 3),
    registerScore: clampScore(parsed.register_score, 3),
    sceneFitScore: clampScore(parsed.scene_fit_score, 3),
    feedbackText,
    correctedSentence: sanitizeText(parsed.corrected_sentence) || null,
    betterVersions,
    mistakeTypes: parseStringArray(parsed.mistake_types),
    nextPracticePrompt: sanitizeText(parsed.next_practice_prompt_zh) || null,
    rawAiResponse: raw,
  };
}

function normalizePattern(value: string) {
  return value
    .replace(/[〜~]/g, "")
    .replace(/\s+/g, "")
    .replace(/Vて\+/g, "")
    .trim();
}

function resolveTeFormConnectionCue(grammarPoint: string, structure?: string | null) {
  const normalizedGrammarPoint = normalizePattern(grammarPoint);
  const requiresTeForm =
    normalizedGrammarPoint.startsWith("て") || Boolean(structure?.includes("Vて"));

  if (!requiresTeForm || !normalizedGrammarPoint.startsWith("て")) {
    return "";
  }

  return normalizedGrammarPoint.replace(/^て/, "").replace(/[？?]$/g, "");
}

function isHospitalPoliteMoraemasuCase(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  registerTag?: string;
  sentence?: string;
}) {
  return (
    input.grammarPoint.grammarPoint === "〜てもらえますか" &&
    input.sceneTag === "hospital" &&
    input.registerTag === "polite" &&
    (!input.sentence || input.sentence.includes("もらえる"))
  );
}

function resolveSceneLabel(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  sceneTagLabel?: string;
}) {
  return (
    input.sceneTagLabel ||
    input.grammarPoint.sceneTags.find((tag) => tag.nameEn === input.sceneTag)?.nameZh ||
    input.grammarPoint.sceneTags[0]?.nameZh ||
    "日常生活"
  );
}

function resolveRegisterLabel(input: {
  grammarPoint: GrammarPointDetail;
  registerTag?: string;
  registerTagLabel?: string;
}) {
  return (
    input.registerTagLabel ||
    input.grammarPoint.registerTags.find((tag) => tag.nameEn === input.registerTag)
      ?.nameZh ||
    input.grammarPoint.registerTags[0]?.nameZh ||
    "一般礼貌"
  );
}

function resolveCategoryPath(grammarPoint: GrammarPointDetail) {
  return [grammarPoint.categoryGroupNameZh, grammarPoint.categoryNameZh]
    .filter((item): item is string => Boolean(item))
    .join(" / ") || "文法";
}

const PRACTICE_LEVEL_LABELS: Record<PracticeLevel, string> = {
  1: "模仿造句",
  2: "场景造句",
  3: "中译日",
  4: "语体转换",
  5: "易混语法对比",
};

function rethrowAiQuotaError(error: unknown) {
  if (error instanceof AiQuotaExhaustedError) {
    throw error;
  }
}

function resolvePracticeLevelLabel(level: PracticeLevel) {
  return `${level} ${PRACTICE_LEVEL_LABELS[level]}`;
}

function buildFallbackReferenceAnswers(
  grammarPoint: GrammarPointDetail
): PracticeReferenceAnswer[] {
  const answers = grammarPoint.examples.slice(0, 2).map((example) => ({
    jp: example.jp,
    zh: example.zh ?? "自然使用目标语法的例句。",
    noteZh: example.notes ?? "参考当前语法点中更自然的例句。",
  }));

  if (answers.length > 0) {
    return answers;
  }

  return [
    {
      jp: `${normalizePattern(grammarPoint.grammarPoint)}を使って、自然な文を作ってください。`,
      zh: "请用目标语法造一个自然句子。",
      noteZh: "先确认目标语法的接续，再放进具体场景。",
    },
  ];
}

function hasPastTimeMismatch(input: {
  grammarPoint: GrammarPointDetail;
  sentence: string;
}) {
  const isTenseFocused =
    input.grammarPoint.categorySlug === "tense_and_negation" ||
    input.grammarPoint.categorySlug === "tense_errors" ||
    input.grammarPoint.categoryGroupSlug === "morphology_conjugation_tense_aspect";
  const hasPastTimeCue = /(昨日|先週|先月|去年|さっき|先ほど|この前|以前)/.test(
    input.sentence
  );
  const hasPastForm = /(ました|でした|かった|だった|なかった|ませんでした|た[。！？!?、\s]|だ[。！？!?、\s])/.test(
    input.sentence
  );
  const hasNonPastPoliteEnding = /(ます|です)(。|！|？|!|\?|$)/.test(input.sentence);

  return isTenseFocused && hasPastTimeCue && hasNonPastPoliteEnding && !hasPastForm;
}

function buildFallbackPractice(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  sceneTagLabel?: string;
  registerTag?: string;
  registerTagLabel?: string;
  level: PracticeLevel;
}): GeneratedPractice {
  const levelLabel = resolvePracticeLevelLabel(input.level);

  if (isHospitalPoliteMoraemasuCase(input)) {
    return {
      prompt:
        `你在医院听不懂医生的说明，想请医生再说明一遍。请使用「请求、许可与建议」分类中的「〜てもらえますか」造一句自然的日语句子。当前等级：${levelLabel}。`,
      referenceAnswers: [
        {
          jp: "すみません、もう一度説明してもらえますか。",
          zh: "不好意思，可以请您再说明一遍吗？",
          noteZh: "一般礼貌表达，可以用于医院。",
        },
        {
          jp: "すみません、もう一度説明していただけますか。",
          zh: "不好意思，能否请您再说明一遍？",
          noteZh: "更礼貌，更适合对医生、老师、客户或上司说。",
        },
      ],
      hints: [
        `练习等级：${levelLabel}`,
        "先用すみません缓冲。",
        "对医生说话时，句尾不要用太随便的「もらえる？」。",
      ],
      source: "fallback",
    };
  }

  const example = input.grammarPoint.examples[0];
  const scene = resolveSceneLabel(input);
  const register = resolveRegisterLabel(input);
  const category = resolveCategoryPath(input.grammarPoint);
  const similarGrammarText =
    input.grammarPoint.similarGrammar[0]?.similarGrammarPointText ?? "相近表达";
  const chineseCue =
    example?.zh ?? input.grammarPoint.naturalTranslation ?? input.grammarPoint.coreMeaning;
  const promptByLevel: Record<PracticeLevel, string> = {
    1: `请参考下面的答案结构，替换人物、地点或时间，在「${scene}」场景中用「${input.grammarPoint.grammarPoint}」写一句「${register}」语体的日语。重点是接续正确。`,
    2: `你正在「${scene}」场景里和别人沟通。请设定一个具体听话对象和表达目的，用「${category}」分类中的「${input.grammarPoint.grammarPoint}」写一句能直接说出口的「${register}」语体日语。`,
    3: `请把中文意图「${chineseCue}」改成自然日语。不要直译中文语序，必须使用「${input.grammarPoint.grammarPoint}」，并保持「${scene}」场景和「${register}」语体。`,
    4: `请把同一个意思改成「${register}」语体的自然日语，并使用「${input.grammarPoint.grammarPoint}」。注意句尾和称呼不要混用随便体、礼貌体和商务表达。`,
    5: `请在「${scene}」场景中用「${input.grammarPoint.grammarPoint}」写一句「${register}」语体的日语，并特别注意不要和「${similarGrammarText}」混淆。句子要体现目标语法自己的用法边界。`,
  };

  return {
    prompt: `${promptByLevel[input.level]}当前等级：${levelLabel}。`,
    referenceAnswers: buildFallbackReferenceAnswers(input.grammarPoint),
    hints: [
      `练习等级：${levelLabel}`,
      `核心意思：${input.grammarPoint.coreMeaning}`,
      input.grammarPoint.structure
        ? `接续结构：${input.grammarPoint.structure}`
        : "先确认前后接续是否自然。",
    ],
    source: "fallback",
  };
}

function buildFallbackFeedback(input: {
  grammarPoint: GrammarPointDetail;
  sentence: string;
  sceneTag?: string;
  registerTag?: string;
  promptText?: string;
}): EvaluatedSentence {
  if (isHospitalPoliteMoraemasuCase(input)) {
    return {
      isCorrect: false,
      grammarScore: 4,
      naturalnessScore: 3,
      registerScore: 2,
      sceneFitScore: 3,
      feedbackText:
        "意思可以理解，目标语法也接近正确，但「もらえる？」对医生有点太随便。医院场景建议用「もらえますか」或更礼貌的「いただけますか」。",
      correctedSentence: "すみません、もう一度説明していただけますか。",
      betterVersions: [
        {
          sentence: "すみません、もう一度説明してもらえますか。",
          registerTag: "polite",
          explanationZh: "一般礼貌表达，可以用于医院。",
        },
        {
          sentence: "すみません、もう一度説明していただけますか。",
          registerTag: "business",
          explanationZh: "更礼貌，更适合对医生、老师、客户或上司说。",
        },
      ],
      mistakeTypes: ["wrong_register"],
      nextPracticePrompt: "请用更礼貌的表达，请店员再说明一次退货流程。",
      source: "fallback",
    };
  }

  const normalizedPattern = normalizePattern(input.grammarPoint.grammarPoint);
  const usesPattern =
    normalizedPattern.length === 1
      ? input.sentence.includes(normalizedPattern)
      : input.sentence.includes(normalizedPattern.replace(/[かですます]+$/g, "")) ||
        input.sentence.includes(normalizedPattern);
  const teFormConnectionCue = resolveTeFormConnectionCue(
    input.grammarPoint.grammarPoint,
    input.grammarPoint.structure
  );
  const hasConnectionIssue =
    !usesPattern &&
    Boolean(teFormConnectionCue) &&
    input.sentence.includes(teFormConnectionCue);
  const isCasualMismatch =
    input.registerTag &&
    input.registerTag !== "casual" &&
    /だよ|だね|かな|かも|もらえる[？?]?$/.test(input.sentence);
  const isTenseMismatch = hasPastTimeMismatch(input);
  const hasUnnaturalExpression = input.sentence.length < 7;
  const mistakeTypes = [
    !usesPattern && !hasConnectionIssue ? "missing_target_grammar" : null,
    hasConnectionIssue ? "connection_error" : null,
    isTenseMismatch ? "tense_mismatch" : null,
    isCasualMismatch ? "wrong_register" : null,
    hasUnnaturalExpression ? "unnatural_expression" : null,
  ].filter((mistakeType): mistakeType is string => Boolean(mistakeType));
  const hasMistake = mistakeTypes.length > 0;
  const feedbackText = hasMistake
    ? [
        hasConnectionIssue
          ? "目标语法的接续还不稳，先确认是否需要て形连接。"
          : null,
        !usesPattern && !hasConnectionIssue ? "句子里还没有清楚使用目标语法。" : null,
        isTenseMismatch ? "过去时间词和句末时态不匹配，昨日、先週等通常要用过去形。" : null,
        isCasualMismatch ? "当前语体偏随便，需要换成更礼貌的句尾。" : null,
        hasUnnaturalExpression ? "句子过短或表达不完整，建议补足具体场景。" : null,
      ]
        .filter(Boolean)
        .join("")
    : "目标语法使用基本自然，语体也和当前场景大体匹配。可以继续练习更自然的表达变化。";

  return {
    isCorrect: !hasMistake,
    grammarScore: usesPattern && !hasConnectionIssue ? 4 : 2,
    naturalnessScore: hasMistake ? 3 : 4,
    registerScore: isCasualMismatch ? 2 : 4,
    sceneFitScore: 4,
    feedbackText,
    correctedSentence: hasMistake
      ? input.grammarPoint.examples[0]?.jp ?? null
      : null,
    betterVersions:
      input.grammarPoint.examples[0]?.jp && hasMistake
        ? [
            {
              sentence: input.grammarPoint.examples[0].jp,
              registerTag: input.grammarPoint.examples[0].registerTag?.nameEn ?? null,
              explanationZh: "参考当前语法点中更自然的例句。",
            },
          ]
        : [],
    mistakeTypes,
    nextPracticePrompt: hasMistake
      ? `请再用「${input.grammarPoint.grammarPoint}」造一个更符合场景的句子。`
      : `请换一个场景继续使用「${input.grammarPoint.grammarPoint}」造句。`,
    source: "fallback",
  };
}

export class GrammarAiClient {
  async generatePractice(input: {
    grammarPoint: GrammarPointDetail;
    sceneTag?: string;
    sceneTagLabel?: string;
    registerTag?: string;
    registerTagLabel?: string;
    level: PracticeLevel;
  }): Promise<GeneratedPractice> {
    const apiKey = process.env.OPENAI_API_KEY;
    const fallback = buildFallbackPractice(input);

    if (!apiKey) {
      return fallback;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildRequestConfig(PRACTICE_MAX_OUTPUT_TOKENS),
          input: [
            {
              role: "system",
              content:
                "你是日语语法练习生成器。你只返回严格 JSON，不返回 Markdown。",
            },
            {
              role: "user",
              content: buildPracticeGenerationPrompt(input),
            },
          ],
        }),
      });

      await throwIfOpenAiQuotaExhausted(response);

      if (!response.ok) {
        return fallback;
      }

      const data = (await response.json()) as OpenAiResponse;
      const parsed = parsePracticeOutput(extractJsonObject(extractResponseText(data)));

      return parsed
        ? {
            ...parsed,
            source: "ai",
          }
        : fallback;
    } catch (error) {
      rethrowAiQuotaError(error);
      return fallback;
    }
  }

  async evaluateSentence(input: {
    grammarPoint: GrammarPointDetail;
    sentence: string;
    sceneTag?: string;
    sceneTagLabel?: string;
    registerTag?: string;
    registerTagLabel?: string;
    promptText?: string;
  }): Promise<EvaluatedSentence> {
    const apiKey = process.env.OPENAI_API_KEY;
    const fallback = buildFallbackFeedback(input);

    if (!apiKey) {
      return fallback;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildRequestConfig(FEEDBACK_MAX_OUTPUT_TOKENS),
          input: [
            {
              role: "system",
              content:
                "你是日语语法反馈教练。你只返回严格 JSON，不返回 Markdown。",
            },
            {
              role: "user",
              content: buildSentenceFeedbackPrompt(input),
            },
          ],
        }),
      });

      await throwIfOpenAiQuotaExhausted(response);

      if (!response.ok) {
        return fallback;
      }

      const data = (await response.json()) as OpenAiResponse;
      const parsed = parseFeedbackOutput(extractJsonObject(extractResponseText(data)));

      return parsed
        ? {
            ...parsed,
            source: "ai",
            modelName: resolveModel(),
          }
        : fallback;
    } catch (error) {
      rethrowAiQuotaError(error);
      return fallback;
    }
  }
}
