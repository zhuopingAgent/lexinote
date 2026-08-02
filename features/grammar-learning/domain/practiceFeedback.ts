import type {
  AIFeedbackIssue,
  AIFeedbackResult,
  GrammarErrorCode,
  GrammarPointDetail,
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

const DIRECT_ISSUE_VERDICTS: Record<GrammarErrorCode, string> = {
  conjugation_error: "这句的活用不对。",
  connection_error: "这句的接续不对。",
  particle_error: "意思能懂，但助词用得不自然。",
  tense_aspect_error: "这句的时态或体不符合题目。",
  giving_receiving_direction_error: "这句的授受方向不对。",
  semantic_error: "这句还没有表达出题目要求的意思。",
  register_mismatch: "意思能懂，但语体不符合当前对象和场合。",
  collocation_error: "意思能懂，但词语搭配不自然。",
  literal_translation: "这句有明显的中文直译痕迹。",
  unnatural_expression: "意思能懂，但日语表达还不自然。",
};

const ISSUE_NAMES: Record<GrammarErrorCode, string> = {
  conjugation_error: "活用",
  connection_error: "接续",
  particle_error: "助词",
  tense_aspect_error: "时态或体",
  giving_receiving_direction_error: "授受方向",
  semantic_error: "意思",
  register_mismatch: "语体",
  collocation_error: "搭配",
  literal_translation: "直译",
  unnatural_expression: "自然度",
};

const ISSUE_DIMENSIONS: Record<
  GrammarErrorCode,
  NonNullable<AIFeedbackIssue["affectedDimensions"]>
> = {
  conjugation_error: ["grammar"],
  connection_error: ["grammar"],
  particle_error: ["grammar", "meaning"],
  tense_aspect_error: ["grammar", "meaning"],
  giving_receiving_direction_error: ["grammar", "meaning"],
  semantic_error: ["meaning"],
  register_mismatch: ["register", "contextFit"],
  collocation_error: ["naturalness", "meaning"],
  literal_translation: ["naturalness"],
  unnatural_expression: ["naturalness"],
};

function directVerdictForIssue(
  issue: AIFeedbackIssue,
  overallExplanation: string
) {
  if (issue.errorTypeCode !== "register_mismatch") {
    return DIRECT_ISSUE_VERDICTS[issue.errorTypeCode];
  }

  const explanation = `${issue.explanation} ${overallExplanation}`;
  if (/太随便|偏随便|礼貌度不足|不够礼貌/.test(explanation)) {
    return "意思能懂，但当前说法对这个对象来说太随便。";
  }
  if (/太正式|过于正式|过度礼貌/.test(explanation)) {
    return "意思能懂，但当前说法对这个对象来说太正式。";
  }
  return DIRECT_ISSUE_VERDICTS.register_mismatch;
}

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
  exerciseType: "meaning_choice" | "contrast_choice";
  selectedOptionLabel: string;
  selectedOptionReason?: string | null;
}): AIFeedbackResult {
  if (input.isCorrect) {
    const explanation = input.exerciseType === "meaning_choice"
      ? `「${input.selectedOptionLabel}」准确概括了「${input.grammarPoint.grammarPoint}」当前学习的意思。`
      : `「${input.selectedOptionLabel}」最符合题目给出的语境和使用条件。`;
    return {
      isCorrect: true,
      grammarScore: 5,
      meaningScore: 5,
      naturalnessScore: 4,
      registerScore: 4,
      sceneFitScore: 5,
      issues: [],
      explanation,
      nextHint: "下一题会换一个条件，确认你能独立迁移。",
      feedbackText: "回答正确。",
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
    explanation: input.selectedOptionReason || "当前选择没有满足题目中的核心语义或使用条件。",
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
    explanation: `你选择的「${input.selectedOptionLabel}」不合适。${input.selectedOptionReason || "它没有满足题目里的核心条件。"}`,
    nextHint: "按题目中的关键条件排除不合适的选项，再选一次。",
    feedbackText: "回答不正确，再看一下这个选项表达的意思。",
    correctedSentence: null,
    betterVersions: [],
    mistakeTypes: [errorTypeCode],
    nextPracticePrompt: null,
  };
}

export function makeFeedbackConversational<T extends AIFeedbackResult>(
  feedback: T
): T {
  const issues = feedback.issues.map((issue, index) => ({
    ...issue,
    role: index === 0 ? "root" as const : "secondary" as const,
    confidence: issue.confidence ?? 0.8,
    evidenceSpan: issue.evidenceSpan ?? null,
    affectedDimensions:
      issue.affectedDimensions ?? ISSUE_DIMENSIONS[issue.errorTypeCode],
    explanation:
      issue.explanation.trim() || PUBLIC_ISSUE_EXPLANATIONS[issue.errorTypeCode],
    correction: issue.correction.trim(),
  }));
  const issueNames = Array.from(
    new Set(issues.map((issue) => ISSUE_NAMES[issue.errorTypeCode]))
  );
  const feedbackText = feedback.isCorrect
    ? "这句可以。目标语法、意思和语体都符合题目。"
    : issues.length === 1
      ? issues[0]
        ? directVerdictForIssue(issues[0], feedback.explanation)
        : DIRECT_ISSUE_VERDICTS.semantic_error
      : issues.length > 1
        ? `这句有 ${issues.length} 个地方需要调整：${issueNames.join("、")}。`
        : "这句还没有完整达到题目要求。";
  const explanation =
    feedback.explanation.trim() ||
    issues.map((issue) => issue.explanation).join(" ") ||
    feedbackText;

  return {
    ...feedback,
    issues,
    feedbackText,
    explanation,
    nextHint:
      feedback.nextHint.trim() ||
      (feedback.isCorrect
        ? "换一个场景，再独立说一次。"
        : "按上面的具体问题修改后，再提交一次。"),
  } as T;
}
