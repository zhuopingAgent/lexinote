import type { PracticeVariation } from "@/features/grammar-learning/prompts/practiceGeneration";
import type {
  AIFeedbackIssue,
  GrammarPointDetail,
  PracticeLevel,
  PracticeReferenceAnswer,
} from "@/shared/types/grammar";
import type {
  EvaluatedSentence,
  GeneratedPractice,
} from "@/features/grammar-learning/infrastructure/GrammarAiOutput";

const PRACTICE_LISTENER_FOCI = [
  "根据场景选择一个具体听话对象，例如老师、店员、医生、同事、客户、朋友或家人。",
  "让说话人面对一个比自己更正式的对象，注意礼貌距离。",
  "让说话人面对熟悉对象，避免过度正式，但仍符合目标语体。",
  "让说话人与服务人员或窗口人员沟通，表达要简洁可执行。",
  "让说话人与工作/学校相关对象沟通，表达目的要清楚。",
];

const PRACTICE_INTENT_FOCI = [
  "请求对方做一件具体事情。",
  "说明原因、背景或当前情况。",
  "确认信息、时间、地点或流程。",
  "表达计划、决定、变化或后续安排。",
  "委婉提出问题、担心或不方便之处。",
  "比较两个选择并表达判断。",
  "转述听到的信息或自己的想法。",
];

const PRACTICE_DETAIL_CONSTRAINTS = [
  "加入一个具体时间点或期限。",
  "加入一个具体地点或窗口/房间/店铺等位置。",
  "加入一个具体物品、资料、症状、订单或课程名。",
  "加入一个轻微问题或限制，例如听不清、赶时间、资料不够。",
  "加入一个数量、频率或先后顺序。",
  "加入一个对方已经知道的背景，避免从零解释。",
];

const PRACTICE_OUTPUT_TEXTURES = [
  "像真实会话中的一句话，短而明确。",
  "像手机消息或聊天回复，但必须保持目标语体。",
  "像窗口、客服或店内沟通中的一句请求/说明。",
  "像工作或学校场景里的简短说明。",
  "像练习者在现实生活中马上能复用的一句话。",
];

function pickRandomItem(items: string[]) {
  return items[Math.floor(Math.random() * items.length)] ?? items[0] ?? "";
}
export function buildPracticeVariation(): PracticeVariation {
  return {
    seed: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    listenerFocus: pickRandomItem(PRACTICE_LISTENER_FOCI),
    intentFocus: pickRandomItem(PRACTICE_INTENT_FOCI),
    detailConstraint: pickRandomItem(PRACTICE_DETAIL_CONSTRAINTS),
    outputTexture: pickRandomItem(PRACTICE_OUTPUT_TEXTURES),
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

export function buildFallbackPractice(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  sceneTagLabel?: string;
  registerTag?: string;
  registerTagLabel?: string;
  level: PracticeLevel;
  variation?: PracticeVariation;
}): GeneratedPractice {
  const levelLabel = resolvePracticeLevelLabel(input.level);
  const variation = input.variation ?? buildPracticeVariation();
  const variationSuffix = `本次变化：${variation.intentFocus}${variation.detailConstraint}${variation.outputTexture}`;

  if (isHospitalPoliteMoraemasuCase(input)) {
    return {
      prompt:
        `你在医院听不懂医生的说明，想请医生再说明一遍。请使用「请求、许可与建议」分类中的「〜てもらえますか」造一句自然的日语句子。当前等级：${levelLabel}。${variationSuffix}`,
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
  const comparisonSet = input.grammarPoint.comparisonSets[0];
  const comparisonMembers = comparisonSet?.members
    .filter((member) => member.grammarPointId !== input.grammarPoint.id)
    .map((member) => member.grammarPoint)
    .join("、");
  const similarGrammarText =
    comparisonMembers ||
    input.grammarPoint.similarGrammar[0]?.similarGrammarPointText ||
    "相近表达";
  const comparisonRule = comparisonSet?.decisionRules[0]?.explanationZh;
  const chineseCue =
    example?.zh ?? input.grammarPoint.naturalTranslation ?? input.grammarPoint.coreMeaning;
  const promptByLevel: Record<PracticeLevel, string> = {
    1: `请参考下面的答案结构，替换人物、地点或时间，在「${scene}」场景中用「${input.grammarPoint.grammarPoint}」写一句「${register}」语体的日语。重点是接续正确。${variationSuffix}`,
    2: `你正在「${scene}」场景里和别人沟通。请设定一个具体听话对象和表达目的，用「${category}」分类中的「${input.grammarPoint.grammarPoint}」写一句能直接说出口的「${register}」语体日语。${variationSuffix}`,
    3: `请把中文意图「${chineseCue}」改成自然日语。不要直译中文语序，必须使用「${input.grammarPoint.grammarPoint}」，并保持「${scene}」场景和「${register}」语体。${variationSuffix}`,
    4: `请把同一个意思改成「${register}」语体的自然日语，并使用「${input.grammarPoint.grammarPoint}」。注意句尾和称呼不要混用随便体、礼貌体和商务表达。${variationSuffix}`,
    5: `请在「${scene}」场景中用「${input.grammarPoint.grammarPoint}」写一句「${register}」语体的日语，并特别注意不要和「${similarGrammarText}」混淆。${comparisonRule ? `判断依据：${comparisonRule}` : "句子要体现目标语法自己的用法边界。"}${variationSuffix}`,
  };

  return {
    prompt: `${promptByLevel[input.level]}当前等级：${levelLabel}。`,
    referenceAnswers: buildFallbackReferenceAnswers(input.grammarPoint),
    hints: [
      `练习等级：${levelLabel}`,
      `变化要求：${variation.listenerFocus}`,
      `核心意思：${input.grammarPoint.coreMeaning}`,
      input.grammarPoint.connections[0]
        ? `接续结构：${input.grammarPoint.connections[0].pattern}`
        : input.grammarPoint.structure
          ? `接续结构：${input.grammarPoint.structure}`
          : "先确认前后接续是否自然。",
    ],
    source: "fallback",
  };
}

export function buildFallbackFeedback(input: {
  grammarPoint: GrammarPointDetail;
  sentence: string;
  sceneTag?: string;
  registerTag?: string;
  promptText?: string;
}): EvaluatedSentence {
  if (isHospitalPoliteMoraemasuCase(input)) {
    const explanation =
      "意思可以理解，目标语法也接近正确，但「もらえる？」对医生有点太随便。医院场景建议用「もらえますか」或更礼貌的「いただけますか」。";
    const correction = "すみません、もう一度説明していただけますか。";
    const nextHint = "先用「すみません」缓冲，再把请求句尾改成礼貌形。";

    return {
      isCorrect: false,
      grammarScore: 4,
      meaningScore: 4,
      naturalnessScore: 3,
      registerScore: 2,
      sceneFitScore: 3,
      issues: [
        {
          errorTypeCode: "register_mismatch",
          severity: "high",
          explanation: "对医生使用「もらえる？」礼貌度不足。",
          correction,
          relatedGrammarPointId: input.grammarPoint.id,
        },
      ],
      explanation,
      nextHint,
      feedbackText: explanation,
      correctedSentence: correction,
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
      mistakeTypes: ["register_mismatch"],
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
  const referenceCorrection = input.grammarPoint.examples[0]?.jp ?? "";
  const issues: AIFeedbackIssue[] = [];

  if (!usesPattern && !hasConnectionIssue) {
    issues.push({
      errorTypeCode: "semantic_error",
      severity: "high",
      explanation: "句子没有清楚表达目标语法的具体用法。",
      correction: referenceCorrection,
      relatedGrammarPointId: input.grammarPoint.id,
    });
  }
  if (hasConnectionIssue) {
    issues.push({
      errorTypeCode: "connection_error",
      severity: "high",
      explanation: "目标表达前需要使用正确的て形接续。",
      correction: referenceCorrection,
      relatedGrammarPointId: input.grammarPoint.id,
    });
  }
  if (isTenseMismatch) {
    issues.push({
      errorTypeCode: "tense_aspect_error",
      severity: "high",
      explanation: "过去时间词与句末的非过去形式不一致。",
      correction: referenceCorrection,
      relatedGrammarPointId: input.grammarPoint.id,
    });
  }
  if (isCasualMismatch) {
    issues.push({
      errorTypeCode: "register_mismatch",
      severity: "high",
      explanation: "当前句尾比目标场景要求的语体更随便。",
      correction: referenceCorrection,
      relatedGrammarPointId: input.grammarPoint.id,
    });
  }
  if (hasUnnaturalExpression) {
    issues.push({
      errorTypeCode: "unnatural_expression",
      severity: "medium",
      explanation: "句子过短或表达不完整，缺少可判断的具体内容。",
      correction: referenceCorrection,
      relatedGrammarPointId: input.grammarPoint.id,
    });
  }
  const mistakeTypes = issues.map((issue) => issue.errorTypeCode);
  const hasMistake = issues.length > 0;
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

  const nextHint = hasMistake
    ? `先按「${input.grammarPoint.connections[0]?.pattern ?? input.grammarPoint.structure ?? input.grammarPoint.grammarPoint}」检查接续，再确认场景语体。`
    : "保持同一语法点，换一个说话对象继续练习。";

  return {
    isCorrect: !hasMistake,
    grammarScore: usesPattern && !hasConnectionIssue ? 4 : 2,
    meaningScore: usesPattern ? 4 : 2,
    naturalnessScore: hasMistake ? 3 : 4,
    registerScore: isCasualMismatch ? 2 : 4,
    sceneFitScore: 4,
    issues,
    explanation: feedbackText,
    nextHint,
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
