import { describe, expect, it } from "vitest";
import {
  MAX_ANALYSIS_ITEMS,
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_MESSAGES,
  conversationLearningItemKey,
  parseConversationAnalysisOutput,
  selectConversationGrammarCandidates,
  reconcileConversationGrammarLearningItems,
  trimConversationContextMessages,
  validateConversationAnalysisReferences,
} from "@/features/conversation/domain/conversation";
import {
  buildConversationAnalysisPrompt,
  buildConversationSystemPrompt,
} from "@/features/conversation/prompts/conversation";
import type {
  ConversationMemory,
  ConversationMessage,
} from "@/shared/types/conversation";

function message(index: number, content: string): ConversationMessage {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    sessionId: "11111111-1111-4111-8111-111111111111",
    role: index % 2 === 0 ? "user" : "assistant",
    content,
    mode: "auto",
    status: "completed",
    parentMessageId: null,
    modelName: null,
    errorCode: null,
    errorMessage: null,
    details: { nuanceNotes: [], keyPoints: [] },
    analysisStatus: "completed",
    createdAt: new Date(index * 1_000).toISOString(),
    updatedAt: new Date(index * 1_000).toISOString(),
    completedAt: new Date(index * 1_000).toISOString(),
  };
}

function memory(
  id: string,
  scope: ConversationMemory["scope"],
  content: string
): ConversationMemory {
  return {
    id,
    sessionId: scope === "session" ? "11111111-1111-4111-8111-111111111111" : null,
    scope,
    kind: "preference",
    content,
    status: "active",
    sourceMessageId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

describe("conversation domain", () => {
  it("builds mode-specific prompts from confirmed structured context", () => {
    const prompt = buildConversationSystemPrompt({
      mode: "zh_to_ja",
      preferences: {
        defaultMode: "auto",
        translationStyle: "natural_first",
        defaultRegister: "business",
        defaultCollectionId: null,
      },
      globalMemories: [memory("global", "global", "优先给自然商务表达")],
      sessionMemories: [memory("session", "session", "对方是客户")],
      summary: "正在准备预约变更邮件。",
    });

    expect(prompt).toContain("把用户的中文翻译成自然、可直接使用的日语");
    expect(prompt).toContain("默认语体：business");
    expect(prompt).toContain("优先给自然商务表达");
    expect(prompt).toContain("对方是客户");
    expect(prompt).toContain("正在准备预约变更邮件");
    expect(prompt).toContain("不声称已经保存");
  });

  it("limits structured learning extraction to the current turn", () => {
    const prompt = buildConversationAnalysisPrompt({
      sessionTitle: "预约表达",
      titleIsManual: false,
      previousSummary: "此前学习过変更する。",
      messages: [message(0, "这次请翻译辛苦了"), message(1, "お疲れさまでした。")],
    });

    expect(prompt).toContain("当前一轮：");
    expect(prompt).toContain("学习项只从“当前一轮”提取");
    expect(prompt).toContain("不要从此前摘要重新提取");
    expect(prompt).toContain("試してみます");
    expect(prompt).toContain("〜てみる");
    expect(prompt).toContain("同一个语言现象只选一个 kind");
    expect(prompt).toContain("不要收集助手给出的普通改写");
  });

  it("canonicalizes te-miru and removes ordinary expressions covered by it", () => {
    const analysis = {
      title: null,
      summary: "用户表示会尝试。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "てみる",
          reading: null,
          meaningZh: "试着做某事",
          explanationZh: "模型生成的语法说明",
          sourceExcerpt: "試してみます",
        },
        {
          kind: "grammar" as const,
          surfaceForm: "〜てみる",
          reading: null,
          meaningZh: "试着……",
          explanationZh: "服务端补充的语法说明",
          sourceExcerpt: "てみます",
        },
        {
          kind: "expression" as const,
          surfaceForm: "やってみます",
          reading: "やってみます",
          meaningZh: "我来试试看",
          explanationZh: "普通改写",
          sourceExcerpt: "やってみます",
        },
        {
          kind: "expression" as const,
          surfaceForm: "試してみますね",
          reading: "ためしてみますね",
          meaningZh: "我试试看哦",
          explanationZh: "礼貌变体",
          sourceExcerpt: "試してみますね",
        },
        {
          kind: "vocabulary" as const,
          surfaceForm: "試してみます",
          reading: "ためしてみます",
          meaningZh: "尝试并实践",
          explanationZh: "错误地把活用短语标成词汇",
          sourceExcerpt: "試してみます",
        },
        {
          kind: "vocabulary" as const,
          surfaceForm: "試す",
          reading: "ためす",
          meaningZh: "尝试",
          explanationZh: "可以独立查词的词典原形",
          sourceExcerpt: "試し",
        },
        {
          kind: "expression" as const,
          surfaceForm: "お疲れさまです",
          reading: "おつかれさまです",
          meaningZh: "辛苦了",
          explanationZh: "固定表达",
          sourceExcerpt: "お疲れさまです",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "試してみます"),
      message(1, "やってみます。試してみますね。お疲れさまです。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜てみる",
        reading: null,
        meaningZh: "试着……",
        explanationZh: "接在动词て形后，表示尝试做某事并观察结果。",
        sourceExcerpt: "てみます",
      },
      expect.objectContaining({
        kind: "vocabulary",
        surfaceForm: "試す",
      }),
      expect.objectContaining({
        kind: "expression",
        surfaceForm: "お疲れさまです",
      }),
    ]);

    const notDuplicated = reconcileConversationGrammarLearningItems(
      reconciled,
      [message(0, "試してみます")]
    );
    expect(notDuplicated.learningItems).toHaveLength(3);
  });

  it("keeps only the newest bounded context and truncates the oldest retained text", () => {
    const messages = Array.from({ length: 24 }, (_, index) =>
      message(index, `${index}:` + "あ".repeat(1_200))
    );
    const selected = trimConversationContextMessages(messages);
    const totalCharacters = selected.reduce(
      (total, item) => total + item.content.length,
      0
    );

    expect(selected.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);
    expect(totalCharacters).toBeLessThanOrEqual(MAX_CONTEXT_CHARACTERS);
    expect(selected.at(-1)?.id).toBe(messages.at(-1)?.id);
    expect(selected[0].id).not.toBe(messages[0].id);
  });

  it("normalizes, deduplicates, and caps structured learning output", () => {
    const learningItems = Array.from({ length: 8 }, (_, index) => ({
      kind: index === 0 ? "vocabulary" : "grammar",
      surface_form: index === 1 ? "語彙0" : `語彙${index}`,
      reading: null,
      meaning_zh: "含义",
      explanation_zh: "说明",
      source_excerpt: `原句${index}`,
    }));
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: "预约改期",
        summary: "摘要",
        details: {
          literal_translation: null,
          nuance_notes: ["语气较礼貌"],
          key_points: ["使用いただけますか"],
        },
        memories: [
          { scope: "global", kind: "preference", content: "偏好商务语体" },
          { scope: "invalid", kind: "goal", content: "不会进入结果" },
        ],
        learning_items: learningItems,
      })
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.learningItems).toHaveLength(MAX_ANALYSIS_ITEMS);
    expect(parsed?.memories).toEqual([
      { scope: "global", kind: "preference", content: "偏好商务语体" },
    ]);
    expect(parseConversationAnalysisOutput("not-json")).toBeNull();
  });

  it("deduplicates equivalent forms without collapsing distinct meanings", () => {
    expect(
      conversationLearningItemKey("grammar", "てみる", "试着……")
    ).toBe(conversationLearningItemKey("grammar", "〜てみる", "试着……"));
    expect(
      conversationLearningItemKey("grammar", "～そうだ", "听说……")
    ).toBe(conversationLearningItemKey("grammar", "〜 そうだ", "听说……"));
    expect(
      conversationLearningItemKey("grammar", "〜そうだ", "看起来……")
    ).not.toBe(conversationLearningItemKey("grammar", "〜そうだ", "听说……"));
  });

  it("drops model candidates whose quoted source is absent from the conversation", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "摘要",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "expression",
            surface_form: "日程を変更する",
            reading: "にっていをへんこうする",
            meaning_zh: "更改日程",
            explanation_zh: "固定搭配",
            source_excerpt: "日程を変更していただけますか",
          },
          {
            kind: "grammar",
            surface_form: "〜ざるを得ない",
            reading: null,
            meaning_zh: "不得不",
            explanation_zh: "并未出现",
            source_excerpt: "行かざるを得ない",
          },
        ],
      })
    );
    expect(parsed).not.toBeNull();

    const validated = validateConversationAnalysisReferences(parsed!, [
      { content: "日程を変更していただけますか。" },
    ]);

    expect(validated.learningItems.map((item) => item.surfaceForm)).toEqual([
      "日程を変更する",
    ]);
  });

  it("prefers exact grammar forms while retaining true exact polysemy", () => {
    const candidates = [
      {
        grammarPointId: "exact-1",
        grammarPoint: "〜ていただけますか",
        canonicalForm: "〜ていただけますか",
        senseKey: "polite_request",
        coreMeaning: "礼貌请求",
      },
      {
        grammarPointId: "fuzzy",
        grammarPoint: "〜ていただけないでしょうか",
        canonicalForm: "〜ていただけないでしょうか",
        senseKey: "deferential_request",
        coreMeaning: "郑重请求",
      },
    ];

    expect(
      selectConversationGrammarCandidates("～ていただけますか", candidates)
    ).toEqual([candidates[0]]);

    const polysemous = [
      { ...candidates[0], grammarPointId: "hearsay", canonicalForm: "〜そうだ" },
      { ...candidates[0], grammarPointId: "appearance", canonicalForm: "〜そうだ" },
      { ...candidates[1], grammarPointId: "fuzzy-sou" },
    ];
    expect(
      selectConversationGrammarCandidates("〜そうだ", polysemous).map(
        (candidate) => candidate.grammarPointId
      )
    ).toEqual(["hearsay", "appearance"]);
  });
});
