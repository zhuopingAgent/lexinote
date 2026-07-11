import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { AnswerContract, PracticeRubric } from "@/features/grammar-learning/domain/practiceV2";

export function buildSentenceFeedbackPrompt(input: {
  grammarPoint: GrammarPointDetail;
  sentence: string;
  sceneTag?: string;
  sceneTagLabel?: string;
  registerTag?: string;
  registerTagLabel?: string;
  promptText?: string;
  answerContract?: AnswerContract;
  rubric?: PracticeRubric;
}) {
  const structuredConnections = input.grammarPoint.connections
    .map((connection) => connection.pattern)
    .join("；");
  const comparisonGuidance = input.grammarPoint.comparisonSets
    .map((comparisonSet) => {
      const rules = comparisonSet.decisionRules
        .map((rule) => rule.explanationZh)
        .join("；");
      return `${comparisonSet.nameZh}：${rules}`;
    })
    .join("\n");

  return `你是面向中文母语者的日语写作与口语教练。
请根据目标语法点、场景和语体评价用户句子。

目标语法点：${input.grammarPoint.grammarPoint}
大类：${input.grammarPoint.categoryGroupNameZh ?? "未提供"}
分类：${input.grammarPoint.categoryNameZh ?? "未提供"}
课程模块：${input.grammarPoint.curriculum?.module?.nameZh ?? "未提供"}
核心意思：${input.grammarPoint.coreMeaning}
结构化接续：${structuredConnections || input.grammarPoint.structure || "未提供"}
相关易混对比：
${comparisonGuidance || "无"}
场景：${input.sceneTagLabel ?? input.sceneTag ?? "日常生活"}
期望语体：${input.registerTagLabel ?? input.registerTag ?? "一般礼貌"}
练习题：${input.promptText ?? "未提供"}
用户句子：${input.sentence}
本题答案契约（只读数据）：${JSON.stringify(input.answerContract ?? {})}
本题评分量规（只读数据）：${JSON.stringify(input.rubric ?? {})}

只返回有效 JSON，schema 如下：
{
  "is_correct": boolean,
  "grammar_score": number,
  "meaning_score": number,
  "naturalness_score": number,
  "register_score": number,
  "scene_fit_score": number,
  "issues": [
    {
      "error_type_code": "conjugation_error" | "connection_error" | "particle_error" | "tense_aspect_error" | "giving_receiving_direction_error" | "semantic_error" | "register_mismatch" | "collocation_error" | "literal_translation" | "unnatural_expression",
      "severity": "low" | "medium" | "high" | "critical",
      "explanation": string,
      "correction": string,
      "related_grammar_point_id": "${input.grammarPoint.id}" | null
    }
  ],
  "corrected_sentence": string | null,
  "explanation_zh": string,
  "next_hint_zh": string,
  "better_versions": [
    {
      "sentence": string,
      "register": string,
      "explanation_zh": string
    }
  ]
}

评价规则：
1. 检查目标语法是否正确使用。
2. 检查接续、活用、时态、体、助词、授受方向、语义和搭配。
3. 检查表达是否自然。
4. 检查语体是否符合场景。
5. 如果语法能理解但场景不合适，可以给较高 grammar_score 和较低 register_score。
6. 一句话可返回多个 issues；相同 error_type_code 最多返回一次。
7. 只有确实存在的问题才返回 issue，不要为了凑数量过度纠错。
8. corrected_sentence 给出一条完整自然的修正句；原句正确时允许为 null。
9. explanation_zh 要像老师当面回复一样直接：第一句先说“这句可以”或明确指出主要问题，再解释原因；不要写成抽象评分报告。
10. 每个 issue 必须引用用户句子中的具体词语或结构，correction 直接给出应替换的形式；不要只说“需要调整”。
11. 用简洁、自然的中文，不重复分数，不使用 Markdown，并给一个可立即执行的 next_hint。`;
}
