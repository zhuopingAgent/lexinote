import { describe, expect, it } from "vitest";
import {
  CONVERSATION_SOAK_CASES,
  buildConversationSoakCases,
} from "../scripts/conversation-soak-cases.mjs";
import {
  evaluateConversationSoakResult,
  summarizeConversationSoakResults,
} from "../scripts/conversation-soak-evaluator.mjs";

describe("conversation production soak corpus", () => {
  it("contains exactly 100 unique, deterministic, evenly distributed cases", () => {
    expect(CONVERSATION_SOAK_CASES).toHaveLength(100);
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.id)).size).toBe(100);
    expect(buildConversationSoakCases()).toEqual(CONVERSATION_SOAK_CASES);
    expect(buildConversationSoakCases(7)).not.toEqual(CONVERSATION_SOAK_CASES);

    const modeCounts = CONVERSATION_SOAK_CASES.reduce<Record<string, number>>(
      (counts, testCase) => ({
        ...counts,
        [testCase.mode]: (counts[testCase.mode] ?? 0) + 1,
      }),
      {}
    );
    expect(modeCounts).toEqual({
      auto: 20,
      explain_ja: 20,
      ja_to_zh: 20,
      polish_ja: 20,
      zh_to_ja: 20,
    });
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.scenario)).size)
      .toBeGreaterThanOrEqual(12);
    expect(CONVERSATION_SOAK_CASES.every((testCase) => testCase.input.length <= 8_000)).toBe(true);
  });

  it("flags duplicate, ungrounded, invalid-reading, and unpromotable output", () => {
    const testCase = {
      id: "case",
      mode: "auto",
      input: "試してみます",
      expect: {
        responseLanguage: "zh",
        responseAny: ["试"],
        learning: { kind: "grammar", surfaceForm: "〜てみる" },
      },
    };
    const item = {
      kind: "grammar",
      surfaceForm: "〜てみる",
      reading: "尝试",
      meaningZh: "试着",
      sourceExcerpt: "不存在",
      status: "suggested",
      grammarCandidates: [],
    };
    const result = {
      assistantMessage: { status: "completed", content: "我会试试看。" },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "尝试", summary: "" },
        memories: [],
        learningItems: [item, item],
      },
    };

    const evaluation = evaluateConversationSoakResult(testCase, result);
    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "duplicate_learning_item",
        "duplicate_learning_surface",
        "invalid_source_excerpt",
        "invalid_reading",
        "invalid_promotable_grammar",
        "expected_grammar_not_promotable",
      ])
    );
  });

  it("accepts a completed grounded and promotable result and summarizes statuses", () => {
    const testCase = {
      id: "case",
      mode: "auto",
      input: "試してみます",
      expect: {
        responseLanguage: "zh",
        responseAny: ["试"],
        learning: { kind: "grammar", surfaceForm: "〜てみる" },
      },
    };
    const result = {
      assistantMessage: { status: "completed", content: "我会试试看。" },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "尝试一下", summary: "用户表示会尝试。" },
        memories: [],
        learningItems: [
          {
            kind: "grammar",
            surfaceForm: "〜てみる",
            reading: null,
            meaningZh: "试着",
            sourceExcerpt: "試してみます",
            status: "suggested",
            grammarCandidates: [{ canonicalForm: "〜てみる" }],
          },
        ],
      },
    };
    const evaluation = evaluateConversationSoakResult(testCase, result);
    expect(evaluation).toEqual({ status: "passed", issues: [] });
    expect(
      summarizeConversationSoakResults([
        { testCase, evaluation },
        {
          testCase: { ...testCase, mode: "explain_ja" },
          evaluation: {
            status: "warning",
            issues: [{ code: "warning", message: "warning", severity: "warning" }],
          },
        },
      ])
    ).toMatchObject({
      total: 2,
      passed: 1,
      warning: 1,
      failed: 0,
      issueCounts: { warning: 1 },
    });
  });

  it("flags untranslated Chinese and malformed learning surfaces", () => {
    const testCase = {
      id: "allergy",
      mode: "zh_to_ja",
      input: "我对花生过敏，请店员确认。",
      expect: {
        responseLanguage: "ja",
        responseAny: ["アレルギー"],
        learning: null,
      },
    };
    const result = {
      assistantMessage: {
        status: "completed",
        content: "花生アレルギーがあります。ご確認いただけますか。",
      },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "过敏确认", summary: "用户说明花生过敏。" },
        memories: [],
        learningItems: [
          {
            kind: "grammar",
            surfaceForm: "くださいませんか/いただけますか",
            reading: null,
            meaningZh: "能请您……吗",
            sourceExcerpt: "ご確認いただけますか",
            status: "needs_review",
            grammarCandidates: [],
          },
          {
            kind: "expression",
            surfaceForm: "花生アレルギーがあります。",
            reading: null,
            meaningZh: "我对花生过敏",
            sourceExcerpt: "花生アレルギーがあります。",
            status: "suggested",
            grammarCandidates: [],
          },
        ],
      },
    };

    const evaluation = evaluateConversationSoakResult(testCase, result);
    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "untranslated_chinese_in_japanese",
        "composite_grammar_surface",
        "sentence_learning_surface",
      ])
    );
  });
});
