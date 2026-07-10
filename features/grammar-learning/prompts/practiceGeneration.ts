import type { GrammarPointDetail, PracticeLevel } from "@/shared/types/api";

export type PracticeVariation = {
  seed: string;
  listenerFocus: string;
  intentFocus: string;
  detailConstraint: string;
  outputTexture: string;
};

const PRACTICE_LEVEL_GUIDES: Record<PracticeLevel, string> = {
  1: "模仿造句：给一个清楚的参考结构，让学习者替换人物、地点、时间或对象。任务要降低自由度，重点练接续和句型。",
  2: "场景造句：给一个具体沟通场景，必须包含说话人、听话对象、想达成的目的。任务要像真实会话，不要像考试题。",
  3: "中译日：给一句自然中文意图，让学习者翻成日语。中文要符合场景，不要为凑语法而别扭。",
  4: "语体转换：给一个意思或偏随便/偏生硬的表达，让学习者改成指定语体。重点检查礼貌程度和对象关系。",
  5: "易混语法对比：指定一个相似语法作为干扰项，让学习者必须使用目标语法，并在参考答案说明为什么不用相似语法。",
};

function formatExamples(grammarPoint: GrammarPointDetail) {
  return grammarPoint.examples
    .slice(0, 3)
    .map((example, index) => {
      const scene = example.sceneTag?.nameZh ? ` / ${example.sceneTag.nameZh}` : "";
      const register = example.registerTag?.nameZh
        ? ` / ${example.registerTag.nameZh}`
        : "";

      return `${index + 1}. ${example.jp}（${example.zh ?? "无中文"}${scene}${register}）`;
    })
    .join("\n");
}

function formatSimilarGrammar(grammarPoint: GrammarPointDetail) {
  return grammarPoint.similarGrammar
    .slice(0, 3)
    .map(
      (relation, index) =>
        `${index + 1}. ${relation.similarGrammarPointText}：${relation.differenceSummary}`
    )
    .join("\n");
}

function formatConnections(grammarPoint: GrammarPointDetail) {
  return grammarPoint.connections
    .map(
      (connection, index) =>
        `${index + 1}. ${connection.baseType} / ${connection.requiredForm}：${connection.pattern}${connection.notes ? `（${connection.notes}）` : ""}`
    )
    .join("\n");
}

export function buildPracticeGenerationPrompt(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  sceneTagLabel?: string;
  registerTag?: string;
  registerTagLabel?: string;
  level: PracticeLevel;
  variation?: PracticeVariation;
}) {
  const scene = input.sceneTagLabel ?? input.sceneTag ?? "日常生活";
  const register = input.registerTagLabel ?? input.registerTag ?? "一般礼貌";
  const examples = formatExamples(input.grammarPoint) || "无";
  const similarGrammar = formatSimilarGrammar(input.grammarPoint) || "无";
  const structuredConnections =
    formatConnections(input.grammarPoint) || "无结构化接续记录";
  const variation = input.variation
    ? `本次变化编号：${input.variation.seed}
听话对象倾向：${input.variation.listenerFocus}
表达目的倾向：${input.variation.intentFocus}
必须加入的具体细节：${input.variation.detailConstraint}
任务质感：${input.variation.outputTexture}`
    : "本次变化编号：未提供。请自行选择一个具体但自然的变化方向。";

  return `你是面向中文母语者的日语语法练习设计师。
请为当前语法点生成一个「可直接拿来练」的微场景任务。任务要像真实会话/写作需求，而不是考试说明。

语法点：${input.grammarPoint.grammarPoint}
读法：${input.grammarPoint.reading ?? "未提供"}
大类：${input.grammarPoint.categoryGroupNameZh ?? "未提供"}
分类：${input.grammarPoint.categoryNameZh ?? "未提供"}
核心意思：${input.grammarPoint.coreMeaning}
结构：${input.grammarPoint.structure ?? "未提供"}
结构化接续：
${structuredConnections}
使用场景：${scene}
目标语体：${register}
练习等级：${input.level}（${PRACTICE_LEVEL_GUIDES[input.level]}）
常见误区：${input.grammarPoint.commonMistakes.join("；") || "无"}
参考例句：
${examples}
相似语法：
${similarGrammar}

本次变化要求：
${variation}

当前可选项约束：
- 使用场景必须严格围绕「${scene}」，不要换成其他场景。
- 目标语体必须严格符合「${register}」。
- 当前产品只展示三个练习类型：中译日、语体转换、易混对比。请让任务明显服务于当前练习等级。
- 不要照抄参考例句；可以借鉴结构，但人物、物品、动作、时间或表达目的必须变化。

等级专项要求：
- 等级 3「中译日」：task_zh 应给出一段自然中文意图或中文句子，让学习者翻成日语；不要提前暴露日语答案。
- 等级 4「语体转换」：task_zh 必须包含一个原始表达或原始意图，并明确要求改成「${register}」语体；重点制造语体判断，而不是只换句尾。
- 等级 5「易混对比」：task_zh 必须明确目标语法和干扰语法/易混点；如果相似语法为“无”，就使用常见误区作为干扰点。

生成目标：
- task_zh 要告诉学习者「谁对谁说」「在什么场景」「想完成什么表达目的」。
- task_zh 不要只写“请用某语法造句”；必须给出具体情境或中文意图。
- reference_answers 给 2 个自然答案：一个标准答案，一个可替代表达。
- 每个参考答案必须自然使用目标语法点，且符合「${register}」语体。
- note_zh 要说明这个答案为什么自然，必要时指出接续、语体或易混点。
- hints 给 2-3 条短提示，分别覆盖接续、语体/场景、常见误区。

只返回有效 JSON，schema 如下：
{
  "task_zh": string,
  "reference_answers": [
    {
      "jp": string,
      "zh": string,
      "note_zh": string
    }
  ],
  "hints": string[]
}

规则：
- 不要返回 Markdown。
- 不要出现英文 slug，例如 daily_life、polite、business。
- 不要让任务过宽泛；学习者读完应立刻知道要写什么。
- 不要生成不自然或过度书面的日语。
- 不要在日语答案里解释语法，解释只写在 note_zh。
- 如果等级是 5，必须在 note_zh 中明确对比目标语法和相似语法的差别。`;
}
