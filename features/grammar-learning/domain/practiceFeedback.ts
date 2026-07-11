import type {
  AIFeedbackIssue,
  AIFeedbackResult,
  GrammarErrorCode,
  GrammarPointDetail,
  PracticeSubmitResponse,
} from "@/shared/types/grammar";

const PUBLIC_ISSUE_EXPLANATIONS: Record<GrammarErrorCode, string> = {
  conjugation_error: "动词或形容词的活用形式与目标结构不匹配。",
  connection_error: "目标表达前的接续形式需要调整。",
  particle_error: "助词没有准确表达句中成分之间的关系。",
  tense_aspect_error: "时间信息与谓语的时态或体不一致。",
  giving_receiving_direction_error: "授受方向或受益者关系需要重新确认。",
  semantic_error: "当前表达没有完整实现题目要求的具体意义。",
  register_mismatch: "当前语体与说话对象、关系距离或场合不匹配。",
  collocation_error: "词语搭配不符合日语中的常见组合。",
  literal_translation: "表达受到中文结构影响，需要按日语方式重新组织。",
  unnatural_expression: "句子可以理解，但整体表达还不够自然或完整。",
};

function issueCodeFor(grammarPoint: GrammarPointDetail): GrammarErrorCode {
  if (grammarPoint.pointType === "particle") {
    return "particle_error";
  }
  if (grammarPoint.pointType === "conjugation") {
    return "conjugation_error";
  }
  if (grammarPoint.pointType === "collocation") {
    return "collocation_error";
  }
  if (grammarPoint.pointType === "register_concept") {
    return "register_mismatch";
  }
  return "semantic_error";
}

export function buildChoiceFeedback(input: {
  isCorrect: boolean;
  grammarPoint: GrammarPointDetail;
}): AIFeedbackResult {
  if (input.isCorrect) {
    return {
      isCorrect: true,
      grammarScore: 5,
      meaningScore: 5,
      naturalnessScore: 4,
      registerScore: 4,
      sceneFitScore: 5,
      issues: [],
      explanation: "判断正确。你抓住了这个语境中的关键条件。",
      nextHint: "下一题会换一个条件，确认你能独立迁移。",
      feedbackText: "判断正确。",
      correctedSentence: null,
      betterVersions: [],
      mistakeTypes: [],
      nextPracticePrompt: null,
    };
  }

  const errorTypeCode = issueCodeFor(input.grammarPoint);
  const issue: AIFeedbackIssue = {
    errorTypeCode,
    severity: "medium",
    explanation: "当前选择没有满足题目中的核心语义或使用条件。",
    correction: "",
    relatedGrammarPointId: input.grammarPoint.id,
  };
  return {
    isCorrect: false,
    grammarScore: 3,
    meaningScore: 2,
    naturalnessScore: 3,
    registerScore: 3,
    sceneFitScore: 2,
    issues: [issue],
    explanation: "这次选择还没有命中关键条件。先查看条件中的人物关系、动作类型或信息来源，再试一次。",
    nextHint: "需要时逐级查看提示；答案会在答对或主动揭示后显示。",
    feedbackText: "这次选择还需要调整。",
    correctedSentence: null,
    betterVersions: [],
    mistakeTypes: [errorTypeCode],
    nextPracticePrompt: null,
  };
}

export function sanitizeIncorrectFeedback(
  feedback: PracticeSubmitResponse
): AIFeedbackResult {
  if (feedback.isCorrect) {
    return feedback;
  }

  const issues = feedback.issues.map((issue) => ({
    ...issue,
    explanation: PUBLIC_ISSUE_EXPLANATIONS[issue.errorTypeCode],
    correction: "",
  }));
  const explanation =
    issues.map((issue) => issue.explanation).join("") ||
    "这次回答还没有完全达到题目要求。";

  return {
    ...feedback,
    issues,
    explanation,
    feedbackText: explanation,
    correctedSentence: null,
    betterVersions: [],
    nextPracticePrompt: null,
    nextHint: "先根据问题类型修改，再尝试一次；也可以逐级查看提示。",
  };
}
