import { afterEach, describe, expect, it, vi } from "vitest";
import { LlmClient } from "@/features/ai-explanation/infrastructure/LlmClient";

describe("LlmClient", () => {
  const originalApiKey = process.env.OPENAI_API_KEY;
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("returns structured fallback when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;
    const client = new LlmClient();

    await expect(
      client.explainWordForZhNative({
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      })
    ).resolves.toMatchObject({
      explanationSource: "fallback",
      explanation: {
        actualUsage: expect.any(String),
        commonScenarios: expect.any(String),
        nuanceDifferences: expect.any(String),
        commonMistakes: expect.any(String),
      },
    });
  });

  it("parses structured JSON output from the model response", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          actualUsage: "用于描述吃东西的动作。",
          commonScenarios: "吃饭、点餐、说明饮食行为。",
          nuanceDifferences: "和口语里的其他表达相比更基础直接。",
          commonMistakes: "容易漏掉变形和助词搭配。",
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(
      client.explainWordForZhNative({
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      })
    ).resolves.toEqual({
      explanationSource: "openai",
      explanation: {
        actualUsage: "用于描述吃东西的动作。",
        commonScenarios: "吃饭、点餐、说明饮食行为。",
        nuanceDifferences: "和口语里的其他表达相比更基础直接。",
        commonMistakes: "容易漏掉变形和助词搭配。",
      },
    });
  });

  it("parses structured JSON from responses output content blocks", async () => {
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
                  actualUsage: "描述实际吃东西的动作，也可用于泛指进食。",
                  commonScenarios: "日常对话、点餐、描述习惯。",
                  nuanceDifferences: "语气中性基础，比更口语化说法更标准。",
                  commonMistakes: "容易忽略动词变形，也容易直接套用中文宾语习惯。",
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(
      client.explainWordForZhNative({
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      })
    ).resolves.toEqual({
      explanationSource: "openai",
      explanation: {
        actualUsage: "描述实际吃东西的动作，也可用于泛指进食。",
        commonScenarios: "日常对话、点餐、描述习惯。",
        nuanceDifferences: "语气中性基础，比更口语化说法更标准。",
        commonMistakes: "容易忽略动词变形，也容易直接套用中文宾语习惯。",
      },
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

    await expect(
      client.explainWordForZhNative({
        word: "静か",
        pronunciation: "しずか",
        meaningZh: "安静；安稳",
        partOfSpeech: "形容动词",
      })
    ).resolves.toMatchObject({
      explanationSource: "fallback",
      explanation: {
        actualUsage: expect.any(String),
        commonScenarios: expect.any(String),
        nuanceDifferences: expect.any(String),
        commonMistakes: expect.any(String),
      },
    });
  });

  it("supports word-only explanation requests", async () => {
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
                  actualUsage: "需要结合上下文确认实际用法。",
                  commonScenarios: "建议放回例句中理解。",
                  nuanceDifferences: "没有上下文时难以精确区分。",
                  commonMistakes: "容易按中文字面直译。",
                }),
              },
            ],
          },
        ],
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await expect(client.explainWordOnlyForZhNative("未知词")).resolves.toEqual({
      explanationSource: "openai",
      explanation: {
        actualUsage: "需要结合上下文确认实际用法。",
        commonScenarios: "建议放回例句中理解。",
        nuanceDifferences: "没有上下文时难以精确区分。",
        commonMistakes: "容易按中文字面直译。",
      },
    });
  });

  it("falls back when the OpenAI request fails", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as typeof fetch;

    const client = new LlmClient();

    await expect(
      client.explainWordForZhNative({
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      })
    ).resolves.toMatchObject({
      explanationSource: "fallback",
      explanation: {
        actualUsage: expect.any(String),
        commonScenarios: expect.any(String),
        nuanceDifferences: expect.any(String),
        commonMistakes: expect.any(String),
      },
    });
  });

  it("uses the explicitly selected model when provided", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        output_text: JSON.stringify({
          actualUsage: "描述吃东西这个动作。",
          commonScenarios: "日常吃饭。",
          nuanceDifferences: "更基础直接。",
          commonMistakes: "容易忽略变形。",
        }),
      }),
    }) as typeof fetch;

    const client = new LlmClient();

    await client.explainWordForZhNative({
      word: "食べる",
      pronunciation: "たべる",
      meaningZh: "吃；进食",
      partOfSpeech: "动词",
      model: "gpt-5.4",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"model":"gpt-5.4"'),
      })
    );
  });

  it("streams text deltas before returning the final parsed explanation", async () => {
    process.env.OPENAI_API_KEY = "test-key";
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.delta","delta":"{\\"actualUsage\\":\\"描述"}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.delta","delta":"吃东西这个动作。\\",\\"commonScenarios\\":\\"日常吃饭\\",\\"nuanceDifferences\\":\\"更基础直接\\",\\"commonMistakes\\":\\"容易忽略变形\\"}"}\n\n'
          )
        );
        controller.enqueue(
          encoder.encode(
            'data: {"type":"response.output_text.done","text":"{\\"actualUsage\\":\\"描述吃东西这个动作。\\",\\"commonScenarios\\":\\"日常吃饭\\",\\"nuanceDifferences\\":\\"更基础直接\\",\\"commonMistakes\\":\\"容易忽略变形\\"}"}\n\n'
          )
        );
        controller.close();
      },
    });

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: stream,
    }) as typeof fetch;

    const client = new LlmClient();
    const chunks: string[] = [];

    await expect(
      client.explainWordForZhNative(
        {
          word: "食べる",
          pronunciation: "たべる",
          meaningZh: "吃；进食",
          partOfSpeech: "动词",
        },
        {
          onTextDelta: (delta) => {
            chunks.push(delta);
          },
        }
      )
    ).resolves.toEqual({
      explanationSource: "openai",
      explanation: {
        actualUsage: "描述吃东西这个动作。",
        commonScenarios: "日常吃饭",
        nuanceDifferences: "更基础直接",
        commonMistakes: "容易忽略变形",
      },
    });

    expect(chunks).toEqual([
      '{"actualUsage":"描述',
      '吃东西这个动作。","commonScenarios":"日常吃饭","nuanceDifferences":"更基础直接","commonMistakes":"容易忽略变形"}',
    ]);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({
        body: expect.stringContaining('"stream":true'),
      })
    );
  });
});
