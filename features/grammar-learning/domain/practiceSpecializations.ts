import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { PracticeExerciseType } from "@/shared/types/practice";
import type { LearningObjective } from "@/features/grammar-learning/domain/practiceV2";

export const GRAMMAR_PRACTICE_CONTENT_VERSION = "2026.07.11.2";

export type PracticeSpecialization = {
  id: string;
  version: number;
  nameZh: string;
  canonicalForms: string[];
  pointTypes: GrammarPointDetail["pointType"][];
  priorityObjectives: LearningObjective[];
  supportedExerciseTypes: PracticeExerciseType[];
  misconceptionCodes: string[];
  hintEmphasis: string[];
};

export const PRACTICE_SPECIALIZATIONS: PracticeSpecialization[] = [
  {
    id: "basic_sentence_patterns",
    version: 1,
    nameZh: "基础句型专项",
    canonicalForms: ["AはBです", "Aがあります", "Aがいます"],
    pointTypes: ["sentence_pattern"],
    priorityObjectives: ["meaning", "form_connection"],
    supportedExerciseTypes: ["meaning_choice", "form_repair", "guided_translation"],
    misconceptionCodes: ["particle_error", "semantic_error"],
    hintEmphasis: ["主题与主语", "存在地点", "有生命与无生命"],
  },
  {
    id: "core_particles",
    version: 1,
    nameZh: "核心助词专项",
    canonicalForms: ["は", "が", "を", "に", "で", "へ", "と", "から", "まで", "より"],
    pointTypes: ["particle"],
    priorityObjectives: ["grammar_selection", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "form_repair", "guided_translation"],
    misconceptionCodes: ["particle_error", "semantic_error"],
    hintEmphasis: ["句子成分关系", "动作地点与存在地点", "主题与焦点"],
  },
  {
    id: "core_conjugation",
    version: 1,
    nameZh: "核心活用专项",
    canonicalForms: ["て形", "た形", "ない形", "普通形", "ます形", "ば形"],
    pointTypes: ["conjugation"],
    priorityObjectives: ["form_connection", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "form_repair", "guided_translation"],
    misconceptionCodes: ["conjugation_error", "connection_error"],
    hintEmphasis: ["词类", "词尾变化", "后续表达要求"],
  },
  {
    id: "tense_aspect",
    version: 1,
    nameZh: "时态与体专项",
    canonicalForms: ["〜ている", "〜てある", "〜てくる", "〜ていく", "〜たばかり"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["meaning", "form_connection"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "form_repair", "guided_translation", "contextual_response"],
    misconceptionCodes: ["tense_aspect_error", "connection_error", "semantic_error"],
    hintEmphasis: ["进行", "结果状态", "习惯状态", "时间基准"],
  },
  {
    id: "condition_system",
    version: 1,
    nameZh: "条件表达专项",
    canonicalForms: ["〜たら", "〜ば", "〜と", "〜なら"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["grammar_selection", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "form_repair", "guided_translation", "contextual_response"],
    misconceptionCodes: ["semantic_error", "connection_error"],
    hintEmphasis: ["时间先后", "一般规律", "前提承接", "后句限制"],
  },
  {
    id: "reason_explanation",
    version: 1,
    nameZh: "原因说明专项",
    canonicalForms: ["〜から", "〜ので", "〜ため", "〜おかげで", "〜せいで"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["grammar_selection", "register_control"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "register_rewrite", "guided_translation"],
    misconceptionCodes: ["semantic_error", "register_mismatch", "connection_error"],
    hintEmphasis: ["主观与客观", "礼貌度", "结果评价"],
  },
  {
    id: "inference_sources",
    version: 1,
    nameZh: "推测与信息来源专项",
    canonicalForms: ["〜そうだ", "〜らしい", "〜ようだ", "〜みたいだ", "〜はず", "〜かもしれない"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["grammar_selection", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "form_repair", "guided_translation"],
    misconceptionCodes: ["semantic_error", "connection_error"],
    hintEmphasis: ["样态与传闻", "证据来源", "确定程度"],
  },
  {
    id: "requests_politeness",
    version: 1,
    nameZh: "请求与礼貌度专项",
    canonicalForms: ["〜てください", "〜てもらえますか", "〜ていただけますか", "〜ていただけないでしょうか"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["register_control", "form_connection"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "register_rewrite", "guided_translation", "contextual_response"],
    misconceptionCodes: ["register_mismatch", "connection_error"],
    hintEmphasis: ["人物关系", "请求负担", "缓冲表达"],
  },
  {
    id: "giving_receiving",
    version: 1,
    nameZh: "授受方向专项",
    canonicalForms: ["〜てあげる", "〜てくれる", "〜てもらう", "〜ていただく", "〜てくださる"],
    pointTypes: ["grammar_pattern"],
    priorityObjectives: ["grammar_selection", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "form_repair", "guided_translation", "contextual_response"],
    misconceptionCodes: ["giving_receiving_direction_error", "particle_error", "register_mismatch"],
    hintEmphasis: ["动作发出者", "受益者", "视点", "助词方向"],
  },
  {
    id: "honorific_business",
    version: 1,
    nameZh: "敬语与商务表达专项",
    canonicalForms: ["〜ております", "〜させていただきます", "お〜になる", "ご〜ください", "でございます"],
    pointTypes: ["register_concept", "grammar_pattern", "collocation"],
    priorityObjectives: ["register_control", "collocation_naturalness"],
    supportedExerciseTypes: ["meaning_choice", "register_rewrite", "guided_translation", "contextual_response"],
    misconceptionCodes: ["register_mismatch", "collocation_error", "unnatural_expression"],
    hintEmphasis: ["抬高对方", "压低自己", "固定商务搭配"],
  },
  {
    id: "collocation_naturalness",
    version: 1,
    nameZh: "高频搭配专项",
    canonicalForms: [],
    pointTypes: ["collocation"],
    priorityObjectives: ["collocation_naturalness", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "form_repair", "guided_translation", "contextual_response"],
    misconceptionCodes: ["collocation_error", "literal_translation", "unnatural_expression"],
    hintEmphasis: ["固定搭配", "动词选择", "避免逐字翻译"],
  },
  {
    id: "discourse_organization",
    version: 1,
    nameZh: "篇章连接专项",
    canonicalForms: [],
    pointTypes: ["discourse_marker"],
    priorityObjectives: ["discourse_function", "meaning"],
    supportedExerciseTypes: ["meaning_choice", "contrast_choice", "guided_translation", "contextual_response"],
    misconceptionCodes: ["semantic_error", "literal_translation", "unnatural_expression"],
    hintEmphasis: ["前后逻辑", "信息推进", "口语与书面语"],
  },
];

export function resolvePracticeSpecialization(
  grammarPoint: GrammarPointDetail
): PracticeSpecialization | null {
  const canonicalForm = grammarPoint.canonicalForm ?? grammarPoint.grammarPoint;
  return PRACTICE_SPECIALIZATIONS.find((profile) =>
    profile.canonicalForms.includes(canonicalForm)
  ) ?? PRACTICE_SPECIALIZATIONS.find((profile) =>
    profile.canonicalForms.length === 0 && profile.pointTypes.includes(grammarPoint.pointType)
  ) ?? null;
}

export function findPracticeSpecialization(id: string | null | undefined) {
  return id ? PRACTICE_SPECIALIZATIONS.find((profile) => profile.id === id) ?? null : null;
}
