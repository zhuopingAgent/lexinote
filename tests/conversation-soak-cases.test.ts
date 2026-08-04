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

describe("conversation production soak corpus", () => {
  it("contains exactly 400 unique, deterministic, evenly distributed cases", () => {
    expect(BASELINE_CONVERSATION_SOAK_CASES).toHaveLength(100);
    expect(ADDITIONAL_CONVERSATION_SOAK_CASES).toHaveLength(300);
    expect(CONVERSATION_SOAK_CASES).toHaveLength(400);
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.id)).size).toBe(400);
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
      auto: 80,
      explain_ja: 80,
      ja_to_zh: 80,
      polish_ja: 80,
      zh_to_ja: 80,
    });
    expect(new Set(CONVERSATION_SOAK_CASES.map((testCase) => testCase.scenario)).size)
      .toBeGreaterThanOrEqual(30);
    expect(new Set(ADDITIONAL_CONVERSATION_SOAK_CASES.map((testCase) => testCase.scenario)).size)
      .toBeGreaterThanOrEqual(30);
    expect(
      new Set(ADDITIONAL_CONVERSATION_SOAK_CASES.flatMap((testCase) => testCase.riskTags)).size
    ).toBeGreaterThanOrEqual(100);
    expect(
      ADDITIONAL_CONVERSATION_SOAK_CASES.every(
        (testCase) => testCase.riskTags.length >= 2 && testCase.input.length >= 20
      )
    ).toBe(true);
    expect(
      new Set(ADDITIONAL_CONVERSATION_SOAK_CASES.map((testCase) => testCase.input)).size
    ).toBe(300);
    expect(
      ADDITIONAL_CONVERSATION_SOAK_CASES.every(
        (testCase) =>
          testCase.expect.responseAny.length > 0 &&
          testCase.expect.responseNone.every(
            (signal: string) => !testCase.expect.responseAny.includes(signal)
          )
      )
    ).toBe(true);
    expect(
      ADDITIONAL_CONVERSATION_SOAK_CASES.filter(
        (testCase) => testCase.mode === "zh_to_ja"
      ).every((testCase) => /[\u3400-\u9fff]/u.test(testCase.input))
    ).toBe(true);
    expect(
      ADDITIONAL_CONVERSATION_SOAK_CASES.filter((testCase) =>
        ["ja_to_zh", "polish_ja"].includes(testCase.mode)
      ).every((testCase) => /[\u3040-\u30ff]/u.test(testCase.input))
    ).toBe(true);
    expect(CONVERSATION_SOAK_CASES.every((testCase) => testCase.input.length <= 8_000)).toBe(true);
  });

  it("flags known-wrong response signals declared by a case", () => {
    const testCase = {
      id: "contextual-answer",
      mode: "auto",
      input: "店员问要不要续杯，我说大丈夫です。",
      expect: {
        responseLanguage: "zh",
        responseAny: ["不需要"],
        responseNone: ["身体健康"],
        learning: null,
      },
    };
    const evaluation = evaluateConversationSoakResult(testCase, {
      assistantMessage: { status: "completed", content: "意思是身体健康。" },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "语境翻译", summary: "说明语境表达。" },
        memories: [],
        learningItems: [],
      },
    });

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "forbidden_response_signal"
    );
  });

  it("does not mistake Japanese kanji for a Chinese explanation", () => {
    const testCase = {
      id: "polish-japanese-explanation",
      mode: "polish_ja",
      input: "この文章を直してください。",
      expect: {
        responseLanguage: "mixed",
        responseAny: ["修正"],
        responseNone: [],
        learning: null,
      },
    };
    const evaluation = evaluateConversationSoakResult(testCase, {
      assistantMessage: {
        status: "completed",
        content: "修正後の文です。表現を自然にしました。",
      },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "日语润色", summary: "修正了日语表达。" },
        memories: [],
        learningItems: [],
      },
    });

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "missing_chinese_explanation"
    );
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
          {
            kind: "grammar",
            surfaceForm: "が入っていないか",
            reading: null,
            meaningZh: "是否不含有……",
            sourceExcerpt: "花生アレルギーがあります。",
            status: "needs_review",
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
        "low_value_grammar",
      ])
    );
  });

  it("flags an inaccurate Japanese explanation for the 住民票 word case", () => {
    const testCase = CONVERSATION_SOAK_CASES.find(
      (candidate) => candidate.id === "auto-explicit-word"
    );
    expect(testCase).toBeDefined();

    const evaluation = evaluateConversationSoakResult(testCase!, {
      assistantMessage: {
        status: "completed",
        content:
          "「住民票」は中国語で「居民户口簿」と言います。文脈によって使い分けます。",
      },
      analysis: {
        message: { analysisStatus: "completed" },
        session: { title: "住民票", summary: "住民票的中文表达。" },
        memories: [],
        learningItems: [],
      },
    });

    expect(evaluation.status).toBe("failed");
    expect(evaluation.issues.map((entry) => entry.code)).toContain(
      "inaccurate_word_translation"
    );
  });
});
