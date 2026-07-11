import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FeedbackPanel } from "@/app/components/grammar/feedback-panel";
import type { AIFeedbackResult } from "@/shared/types/grammar";

const feedback: AIFeedbackResult = {
  isCorrect: false,
  grammarScore: 4,
  meaningScore: 4,
  naturalnessScore: 3,
  registerScore: 2,
  sceneFitScore: 3,
  issues: [
    {
      errorTypeCode: "register_mismatch",
      severity: "high",
      explanation: "对医生使用「もらえる？」礼貌度不足。",
      correction: "すみません、もう一度説明していただけますか。",
      relatedGrammarPointId: null,
    },
  ],
  explanation: "意思能懂，但对医生说「もらえる？」太随便。",
  nextHint: "把请求句尾改成礼貌形后再说一次。",
  feedbackText: "意思能懂，但当前说法对这个对象来说太随便。",
  correctedSentence: "すみません、もう一度説明していただけますか。",
  betterVersions: [],
  mistakeTypes: ["register_mismatch"],
  nextPracticePrompt: null,
};

describe("FeedbackPanel", () => {
  it("renders the attempt and direct coaching as a recorded conversation", () => {
    const html = renderToStaticMarkup(
      createElement(FeedbackPanel, {
        feedback,
        learnerAnswer: "先生、もう一度説明してもらえる？",
        isRecorded: true,
        embedded: true,
      })
    );

    expect(html).toContain('aria-label="练习反馈对话"');
    expect(html).toContain("你的回答");
    expect(html).toContain("LexiNote 教练");
    expect(html).toContain("太随便");
    expect(html).toContain("建议改为");
    expect(html).toContain("すみません、もう一度説明していただけますか。");
    expect(html).toContain("本次作答已记录");
    expect(html).toContain("查看本次评分");
  });
});
