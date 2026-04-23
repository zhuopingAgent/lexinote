import { describe, expect, it } from "vitest";
import { buildJaWordLookupPrompt } from "@/features/ai-lookup/prompts/jaWordLookup";
import { buildJaWordReconcilePrompt } from "@/features/ai-lookup/prompts/jaWordReconcile";

describe("AI lookup prompts", () => {
  it("requires dictionary-form pronunciation for context lookups", () => {
    const prompt = buildJaWordLookupPrompt(
      "巡る",
      {
        pronunciation: "めぐる",
        partOfSpeech: "动词",
        meaningZh: "围绕；巡回",
      },
      "制度を巡り議論が起きた"
    );

    expect(prompt).toContain("词典形/基本形下的读音");
    expect(prompt).toContain("不要写成参考语境里的连用形");
  });

  it("requires dictionary-form pronunciation for reconcile output", () => {
    const prompt = buildJaWordReconcilePrompt(
      "巡る",
      {
        word: "巡る",
        pronunciation: "めぐる",
        partOfSpeech: "动词",
        meaningZh: "围绕；巡回",
        examples: [
          {
            japanese: "季節が巡る。",
            reading: "きせつ が めぐる。",
            translationZh: "季节轮转。",
          },
          {
            japanese: "町を巡る。",
            reading: "まち を めぐる。",
            translationZh: "在城里巡行。",
          },
          {
            japanese: "話が巡る。",
            reading: "はなし が めぐる。",
            translationZh: "话题流转。",
          },
        ],
      },
      {
        word: "巡る",
        pronunciation: "めぐり",
        partOfSpeech: "动词",
        meaningZh: "围绕，就……问题",
        examples: [
          {
            japanese: "制度を巡り議論が起きた。",
            reading: "せいど を めぐり ぎろん が おきた。",
            translationZh: "围绕制度问题发生了讨论。",
          },
          {
            japanese: "予算を巡り意見が対立した。",
            reading: "よさん を めぐり いけん が たいりつ した。",
            translationZh: "围绕预算问题意见产生对立。",
          },
          {
            japanese: "責任を巡り争いが続いた。",
            reading: "せきにん を めぐり あらそい が つづいた。",
            translationZh: "围绕责任问题的争论持续了下去。",
          },
        ],
      },
      "制度を巡り議論が起きた"
    );

    expect(prompt).toContain("词典形/基本形下的读音");
    expect(prompt).toContain("不要写成语境里的连用形");
  });
});
