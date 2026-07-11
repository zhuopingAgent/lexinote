import type { GrammarPointDetail, PracticeReferenceAnswer } from "@/shared/types/grammar";
import type {
  PracticeContext,
  PracticeDifficulty,
  PracticeExerciseType,
  PracticeSkillDimension,
} from "@/shared/types/practice";
import {
  PRACTICE_EXERCISE_LABELS,
  PRACTICE_SKILL_LABELS,
} from "@/features/grammar-learning/domain/practice";

export type PlannedTextExerciseInput = {
  grammarPoint: GrammarPointDetail;
  skillDimension: PracticeSkillDimension;
  exerciseType: PracticeExerciseType;
  difficulty: PracticeDifficulty;
  context: PracticeContext;
  generationSeed: string;
};

function formatConnections(grammarPoint: GrammarPointDetail) {
  return grammarPoint.connections
    .map((connection) => `${connection.pattern}（${connection.notes || connection.requiredForm}）`)
    .join("；");
}

function formatComparisons(grammarPoint: GrammarPointDetail) {
  return grammarPoint.comparisonSets
    .slice(0, 2)
    .map((comparison) => {
      const members = comparison.members.map((member) => member.grammarPoint).join("、");
      const rules = comparison.decisionRules
        .slice(0, 3)
        .map((rule) => rule.explanationZh)
        .join("；");
      return `${comparison.nameZh}（${members}）：${rules}`;
    })
    .join("\n");
}

export function buildPlannedExerciseGenerationPrompt(input: PlannedTextExerciseInput) {
  const context = input.context;
  const referenceExamples = input.grammarPoint.examples
    .slice(0, 3)
    .map((example) => `${example.jp}（${example.zh ?? ""}）`)
    .join("\n");

  return `你是中文母语者的日语练习题实现器。教学规划器已经确定教学目标，你不能改变目标。

目标语法：${input.grammarPoint.grammarPoint}
具体用法：${input.grammarPoint.coreMeaning}
接续：${formatConnections(input.grammarPoint) || input.grammarPoint.structure || "未提供"}
能力维度：${PRACTICE_SKILL_LABELS[input.skillDimension]}
练习类型：${PRACTICE_EXERCISE_LABELS[input.exerciseType]}
难度：D${input.difficulty}
生成编号：${input.generationSeed}

场景：${context.sceneLabel}
说话人：${context.speakerRole}
听话人：${context.listenerRole}
关系距离：${context.socialDistance}
上下关系：${context.hierarchy}
请求负担：${context.requestBurden}
媒介：${context.medium}
沟通目的：${context.communicativeGoal}
共同背景：${context.knownContext}
必须包含：${context.requiredDetail}
目标语体：${context.registerLabel}

常见误区：${input.grammarPoint.commonMistakes.join("；") || "无"}
易混对比：
${formatComparisons(input.grammarPoint) || "无"}
参考素材，仅用于确认自然度，不得照抄：
${referenceExamples || "无"}

题型规则：
- form_repair：给出一个存在接续、活用或形式问题的原始表达，要求学习者修复，不能提前写出正确答案。
- register_rewrite：给出与目标人物关系不匹配的原始表达，要求改为目标语体；不能只要求机械替换句尾。
- guided_translation：给出自然中文意图、人物关系和必要细节，要求翻成日语。
- contextual_response：只提供现实沟通目标和必要背景，让学习者独立回应。

输出要求：
- task_zh 必须具体、可立即作答，且不能包含完整日语答案。
- reference_answers 必须给两个自然答案，都使用目标语法和目标语体，但人物、物品或措辞应有变化。
- hints 必须依次为：意义方向、接续结构、句子骨架。第三条也不能给出完整答案。
- 不能出现 daily_life、polite、business 等内部英文标签。
- 不得照抄参考素材的完整日语句子。
- 只返回 JSON，不返回 Markdown。

{
  "task_zh": string,
  "reference_answers": [
    { "jp": string, "zh": string, "note_zh": string }
  ],
  "hints": string[]
}`;
}

function fallbackReferenceAnswers(
  grammarPoint: GrammarPointDetail
): PracticeReferenceAnswer[] {
  return grammarPoint.examples.slice(0, 2).map((example) => ({
    jp: example.jp,
    zh: example.zh ?? grammarPoint.naturalTranslation ?? grammarPoint.coreMeaning,
    noteZh: example.notes ?? `自然使用「${grammarPoint.grammarPoint}」的表达。`,
  }));
}

function buildIncorrectConnection(grammarPoint: GrammarPointDetail) {
  const requiredForm = grammarPoint.connections[0]?.requiredForm ?? "";
  const suffix = grammarPoint.grammarPoint.replace(/^〜/, "");
  const wrongBase =
    requiredForm === "te_form" || requiredForm === "ta_form"
      ? "読む"
      : requiredForm === "nai_form" || requiredForm === "masu_stem"
        ? "読みます"
        : "読みます";

  return `${wrongBase}${suffix}`;
}

function buildRegisterMismatchSource(grammarPoint: GrammarPointDetail) {
  const example = grammarPoint.examples[0]?.jp ?? grammarPoint.grammarPoint;
  return example
    .replace(/ていただけますか。?$/, "てもらえる？")
    .replace(/てもらえますか。?$/, "てもらえる？")
    .replace(/てください。?$/, "て。")
    .replace(/でしょうか。?$/, "？")
    .replace(/ですか。?$/, "？")
    .replace(/ますか。?$/, "？")
    .replace(/です。?$/, "だ。")
    .replace(/ます。?$/, "る。");
}

export function buildPlannedExerciseFallback(input: PlannedTextExerciseInput) {
  const cue =
    input.grammarPoint.examples[0]?.zh ??
    input.grammarPoint.naturalTranslation ??
    input.grammarPoint.coreMeaning;
  const contextLead = `${input.context.speakerRole}正在「${input.context.sceneLabel}」向${input.context.listenerRole}表达。${input.context.knownContext}`;
  const incorrectConnection = buildIncorrectConnection(input.grammarPoint);
  const registerMismatchSource = buildRegisterMismatchSource(input.grammarPoint);
  const promptByType: Partial<Record<PracticeExerciseType, string>> = {
    form_repair: `${contextLead}下面的形式存在接续或活用问题：「${incorrectConnection}」。请修复成完整、自然的日语，并表达「${cue}」。`,
    register_rewrite: `${contextLead}下面的说法不符合人物关系：「${registerMismatchSource}」。请保留原意，改写成适合对${input.context.listenerRole}使用的「${input.context.registerLabel}」日语。`,
    guided_translation: `${contextLead}请把「${cue}」翻译成自然日语，必须使用「${input.grammarPoint.grammarPoint}」，并包含「${input.context.requiredDetail}」。`,
    contextual_response: `${contextLead}你的目的是「${input.context.communicativeGoal}」，必须提到「${input.context.requiredDetail}」。请使用「${input.grammarPoint.grammarPoint}」独立写一句自然的「${input.context.registerLabel}」日语。`,
  };
  const baseReferenceAnswers = fallbackReferenceAnswers(input.grammarPoint);
  const referenceAnswers =
    input.exerciseType === "register_rewrite" &&
    input.context.sceneSlug === "hospital" &&
    input.grammarPoint.grammarPoint === "〜てもらえますか"
      ? [
          {
            jp: "すみません、もう一度説明していただけますか。",
            zh: "不好意思，能请您再说明一遍吗？",
            noteZh: "对医生使用更郑重的请求表达。",
          },
          ...baseReferenceAnswers,
        ].slice(0, 2)
      : baseReferenceAnswers;

  return {
    prompt:
      promptByType[input.exerciseType] ??
      `${contextLead}请使用「${input.grammarPoint.grammarPoint}」完成表达。`,
    referenceAnswers:
      referenceAnswers.length > 0
        ? referenceAnswers
        : [
            {
              jp: input.grammarPoint.grammarPoint,
              zh: input.grammarPoint.coreMeaning,
              noteZh: "先按结构化接续完成一个完整句子。",
            },
          ],
    hints: [
      `先表达这个核心意思：${input.grammarPoint.coreMeaning}`,
      `接续结构：${input.grammarPoint.connections[0]?.pattern ?? input.grammarPoint.structure ?? "先确认目标形式"}`,
      `句子骨架：人物／背景 + 具体内容 + ${input.grammarPoint.grammarPoint}`,
    ],
    source: "fallback" as const,
  };
}

export function isPlannedExerciseSafe(input: {
  prompt: string;
  referenceAnswers: PracticeReferenceAnswer[];
}) {
  if (!input.prompt.trim() || input.referenceAnswers.length === 0) {
    return false;
  }
  if (/\b(daily_life|polite|business|formal|media_formal)\b/.test(input.prompt)) {
    return false;
  }
  return input.referenceAnswers.every(
    (answer) => answer.jp.trim() && !input.prompt.includes(answer.jp.trim())
  );
}
