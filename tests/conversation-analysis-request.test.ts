import { describe, expect, it } from "vitest";
import {
  normalizeConversationAnalysisFocus,
  parseConversationAnalysisCommand,
} from "@/features/conversation/domain/analysis-request";

describe("conversation analysis requests", () => {
  it.each([
    ["/analysis", { focus: "all", instruction: "" }],
    [
      "/analysis grammar 只看尝试表达",
      { focus: "grammar", instruction: "只看尝试表达" },
    ],
    [
      "/analysis 词汇 排除专有名词",
      { focus: "vocabulary", instruction: "排除专有名词" },
    ],
    [
      "/analysis 固定表达 只保留商务搭配",
      { focus: "expressions", instruction: "只保留商务搭配" },
    ],
  ] as const)("parses %s", (command, expected) => {
    expect(parseConversationAnalysisCommand(command)).toEqual(expected);
  });

  it("does not intercept ordinary chat messages", () => {
    expect(parseConversationAnalysisCommand("请分析这句话")).toBeNull();
    expect(parseConversationAnalysisCommand("/analysis-extra grammar")).toBeNull();
  });

  it("validates API focus independently from slash command parsing", () => {
    expect(normalizeConversationAnalysisFocus(undefined)).toBe("all");
    expect(normalizeConversationAnalysisFocus("grammar")).toBe("grammar");
    expect(() => normalizeConversationAnalysisFocus("sentiment")).toThrow(
      "analysis focus is invalid"
    );
  });
});
