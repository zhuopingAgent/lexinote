const HAN_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u;
const KANA_PATTERN = /[\u3040-\u30ff]/u;
const CHINESE_SIGNAL_PATTERN = /[这请说语时为会应过将与发实习问词译还较让给从门开关变认为区别说明表示正确]/u;
const MARKDOWN_PATTERN = /(?:\*\*|__|```|<\/?[a-z][^>]*>)/iu;
const META_SUMMARY_PATTERN = /(?:学习项|候选).*(?:提取|分析)|\b(?:grammar|vocabulary|expression)\b/iu;
const HANGUL_PATTERN = /[\u1100-\u11ff\u3130-\u318f\uac00-\ud7af]/u;
const LOW_VALUE_GRAMMAR = new Set([
  "には",
  "必要です",
  "いただけますか",
  "をいただけますか",
  "があります",
  "ひとつの",
  "一つの",
]);
const UNTRANSLATED_CHINESE_JAPANESE_PATTERN = /花生(?:アレルギー)?/u;

function normalizeGrammar(value) {
  return value.normalize("NFKC").replace(/[~～]/gu, "〜").replace(/\s+/gu, "").replace(/^〜+/u, "");
}

function learningKey(item) {
  const surface = item.kind === "grammar"
    ? normalizeGrammar(item.surfaceForm)
    : item.surfaceForm.normalize("NFKC").trim().toLowerCase();
  return JSON.stringify([item.kind, surface, item.meaningZh.normalize("NFKC").trim().toLowerCase()]);
}

function issue(code, message, severity = "error") {
  return { code, message, severity };
}

export function evaluateConversationSoakResult(testCase, result) {
  const issues = [];
  if (result.error) {
    issues.push(issue("request_failed", result.error));
    return { status: "failed", issues };
  }

  const assistant = result.assistantMessage;
  const analysis = result.analysis;
  const content = assistant?.content?.trim() ?? "";
  const learningItems = analysis?.learningItems ?? [];
  const memories = analysis?.memories ?? [];

  if (assistant?.status !== "completed") {
    issues.push(issue("assistant_not_completed", `assistant status: ${assistant?.status ?? "missing"}`));
  }
  if (!content) issues.push(issue("empty_response", "assistant response is empty"));
  if (content.length > 8_000) issues.push(issue("response_too_long", "assistant response exceeds 8,000 characters"));
  if (MARKDOWN_PATTERN.test(content)) issues.push(issue("formatted_response", "assistant response contains forbidden Markdown or HTML"));
  if (analysis?.message?.analysisStatus !== "completed") {
    issues.push(issue("analysis_not_completed", `analysis status: ${analysis?.message?.analysisStatus ?? "missing"}`));
  }
  if (!analysis?.session?.title || analysis.session.title === "新对话") {
    issues.push(issue("missing_title", "first analysis did not produce a useful title", "warning"));
  }
  if (META_SUMMARY_PATTERN.test(analysis?.session?.summary ?? "")) {
    issues.push(issue("meta_summary", "summary contains extraction metadata"));
  }
  if (memories.length > 0) {
    issues.push(issue("unexpected_memory", "ordinary test turn suggested memory", "warning"));
  }

  const language = testCase.expect.responseLanguage;
  if ((language === "ja" || language === "mixed") && !KANA_PATTERN.test(content)) {
    issues.push(issue("missing_japanese", "expected Japanese text was not found"));
  }
  if (
    (language === "ja" || language === "mixed") &&
    UNTRANSLATED_CHINESE_JAPANESE_PATTERN.test(content)
  ) {
    issues.push(issue("untranslated_chinese_in_japanese", "Japanese output contains the untranslated Chinese word 花生"));
  }
  if (language === "zh" && !HAN_PATTERN.test(content)) {
    issues.push(issue("missing_chinese", "expected Chinese text was not found"));
  }
  if (language === "mixed" && !CHINESE_SIGNAL_PATTERN.test(content)) {
    issues.push(issue("missing_chinese_explanation", "expected a Chinese explanation alongside Japanese text"));
  }
  if (testCase.mode === "explain_ja" && /(?:^|\n)(?:意味|接続|ポイント)[：:]/u.test(content)) {
    issues.push(issue("japanese_explanation_heading", "explanation mode used Japanese section headings"));
  }
  if (
    testCase.expect.responseAny.length > 0 &&
    !testCase.expect.responseAny.some((value) => content.includes(value))
  ) {
    issues.push(issue("expected_response_signal_missing", `none of the expected signals appeared: ${testCase.expect.responseAny.join(", ")}`, "warning"));
  }

  if (learningItems.length > 5) {
    issues.push(issue("too_many_learning_items", `analysis returned ${learningItems.length} learning items`));
  }
  const keys = learningItems.map(learningKey);
  if (new Set(keys).size !== keys.length) {
    issues.push(issue("duplicate_learning_item", "analysis returned duplicate learning items"));
  }
  const surfaces = learningItems.map((item) => `${item.kind}:${normalizeGrammar(item.surfaceForm)}`);
  if (new Set(surfaces).size !== surfaces.length) {
    issues.push(issue("duplicate_learning_surface", "analysis repeated the same learning surface", "warning"));
  }

  for (const item of learningItems) {
    if (!item.sourceExcerpt || (!testCase.input.includes(item.sourceExcerpt) && !content.includes(item.sourceExcerpt))) {
      issues.push(issue("invalid_source_excerpt", `${item.kind}:${item.surfaceForm} has an ungrounded source excerpt`));
    }
    if (item.reading && (!KANA_PATTERN.test(item.reading) || HAN_PATTERN.test(item.reading))) {
      issues.push(issue("invalid_reading", `${item.surfaceForm} has an invalid reading: ${item.reading}`));
    }
    if (HANGUL_PATTERN.test(item.meaningZh ?? "") || HANGUL_PATTERN.test(item.explanationZh ?? "")) {
      issues.push(issue("unexpected_hangul", `${item.kind}:${item.surfaceForm} contains Hangul`));
    }
    if (item.kind === "grammar" && item.reading !== null) {
      issues.push(issue("grammar_reading", `${item.surfaceForm} should not have a reading`));
    }
    if (item.kind === "grammar" && LOW_VALUE_GRAMMAR.has(item.surfaceForm)) {
      issues.push(issue("low_value_grammar", `low-value grammar candidate: ${item.surfaceForm}`));
    }
    if (/[。！？?!]/u.test(item.surfaceForm)) {
      issues.push(issue("sentence_learning_surface", `sentence-shaped learning candidate: ${item.surfaceForm}`));
    }
    if (item.kind === "grammar" && /[\/／]/u.test(item.surfaceForm)) {
      issues.push(issue("composite_grammar_surface", `combined grammar candidate: ${item.surfaceForm}`));
    }
    if (item.kind === "grammar" && item.status === "suggested" && item.grammarCandidates.length !== 1) {
      issues.push(issue("invalid_promotable_grammar", `${item.surfaceForm} is suggested without exactly one grammar match`));
    }
  }

  const expectedLearning = testCase.expect.learning;
  if (expectedLearning) {
    const matched = learningItems.find(
      (item) =>
        item.kind === expectedLearning.kind &&
        (item.kind === "grammar"
          ? normalizeGrammar(item.surfaceForm) === normalizeGrammar(expectedLearning.surfaceForm)
          : item.surfaceForm.normalize("NFKC") === expectedLearning.surfaceForm.normalize("NFKC"))
    );
    if (!matched) {
      issues.push(issue("expected_learning_missing", `missing ${expectedLearning.kind}:${expectedLearning.surfaceForm}`));
    } else if (
      matched.kind === "grammar" &&
      (matched.status !== "suggested" || matched.grammarCandidates.length !== 1)
    ) {
      issues.push(issue("expected_grammar_not_promotable", `${matched.surfaceForm} is not directly promotable`));
    }
  }

  const hasError = issues.some((entry) => entry.severity === "error");
  const hasWarning = issues.some((entry) => entry.severity === "warning");
  return {
    status: hasError ? "failed" : hasWarning ? "warning" : "passed",
    issues,
  };
}

export function summarizeConversationSoakResults(results) {
  const summary = {
    total: results.length,
    passed: 0,
    warning: 0,
    failed: 0,
    byMode: {},
    issueCounts: {},
  };
  for (const result of results) {
    summary[result.evaluation.status] += 1;
    summary.byMode[result.testCase.mode] ??= { total: 0, passed: 0, warning: 0, failed: 0 };
    summary.byMode[result.testCase.mode].total += 1;
    summary.byMode[result.testCase.mode][result.evaluation.status] += 1;
    for (const entry of result.evaluation.issues) {
      summary.issueCounts[entry.code] = (summary.issueCounts[entry.code] ?? 0) + 1;
    }
  }
  return summary;
}
