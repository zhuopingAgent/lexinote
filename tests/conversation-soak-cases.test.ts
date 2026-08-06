import { describe, expect, it } from "vitest";
import {
  ADDITIONAL_CONVERSATION_SOAK_CASES,
  BASELINE_CONVERSATION_SOAK_CASES,
  CONVERSATION_SOAK_CASES,
  buildConversationSoakCases,
} from "../scripts/conversation-soak-cases.mjs";
import {
  evaluateConversationSoakResult,
  summarizeConversationSoakResults,
} from "../scripts/conversation-soak-evaluator.mjs";

function completedResult(overrides: Record<string, unknown> = {}) {
  return {
    assistantMessage: { status: "completed", content: "我会试试看。" },
    analysis: {
      analysis: { status: "completed" },
      learningItems: [],
    },
    maintenance: {
      session: { title: "尝试一下", summary: "用户表示会尝试。" },
      memories: [],
    },
    ...overrides,
  };
}

describe("optional conversation Agent soak contracts", () => {
  it("keeps a diverse, bounded corpus for opt-in live runs", () => {
    expect(BASELINE_CONVERSATION_SOAK_CASES).toHaveLength(120);
    expect(ADDITIONAL_CONVERSATION_SOAK_CASES).toHaveLength(300);
    expect(CONVERSATION_SOAK_CASES).toHaveLength(420);
    expect(buildConversationSoakCases()).toEqual(CONVERSATION_SOAK_CASES);
    expect(buildConversationSoakCases(7)).not.toEqual(CONVERSATION_SOAK_CASES);
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.id)).size).toBe(
      CONVERSATION_SOAK_CASES.length
    );
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.mode))).toEqual(
      new Set([
        "chat",
        "auto",
        "zh_to_ja",
        "ja_to_zh",
        "polish_ja",
        "explain_ja",
      ])
    );
    expect(
      CONVERSATION_SOAK_CASES.every((testCase) => testCase.input.length <= 8_000)
    ).toBe(true);
    expect(
      new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.scenario)).size
    ).toBeGreaterThanOrEqual(30);
    expect(
      ADDITIONAL_CONVERSATION_SOAK_CASES.every(
        (testCase) => testCase.riskTags.length >= 2 && testCase.input.length >= 20
      )
    ).toBe(true);
    expect(
      new Set(ADDITIONAL_CONVERSATION_SOAK_CASES.map((testCase) => testCase.input))
        .size
    ).toBe(300);
  });

  it("flags known-wrong response signals", () => {
    const evaluation = evaluateConversationSoakResult(
      {
        id: "contextual-answer",
        mode: "auto",
        input: "店员问要不要续杯，我说大丈夫です。",
        expect: {
          responseLanguage: "zh",
          responseAny: ["不需要"],
          responseNone: ["身体健康"],
          learning: null,
        },
      },
      completedResult({
        assistantMessage: { status: "completed", content: "意思是身体健康。" },
      })
    );

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "forbidden_response_signal"
    );
  });

  it("requires Chinese explanations alongside polished Japanese", () => {
    const evaluation = evaluateConversationSoakResult(
      {
        id: "polish-japanese-explanation",
        mode: "polish_ja",
        input: "この文章を直してください。",
        expect: {
          responseLanguage: "mixed",
          responseAny: ["修正"],
          responseNone: [],
          learning: null,
        },
      },
      completedResult({
        assistantMessage: {
          status: "completed",
          content: "修正後の文です。表現を自然にしました。",
        },
      })
    );

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "missing_chinese_explanation"
    );
  });

  it("accepts a completed grounded and promotable result", () => {
    const testCase = {
      id: "attempt",
      mode: "auto",
      input: "試してみます",
      expect: {
        responseLanguage: "zh",
        responseAny: ["试"],
        responseNone: [],
        learning: { kind: "grammar", surfaceForm: "〜てみる" },
      },
    };
    const evaluation = evaluateConversationSoakResult(
      testCase,
      completedResult({
        analysis: {
          analysis: { status: "completed" },
          learningItems: [
            {
              kind: "grammar",
              surfaceForm: "〜てみる",
              reading: null,
              meaningZh: "试着",
              explanationZh: "表示尝试。",
              sourceExcerpt: "試してみます",
              status: "suggested",
              grammarCandidates: [{ canonicalForm: "〜てみる" }],
            },
          ],
        },
      })
    );
    expect(evaluation).toEqual({ status: "passed", issues: [] });
  });

  it("flags duplicate, ungrounded, and unpromotable learning output", () => {
    const testCase = {
      id: "attempt",
      mode: "auto",
      input: "試してみます",
      expect: {
        responseLanguage: "zh",
        responseAny: ["试"],
        responseNone: [],
        learning: { kind: "grammar", surfaceForm: "〜てみる" },
      },
    };
    const item = {
      kind: "grammar",
      surfaceForm: "〜てみる",
      reading: "尝试",
      meaningZh: "试着",
      explanationZh: "表示尝试。",
      sourceExcerpt: "不存在",
      status: "suggested",
      grammarCandidates: [],
    };
    const evaluation = evaluateConversationSoakResult(
      testCase,
      completedResult({
        analysis: {
          analysis: { status: "completed" },
          learningItems: [item, item],
        },
      })
    );
    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "duplicate_learning_item",
        "duplicate_learning_surface",
        "invalid_source_excerpt",
        "invalid_reading",
        "grammar_reading",
        "invalid_promotable_grammar",
        "expected_grammar_not_promotable",
      ])
    );
  });

  it("flags untranslated Chinese and malformed learning surfaces", () => {
    const evaluation = evaluateConversationSoakResult(
      {
        id: "allergy",
        mode: "zh_to_ja",
        input: "我对花生过敏，请店员确认。",
        expect: {
          responseLanguage: "ja",
          responseAny: ["アレルギー"],
          responseNone: [],
          learning: null,
        },
      },
      completedResult({
        assistantMessage: {
          status: "completed",
          content: "花生アレルギーがあります。ご確認いただけますか。",
        },
        analysis: {
          analysis: { status: "completed" },
          learningItems: [
            {
              kind: "grammar",
              surfaceForm: "くださいませんか/いただけますか",
              reading: null,
              meaningZh: "能请您……吗",
              explanationZh: "错误的复合标签。",
              sourceExcerpt: "ご確認いただけますか",
              status: "needs_review",
              grammarCandidates: [],
            },
            {
              kind: "expression",
              surfaceForm: "花生アレルギーがあります。",
              reading: null,
              meaningZh: "我对花生过敏",
              explanationZh: "整句候选。",
              sourceExcerpt: "花生アレルギーがあります。",
              status: "suggested",
              grammarCandidates: [],
            },
            {
              kind: "grammar",
              surfaceForm: "が入っていないか",
              reading: null,
              meaningZh: "是否不含有……",
              explanationZh: "低价值从句。",
              sourceExcerpt: "花生アレルギーがあります。",
              status: "needs_review",
              grammarCandidates: [],
            },
          ],
        },
      })
    );

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "untranslated_chinese_in_japanese",
        "composite_grammar_surface",
        "sentence_learning_surface",
        "low_value_grammar",
      ])
    );
  });

  it("flags an inaccurate 住民票 translation", () => {
    const testCase = CONVERSATION_SOAK_CASES.find(
      (candidate) => candidate.id === "auto-explicit-word"
    );
    expect(testCase).toBeDefined();

    const evaluation = evaluateConversationSoakResult(
      testCase!,
      completedResult({
        assistantMessage: {
          status: "completed",
          content:
            "「住民票」は中国語で「居民户口簿」と言います。文脈によって使い分けます。",
        },
      })
    );
    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "inaccurate_word_translation"
    );
  });

  it("summarizes pass, warning, and failure independently", () => {
    expect(
      summarizeConversationSoakResults([
        {
          testCase: { mode: "chat" },
          evaluation: { status: "passed", issues: [] },
        },
        {
          testCase: { mode: "auto" },
          evaluation: {
            status: "warning",
            issues: [{ code: "quality", severity: "warning" }],
          },
        },
        {
          testCase: { mode: "auto" },
          evaluation: {
            status: "failed",
            issues: [{ code: "quality", severity: "error" }],
          },
        },
      ])
    ).toMatchObject({
      total: 3,
      passed: 1,
      warning: 1,
      failed: 1,
      issueCounts: { quality: 2 },
    });
  });
});
