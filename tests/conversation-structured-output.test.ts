import { describe, expect, it } from "vitest";
import {
  MAX_ANALYSIS_ITEMS,
  parseConversationLearningAnalysisOutput,
  parseConversationMaintenanceOutput,
  validateConversationAnalysisReferences,
} from "@/features/conversation/domain/conversation";

function parseItems(items: unknown[]) {
  return parseConversationLearningAnalysisOutput(
    JSON.stringify({ overview: "学习重点", learning_items: items })
  );
}

function rawItem(overrides: Record<string, unknown> = {}) {
  return {
    kind: "grammar",
    surface_form: "〜てみる",
    reading: null,
    meaning_zh: "试着……",
    explanation_zh: "表示尝试做某事。",
    source_excerpt: "試してみます",
    ...overrides,
  };
}

describe("conversation structured output", () => {
  it("rejects malformed top-level contracts", () => {
    expect(parseConversationLearningAnalysisOutput("not-json")).toBeNull();
    expect(parseConversationLearningAnalysisOutput("{}")).toBeNull();
    expect(parseConversationMaintenanceOutput("{}")).toBeNull();
  });

  it("normalizes, deduplicates, and caps learning items", () => {
    const items = Array.from({ length: 8 }, (_, index) =>
      rawItem({
        surface_form: index < 2 ? "～ てみる" : `〜ので${index}`,
        meaning_zh: index < 2 ? "试着……" : `原因${index}`,
        source_excerpt: index < 2 ? "試してみます" : `ので${index}`,
      })
    );
    const parsed = parseItems(items);
    expect(parsed?.learningItems).toHaveLength(MAX_ANALYSIS_ITEMS);
    expect(parsed?.learningItems[0].surfaceForm).toBe("〜てみる");
  });

  it("keeps kana readings and rejects translated reading text", () => {
    const parsed = parseItems([
      rawItem({
        kind: "vocabulary",
        surface_form: "在職証明書",
        reading: "在职证明",
        meaning_zh: "在职证明",
        explanation_zh: "证明当前在职的文件。",
        source_excerpt: "在職証明書",
      }),
      rawItem({
        kind: "vocabulary",
        surface_form: "領収書",
        reading: "りょうしゅうしょ",
        meaning_zh: "收据",
        explanation_zh: "付款凭证。",
        source_excerpt: "領収書",
      }),
    ]);
    expect(parsed?.learningItems.map((item) => item.reading)).toEqual([
      null,
      "りょうしゅうしょ",
    ]);
  });

  it("reclassifies lexical and contextual model mistakes", () => {
    const parsed = parseItems([
      rawItem({
        surface_form: "おっしゃった",
        reading: "おっしゃった",
        meaning_zh: "说的尊敬语",
        explanation_zh: "用于抬高动作主体。",
        source_excerpt: "おっしゃる",
      }),
      rawItem({
        surface_form: "アレルギーがあります",
        meaning_zh: "有过敏",
        explanation_zh: "描述自己有某种过敏。",
        source_excerpt: "ピーナッツアレルギーがあります",
      }),
      rawItem({
        kind: "vocabulary",
        surface_form: "大丈夫です",
        reading: "だいじょうぶです",
        meaning_zh: "不用了，谢谢",
        explanation_zh: "服务场景中的委婉拒绝。",
        source_excerpt: "大丈夫です",
      }),
    ]);
    expect(
      parsed?.learningItems.map((item) => [item.kind, item.surfaceForm])
    ).toEqual([
      ["vocabulary", "おっしゃる"],
      ["expression", "アレルギーがある"],
      ["expression", "大丈夫です"],
    ]);
  });

  it("drops contaminated, sentence-shaped, and meta-only candidates", () => {
    const parsed = parseItems([
      rawItem({ meaning_zh: "可以请 받다 的礼貌表达" }),
      rawItem({
        surface_form: "いただけますか",
        meaning_zh: "礼貌请求",
      }),
      rawItem({
        kind: "expression",
        surface_form: "ピーナッツアレルギーがあります。",
      }),
      rawItem({
        surface_form: "くださいませんか/いただけますか",
      }),
      rawItem({
        surface_form: "〜ていただけますか",
        meaning_zh: "能请您……吗",
        explanation_zh: "礼貌请求对方做某事。",
        source_excerpt: "確認していただけますか",
      }),
    ]);
    expect(parsed?.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜ていただけますか",
    ]);
  });

  it("normalizes inflected grammar to library forms", () => {
    const parsed = parseItems([
      rawItem({
        surface_form: "〜てもらいました",
        meaning_zh: "请别人做了某事",
        explanation_zh: "表示接受他人的帮助。",
        source_excerpt: "見せてもらいました",
      }),
      rawItem({
        surface_form: "〜ことになっています",
        meaning_zh: "既定规则",
        explanation_zh: "表示外部规则或安排。",
        source_excerpt: "ことになっています",
      }),
    ]);
    expect(parsed?.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜てもらう",
      "〜ことになっている",
    ]);
  });

  it("sanitizes summary meta-text and memory suggestions", () => {
    const parsed = parseConversationMaintenanceOutput(
      JSON.stringify({
        title: "练习",
        summary:
          "用户练习了过去形。规则回顾：学习项不超过5项。此次重点是自然表达。",
        memories: [
          {
            scope: "session",
            kind: "context",
            content: "当前轮对话：用户请求解释语法。",
          },
          {
            scope: "global",
            kind: "preference",
            content: "偏好简洁的商务日语",
          },
          {
            scope: "global",
            kind: "preference",
            content: "偏好简洁的商务日语",
          },
        ],
      })
    );
    expect(parsed).toEqual({
      title: "练习",
      summary: "用户练习了过去形。此次重点是自然表达。",
      memories: [
        {
          scope: "global",
          kind: "preference",
          content: "偏好简洁的商务日语",
        },
      ],
    });
  });

  it("requires exact quoted source evidence", () => {
    const parsed = parseItems([
      rawItem({
        kind: "expression",
        surface_form: "日程を変更する",
        reading: "にっていをへんこうする",
        meaning_zh: "更改日程",
        explanation_zh: "固定搭配。",
        source_excerpt: "日程を変更していただけますか",
      }),
      rawItem({
        surface_form: "〜ざるを得ない",
        meaning_zh: "不得不",
        explanation_zh: "并未出现。",
        source_excerpt: "行かざるを得ない",
      }),
    ]);
    const validated = validateConversationAnalysisReferences(parsed!, [
      { content: "日程を変更していただけますか。" },
    ]);
    expect(validated.learningItems.map((item) => item.surfaceForm)).toEqual([
      "日程を変更する",
    ]);
  });

  it("rejects grammar labels not evidenced by their own excerpt", () => {
    const parsed = parseItems([
      rawItem({
        source_excerpt:
          "このアカウントにログインできません。パスワードをリセットします。",
      }),
    ]);
    const validated = validateConversationAnalysisReferences(parsed!, [
      {
        content:
          "このアカウントにログインできません。パスワードをリセットします。",
      },
    ]);
    expect(validated.learningItems).toEqual([]);
  });
});
