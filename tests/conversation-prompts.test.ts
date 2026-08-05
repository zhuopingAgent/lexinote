import { describe, expect, it } from "vitest";
import {
  buildConversationAnalysisPrompt,
  buildConversationSystemPrompt,
} from "@/features/conversation/prompts/conversation";
import {
  makeConversationMemory,
  makeConversationMessage,
} from "@/tests/conversation-test-doubles";

const preferences = {
  defaultMode: "auto" as const,
  translationStyle: "natural_first" as const,
  defaultRegister: "business" as const,
  defaultCollectionId: null,
};

describe("conversation prompts", () => {
  it("keeps general chat general-purpose and in the user's language", () => {
    const prompt = buildConversationSystemPrompt({
      mode: "chat",
      preferences,
      globalMemories: [],
      sessionMemories: [],
      summary: "",
      currentUserContent: "帮我梳理一个旅行计划",
    });
    expect(prompt).toContain("LexiNote 的通用对话助手");
    expect(prompt).toContain("使用用户当前使用的语言回答");
    expect(prompt).not.toContain("核心结果必须是日语翻译");
  });

  it("injects only structured confirmed context into translation prompts", () => {
    const prompt = buildConversationSystemPrompt({
      mode: "zh_to_ja",
      preferences,
      globalMemories: [
        makeConversationMemory({
          sessionId: null,
          scope: "global",
          content: "优先给自然商务表达",
        }),
      ],
      sessionMemories: [makeConversationMemory({ content: "对方是客户" })],
      summary: "正在准备预约变更邮件。",
      currentUserContent: "请把会议改到下周二",
    });
    expect(prompt).toContain("把用户的中文完整翻译成自然、可直接使用的日语");
    expect(prompt).toContain("优先给自然商务表达");
    expect(prompt).toContain("对方是客户");
    expect(prompt).toContain("正在准备预约变更邮件");
    expect(prompt).toContain("不声称已经保存");
  });

  it("routes auto mode from the current turn instead of the summary", () => {
    const chinesePrompt = buildConversationSystemPrompt({
      mode: "auto",
      preferences,
      globalMemories: [],
      sessionMemories: [],
      summary: "上一轮把日语翻译成了中文。",
      currentUserContent: "这个账户我登录不上去。",
    });
    const japanesePrompt = buildConversationSystemPrompt({
      mode: "auto",
      preferences,
      globalMemories: [],
      sessionMemories: [],
      summary: "上一轮把中文翻译成了日语。",
      currentUserContent: "週末に新しいレシピを試してみます。",
    });
    const explicitPrompt = buildConversationSystemPrompt({
      mode: "auto",
      preferences,
      globalMemories: [],
      sessionMemories: [],
      summary: "上一轮是普通翻译。",
      currentUserContent: "请帮我润色这句日语：昨日、部長に会いました。",
    });
    expect(chinesePrompt).toContain("当前输入是完整中文");
    expect(chinesePrompt).toContain("核心结果必须是日语翻译");
    expect(chinesePrompt).toContain("不得沿用上一轮的日译中方向");
    expect(japanesePrompt).toContain("当前输入是日语");
    expect(japanesePrompt).toContain("核心结果必须是中文翻译");
    expect(explicitPrompt).toContain("当前输入含有明确任务指令");
    expect(explicitPrompt).toContain("不得沿用上一轮的任务方向");
  });

  it("turns first-person permission uncertainty into direct questions", () => {
    const prompt = buildConversationSystemPrompt({
      mode: "zh_to_ja",
      preferences,
      globalMemories: [],
      sessionMemories: [],
      summary: "",
      currentUserContent:
        "我可以拍展品，但不确定能否使用闪光灯，也不确定照片能否上传社交媒体。",
    });
    expect(prompt).toContain("当前输入包含己方尚未确认的许可事项");
    expect(prompt).toContain("每个“不确定/不知道自己能否做”的事项");
    expect(prompt).toContain("使用「〜てもよろしいでしょうか」");
    expect(prompt).toContain("禁止译成「〜かどうかわかりません」");
    expect(prompt).toContain("原文已明确允许的事项只写成");
  });

  it("limits learning analysis to the selected current turn and focus", () => {
    const prompt = buildConversationAnalysisPrompt({
      messages: [
        makeConversationMessage({ content: "試してみます" }),
        makeConversationMessage({
          role: "assistant",
          content: "我会试试看。",
        }),
      ],
      focus: "grammar",
      instruction: "只看尝试表达",
    });
    expect(prompt).toContain("学习项只从“当前一轮”提取");
    expect(prompt).toContain("只提取语法候选");
    expect(prompt).toContain("只看尝试表达");
    expect(prompt).toContain("同一个语言现象只选一个 kind");
  });
});
