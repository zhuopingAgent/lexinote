import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";

describe("LlmClient", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalModel = process.env.OPENAI_MODEL;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    process.env.OPENAI_MODEL = originalModel;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns null for base-form resolution when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new LlmClient();

    await expect(client.resolveLookupWord("見通せない")).resolves.toBeNull();
  });

  it("parses a base-form lookup word from the model response", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          lookupWord: "見通せる",
          lookupReason: "输入是否定形，查词时通常还原为对应的词典形。",
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.resolveLookupWord("見通せない")).resolves.toEqual({
      lookupWord: "見通せる",
      lookupReason: "输入是否定形，查词时通常还原为对应的词典形。",
    });
  });

  it("returns a fallback entry when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new LlmClient();

    await expect(client.completeWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
      examples: [],
    });
  });

  it("preserves known entry fields when generating examples is unavailable", async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new LlmClient();

    await expect(
      client.completeWordEntry("食べる", {
        pronunciation: "たべる",
        partOfSpeech: "动词",
        meaningZh: "吃；进食",
      })
    ).resolves.toEqual({
      word: "食べる",
      pronunciation: "たべる",
      partOfSpeech: "动词",
      meaningZh: "吃；进食",
      examples: [],
    });
  });

  it("parses a structured lookup result from output_text", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          pronunciation: "はしる",
          partOfSpeech: "动词",
          meaningZh: "跑",
          examples: [
            {
              japanese: "毎朝公園を走る。",
              reading: "まいあさ こうえん を はしる。",
              translationZh: "每天早上在公园跑步。",
            },
            {
              japanese: "駅まで走って行く。",
              reading: "えき まで はしって いく。",
              translationZh: "跑着去车站。",
            },
            {
              japanese: "子どもが庭を走る。",
              reading: "こども が にわ を はしる。",
              translationZh: "孩子在院子里跑。",
            },
          ],
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.completeWordEntry("走る")).resolves.toEqual({
      word: "走る",
      pronunciation: "はしる",
      partOfSpeech: "动词",
      meaningZh: "跑",
      examples: [
        {
          japanese: "毎朝公園を走る。",
          reading: "まいあさ こうえん を はしる。",
          translationZh: "每天早上在公园跑步。",
        },
        {
          japanese: "駅まで走って行く。",
          reading: "えき まで はしって いく。",
          translationZh: "跑着去车站。",
        },
        {
          japanese: "子どもが庭を走る。",
          reading: "こども が にわ を はしる。",
          translationZh: "孩子在院子里跑。",
        },
      ],
    });
  });

  it("parses a structured lookup result from output content blocks", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [
          {
            content: [
              {
                type: "output_text",
                text: JSON.stringify({
                  pronunciation: "おいしい",
                  partOfSpeech: "形容词",
                  meaningZh: "好吃",
                  examples: [
                    {
                      japanese: "このケーキはおいしい。",
                      reading: "この ケーキ は おいしい。",
                      translationZh: "这个蛋糕很好吃。",
                    },
                    {
                      japanese: "ここのパンはおいしいです。",
                      reading: "ここ の パン は おいしい です。",
                      translationZh: "这里的面包很好吃。",
                    },
                    {
                      japanese: "温かいうちに食べるとおいしい。",
                      reading: "あたたかい うち に たべる と おいしい。",
                      translationZh: "趁热吃会更好吃。",
                    },
                  ],
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.completeWordEntry("おいしい")).resolves.toEqual({
      word: "おいしい",
      pronunciation: "おいしい",
      partOfSpeech: "形容词",
      meaningZh: "好吃",
      examples: [
        {
          japanese: "このケーキはおいしい。",
          reading: "この ケーキ は おいしい。",
          translationZh: "这个蛋糕很好吃。",
        },
        {
          japanese: "ここのパンはおいしいです。",
          reading: "ここ の パン は おいしい です。",
          translationZh: "这里的面包很好吃。",
        },
        {
          japanese: "温かいうちに食べるとおいしい。",
          reading: "あたたかい うち に たべる と おいしい。",
          translationZh: "趁热吃会更好吃。",
        },
      ],
    });
  });

  it("falls back when the model response is not valid JSON", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: "这不是 JSON",
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.completeWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
      examples: [],
    });
  });

  it("falls back when the OpenAI request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    const client = new LlmClient();

    await expect(client.completeWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
      examples: [],
    });
  });

  it("uses OPENAI_MODEL when it is configured", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    process.env.OPENAI_MODEL = "gpt-5-mini";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          pronunciation: "はしる",
          partOfSpeech: "动词",
          meaningZh: "跑",
          examples: [
            {
              japanese: "毎朝公園を走る。",
              reading: "まいあさ こうえん を はしる。",
              translationZh: "每天早上在公园跑步。",
            },
            {
              japanese: "駅まで走って行く。",
              reading: "えき まで はしって いく。",
              translationZh: "跑着去车站。",
            },
            {
              japanese: "子どもが庭を走る。",
              reading: "こども が にわ を はしる。",
              translationZh: "孩子在院子里跑。",
            },
          ],
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await client.completeWordEntry("走る");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"model":"gpt-5-mini"'),
      })
    );
  });
});
