import { describe, expect, it } from "vitest";
import {
  MAX_CONTEXT_CHARACTERS,
  MAX_CONTEXT_MESSAGES,
  buildConversationFallbackTitle,
  buildConversationGrammarSearchQuery,
  conversationLearningItemKey,
  selectConversationGrammarCandidates,
  trimConversationContextMessages,
} from "@/features/conversation/domain/model";
import { makeConversationMessage } from "@/tests/conversation-test-doubles";

describe("conversation domain model", () => {
  it("keeps only the newest bounded context", () => {
    const messages = Array.from({ length: 24 }, (_, index) =>
      makeConversationMessage({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        content: `${index}:` + "あ".repeat(1_200),
      })
    );
    const selected = trimConversationContextMessages(messages);
    expect(selected.length).toBeLessThanOrEqual(MAX_CONTEXT_MESSAGES);
    expect(
      selected.reduce((total, message) => total + message.content.length, 0)
    ).toBe(MAX_CONTEXT_CHARACTERS);
    expect(selected.at(-1)?.id).toBe(messages.at(-1)?.id);
    expect(selected[0].id).not.toBe(messages[0].id);
  });

  it("deduplicates equivalent forms without collapsing distinct meanings", () => {
    expect(conversationLearningItemKey("grammar", "てみる", "试着……")).toBe(
      conversationLearningItemKey("grammar", "〜てみる", "试着……")
    );
    expect(conversationLearningItemKey("grammar", "〜そうだ", "看起来……")).not.toBe(
      conversationLearningItemKey("grammar", "〜そうだ", "听说……")
    );
  });

  it("normalizes grammar forms for repository search", () => {
    expect(buildConversationGrammarSearchQuery("～ てみる")).toBe("てみる");
    expect(buildConversationGrammarSearchQuery("~わけではありません")).toBe(
      "わけではない"
    );
  });

  it("selects exact senses and preserves exact polysemy", () => {
    const candidates = [
      {
        grammarPointId: "hearsay",
        grammarPoint: "〜そうだ",
        canonicalForm: "〜そうだ",
        senseKey: "hearsay",
        coreMeaning: "听说",
      },
      {
        grammarPointId: "appearance",
        grammarPoint: "〜そうだ",
        canonicalForm: "〜そうだ",
        senseKey: "appearance",
        coreMeaning: "看起来",
      },
      {
        grammarPointId: "fuzzy",
        grammarPoint: "〜そうにもない",
        canonicalForm: "〜そうにもない",
        senseKey: "unlikely",
        coreMeaning: "看起来不会",
      },
    ];
    expect(
      selectConversationGrammarCandidates("～そうだ", candidates).map(
        (candidate) => candidate.grammarPointId
      )
    ).toEqual(["hearsay", "appearance"]);
  });

  it("builds a bounded fallback title", () => {
    expect(buildConversationFallbackTitle("  試してみます\n")).toBe(
      "試してみます"
    );
    expect(buildConversationFallbackTitle("あ".repeat(40))).toBe(
      `${"あ".repeat(31)}…`
    );
  });
});
