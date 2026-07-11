import { createHash } from "node:crypto";
import { normalizeRegisterPreset } from "@/features/grammar-learning/domain/practice";
import type { GrammarPointDetail, PracticeReferenceAnswer } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeExerciseOption,
  PracticeExerciseType,
} from "@/shared/types/practice";

type ScenarioTemplate = {
  sceneSlug: string;
  sceneLabel: string;
  registerSlug: string;
  speakerRole: string;
  listenerRole: string;
  socialDistance: PracticeContext["socialDistance"];
  hierarchy: PracticeContext["hierarchy"];
  requestBurden: PracticeContext["requestBurden"];
  medium: PracticeContext["medium"];
  communicativeGoals: string[];
  knownContexts: string[];
  detailPool: string[];
};

const REGISTER_LABELS = {
  casual: "随便",
  polite: "一般礼貌",
  business: "正式 / 商务",
} as const;

const MEANING_DISTRACTORS: Record<GrammarPointDetail["pointType"], string[]> = {
  grammar_pattern: ["只表示动作已经完成", "只用于转述他人的原话", "只表示强制命令"],
  conjugation: ["表示说话人的推测", "标记动作发生的地点", "只用于引用内容"],
  sentence_pattern: ["只连接两个名词", "表示传闻的信息来源", "只用于随便口语"],
  syntax_concept: ["只表示过去时间", "只改变句子的礼貌程度", "只标记动作对象"],
  particle: ["表示动词的过去形", "把句子改成敬语", "表示他人的传闻"],
  collocation: ["仅表示语法上的否定", "只用于书面引用", "改变动词的时态"],
  register_concept: ["只改变事件发生的时间", "只标记动作地点", "只表示条件关系"],
  discourse_marker: ["只改变动词活用", "只标记句子主语", "只用于请求许可"],
};

function rotate<T>(items: T[], index: number, fallback: T): T {
  return items.length > 0 ? items[index % items.length] : fallback;
}

function uniqueStrings(items: Array<string | null | undefined>) {
  return Array.from(
    new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item)))
  );
}

function referenceAnswersFor(
  grammarPoint: GrammarPointDetail
): PracticeReferenceAnswer[] {
  const examples = grammarPoint.examples.slice(0, 2).map((example) => ({
    jp: example.jp,
    zh: example.zh ?? grammarPoint.naturalTranslation ?? grammarPoint.coreMeaning,
    noteZh: example.notes ?? `自然使用「${grammarPoint.grammarPoint}」的表达。`,
  }));

  return examples.length > 0
    ? examples
    : [
        {
          jp: grammarPoint.grammarPoint,
          zh: grammarPoint.coreMeaning,
          noteZh: "请结合结构化接续完成一个完整句子。",
        },
      ];
}

function buildChoiceOptions(labels: string[], correctIndex: number, rotation: number) {
  const items = labels.map((label, index) => ({
    label,
    isCorrect: index === correctIndex,
  }));
  const offset = items.length > 0 ? rotation % items.length : 0;
  const rotated = [...items.slice(offset), ...items.slice(0, offset)];
  const options: PracticeExerciseOption[] = rotated.map((item, index) => ({
    id: `option-${index + 1}`,
    label: item.label,
  }));
  const correctOptionId = options[rotated.findIndex((item) => item.isCorrect)]?.id;

  return { options, correctOptionId };
}

export function buildPracticeContext(input: {
  scenario: ScenarioTemplate;
  preferredRegister: string | null;
  sequenceNumber: number;
  variant: number;
}): PracticeContext {
  const { scenario, sequenceNumber, variant } = input;
  const index = sequenceNumber - 1 + variant;
  const registerPreset = normalizeRegisterPreset(
    input.preferredRegister ?? scenario.registerSlug
  );
  return {
    sceneSlug: scenario.sceneSlug,
    sceneLabel: scenario.sceneLabel,
    speakerRole: scenario.speakerRole,
    listenerRole: scenario.listenerRole,
    socialDistance: scenario.socialDistance,
    hierarchy: scenario.hierarchy,
    requestBurden: scenario.requestBurden,
    medium: scenario.medium,
    communicativeGoal: rotate(
      scenario.communicativeGoals,
      index,
      "完成一次自然沟通"
    ),
    knownContext: rotate(
      scenario.knownContexts,
      index + variant,
      "双方知道当前话题"
    ),
    requiredDetail: rotate(
      scenario.detailPool,
      index + variant * 2,
      "一个具体细节"
    ),
    registerPreset,
    registerLabel: REGISTER_LABELS[registerPreset],
  };
}

export function buildPracticeContentSignature(input: {
  grammarPointId: string;
  blueprintSlug: string;
  context: PracticeContext;
}) {
  return createHash("sha256")
    .update(
      [
        input.grammarPointId,
        input.blueprintSlug,
        input.context.sceneSlug,
        input.context.communicativeGoal,
        input.context.knownContext,
        input.context.requiredDetail,
        input.context.registerPreset,
      ].join("|")
    )
    .digest("hex");
}

export function buildDeterministicChoiceExercise(input: {
  grammarPoint: GrammarPointDetail;
  context: PracticeContext;
  sequenceNumber: number;
  exerciseType: PracticeExerciseType;
}) {
  const { grammarPoint, context, sequenceNumber, exerciseType } = input;
  const comparison =
    exerciseType === "contrast_choice"
      ? grammarPoint.comparisonSets.find((item) => item.members.length >= 2)
      : undefined;

  if (comparison) {
    const rule =
      comparison.decisionRules[(sequenceNumber - 1) % comparison.decisionRules.length];
    const preferredPosition = rule?.preferredMemberPosition ?? 1;
    const labels = comparison.members.map((member) => member.grammarPoint);
    const { options, correctOptionId } = buildChoiceOptions(
      labels,
      Math.max(0, preferredPosition - 1),
      sequenceNumber
    );
    const minimalPair = comparison.minimalPairExamples.find((pair) =>
      pair.sentences.some(
        (sentence) => sentence.memberPosition === preferredPosition
      )
    );
    const references = minimalPair
      ? minimalPair.sentences
          .filter((sentence) => sentence.memberPosition === preferredPosition)
          .map((sentence) => ({
            jp: sentence.jp,
            zh: sentence.zh,
            noteZh: sentence.notesZh ?? minimalPair.explanationZh,
          }))
      : referenceAnswersFor(grammarPoint);

    return {
      prompt: `${context.sceneLabel}场景：${rule?.conditionZh ?? comparison.summary}。请选择最合适的表达。`,
      options,
      expectedFeatures: {
        correctOptionId,
        comparisonSetId: comparison.id,
        preferredMemberPosition: preferredPosition,
      },
      referenceAnswers: references,
      hintLadder: [
        `先判断：${comparison.commonMeaning || comparison.summary}`,
        comparison.connectionDifferences.find(
          (difference) => difference.memberPosition === preferredPosition
        )?.descriptionZh ?? "比较每个选项的接续条件。",
        rule?.explanationZh ?? "回到题目中的人物关系、动作类型或信息来源。",
      ],
      comparisonSetId: comparison.id,
      source: "deterministic" as const,
    };
  }

  const labels = uniqueStrings([
    grammarPoint.coreMeaning,
    ...grammarPoint.formSiblings.map((sibling) => sibling.coreMeaning),
    ...MEANING_DISTRACTORS[grammarPoint.pointType],
  ]).slice(0, 4);
  const { options, correctOptionId } = buildChoiceOptions(
    labels,
    labels.indexOf(grammarPoint.coreMeaning),
    sequenceNumber
  );

  return {
    prompt: `在「${context.sceneLabel}」中看到「${grammarPoint.grammarPoint}」时，哪项最符合这里要学习的具体用法？`,
    options,
    expectedFeatures: {
      correctOptionId,
      grammarPointId: grammarPoint.id,
      senseKey: grammarPoint.senseKey,
    },
    referenceAnswers: referenceAnswersFor(grammarPoint),
    hintLadder: [
      `先抓核心功能：${grammarPoint.primaryCategory?.nameZh ?? "句中的表达作用"}。`,
      `接续线索：${grammarPoint.connections[0]?.pattern ?? grammarPoint.structure ?? "观察前后成分"}。`,
      grammarPoint.commonMistakes[0] ?? "排除把形式、语体和实际意义混为一谈的选项。",
    ],
    comparisonSetId: null,
    source: "deterministic" as const,
  };
}
