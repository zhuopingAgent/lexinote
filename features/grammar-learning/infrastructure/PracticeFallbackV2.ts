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
    supportedExerciseTypes: ["meaning_choice", "register_rewrite"],
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
  return [
    {
      level: "semantic_hint",
      content: emphasis
        ? `先确认核心意思，并留意：${emphasis}。`
        : `先确认核心意思：${grammarPoint.coreMeaning}`,
      revealsForm: false,
      revealsAnswer: false,
    },
    { level: "form_hint", content: `接续要求：${grammarPoint.connections[0]?.pattern ?? grammarPoint.structure ?? "查看语法说明中的接续"}`, revealsForm: true, revealsAnswer: false },
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
  const choiceData = choices([
    input.grammarPoint.coreMeaning,
    ...siblingMeanings,
    "只改变句子的礼貌程度，不改变意义",
    "只表示动作已经结束",
  ]);
  const root = base(input);
  return {
    ...root,
    exerciseType: "meaning_choice",
    prompt: `在当前学习的具体用法中，「${input.grammarPoint.grammarPoint}」最符合哪项说明？`,
    choices: choiceData.options,
    correctChoiceId: choiceData.correctChoiceId,
    distractorReasons: Object.fromEntries(
      choiceData.options.filter((option) => option.id !== choiceData.correctChoiceId).map((option) => [option.id, "不符合当前具体用法。"])
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

function hospitalRegisterFallback(input: {
  intent: PracticeIntent;
  grammarPoint: GrammarPointDetail;
  fallbackReason: string;
}): PracticeItemV2 {
  const root = base(input);
  const answer = {
    jp: "すみません、もう一度説明していただけますか。",
    zh: "不好意思，能请您再说明一遍吗？",
    noteZh: "对医生使用更郑重、自然的请求。",
  };
  return {
    ...root,
    referenceAnswers: [answer],
    answerContract: { ...root.answerContract, allowedVariants: [answer.jp] },
    exerciseType: "register_rewrite",
    prompt: "你在医院没有听清医生的说明。下面的说法对医生过于随便：「先生、もう一度説明してもらえる？」请保留原意，改成自然礼貌的日语。",
    sourceSentence: "先生、もう一度説明してもらえる？",
    targetRegister: "polite",
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

export function buildLocalFallbackV2(input: {
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
    input.intent.exerciseType === "register_rewrite" &&
    input.intent.context.sceneSlug === "hospital" &&
    input.grammarPoint.grammarPoint === "〜てもらえますか"
  ) {
    item = hospitalRegisterFallback(input);
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

  const validation = validatePracticeItemV2(item, input.grammarPoint);
  item.generationMetadata.validationResults = validation.results;
  if (!validation.valid) {
    throw new Error(`Validated fallback failed: ${validation.errorCodes.join(",")}`);
  }
  return item;
}

export function fallbackSupportFor(grammarPoint: GrammarPointDetail) {
  const canonical = grammarPoint.canonicalForm ?? grammarPoint.grammarPoint;
  return PRACTICE_FALLBACK_SUPPORT_MATRIX.find((entry) => entry.canonicalForms.includes(canonical)) ??
    PRACTICE_FALLBACK_SUPPORT_MATRIX[PRACTICE_FALLBACK_SUPPORT_MATRIX.length - 1];
}
