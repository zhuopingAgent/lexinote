import type { GrammarPointDetail, PracticeLevel } from "@/shared/types/api";

export function buildPracticeGenerationPrompt(input: {
  grammarPoint: GrammarPointDetail;
  sceneTag?: string;
  registerTag?: string;
  level: PracticeLevel;
}) {
  return `你是面向中文母语者的日语语法练习生成器。
请生成一个实用造句任务。

语法点：${input.grammarPoint.grammarPoint}
核心意思：${input.grammarPoint.coreMeaning}
结构：${input.grammarPoint.structure ?? "未提供"}
使用场景：${input.sceneTag ?? "daily_life"}
语体：${input.registerTag ?? "polite"}
练习等级：${input.level}

等级说明：
1. 模仿造句
2. 场景造句
3. 中译日造句
4. 语体转换
5. 易混语法对比

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
- 任务必须真实、实用，不要像考试题。
- 参考答案必须使用目标语法点。
- 场景和语体必须匹配。
- 中文说明要清楚、直接。`;
}
