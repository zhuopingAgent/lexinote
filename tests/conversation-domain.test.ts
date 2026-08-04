import { describe, expect, it } from "vitest";
import {
  MAX_ANALYSIS_ITEMS,
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_MESSAGES,
  buildConversationFallbackTitle,
  buildConversationGrammarSearchQuery,
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
      grammarReferences: [
        {
          grammarPoint: "〜わけではない",
          canonicalForm: "〜わけではない",
          coreMeaning: "并非完全如此",
          naturalTranslation: "并不是……",
          structure: "普通形 + わけではない",
          usage: "否定过度结论",
          examples: [
            {
              jp: "甘いものが嫌いなわけではありません。",
              zh: "并不是讨厌甜食。",
            },
          ],
        },
      ],
    });

    expect(prompt).toContain("把用户的中文完整翻译成自然、可直接使用的日语");
    expect(prompt).toContain("禁止写成「花生アレルギー」");
    expect(prompt).toContain("准确判断请求中的动作主体");
    expect(prompt).toContain("只有询问自己或己方是否可以执行时");
    expect(prompt).toContain("禁止直译成「状況を注意して見る」");
    expect(prompt).toContain("默认语体：business");
    expect(prompt).toContain("优先给自然商务表达");
    expect(prompt).toContain("对方是客户");
    expect(prompt).toContain("正在准备预约变更邮件");
    expect(prompt).toContain("不声称已经保存");
    expect(prompt).toContain("不在结尾追问");
    expect(prompt).toContain("甘いものが嫌いなわけではありません");
    expect(prompt).toContain("禁止输出 **");
    expect(prompt).toContain("核心译法、解释和补充说明必须全部使用中文");

    const explanationPrompt = buildConversationSystemPrompt({
      mode: "explain_ja",
      preferences: {
        defaultMode: "auto",
        translationStyle: "natural_first",
        defaultRegister: "auto",
        defaultCollectionId: null,
      },
      globalMemories: [],
      sessionMemories: [],
      summary: "",
    });
    expect(explanationPrompt).toContain("必须用简洁中文解释");
    expect(explanationPrompt).toContain("当前是用法讲解模式");
    expect(explanationPrompt).toContain("禁止使用「意味」「接続」「ポイント」");

    const polishPrompt = buildConversationSystemPrompt({
      mode: "polish_ja",
      preferences: {
        defaultMode: "auto",
        translationStyle: "natural_first",
        defaultRegister: "polite",
        defaultCollectionId: null,
      },
      globalMemories: [],
      sessionMemories: [],
      summary: "",
    });
    expect(polishPrompt).toContain("「お水」的「お」是美化语");
    expect(polishPrompt).toContain("必须同时删除「必ず」「絶対」");
    expect(polishPrompt).toContain("不得改用日语讲解");

    const autoPrompt = buildConversationSystemPrompt({
      mode: "auto",
      preferences: {
        defaultMode: "auto",
        translationStyle: "natural_first",
        defaultRegister: "business",
        defaultCollectionId: null,
      },
      globalMemories: [],
      sessionMemories: [],
      summary: "",
    });
    expect(autoPrompt).toContain("完整日语句子按日译中处理");
    expect(autoPrompt).toContain("必须直接用中文回答该词的中文译法");
    expect(autoPrompt).toContain("不能误译成中国户口簿");
    expect(autoPrompt).toContain("涉及过敏、症状或安全确认");
    expect(autoPrompt).toContain("花生使用「ピーナッツ」或「落花生」");
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
    expect(prompt).toContain("memories 不是对话摘要");
    expect(prompt).toContain("通常只选 1–3 个");
    expect(prompt).toContain("不能输出「〜かもしれませんので」");
    expect(prompt).toContain("特殊敬语动词属于 vocabulary");
    expect(prompt).toContain("不要把「楽しいです/楽しかったです」");
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

  it("reconciles an i-adjective correction to the grammar library form", () => {
    const analysis = {
      title: null,
      summary: "纠正了过去时。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "楽しいです/楽しかったです",
          reading: "たのしいです/たのしかったです",
          meaningZh: "过去时",
          explanationZh: "将楽しい改为楽しかったです",
          sourceExcerpt: "とても楽しかったです",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "昨日はとても楽しいでした。"),
      message(1, "昨日はとても楽しかったです。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "い形容词过去形",
        reading: null,
        meaningZh: "表示い形容词的过去状态",
        explanationZh: "将词尾「い」变为「かった」，礼貌表达再接「です」。",
        sourceExcerpt: "昨日はとても楽しいでした",
      },
    ]);
  });

  it("adds grammar explicitly requested in Japanese quotation marks", () => {
    const analysis = {
      title: null,
      summary: "解释了目标语法。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "「〜わけではない」の使い方を説明してください。"),
      message(1, "并不是完全如此。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      expect.objectContaining({
        kind: "grammar",
        surfaceForm: "〜わけではない",
        sourceExcerpt: "〜わけではない",
      }),
    ]);
  });

  it("does not treat a correct na-adjective ending in い as an i-adjective error", () => {
    const analysis = {
      title: null,
      summary: "说明了句子。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "昨日の景色はきれいでした。"),
      message(1, "昨天的景色很漂亮。"),
    ]);

    expect(reconciled.learningItems).toEqual([]);
  });

  it("normalizes a tentative recommendation to the existing advice grammar", () => {
    const analysis = {
      title: null,
      summary: "建议继续观察。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "ほうがよさそうです",
          reading: null,
          meaningZh: "看起来最好",
          explanationZh: "模型拼接的语法名称",
          sourceExcerpt: "見たほうがよさそうです",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "もう少し様子を見たほうがよさそうです。"),
      message(1, "还是再观察一段时间比较好。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜たほうがいい",
        reading: null,
        meaningZh: "最好……",
        explanationZh: "用过去形接「ほうがいい」，表示建议采取某个做法。",
        sourceExcerpt: "たほうがよさそうです",
      },
    ]);
  });

  it("normalizes permission grammar found in a Chinese-to-Japanese answer", () => {
    const analysis = {
      title: null,
      summary: "请求变更会议时间。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "〜に変更してもよろしいでしょうか",
          reading: null,
          meaningZh: "可以改为……吗",
          explanationZh: "模型把变更动作拼进了语法名称",
          sourceExcerpt: "変更してもよろしいでしょうか",
        },
        {
          kind: "expression" as const,
          surfaceForm: "変更してもよろしいでしょうか",
          reading: null,
          meaningZh: "可以变更吗",
          explanationZh: "与许可语法重复",
          sourceExcerpt: "変更してもよろしいでしょうか",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "请问可以把会议改到下周二吗？"),
      message(1, "会議を来週の火曜日に変更してもよろしいでしょうか。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜てもよろしいでしょうか",
        reading: null,
        meaningZh: "可以……吗",
        explanationZh: "郑重询问自己或己方是否可以进行某个动作。",
        sourceExcerpt: "てもよろしいでしょうか",
      },
    ]);
  });

  it("normalizes request grammar found in a Chinese-to-Japanese answer", () => {
    const analysis = {
      title: null,
      summary: "请求变更会议时间。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "〜に変更していただけますか",
          reading: null,
          meaningZh: "请改为……",
          explanationZh: "模型把变更动作拼进了语法名称",
          sourceExcerpt: "変更していただけますか",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "请问可以把会议改到下周二吗？"),
      message(1, "会議を来週の火曜日に変更していただけますか。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜ていただけますか",
        reading: null,
        meaningZh: "能请您……吗",
        explanationZh: "以谦让授受形式郑重请求对方做某事。",
        sourceExcerpt: "ていただけますか",
      },
    ]);
  });

  it("recovers a corrected na-adjective past form", () => {
    const analysis = {
      title: null,
      summary: "纠正了な形容词过去式。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "昨日のホテルはとても静かかったです。"),
      message(1, "昨日のホテルはとても静かでした。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "な形容词过去形",
        reading: null,
        meaningZh: "表示な形容词的过去状态",
        explanationZh:
          "词干后接「でした」；不能像い形容词一样变成「かったです」。",
        sourceExcerpt: "昨日のホテルはとても静かかったです",
      },
    ]);
  });

  it("does not misclassify a correct i-adjective past form", () => {
    const analysis = {
      title: null,
      summary: "翻译了天气描述。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "昨日は暖かかったです。"),
      message(1, "昨天很暖和。"),
    ]);

    expect(reconciled.learningItems).toEqual([]);
  });

  it("filters low-value pseudo-grammar while retaining concrete vocabulary", () => {
    const analysis = {
      title: null,
      summary: "翻译了申请材料。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "には",
          reading: null,
          meaningZh: "对于……",
          explanationZh: "孤立助词组合",
          sourceExcerpt: "には",
        },
        {
          kind: "grammar" as const,
          surfaceForm: "必要です",
          reading: null,
          meaningZh: "需要",
          explanationZh: "普通礼貌表达",
          sourceExcerpt: "必要です",
        },
        {
          kind: "vocabulary" as const,
          surfaceForm: "在職証明書",
          reading: "ざいしょくしょうめいしょ",
          meaningZh: "在职证明",
          explanationZh: "办理手续时使用的证明文件",
          sourceExcerpt: "在職証明書",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "この申請には在職証明書が必要です。"),
      message(1, "这份申请需要在职证明。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      expect.objectContaining({
        kind: "vocabulary",
        surfaceForm: "在職証明書",
      }),
    ]);
  });

  it("recovers a vocabulary item explicitly requested for translation", () => {
    const analysis = {
      title: null,
      summary: "解释了一个词。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "vocabulary" as const,
          surfaceForm: "在职证明",
          reading: "ざいしょくしょうめいしょ",
          meaningZh: "在职证明",
          explanationZh: "错误地把中文译文当成日语词条",
          sourceExcerpt: "在职证明",
        },
        {
          kind: "grammar" as const,
          surfaceForm: "〜は中国語で...と言います",
          reading: null,
          meaningZh: "用另一种语言怎么说",
          explanationZh: "模型误提取的问句模板",
          sourceExcerpt: "中国語で何と言いますか",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "「在職証明書」は中国語で何と言いますか。"),
      message(1, "「在職証明書」は中国語で「在职证明」と言います。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "vocabulary",
        surfaceForm: "在職証明書",
        reading: null,
        meaningZh: "在职证明",
        explanationZh: "用户在本轮明确询问了这个词的中文含义。",
        sourceExcerpt: "在職証明書",
      },
    ]);
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

  it("removes internal extraction instructions from session summaries", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary:
          "用户将「楽しいでした」改为「楽しかったです」。规则回顾：学习项聚焦高价值语法，且不超过5项。当前轮对话中涉及的核心语法需作为 grammar 提取。未产生明确的词汇学习需求，故不列 vocabulary。此次核心学习点是い形容词过去形。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [],
      })
    );

    expect(parsed?.summary).toBe(
      "用户将「楽しいでした」改为「楽しかったです」。此次核心学习点是い形容词过去形。"
    );
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

  it("normalizes grammar wave dashes before persistence", () => {
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
            kind: "grammar",
            surface_form: "～ ので",
            reading: null,
            meaning_zh: "因为",
            explanation_zh: "表示原因",
            source_excerpt: "ので",
          },
        ],
      })
    );

    expect(parsed?.learningItems[0].surfaceForm).toBe("〜ので");
  });

  it("keeps kana readings and rejects translated text in the reading field", () => {
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
            kind: "vocabulary",
            surface_form: "在職証明書",
            reading: "在职证明",
            meaning_zh: "在职证明",
            explanation_zh: "证明当前在职的文件",
            source_excerpt: "在職証明書",
          },
          {
            kind: "vocabulary",
            surface_form: "領収書",
            reading: "りょうしゅうしょ",
            meaning_zh: "收据",
            explanation_zh: "付款凭证",
            source_excerpt: "領収書",
          },
          {
            kind: "grammar",
            surface_form: "〜てみる",
            reading: "てみる",
            meaning_zh: "试着……",
            explanation_zh: "表示尝试做某事",
            source_excerpt: "試してみます",
          },
        ],
      })
    );

    expect(parsed?.learningItems.map((item) => item.reading)).toEqual([
      null,
      "りょうしゅうしょ",
      null,
    ]);
  });

  it("rejects Korean-contaminated and meta-only learning candidates", () => {
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
            kind: "grammar",
            surface_form: "〜をいただけますか",
            reading: null,
            meaning_zh: "可以请 받다 的礼貌表达",
            explanation_zh: "表示请求",
            source_excerpt: "お水をいただけますか",
          },
          {
            kind: "grammar",
            surface_form: "〜ことになっている",
            reading: null,
            meaning_zh: "接续：动词辞书形 + ことになっている",
            explanation_zh: "用于构成该语法点的接续形式",
            source_excerpt: "ことになっている",
          },
          {
            kind: "grammar",
            surface_form: "いただけますか",
            reading: null,
            meaning_zh: "礼貌请求",
            explanation_zh: "名词后接该表达",
            source_excerpt: "お水をいただけますか",
          },
        ],
      })
    );

    expect(parsed?.learningItems).toEqual([]);
  });

  it("reclassifies lexical honorific verbs as vocabulary", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "修正了双重敬语。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "grammar",
            surface_form: "おっしゃった",
            reading: "おっしゃった",
            meaning_zh: "说的尊敬语",
            explanation_zh: "用于抬高动作主体",
            source_excerpt: "おっしゃる",
          },
          {
            kind: "grammar",
            surface_form: "お水",
            reading: "おみず",
            meaning_zh: "饮用水",
            explanation_zh: "使用美化语前缀的常见说法",
            source_excerpt: "お水",
          },
        ],
      })
    );

    expect(parsed?.learningItems).toEqual([
      {
        kind: "vocabulary",
        surfaceForm: "おっしゃる",
        reading: "おっしゃる",
        meaningZh: "说的尊敬语",
        explanationZh: "用于抬高动作主体",
        sourceExcerpt: "おっしゃる",
      },
      {
        kind: "vocabulary",
        surfaceForm: "お水",
        reading: "おみず",
        meaningZh: "饮用水",
        explanationZh: "使用美化语前缀的常见说法",
        sourceExcerpt: "お水",
      },
    ]);
  });

  it("reclassifies contextual collocations and drops punctuation fragments", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "整理了餐厅和会议表达。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "grammar",
            surface_form: "アレルギーがあります",
            reading: null,
            meaning_zh: "有过敏",
            explanation_zh: "描述自己有某种过敏",
            source_excerpt: "ピーナッツアレルギーがあります",
          },
          {
            kind: "grammar",
            surface_form: "来週、この問題について",
            reading: null,
            meaning_zh: "下周讨论这个问题",
            explanation_zh: "逗号后的停顿",
            source_excerpt: "来週、この問題について",
          },
        ],
      })
    );

    expect(parsed?.learningItems).toEqual([
      {
        kind: "expression",
        surfaceForm: "アレルギーがある",
        reading: null,
        meaningZh: "有过敏",
        explanationZh: "描述自己有某种过敏",
        sourceExcerpt: "ピーナッツアレルギーがあります",
      },
    ]);
  });

  it("reclassifies context-dependent service responses as expressions", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "说明了服务场景中的委婉拒绝。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "vocabulary",
            surface_form: "大丈夫です",
            reading: "だいじょうぶです",
            meaning_zh: "不用了，谢谢",
            explanation_zh: "在服务场景中委婉表示不需要。",
            source_excerpt: "大丈夫です",
          },
        ],
      })
    );

    expect(parsed?.learningItems).toEqual([
      {
        kind: "expression",
        surfaceForm: "大丈夫です",
        reading: "だいじょうぶです",
        meaningZh: "不用了，谢谢",
        explanationZh: "在服务场景中委婉表示不需要。",
        sourceExcerpt: "大丈夫です",
      },
    ]);
  });

  it("drops generic existence forms and counter modifiers mislabeled as grammar", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "整理了餐厅请求和会议表达。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "grammar",
            surface_form: "〜があります",
            reading: null,
            meaning_zh: "表示有某种状态",
            explanation_zh: "表示存在",
            source_excerpt: "ピーナッツアレルギーがあります",
          },
          {
            kind: "grammar",
            surface_form: "ひとつの",
            reading: null,
            meaning_zh: "一个",
            explanation_zh: "数量词修饰名词",
            source_excerpt: "一つの会議",
          },
          {
            kind: "grammar",
            surface_form: "〜ていただけますか",
            reading: null,
            meaning_zh: "能请您……吗",
            explanation_zh: "礼貌请求对方做某事",
            source_excerpt: "確認していただけますか",
          },
          {
            kind: "grammar",
            surface_form: "〜が入っていないか",
            reading: null,
            meaning_zh: "是否不含有……",
            explanation_zh: "询问是否包含某种成分",
            source_excerpt: "ピーナッツが入っていないか",
          },
        ],
      })
    );

    expect(parsed?.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜ていただけますか",
    ]);
  });

  it("drops combined grammar labels and full-sentence learning surfaces", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "翻译了餐厅过敏请求。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "grammar",
            surface_form: "くださいませんか/いただけますか",
            reading: null,
            meaning_zh: "能请您……吗",
            explanation_zh: "礼貌请求",
            source_excerpt: "ご確認いただけますか",
          },
          {
            kind: "expression",
            surface_form: "ピーナッツアレルギーがあります。",
            reading: null,
            meaning_zh: "我对花生过敏",
            explanation_zh: "声明过敏信息",
            source_excerpt: "ピーナッツアレルギーがあります。",
          },
          {
            kind: "grammar",
            surface_form: "おっしゃる→おっしゃった",
            reading: null,
            meaning_zh: "尊敬语过去式",
            explanation_zh: "错误形式到正确形式的对照",
            source_excerpt: "おっしゃった",
          },
          {
            kind: "grammar",
            surface_form: "〜ていただけますか",
            reading: null,
            meaning_zh: "能请您……吗",
            explanation_zh: "礼貌请求对方做某事",
            source_excerpt: "ご確認いただけますか",
          },
        ],
      })
    );

    expect(parsed?.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜ていただけますか",
    ]);
  });

  it("normalizes inflected grammar candidates to dictionary forms", () => {
    const parsed = parseConversationAnalysisOutput(
      JSON.stringify({
        title: null,
        summary: "润色了过去式。",
        details: {
          literal_translation: null,
          nuance_notes: [],
          key_points: [],
        },
        memories: [],
        learning_items: [
          {
            kind: "grammar",
            surface_form: "〜てもらいました",
            reading: null,
            meaning_zh: "请别人做了某事",
            explanation_zh: "表示接受他人的帮助",
            source_excerpt: "見せてもらいました",
          },
          {
            kind: "grammar",
            surface_form: "〜ことになっています",
            reading: null,
            meaning_zh: "既定规则",
            explanation_zh: "表示外部规则或安排",
            source_excerpt: "ことになっています",
          },
        ],
      })
    );

    expect(parsed?.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜てもらう",
      "〜ことになっている",
    ]);
  });

  it("recovers 〜てもらう from a corrected polite-past form", () => {
    const analysis = {
      title: null,
      summary: "修正了不自然的句尾。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "请帮我润色：昨日、部長に資料を見せてもらいましたです。"),
      message(1, "昨日、部長に資料を見せてもらいました。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜てもらう",
        reading: null,
        meaningZh: "请别人做某事并接受其帮助",
        explanationZh:
          "动词て形后接「もらう」表示接受别人为自己做某事；礼貌过去式是「てもらいました」。",
        sourceExcerpt: "てもらいましたです",
      },
    ]);
  });

  it("canonicalizes and collapses repeated explicitly requested grammar", () => {
    const analysis = {
      title: null,
      summary: "解释了规则与个人习惯。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "ことになっている",
          reading: "ことになっている",
          meaningZh: "外部规则或安排",
          explanationZh: "强调外部决定",
          sourceExcerpt: "ことになっている",
        },
        {
          kind: "grammar" as const,
          surfaceForm: "〜ことになっている",
          reading: null,
          meaningZh: "接续说明",
          explanationZh: "重复候选",
          sourceExcerpt: "ことになっている",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "请解释「〜ことになっている」，并和「〜ことにしている」比较。"),
      message(1, "「〜ことになっている」表示外部规则。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜ことにしている",
        reading: null,
        meaningZh: "本轮明确询问的语法",
        explanationZh:
          "用户明确询问了该语法的用法，可绑定现有语法义项继续复习。",
        sourceExcerpt: "〜ことにしている",
      },
      {
        kind: "grammar",
        surfaceForm: "〜ことになっている",
        reading: null,
        meaningZh: "外部规则或安排",
        explanationZh: "强调外部决定",
        sourceExcerpt: "〜ことになっている",
      },
    ]);
  });

  it("recovers 〜こそ and removes the continuative 〜ており pseudo-candidate", () => {
    const analysis = {
      title: null,
      summary: "翻译了托儿所的状态说明。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "〜ており",
          reading: null,
          meaningZh: "书面连接形式",
          explanationZh: "表示状态延续",
          sourceExcerpt: "水分は取れており",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(
        0,
        "今日は食欲こそありませんでしたが、水分は取れており、午睡後は普段どおり遊んでいました。"
      ),
      message(1, "今天虽然没有食欲，但能喝水，午睡后也照常玩耍。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜こそ",
        reading: null,
        meaningZh: "正是……/这次一定……",
        explanationZh: "把前接成分作为焦点加以强调，并常暗含与其他情况的对比。",
        sourceExcerpt: "今日は食欲こそ",
      },
    ]);
  });

  it("does not split compound 〜からこそ into a second 〜こそ candidate", () => {
    const analysis = {
      title: null,
      summary: "解释了强调原因。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "「〜からこそ」和普通的原因「から」有什么区别？"),
      message(1, "「〜からこそ」强调正因为前项，后项才成立。"),
    ]);

    expect(reconciled.learningItems.map((item) => item.surfaceForm)).toEqual([
      "〜からこそ",
    ]);
  });

  it("recovers 〜ないことには as one canonical grammar point", () => {
    const analysis = {
      title: null,
      summary: "翻译了治疗条件。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [],
      learningItems: [
        {
          kind: "grammar" as const,
          surfaceForm: "〜ている/ていない类表达的否定前提",
          reading: null,
          meaningZh: "错误的抽象名称",
          explanationZh: "错误拆分",
          sourceExcerpt: "検査結果が出ないことには",
        },
      ],
    };

    const reconciled = reconcileConversationGrammarLearningItems(analysis, [
      message(0, "検査結果が出ないことには、治療方針を決めることができません。"),
      message(1, "如果检查结果不出来，就无法确定治疗方案。"),
    ]);

    expect(reconciled.learningItems).toEqual([
      {
        kind: "grammar",
        surfaceForm: "〜ないことには",
        reading: null,
        meaningZh: "如果不……就不能……",
        explanationZh:
          "表示前项是后项成立的必要条件，后项通常是否定、困难或无法判断的内容。",
        sourceExcerpt: "ないことには",
      },
    ]);
  });

  it("builds a bounded fallback title from the first user message", () => {
    expect(buildConversationFallbackTitle("  試してみます\n")).toBe(
      "試してみます"
    );
    expect(buildConversationFallbackTitle("あ".repeat(40))).toBe(
      `${"あ".repeat(31)}…`
    );
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

  it("drops meta summaries masquerading as memory suggestions", () => {
    const analysis = {
      title: null,
      summary: "用户表示会尝试。",
      details: { literalTranslation: null, nuanceNotes: [], keyPoints: [] },
      memories: [
        {
          scope: "session" as const,
          kind: "context" as const,
          content:
            "当前轮对话：用户说试してみます，助手给出释义。规则涉及 grammar、vocabulary、expression。",
        },
        {
          scope: "session" as const,
          kind: "context" as const,
          content: "这次对话对象是医院前台",
        },
        {
          scope: "global" as const,
          kind: "preference" as const,
          content: "偏好简洁的商务日语",
        },
        {
          scope: "session" as const,
          kind: "context" as const,
          content: "用户请求解释目标语法，包含接続、意味和例文。",
        },
        {
          scope: "session" as const,
          kind: "goal" as const,
          content: "帮助用户清晰掌握目标语法并举出常见例句。",
        },
        {
          scope: "session" as const,
          kind: "context" as const,
          content: "当前对话主题是日语到中文的对照学习，关注因果表达。",
        },
      ],
      learningItems: [],
    };

    const validated = validateConversationAnalysisReferences(analysis, [
      { content: "試してみます" },
    ]);

    expect(validated.memories.map((memory) => memory.content)).toEqual([
      "这次对话对象是医院前台",
      "偏好简洁的商务日语",
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
    expect(
      selectConversationGrammarCandidates("〜ことにしている", [
        {
          ...candidates[0],
          grammarPointId: "wrong-fuzzy-match",
          canonicalForm: "〜ことになっている",
        },
      ])
    ).toEqual([]);
  });

  it("removes wave-dash variants before searching the grammar repository", () => {
    expect(buildConversationGrammarSearchQuery("〜こそ")).toBe("こそ");
    expect(buildConversationGrammarSearchQuery("～ てみる")).toBe("てみる");
    expect(buildConversationGrammarSearchQuery("~わけではありません")).toBe(
      "わけではない"
    );
  });
});
