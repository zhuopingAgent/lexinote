import type { GrammarPointDetail, PracticeReferenceAnswer } from "@/shared/types/grammar";
import type { PracticeExerciseOption } from "@/shared/types/practice";
import {
  buildAnswerContract,
  buildEmptyGenerationMetadata,
  validatePracticeItemV2,
} from "@/features/grammar-learning/domain/practiceGenerationV2";
import type {
  PracticeHint,
  PracticeIntent,
  PracticeItemV2,
} from "@/features/grammar-learning/domain/practiceV2";
import { findPracticeSpecialization } from "@/features/grammar-learning/domain/practiceSpecializations";
import { toActivePracticeIntent } from "@/features/grammar-learning/domain/practiceFormats";

export type FallbackSupport = {
  id: string;
  canonicalForms: string[];
  supportedExerciseTypes: PracticeIntent["exerciseType"][];
  supportedScenarios: string[];
  supportedRegisters: Array<"casual" | "polite" | "business">;
  validatedTemplates: string[];
  knownMisconceptions: string[];
  validatedReferenceAnswers: string[];
  requiredGrammarFeatures: string[];
};

export const PRACTICE_FALLBACK_SUPPORT_MATRIX: FallbackSupport[] = [
  {
    id: "existence",
    canonicalForms: ["Aがあります", "Aがいます"],
    supportedExerciseTypes: ["meaning_choice", "guided_translation"],
    supportedScenarios: ["daily_life", "workplace", "shopping", "transportation"],
    supportedRegisters: ["polite"],
    validatedTemplates: ["existence-location", "existence-count"],
    knownMisconceptions: ["particle_error", "semantic_error"],
    validatedReferenceAnswers: ["駅の近くにコンビニが一軒あります。", "教室に学生がいます。"],
    requiredGrammarFeatures: ["location-ni", "subject-ga", "existence-predicate"],
  },
  {
    id: "hospital-polite-request",
    canonicalForms: ["〜てもらえますか"],
    supportedExerciseTypes: ["meaning_choice", "guided_translation"],
    supportedScenarios: ["hospital"],
    supportedRegisters: ["polite", "business"],
    validatedTemplates: ["hospital-repeat-request", "workplace-confirmation-request"],
    knownMisconceptions: ["register_mismatch", "giving_receiving_direction_error"],
    validatedReferenceAnswers: ["すみません、もう一度説明していただけますか。", "もう一度説明してもらえますか。"],
    requiredGrammarFeatures: ["te-form-request", "listener-benefit-direction"],
  },
  {
    id: "formal-request",
    canonicalForms: ["〜ていただけますか", "〜てください"],
    supportedExerciseTypes: ["meaning_choice"],
    supportedScenarios: ["hospital", "workplace", "school", "customer_service"],
    supportedRegisters: ["polite", "business"],
    validatedTemplates: ["closed-meaning-from-verified-content"],
    knownMisconceptions: ["register_mismatch", "giving_receiving_direction_error"],
    validatedReferenceAnswers: [],
    requiredGrammarFeatures: ["target-sense"],
  },
  {
    id: "core-forms-and-contrast",
    canonicalForms: [
      "AはBです",
      "は",
      "が",
      "に",
      "で",
      "て形",
      "〜ている",
      "〜たら",
      "〜ば",
      "〜と",
      "〜なら",
      "〜から",
      "〜ので",
      "〜そうだ",
      "〜らしい",
      "〜てくれる",
      "〜てもらう",
      "〜てあげる",
      "〜ております",
      "不安を抱く",
      "そのため",
      "一方で",
    ],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice"],
    supportedScenarios: ["daily_life", "hospital", "workplace", "school"],
    supportedRegisters: ["casual", "polite", "business"],
    validatedTemplates: ["closed-meaning", "closed-connection", "normalized-comparison"],
    knownMisconceptions: ["connection_error", "particle_error", "semantic_error", "tense_aspect_error"],
    validatedReferenceAnswers: [],
    requiredGrammarFeatures: ["target-sense", "structured-connection"],
  },
  {
    id: "safe-example-closure",
    canonicalForms: ["*"],
    supportedExerciseTypes: ["meaning_choice"],
    supportedScenarios: ["*"],
    supportedRegisters: ["casual", "polite", "business"],
    validatedTemplates: ["closed-meaning-from-verified-content", "closed-connection-from-verified-content"],
    knownMisconceptions: ["semantic_error", "connection_error"],
    validatedReferenceAnswers: [],
    requiredGrammarFeatures: ["target-sense"],
  },
];

function references(grammarPoint: GrammarPointDetail): PracticeReferenceAnswer[] {
  return grammarPoint.examples.slice(0, 2).map((example) => ({
    jp: example.jp,
    zh: example.zh ?? grammarPoint.naturalTranslation ?? grammarPoint.coreMeaning,
    noteZh: example.notes ?? `自然使用「${grammarPoint.grammarPoint}」的表达。`,
  }));
}

function hints(intent: PracticeIntent, grammarPoint: GrammarPointDetail): PracticeHint[] {
  const emphasis = findPracticeSpecialization(intent.specializationId)?.hintEmphasis
    .slice(0, 2)
    .join("、");
  if (intent.answerPolicy.responseMode === "choice") {
    return [
      {
        level: "semantic_hint",
        content: `先用自己的话概括「${grammarPoint.grammarPoint}」在当前用法中的核心意思，再逐项核对。`,
        revealsForm: false,
        revealsAnswer: false,
      },
      {
        level: "form_hint",
        content: "排除只描述其他语法功能、对象类型或使用条件的选项。",
        revealsForm: false,
        revealsAnswer: false,
      },
    ];
  }
  return [
    {
      level: "semantic_hint",
      content: emphasis
        ? `先把中文意图拆成“谁、做什么、对谁或在哪里”，并留意：${emphasis}。`
        : `先确认这句话要表达的关系：${grammarPoint.coreMeaning}`,
      revealsForm: false,
      revealsAnswer: false,
    },
    { level: "form_hint", content: `再按这个结构组织句子：${grammarPoint.connections[0]?.pattern ?? grammarPoint.structure ?? "查看语法说明中的接续"}`, revealsForm: true, revealsAnswer: false },
  ];
}

function base(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
  degradationReason?: string | null;
}) {
  const answerContract = buildAnswerContract(input);
  return {
    id: `fallback-${input.intent.targetGrammarPointId}-${input.intent.blueprintId}`,
    intent: input.intent,
    instructionZh: "根据题目完成这一步练习。",
    context: input.intent.context,
    referenceAnswers: references(input.grammarPoint),
    answerContract,
    rubric: {
      primaryDimension: answerContract.assessedDimensions[0] ?? "grammar",
      assessedDimensions: answerContract.assessedDimensions,
      scoringNotes: input.intent.requiredEvidence,
    },
    hints: hints(input.intent, input.grammarPoint),
    generationMetadata: buildEmptyGenerationMetadata({
      generationSource: "fallback",
      fallbackReason: input.fallbackReason,
      degradationReason: input.degradationReason ?? null,
    }),
  };
}

function requiredFeaturesForItem(
  support: FallbackSupport,
  referenceAnswers: PracticeReferenceAnswer[]
) {
  const references = referenceAnswers.map((answer) => answer.jp);
  return support.requiredGrammarFeatures.filter((feature) => {
    if (feature === "location-ni") {
      return references.some((sentence) =>
        /に[^。？！!?]*(?:が|は)[^。？！!?]*(?:あります|います)/.test(sentence)
      );
    }
    if (feature === "subject-ga") {
      return references.some((sentence) =>
        /が[^。？！!?]*(?:あります|います)/.test(sentence)
      );
    }
    return true;
  });
}

function choices(labels: string[], correctIndex = 0) {
  const unique = Array.from(new Set(labels.filter(Boolean))).slice(0, 4);
  const options: PracticeExerciseOption[] = unique.map((label, index) => ({ id: `option-${index + 1}`, label }));
  return { options, correctChoiceId: options[correctIndex]?.id ?? options[0]?.id ?? "option-1" };
}

function meaningFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
  degradationReason?: string | null;
}): PracticeItemV2 {
  const siblingMeanings = input.grammarPoint.formSiblings.map((sibling) => sibling.coreMeaning);
  const canonical = input.grammarPoint.canonicalForm ?? input.grammarPoint.grammarPoint;
  const knownDistractors: Record<string, string[]> = {
    "Aがあります": [
      "某处有人或动物",
      "某事物发生了变化",
      "把某事物设定为某种状态",
    ],
    "Aがいます": [
      "某处有物品、设施等无生命事物",
      "某事物发生了变化",
      "把某事物设定为某种状态",
    ],
    "AはBです": [
      "某处存在B",
      "A发生了变化并成为B",
      "把A决定或设定为B",
    ],
  };
  const fallbackDistractors = knownDistractors[canonical] ?? [
    "表示前项是后项发生的原因",
    "表示从他人处听到的信息",
    "表示某个条件成立后的结果",
  ];
  const choiceData = choices([
    input.grammarPoint.coreMeaning,
    ...siblingMeanings,
    ...fallbackDistractors,
  ]);
  const root = base(input);
  return {
    ...root,
    exerciseType: "meaning_choice",
    prompt: `在当前学习的具体用法中，「${input.grammarPoint.grammarPoint}」最符合哪项说明？`,
    choices: choiceData.options,
    correctChoiceId: choiceData.correctChoiceId,
    distractorReasons: Object.fromEntries(
      choiceData.options
        .filter((option) => option.id !== choiceData.correctChoiceId)
        .map((option) => [
          option.id,
          canonical === "Aがあります" && option.label.includes("有人或动物")
            ? "人和动物的存在通常用「います」，这里学习的是无生命事物的存在。"
            : canonical === "Aがいます" && option.label.includes("无生命")
              ? "物品和设施等无生命事物通常用「あります」。"
              : `「${option.label}」不是这个具体用法表达的核心意思。`,
        ])
    ),
  };
}

function formChoiceFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 | null {
  const connection = input.grammarPoint.connections[0];
  if (!connection) return null;
  const choiceData = choices([
    connection.pattern,
    `辞书形 + ${input.grammarPoint.grammarPoint.replace(/^〜/, "")}`,
    `ます形 + ${input.grammarPoint.grammarPoint.replace(/^〜/, "")}`,
    `名词 + ${input.grammarPoint.grammarPoint.replace(/^〜/, "")}`,
  ]);
  const degradedIntent: PracticeIntent = {
    ...input.intent,
    blueprintId: "contrast_choice",
    exerciseType: "contrast_choice",
    cognitiveOperation: "select",
    scaffoldLevel: "options",
    answerPolicy: { ...input.intent.answerPolicy, responseMode: "choice", requireExactChoice: true, allowEquivalentAnswers: false },
  };
  const root = base({ ...input, intent: degradedIntent, degradationReason: `从${input.intent.exerciseType}降级为封闭接续选择` });
  return {
    ...root,
    exerciseType: "contrast_choice",
    prompt: `哪一种接续方式符合「${input.grammarPoint.grammarPoint}」当前学习的具体用法？`,
    choices: choiceData.options,
    correctChoiceId: choiceData.correctChoiceId,
    distractorReasons: Object.fromEntries(
      choiceData.options.filter((option) => option.id !== choiceData.correctChoiceId).map((option) => [option.id, "不符合结构化接续条件。"])
    ),
  };
}

function comparisonChoiceFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 | null {
  const comparison = input.grammarPoint.comparisonSets.find(
    (set) => set.members.length >= 2 && set.decisionRules.length > 0
  );
  if (!comparison) return null;
  const rule = comparison.decisionRules[0];
  const preferredIndex = Math.max(0, rule.preferredMemberPosition - 1);
  const choiceData = choices(
    comparison.members.map((member) => member.grammarPoint),
    preferredIndex
  );
  const pair = comparison.minimalPairExamples.find((candidate) =>
    candidate.sentences.some(
      (sentence) => sentence.memberPosition === rule.preferredMemberPosition
    )
  );
  const pairReferences = pair?.sentences
    .filter((sentence) => sentence.memberPosition === rule.preferredMemberPosition)
    .map((sentence) => ({
      jp: sentence.jp,
      zh: sentence.zh,
      noteZh: sentence.notesZh ?? pair.explanationZh,
    }));
  if (!pairReferences?.length) return null;
  const root = base(input);
  return {
    ...root,
    referenceAnswers: pairReferences,
    exerciseType: "contrast_choice",
    prompt: `${rule.conditionZh}请选择最合适的表达。`,
    choices: choiceData.options,
    correctChoiceId: choiceData.correctChoiceId,
    distractorReasons: Object.fromEntries(
      choiceData.options
        .filter((option) => option.id !== choiceData.correctChoiceId)
        .map((option) => [option.id, rule.explanationZh])
    ),
  };
}

function hospitalTranslationFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 {
  const root = base(input);
  const answer = {
    jp: "すみません、もう一度説明してもらえますか。",
    zh: "不好意思，能请您再说明一遍吗？",
    noteZh: "使用目标语法完成一般礼貌请求。",
  };
  const chineseSentence = "不好意思，我没听清楚，能请您再说明一遍吗？";
  return {
    ...root,
    referenceAnswers: [answer],
    answerContract: {
      ...root.answerContract,
      allowedVariants: [answer.jp],
      requiredMeaningSlots: [chineseSentence],
    },
    exerciseType: "guided_translation",
    instructionZh: "请把完整中文句子翻译成适合当前场景的自然日语。",
    prompt: `你正在医院向医生提出请求。请把下面这句中文翻译成自然日语：“${chineseSentence}”`,
    chineseSentence,
  };
}

function verifiedExampleTranslationFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 | null {
  const example = input.grammarPoint.examples.find(
    (candidate) =>
      candidate.sceneTag?.nameEn === input.intent.context.sceneSlug &&
      Boolean(candidate.zh)
  ) ?? input.grammarPoint.examples.find((candidate) => Boolean(candidate.zh));
  if (!example?.zh) return null;
  const chineseSentence = /[。？！!?]$/.test(example.zh)
    ? example.zh
    : `${example.zh}。`;
  const reference = {
    jp: example.jp,
    zh: chineseSentence,
    noteZh: example.notes ?? "使用经过验证的语法例句。",
  };
  const root = base({
    ...input,
    degradationReason: "使用经过验证的例句生成封闭中译日",
  });
  return {
    ...root,
    exerciseType: "guided_translation",
    instructionZh: "请把完整中文句子翻译成自然日语。",
    prompt: `请把下面这句中文翻译成自然日语：“${chineseSentence}”`,
    chineseSentence,
    referenceAnswers: [reference],
    answerContract: {
      ...root.answerContract,
      allowedVariants: [reference.jp],
      requiredMeaningSlots: [chineseSentence],
    },
  };
}

function existenceTranslationFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 {
  const detail = input.intent.context.requiredDetail;
  const content = detail.includes("两次")
    ? { zh: "这周还有两次会议。", jp: "今週は会議があと二回あります。" }
    : detail.includes("车站")
      ? { zh: "车站附近有一家便利店。", jp: "駅の近くにコンビニが一軒あります。" }
      : { zh: "今天下班前还有一场会议。", jp: "今日、仕事が終わる前にもう一つ会議があります。" };
  const root = base(input);
  const answer = { jp: content.jp, zh: content.zh, noteZh: "地点用「に」，存在对象用「が」。" };
  return {
    ...root,
    referenceAnswers: [answer],
    answerContract: { ...root.answerContract, allowedVariants: [answer.jp], requiredMeaningSlots: [content.zh] },
    exerciseType: "guided_translation",
    instructionZh: "请把完整中文句子翻译成自然日语。",
    prompt: `请把下面这句中文翻译成自然日语：“${content.zh}”`,
    chineseSentence: content.zh,
  };
}

function buildLocalFallbackV2ForActiveIntent(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 {
  const canonical = input.grammarPoint.canonicalForm ?? input.grammarPoint.grammarPoint;
  const declaredSupport = fallbackSupportFor(input.grammarPoint);
  const isDeclaredSupported =
    declaredSupport.supportedExerciseTypes.includes(input.intent.exerciseType) &&
    (declaredSupport.supportedScenarios.includes("*") ||
      declaredSupport.supportedScenarios.includes(input.intent.context.sceneSlug)) &&
    declaredSupport.supportedRegisters.includes(input.intent.context.registerPreset);
  let item: PracticeItemV2;
  if (
    isDeclaredSupported &&
    input.intent.exerciseType === "guided_translation" &&
    input.intent.context.sceneSlug === "hospital" &&
    input.grammarPoint.grammarPoint === "〜てもらえますか"
  ) {
    item = hospitalTranslationFallback(input);
  } else if (
    isDeclaredSupported &&
    input.intent.exerciseType === "guided_translation" &&
    canonical === "Aがあります"
  ) {
    item = existenceTranslationFallback(input);
  } else if (isDeclaredSupported && input.intent.exerciseType === "contrast_choice") {
    item = comparisonChoiceFallback(input) ?? meaningFallback({
      ...input,
      degradationReason: "缺少已验证的最小对比例句，降级为封闭意义确认",
      intent: {
        ...input.intent,
        blueprintId: "meaning_choice",
        exerciseType: "meaning_choice",
        cognitiveOperation: "recognize",
        scaffoldLevel: "options",
        transferLevel: "reproduction",
        answerPolicy: {
          ...input.intent.answerPolicy,
          responseMode: "choice",
          requireExactChoice: true,
          allowEquivalentAnswers: false,
        },
      },
    });
  } else if (input.intent.learningObjective === "form_connection") {
    item = formChoiceFallback(input) ?? meaningFallback({
      ...input,
      degradationReason: "缺少结构化接续，降级为封闭意义确认",
      intent: {
        ...input.intent,
        blueprintId: "meaning_choice",
        exerciseType: "meaning_choice",
        cognitiveOperation: "recognize",
        scaffoldLevel: "options",
        transferLevel: "reproduction",
        answerPolicy: {
          ...input.intent.answerPolicy,
          responseMode: "choice",
          requireExactChoice: true,
          allowEquivalentAnswers: false,
        },
      },
    });
  } else if (input.intent.exerciseType === "guided_translation") {
    item = verifiedExampleTranslationFallback(input) ?? meaningFallback({
      ...input,
      degradationReason: "缺少可直接翻译的已验证例句，降级为封闭意义确认",
      intent: {
        ...input.intent,
        blueprintId: "meaning_choice",
        exerciseType: "meaning_choice",
        cognitiveOperation: "recognize",
        scaffoldLevel: "options",
        transferLevel: "reproduction",
        answerPolicy: {
          ...input.intent.answerPolicy,
          responseMode: "choice",
          requireExactChoice: true,
          allowEquivalentAnswers: false,
        },
      },
    });
  } else {
    const degradedIntent: PracticeIntent = input.intent.exerciseType === "meaning_choice"
      ? input.intent
      : {
          ...input.intent,
          blueprintId: "meaning_choice",
          exerciseType: "meaning_choice",
          cognitiveOperation: "recognize",
          scaffoldLevel: "options",
          transferLevel: "reproduction",
          answerPolicy: { ...input.intent.answerPolicy, responseMode: "choice", requireExactChoice: true, allowEquivalentAnswers: false },
        };
    item = meaningFallback({ ...input, intent: degradedIntent, degradationReason: input.intent.exerciseType === "meaning_choice" ? null : `从${input.intent.exerciseType}降级为已验证封闭题` });
  }

  item.answerContract = {
    ...item.answerContract,
    requiredGrammarFeatures: Array.from(new Set([
      ...item.answerContract.requiredGrammarFeatures,
      ...requiredFeaturesForItem(fallbackSupportFor(input.grammarPoint), item.referenceAnswers),
    ])),
  };
  const validation = validatePracticeItemV2(item, input.grammarPoint);
  item.generationMetadata.validationResults = validation.results;
  if (!validation.valid) {
    throw new Error(`Validated fallback failed: ${validation.errorCodes.join(",")}`);
  }
  return item;
}

export function buildLocalFallbackV2(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 {
  return buildLocalFallbackV2ForActiveIntent({
    ...input,
    intent: toActivePracticeIntent(
      input.intent,
      input.grammarPoint.comparisonSets.some((set) => set.members.length >= 2)
    ),
  });
}

export function fallbackSupportFor(grammarPoint: GrammarPointDetail) {
  const canonical = grammarPoint.canonicalForm ?? grammarPoint.grammarPoint;
  return PRACTICE_FALLBACK_SUPPORT_MATRIX.find((entry) => entry.canonicalForms.includes(canonical)) ??
    PRACTICE_FALLBACK_SUPPORT_MATRIX[PRACTICE_FALLBACK_SUPPORT_MATRIX.length - 1];
}
