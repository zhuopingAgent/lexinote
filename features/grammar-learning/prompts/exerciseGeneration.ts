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
- 只生成中译日。直接给出一整句语义完整、可以逐项核对的中文句子，要求翻成日语。
- 必须把人物、沟通目的和必要细节自然写进中文句子，不能把抽象标签交给学习者自行补全。

输出要求：
- task_zh 必须具体、可立即作答，且不能包含完整或接近完整的日语答案。
- task_zh 必须是一段标点完整、语义连贯的自然中文，不能机械拼接“沟通目的 + 并提到 + 必要细节”。
- 使用“请把下面这句中文翻译成自然日语：‘完整中文句子。’”这一信息结构。错误示例：“表达计划，并提到‘两次’。”正确示例：“这周还有两次会议。”
- 作答内容必须只用中文描述；除了用书名号标出的目标语法标签，不得出现任何候选日语句子。
- reference_answers 必须准确回答 task_zh，并使用目标语法和目标语体。两个答案可以更换自然措辞，但不得改变题目中的人物、数量、时间或事实。
- hints 必须依次为：意义方向、接续结构、句子骨架。第三条也不能给出完整答案。
- 不能出现 daily_life、polite、business 等内部英文标签。
- task_zh 不得使用 Markdown 粗体、代码标记或标题符号。
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

function seedIndex(seed: string, length: number) {
  if (length <= 1) {
    return 0;
  }

  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash % length;
}

function fallbackReferenceAnswers(
  grammarPoint: GrammarPointDetail,
  generationSeed: string
): PracticeReferenceAnswer[] {
  const examples = grammarPoint.examples;
  const startIndex = seedIndex(generationSeed, examples.length);

  return Array.from({ length: Math.min(2, examples.length) }, (_, offset) =>
    examples[(startIndex + offset) % examples.length]
  ).map((example) => ({
    jp: example.jp,
    zh: example.zh ?? grammarPoint.naturalTranslation ?? grammarPoint.coreMeaning,
    noteZh: example.notes ?? `自然使用「${grammarPoint.grammarPoint}」的表达。`,
  }));
}

type FallbackTaskContent = {
  cueZh: string;
  referenceAnswers: PracticeReferenceAnswer[];
};

function buildExistenceTaskContent(
  input: PlannedTextExerciseInput
): FallbackTaskContent | null {
  const canonicalForm =
    input.grammarPoint.canonicalForm ?? input.grammarPoint.grammarPoint;
  if (canonicalForm !== "Aがあります") {
    return null;
  }

  const detail = input.context.requiredDetail;
  if (detail.includes("两次")) {
    return {
      cueZh: "这周还有两次会议。",
      referenceAnswers: [
        {
          jp: "今週は会議があと二回あります。",
          zh: "这周还有两次会议。",
          noteZh: "用「あと二回」明确剩余次数。",
        },
        {
          jp: "今週はまだ会議が二回あります。",
          zh: "这周还有两次会议。",
          noteZh: "「まだ」强调本周仍有会议。",
        },
      ],
    };
  }
  if (detail.includes("车站附近")) {
    return {
      cueZh: "车站附近有一家便利店。",
      referenceAnswers: [
        {
          jp: "駅の近くにコンビニが一軒あります。",
          zh: "车站附近有一家便利店。",
          noteZh: "存在地点使用「に」，店铺数量使用「一軒」。",
        },
        {
          jp: "駅の近くにはコンビニが一軒あります。",
          zh: "车站附近有一家便利店。",
          noteZh: "用「には」把车站附近作为话题范围。",
        },
      ],
    };
  }
  if (detail.includes("今天下班前")) {
    return {
      cueZh: "今天下班前还有一场会议。",
      referenceAnswers: [
        {
          jp: "今日、仕事が終わる前にもう一つ会議があります。",
          zh: "今天下班前还有一场会议。",
          noteZh: "用「もう一つ」表示还有一场。",
        },
        {
          jp: "今日は退勤前に会議がもう一つあります。",
          zh: "今天下班前还有一场会议。",
          noteZh: "「退勤前」适合工作场景。",
        },
      ],
    };
  }

  return null;
}

function buildFallbackTaskContent(
  input: PlannedTextExerciseInput
): FallbackTaskContent {
  const referenceAnswers = fallbackReferenceAnswers(
    input.grammarPoint,
    input.generationSeed
  );
  const existenceContent =
    input.exerciseType === "guided_translation" ||
    input.exerciseType === "contextual_response"
      ? buildExistenceTaskContent(input)
      : null;

  return {
    cueZh:
      existenceContent?.cueZh ??
      referenceAnswers[0]?.zh ??
      input.grammarPoint.naturalTranslation ??
      input.grammarPoint.coreMeaning,
    referenceAnswers: existenceContent?.referenceAnswers ?? referenceAnswers,
  };
}

export function buildPlannedExerciseFallback(input: PlannedTextExerciseInput) {
  const taskContent = buildFallbackTaskContent(input);
  const isHospitalRequestAcceptance =
    input.context.sceneSlug === "hospital" &&
    input.grammarPoint.grammarPoint === "〜てもらえますか";
  const cue = isHospitalRequestAcceptance
    ? "不好意思，我没听清楚，能请您再说明一遍吗？"
    : taskContent.cueZh;
  const speakerRole =
    input.context.speakerRole === "学习者" ? "你" : input.context.speakerRole;
  const listenerRole =
    input.context.listenerRole === "不熟悉的人"
      ? "一位不熟悉的人"
      : input.context.listenerRole;
  const contextLead = `在「${input.context.sceneLabel}」场景中，${speakerRole}正和${listenerRole}交流。`;
  const baseReferenceAnswers = taskContent.referenceAnswers;
  const referenceAnswers =
    isHospitalRequestAcceptance
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
      `${contextLead}请把下面这句中文翻译成自然日语，要求使用「${input.grammarPoint.grammarPoint}」和「${input.context.registerLabel}」语体：“${cue}”`,
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
  hints?: string[];
  exerciseType: PracticeExerciseType;
  grammarPoint: string;
}) {
  if (input.exerciseType !== "guided_translation") {
    return false;
  }
  if (!input.prompt.trim() || input.referenceAnswers.length === 0) {
    return false;
  }
  if (/\b(daily_life|polite|business|formal|media_formal)\b/.test(input.prompt)) {
    return false;
  }
  if (/(\*\*|__|`|^#{1,6}\s)/m.test(input.prompt)) {
    return false;
  }
  if (
    /(?:(?:表达计划|确认信息|说明情况)[，,；;]?\s*(?:并|同时)?(?:提到|包含)|(?:中文意图|沟通目的|你的目的是)[^。？！]{0,40}(?:并提到|必须提到|包含))/.test(
      input.prompt
    )
  ) {
    return false;
  }
  if (!/[“"]([^”"]{4,}[。？！?])[”"]/.test(input.prompt)) {
    return false;
  }

  const normalizeForComparison = (value: string) =>
    value
      .normalize("NFKC")
      .replace(/[\s*_`「」『』【】（）()\[\]。、，：；！？!?]/g, "")
      .trim();
  const promptForComparison = normalizeForComparison(input.prompt);
  const visibleLearnerText = [input.prompt, ...(input.hints ?? [])];

  if (
    input.referenceAnswers.some((answer) => {
      const normalizedAnswer = normalizeForComparison(answer.jp);
      return (
        !normalizedAnswer ||
        visibleLearnerText.some((text) =>
          normalizeForComparison(text).includes(normalizedAnswer)
        )
      );
    })
  ) {
    return false;
  }

  const grammarMentionForms = Array.from(
    new Set([
      input.grammarPoint,
      input.grammarPoint.replace(/^[〜~]/, ""),
      input.grammarPoint.replace(/^[〜~]/, "").replace(/[A-ZＡ-Ｚ]/g, ""),
    ])
  )
    .map((form) => form.trim())
    .filter(Boolean);
  const normalizedGrammarMentions = new Set(
    grammarMentionForms.map(normalizeForComparison)
  );
  const promptWithoutGrammarLabel = input.prompt.replace(
    /[「『]([^」』]+)[」』]/g,
    (whole, content: string) =>
      normalizedGrammarMentions.has(normalizeForComparison(content)) ? "" : whole
  );
  const remainingKanaCount =
    promptWithoutGrammarLabel.match(/[\u3040-\u30ff]/g)?.length ?? 0;

  return remainingKanaCount === 0 && promptForComparison.length > 0;
}
