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
    const canonical = grammarPoint.canonicalForm ?? grammarPoint.grammarPoint;
    if (intent.learningObjective === "form_connection") {
      return [
        {
          level: "semantic_hint",
          content: "先判断目标表达前面需要名词、动词的哪种活用，还是一个完整小句。",
          revealsForm: false,
          revealsAnswer: false,
        },
        {
          level: "form_hint",
          content: `核对接续骨架：${grammarPoint.connections[0]?.pattern ?? grammarPoint.structure ?? "语法说明中的接续"}`,
          revealsForm: true,
          revealsAnswer: false,
        },
      ];
    }
    if (intent.learningObjective === "grammar_selection") {
      return [
        {
          level: "semantic_hint",
          content: "先圈出题目真正要求区分的条件，例如话题与主语、存在地点与动作地点，或直接与柔和的语气。",
          revealsForm: false,
          revealsAnswer: false,
        },
        {
          level: "form_hint",
          content: "再逐个检查选项是否同时满足意思、接续和当前语体，不要只看中文翻译相近。",
          revealsForm: false,
          revealsAnswer: false,
        },
      ];
    }
    if (canonical === "Aがあります" || canonical === "Aがいます") {
      const isInanimate = canonical === "Aがあります";
      return [
        {
          level: "semantic_hint",
          content: "先判断存在的是人或动物，还是物品、设施、活动等无生命事物。",
          revealsForm: false,
          revealsAnswer: false,
        },
        {
          level: "form_hint",
          content: isInanimate
            ? "物品、设施和事情的存在用「あります」；人和动物通常用「います」。"
            : "人和动物的存在通常用「います」；物品、设施和事情用「あります」。",
          revealsForm: true,
          revealsAnswer: false,
        },
      ];
    }
    if (canonical === "AはBです") {
      return [
        {
          level: "semantic_hint",
          content: "先判断句子是在说明 A 的身份或性质，还是在表达存在、变化或选择。",
          revealsForm: false,
          revealsAnswer: false,
        },
        {
          level: "form_hint",
          content: "「は」提出要谈的 A，「です」对 A 作出判断。",
          revealsForm: true,
          revealsAnswer: false,
        },
      ];
    }
    return [
      {
        level: "semantic_hint",
        content: "先判断这个表达主要在说明存在、变化、原因、条件，还是说话人的判断与态度。",
        revealsForm: false,
        revealsAnswer: false,
      },
      {
        level: "form_hint",
        content: `留意接续「${grammarPoint.connections[0]?.pattern ?? grammarPoint.structure ?? grammarPoint.grammarPoint}」，用它排除功能不同的选项。`,
        revealsForm: true,
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

function comparisonSetForIntent(
  grammarPoint: GrammarPointDetail,
  intent: PracticeIntent
) {
  const requestedIds = new Set([
    grammarPoint.id,
    ...intent.comparisonGrammarPointIds,
  ]);
  const eligibleSets = grammarPoint.comparisonSets.filter(
    (set) => set.members.length >= 2 && set.decisionRules.length > 0
  );
  return eligibleSets.find(
    (set) =>
      set.members.length === requestedIds.size &&
      set.members.every((member) => requestedIds.has(member.grammarPointId))
  ) ?? eligibleSets.find((set) =>
    set.members.some((member) =>
      intent.comparisonGrammarPointIds.includes(member.grammarPointId)
    )
  );
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
  const prompt = input.intent.transferLevel === "reproduction"
    ? `在「${input.intent.context.scenario}」中${input.intent.context.communicativeGoal}时，「${input.grammarPoint.grammarPoint}」在当前具体用法中最符合哪项说明？`
    : `换到新的「${input.intent.context.scenario}」沟通条件并需要${input.intent.context.communicativeGoal}时，「${input.grammarPoint.grammarPoint}」仍主要表达哪项意思？`;
  return {
    ...root,
    exerciseType: "meaning_choice",
    prompt,
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
    prompt: `在「${input.intent.context.scenario}」中${input.intent.context.communicativeGoal}时，哪一种接续方式符合「${input.grammarPoint.grammarPoint}」当前学习的具体用法？`,
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
  const comparison = comparisonSetForIntent(input.grammarPoint, input.intent);
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
    prompt: `在「${input.intent.context.scenario}」场景中，如果要表达“${rule.conditionZh.trim().replace(/[，,。；;]+$/, "")}”，请选择最合适的日语形式。`,
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
  const detail = input.intent.context.requiredDetail;
  const content = input.intent.transferLevel === "reproduction"
    ? {
        zh: "不好意思，我没听清楚，能请您再说明一遍吗？",
        jp: "すみません、もう一度説明してもらえますか。",
      }
    : detail.includes("检查")
      ? {
          zh: "不好意思，能请您再告诉我下次检查的日期吗？",
          jp: "すみません、次の検査の日をもう一度教えてもらえますか。",
        }
      : detail.includes("药")
        ? {
            zh: "不好意思，能请您再说明一下药的服用时间吗？",
            jp: "すみません、薬を飲む時間をもう一度説明してもらえますか。",
          }
        : {
            zh: "不好意思，能请您再说慢一点吗？",
            jp: "すみません、もう少しゆっくり話してもらえますか。",
          };
  const answer = {
    jp: content.jp,
    zh: content.zh,
    noteZh: "使用目标语法完成一般礼貌请求。",
  };
  const chineseSentence = content.zh;
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
  const isNearTransfer = input.intent.transferLevel !== "reproduction";
  const content = detail.includes("两次")
    ? { zh: "这周还有两次会议。", jp: "今週は会議があと二回あります。" }
    : detail.includes("车站")
      ? isNearTransfer
        ? { zh: "车站附近有一个停车场。", jp: "駅の近くに駐車場があります。" }
        : { zh: "车站附近有一家便利店。", jp: "駅の近くにコンビニが一軒あります。" }
      : { zh: "今天下班前还有一场会议。", jp: "今日、仕事が終わる前にもう一つ会議があります。" };
  const root = base(input);
  const noteZh = detail.includes("两次")
    ? "用「あと二回」表达“还有两次”，并用「会議があります」表示仍有会议安排。"
    : detail.includes("车站")
      ? "地点用「に」，存在对象用「が」。"
      : "用「もう一つ」表达“还有一场”，并用「会議があります」表示会议安排。";
  const answer = { jp: content.jp, zh: content.zh, noteZh };
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
  const hasStructuredComparison =
    input.intent.exerciseType === "contrast_choice" &&
    Boolean(comparisonSetForIntent(input.grammarPoint, input.intent));
  const isDeclaredSupported =
    hasStructuredComparison ||
    (declaredSupport.supportedExerciseTypes.includes(input.intent.exerciseType) &&
      (declaredSupport.supportedScenarios.includes("*") ||
        declaredSupport.supportedScenarios.includes(input.intent.context.sceneSlug)) &&
      declaredSupport.supportedRegisters.includes(input.intent.context.registerPreset));
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
