import { describe, expect, it } from "vitest";
import { reconcileConversationGrammarLearningItems } from "@/features/conversation/domain/grammar-reconciliation";
import type { ConversationAnalysisLearningItem } from "@/features/conversation/domain/structured-output";
import { makeConversationMessage } from "@/tests/conversation-test-doubles";

function reconcile(
  user: string,
  assistant: string,
  learningItems: ConversationAnalysisLearningItem[] = []
) {
  return reconcileConversationGrammarLearningItems(
    { learningItems },
    [
      makeConversationMessage({ content: user }),
      makeConversationMessage({
        id: "99999999-9999-4999-8999-999999999999",
        role: "assistant",
        content: assistant,
      }),
    ]
  ).learningItems;
}

describe("conversation grammar reconciliation", () => {
  it("canonicalizes 〜てみる and removes duplicate phrase candidates", () => {
    const items = reconcile("試してみます", "我会试试看。", [
      {
        kind: "expression",
        surfaceForm: "試してみます",
        reading: "ためしてみます",
        meaningZh: "我会试试看",
        explanationZh: "普通改写。",
        sourceExcerpt: "試してみます",
      },
      {
        kind: "vocabulary",
        surfaceForm: "試す",
        reading: "ためす",
        meaningZh: "尝试",
        explanationZh: "词典原形。",
        sourceExcerpt: "試し",
      },
    ]);
    expect(items).toEqual([
      expect.objectContaining({ kind: "grammar", surfaceForm: "〜てみる" }),
      expect.objectContaining({ kind: "vocabulary", surfaceForm: "試す" }),
    ]);
  });

  it.each([
    {
      name: "i-adjective past",
      user: "昨日はとても楽しいでした。",
      assistant: "昨日はとても楽しかったです。",
      surface: "い形容词过去形",
    },
    {
      name: "na-adjective past",
      user: "昨日のホテルはとても静かかったです。",
      assistant: "昨日のホテルはとても静かでした。",
      surface: "な形容词过去形",
    },
    {
      name: "tentative advice",
      user: "もう少し様子を見たほうがよさそうです。",
      assistant: "还是再观察一段时间比较好。",
      surface: "〜たほうがいい",
    },
    {
      name: "permission request",
      user: "请问可以把会议改到下周二吗？",
      assistant: "会議を来週の火曜日に変更してもよろしいでしょうか。",
      surface: "〜てもよろしいでしょうか",
    },
    {
      name: "deferential request",
      user: "请把会议改到下周二。",
      assistant: "会議を来週の火曜日に変更していただけますか。",
      surface: "〜ていただけますか",
    },
    {
      name: "corrected benefactive",
      user: "昨日、部長に資料を見せてもらいましたです。",
      assistant: "昨日、部長に資料を見せてもらいました。",
      surface: "〜てもらう",
    },
    {
      name: "necessary condition",
      user: "検査結果が出ないことには、治療方針を決められません。",
      assistant: "如果检查结果不出来，就无法确定治疗方案。",
      surface: "〜ないことには",
    },
  ])("recovers $name as a library form", ({ user, assistant, surface }) => {
    expect(reconcile(user, assistant)).toEqual([
      expect.objectContaining({ kind: "grammar", surfaceForm: surface }),
    ]);
  });

  it.each([
    {
      name: "a correct na-adjective whose stem ends in い",
      user: "昨日の景色はきれいでした。",
      assistant: "昨天的景色很漂亮。",
    },
    {
      name: "a correct i-adjective past form",
      user: "昨日は暖かかったです。",
      assistant: "昨天很暖和。",
    },
  ])("does not invent a correction for $name", ({ user, assistant }) => {
    expect(reconcile(user, assistant)).toEqual([]);
  });

  it("filters pseudo-grammar while retaining concrete vocabulary", () => {
    const items = reconcile(
      "この申請には在職証明書が必要です。",
      "这份申请需要在职证明。",
      [
        {
          kind: "grammar",
          surfaceForm: "には",
          reading: null,
          meaningZh: "对于",
          explanationZh: "孤立助词。",
          sourceExcerpt: "には",
        },
        {
          kind: "vocabulary",
          surfaceForm: "在職証明書",
          reading: "ざいしょくしょうめいしょ",
          meaningZh: "在职证明",
          explanationZh: "证明文件。",
          sourceExcerpt: "在職証明書",
        },
      ]
    );
    expect(items).toEqual([
      expect.objectContaining({ kind: "vocabulary", surfaceForm: "在職証明書" }),
    ]);
  });

  it("recovers vocabulary explicitly requested for translation", () => {
    expect(
      reconcile(
        "「在職証明書」は中国語で何と言いますか。",
        "「在職証明書」は中国語で「在职证明」と言います。"
      )
    ).toEqual([
      expect.objectContaining({
        kind: "vocabulary",
        surfaceForm: "在職証明書",
        meaningZh: "在职证明",
      }),
    ]);
  });

  it("canonicalizes repeated explicitly requested grammar", () => {
    const items = reconcile(
      "请解释「〜ことになっている」，并和「〜ことにしている」比较。",
      "前者表示外部规则。",
      [
        {
          kind: "grammar",
          surfaceForm: "ことになっている",
          reading: null,
          meaningZh: "外部规则",
          explanationZh: "强调外部决定。",
          sourceExcerpt: "ことになっている",
        },
        {
          kind: "grammar",
          surfaceForm: "〜ことになっている",
          reading: null,
          meaningZh: "外部规则",
          explanationZh: "重复候选。",
          sourceExcerpt: "ことになっている",
        },
      ]
    );
    expect(items.map((item) => item.surfaceForm)).toEqual([
      "〜ことにしている",
      "〜ことになっている",
    ]);
  });

  it("does not split compound 〜からこそ into an extra 〜こそ", () => {
    const items = reconcile(
      "「〜からこそ」和普通的原因「から」有什么区别？",
      "「〜からこそ」强调原因。"
    );
    expect(items.map((item) => item.surfaceForm)).toEqual(["〜からこそ"]);
  });

  it("recovers 〜こそ while dropping a continuative pseudo-candidate", () => {
    const items = reconcile(
      "今日は食欲こそありませんでしたが、水分は取れており、遊んでいました。",
      "今天虽然没有食欲，但能喝水。",
      [
        {
          kind: "grammar",
          surfaceForm: "〜ており",
          reading: null,
          meaningZh: "连接形式",
          explanationZh: "状态延续。",
          sourceExcerpt: "取れており",
        },
      ]
    );
    expect(items).toEqual([
      expect.objectContaining({ kind: "grammar", surfaceForm: "〜こそ" }),
    ]);
  });
});
