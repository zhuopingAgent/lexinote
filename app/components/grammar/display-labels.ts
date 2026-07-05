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
  connection_error: "接续错误",
  tense_mismatch: "时态不匹配",
  missing_target_grammar: "目标语法缺失",
  unnatural_expression: "表达不自然",
};

const REVIEW_STATUS_LABELS: Record<string, string> = {
  new: "新项目",
  learning: "学习中",
  reviewing: "复习中",
  mastered: "已掌握",
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
