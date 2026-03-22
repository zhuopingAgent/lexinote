import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/utils/errors";

const prepareLookupMock = vi.fn();
const completeLookupMock = vi.fn();

async function readSseEvents(response: Response) {
  const text = await response.text();
  return text
    .split("\n\n")
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const dataLine = block
        .split("\n")
        .find((line) => line.startsWith("data: "));

      return JSON.parse(dataLine?.slice(6) ?? "{}");
    });
}

vi.mock("@/features/word-lookup/application/WordLookupService", () => ({
  WordLookupService: class {
    prepareLookup = prepareLookupMock;
    completeLookup = completeLookupMock;
  },
}));

vi.mock("@/features/japanese-dictionary/application/JapaneseDictionaryService", () => ({
  JapaneseDictionaryService: class {},
}));

vi.mock(
  "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository",
  () => ({
    JapaneseDictionaryRepository: class {},
  })
);

vi.mock("@/features/ai-explanation/application/AIExplanationService", () => ({
  AIExplanationService: class {},
}));

vi.mock("@/features/ai-explanation/infrastructure/LlmClient", () => ({
  LlmClient: class {},
}));

describe("POST /api/words/explain", () => {
  beforeEach(() => {
    prepareLookupMock.mockReset();
    completeLookupMock.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: "{",
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "request body must be valid JSON",
      },
    });
    expect(prepareLookupMock).not.toHaveBeenCalled();
    expect(completeLookupMock).not.toHaveBeenCalled();
  });

  it("streams preview and final lookup response", async () => {
    prepareLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
    });
    completeLookupMock.mockImplementation(async (_preview, _model, onTextDelta) => {
      await onTextDelta?.('{"actualUsage":"描述');
      await onTextDelta?.('吃东西这个动作。"}');
      return {
        word: "食べる",
        source: "dictionary",
        entry: {
          word: "食べる",
          pronunciation: "たべる",
          meaningZh: "吃；进食",
          partOfSpeech: "动词",
        },
        explanationSource: "openai",
        explanation: {
          actualUsage: "描述吃东西这个动作。",
          commonScenarios: "日常吃饭、点餐、描述饮食习惯。",
          nuanceDifferences: "和近义表达相比更基础直接。",
          commonMistakes: "容易忽略动词变形。",
        },
      };
    });

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    await expect(readSseEvents(response)).resolves.toEqual([
      {
        type: "preview",
        data: {
          word: "食べる",
          source: "dictionary",
          entry: {
            word: "食べる",
            pronunciation: "たべる",
            meaningZh: "吃；进食",
            partOfSpeech: "动词",
          },
        },
      },
      {
        type: "ai_delta",
        data: {
          delta: '{"actualUsage":"描述',
        },
      },
      {
        type: "ai_delta",
        data: {
          delta: '吃东西这个动作。"}',
        },
      },
      {
        type: "complete",
        data: {
          word: "食べる",
          source: "dictionary",
          entry: {
            word: "食べる",
            pronunciation: "たべる",
            meaningZh: "吃；进食",
            partOfSpeech: "动词",
          },
          explanationSource: "openai",
          explanation: {
            actualUsage: "描述吃东西这个动作。",
            commonScenarios: "日常吃饭、点餐、描述饮食习惯。",
            nuanceDifferences: "和近义表达相比更基础直接。",
            commonMistakes: "容易忽略动词变形。",
          },
        },
      },
    ]);
    expect(prepareLookupMock).toHaveBeenCalledWith("食べる");
    expect(completeLookupMock).toHaveBeenCalledWith(
      {
        word: "食べる",
        source: "dictionary",
        entry: {
          word: "食べる",
          pronunciation: "たべる",
          meaningZh: "吃；进食",
          partOfSpeech: "动词",
        },
      },
      undefined,
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("passes selected model through to the service", async () => {
    prepareLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
    });
    completeLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
      explanationSource: "openai",
      explanation: {
        actualUsage: "描述吃东西这个动作。",
        commonScenarios: "日常吃饭、点餐、描述饮食习惯。",
        nuanceDifferences: "和近义表达相比更基础直接。",
        commonMistakes: "容易忽略动词变形。",
      },
    });

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる", model: "gpt-5-mini" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await readSseEvents(response);
    expect(completeLookupMock).toHaveBeenCalledWith(
      expect.objectContaining({ word: "食べる" }),
      "gpt-5-mini",
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("accepts gpt-5-nano as a valid model", async () => {
    prepareLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
    });
    completeLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
      explanationSource: "openai",
      explanation: {
        actualUsage: "描述吃东西这个动作。",
        commonScenarios: "日常吃饭、点餐、描述饮食习惯。",
        nuanceDifferences: "和近义表达相比更基础直接。",
        commonMistakes: "容易忽略动词变形。",
      },
    });

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる", model: "gpt-5-nano" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await readSseEvents(response);
    expect(completeLookupMock).toHaveBeenCalledWith(
      expect.objectContaining({ word: "食べる" }),
      "gpt-5-nano",
      expect.any(Function),
      expect.any(AbortSignal)
    );
  });

  it("hides internal messages for non-exposed app errors", async () => {
    prepareLookupMock.mockRejectedValue(
      new AppError("DATABASE_URL is not configured", 503, "CONFIGURATION_ERROR")
    );

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "CONFIGURATION_ERROR",
        message: "Service temporarily unavailable",
      },
    });
  });

  it("streams ai-only response when the dictionary misses", async () => {
    prepareLookupMock.mockResolvedValue({
      word: "未知词",
      source: "ai-only",
      entry: null,
    });
    completeLookupMock.mockResolvedValue({
      word: "未知词",
      source: "ai-only",
      entry: null,
      explanationSource: "openai",
      explanation: {
        actualUsage: "需要结合上下文确认这个词的具体用法。",
        commonScenarios: "建议放回句子里理解。",
        nuanceDifferences: "没有上下文时难以精确区分近义差别。",
        commonMistakes: "容易只按字面直译理解。",
      },
    });

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "未知词" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(readSseEvents(response)).resolves.toEqual([
      {
        type: "preview",
        data: {
          word: "未知词",
          source: "ai-only",
          entry: null,
        },
      },
      {
        type: "complete",
        data: {
          word: "未知词",
          source: "ai-only",
          entry: null,
          explanationSource: "openai",
          explanation: {
            actualUsage: "需要结合上下文确认这个词的具体用法。",
            commonScenarios: "建议放回句子里理解。",
            nuanceDifferences: "没有上下文时难以精确区分近义差别。",
            commonMistakes: "容易只按字面直译理解。",
          },
        },
      },
    ]);
  });

  it("streams error events when explanation generation fails after preview", async () => {
    prepareLookupMock.mockResolvedValue({
      word: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
      },
    });
    completeLookupMock.mockRejectedValue(
      new AppError("upstream failed", 503, "SERVICE_UNAVAILABLE")
    );

    const { POST } = await import("@/app/api/words/explain/route");
    const request = new Request("http://localhost/api/words/explain", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    await expect(readSseEvents(response)).resolves.toEqual([
      {
        type: "preview",
        data: {
          word: "食べる",
          source: "dictionary",
          entry: {
            word: "食べる",
            pronunciation: "たべる",
            meaningZh: "吃；进食",
            partOfSpeech: "动词",
          },
        },
      },
      {
        type: "error",
        data: {
          code: "SERVICE_UNAVAILABLE",
          message: "Service temporarily unavailable",
        },
      },
    ]);
  });
});
