import type {
  FeedbackIssueSeverity,
  GrammarPointType,
} from "@/shared/types/grammar";

const REGISTER_TAG_LABELS: Record<string, string> = {
  casual: "朋友口语",
  polite: "一般礼貌",
  business: "商务",
  formal: "正式",
  written: "书面",
  customer: "店员 / 客服用语",
  academic: "学术",
  news: "新闻",
  rough: "粗鲁 / 很随便",
  soft: "柔和表达",
};

const MISTAKE_TYPE_LABELS: Record<string, string> = {
  wrong_register: "语体不匹配",
  register_mismatch: "语体不匹配",
  connection_error: "接续错误",
  conjugation_error: "活用错误",
  particle_error: "助词错误",
  tense_mismatch: "时态不匹配",
  tense_aspect_error: "时态与体错误",
  giving_receiving_direction_error: "授受方向错误",
  semantic_error: "语义错误",
  collocation_error: "搭配错误",
  literal_translation: "中文直译与不自然表达",
  missing_target_grammar: "目标语法缺失",
  unnatural_expression: "表达不自然",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  new: "新项目",
  learning: "学习中",
  reviewing: "学习中",
  mastered: "已掌握",
};

const GRAMMAR_POINT_TYPE_LABELS: Record<GrammarPointType, string> = {
  grammar_pattern: "语法表达",
  conjugation: "活用形式",
  sentence_pattern: "句型",
  syntax_concept: "句法概念",
  particle: "助词",
  collocation: "搭配",
  register_concept: "语体概念",
  discourse_marker: "篇章连接表达",
};

export function displayRegisterTagLabel(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return REGISTER_TAG_LABELS[value] ?? value;
}

export function displayMistakeTypeLabel(value: string) {
  return MISTAKE_TYPE_LABELS[value] ?? value;
}

export function displayReviewStatusLabel(value: string) {
  return REVIEW_STATUS_LABELS[value] ?? value;
}

export function displayGrammarPointTypeLabel(value: GrammarPointType) {
  return GRAMMAR_POINT_TYPE_LABELS[value];
}

export function displayFeedbackSeverityLabel(value: FeedbackIssueSeverity) {
  return value === "critical"
    ? "严重"
    : value === "high"
      ? "较高"
      : value === "medium"
        ? "中等"
        : "较低";
}
