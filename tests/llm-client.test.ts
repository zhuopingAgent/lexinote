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

  it("returns a fallback entry when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new LlmClient();

    await expect(client.inferWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
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
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.inferWordEntry("走る")).resolves.toEqual({
      word: "走る",
      pronunciation: "はしる",
      partOfSpeech: "动词",
      meaningZh: "跑",
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
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.inferWordEntry("おいしい")).resolves.toEqual({
      word: "おいしい",
      pronunciation: "おいしい",
      partOfSpeech: "形容词",
      meaningZh: "好吃",
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

    await expect(client.inferWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
    });
  });

  it("falls back when the OpenAI request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    const client = new LlmClient();

    await expect(client.inferWordEntry("未知词")).resolves.toEqual({
      word: "未知词",
      pronunciation: "需结合上下文确认",
      partOfSpeech: "需结合上下文确认",
      meaningZh: "需结合上下文确认",
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
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await client.inferWordEntry("走る");

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"model":"gpt-5-mini"'),
      })
    );
  });
});
