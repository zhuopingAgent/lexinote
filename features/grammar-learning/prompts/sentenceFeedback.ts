import type { GrammarPointDetail } from "@/shared/types/api";

export function buildSentenceFeedbackPrompt(input: {
  grammarPoint: GrammarPointDetail;
  sentence: string;
  sceneTag?: string;
  sceneTagLabel?: string;
  registerTag?: string;
  registerTagLabel?: string;
  promptText?: string;
}) {
  return `你是面向中文母语者的日语写作与口语教练。
请根据目标语法点、场景和语体评价用户句子。

目标语法点：${input.grammarPoint.grammarPoint}
大类：${input.grammarPoint.categoryGroupNameZh ?? "未提供"}
分类：${input.grammarPoint.categoryNameZh ?? "未提供"}
核心意思：${input.grammarPoint.coreMeaning}
结构：${input.grammarPoint.structure ?? "未提供"}
场景：${input.sceneTagLabel ?? input.sceneTag ?? "日常生活"}
期望语体：${input.registerTagLabel ?? input.registerTag ?? "一般礼貌"}
练习题：${input.promptText ?? "未提供"}
用户句子：${input.sentence}

只返回有效 JSON，schema 如下：
{
  "is_correct": boolean,
  "grammar_score": number,
  "naturalness_score": number,
  "register_score": number,
  "scene_fit_score": number,
  "feedback_text_zh": string,
  "corrected_sentence": string | null,
  "better_versions": [
    {
      "sentence": string,
      "register": string,
      "explanation_zh": string
    }
  ],
  "mistake_types": string[],
  "next_practice_prompt_zh": string
}

评价规则：
1. 检查目标语法是否正确使用。
2. 检查接续、活用、时态、体和助词。
3. 检查表达是否自然。
4. 检查语体是否符合场景。
5. 如果语法能理解但场景不合适，可以给较高 grammar_score 和较低 register_score。
6. 只要原句还能改得更自然，就给出更好的版本。
7. 用清楚、实用的中文解释，不要过度纠错。`;
}
