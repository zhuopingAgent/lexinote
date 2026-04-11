import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/shared/utils/errors";

const lookupWordMock = vi.fn();

vi.mock("@/features/word-lookup/application/WordLookupService", () => ({
  WordLookupService: class {
    lookupWord = lookupWordMock;
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

vi.mock("@/features/ai-lookup/application/AIWordLookupService", () => ({
  AIWordLookupService: class {},
}));

vi.mock("@/features/ai-lookup/infrastructure/LlmClient", () => ({
  LlmClient: class {},
}));

describe("POST /api/words/lookup", () => {
  beforeEach(() => {
    lookupWordMock.mockReset();
  });

  it("returns 400 for invalid JSON", async () => {
    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
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
    expect(lookupWordMock).not.toHaveBeenCalled();
  });

  it("returns 400 when word is missing", async () => {
    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "word must be a string",
      },
    });
  });

  it("returns 400 when context is not a string", async () => {
    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる", context: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "context must be a string",
      },
    });
  });

  it("returns 400 when pronunciation is not a string", async () => {
    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "抱く", pronunciation: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "pronunciation must be a string",
      },
    });
  });

  it("returns the lookup result as plain JSON", async () => {
    lookupWordMock.mockResolvedValue({
      word: "食べる",
      lookupWord: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
        examples: [
          {
            japanese: "朝ごはんを食べる。",
            reading: "あさごはん を たべる。",
            translationZh: "吃早餐。",
          },
          {
            japanese: "家で食べる。",
            reading: "いえ で たべる。",
            translationZh: "在家吃。",
          },
          {
            japanese: "一緒に食べる。",
            reading: "いっしょ に たべる。",
            translationZh: "一起吃。",
          },
        ],
      },
    });

    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "食べる" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("application/json");
    await expect(response.json()).resolves.toEqual({
      word: "食べる",
      lookupWord: "食べる",
      source: "dictionary",
      entry: {
        word: "食べる",
        pronunciation: "たべる",
        meaningZh: "吃；进食",
        partOfSpeech: "动词",
        examples: [
          {
            japanese: "朝ごはんを食べる。",
            reading: "あさごはん を たべる。",
            translationZh: "吃早餐。",
          },
          {
            japanese: "家で食べる。",
            reading: "いえ で たべる。",
            translationZh: "在家吃。",
          },
          {
            japanese: "一緒に食べる。",
            reading: "いっしょ に たべる。",
            translationZh: "一起吃。",
          },
        ],
      },
    });
    expect(lookupWordMock).toHaveBeenCalledWith("食べる", undefined, undefined);
  });

  it("forwards the optional context to the lookup service", async () => {
    lookupWordMock.mockResolvedValue({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: {
        word: "抱く",
        pronunciation: "だく",
        meaningZh: "怀有；抱有",
        partOfSpeech: "动词",
        examples: [
          {
            japanese: "将来に不安を抱く。",
            reading: "しょうらい に ふあん を だく。",
            translationZh: "对未来怀有不安。",
          },
          {
            japanese: "疑問を抱いたまま会議に出た。",
            reading: "ぎもん を いだいた まま かいぎ に でた。",
            translationZh: "带着疑问参加了会议。",
          },
          {
            japanese: "強い期待を抱いている。",
            reading: "つよい きたい を いだいて いる。",
            translationZh: "正怀着很强的期待。",
          },
        ],
      },
    });

    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "抱く", context: "不安を抱く" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(lookupWordMock).toHaveBeenCalledWith("抱く", "不安を抱く", undefined);
  });

  it("forwards the optional pronunciation to the lookup service", async () => {
    lookupWordMock.mockResolvedValue({
      word: "抱く",
      lookupWord: "抱く",
      source: "dictionary",
      entry: {
        word: "抱く",
        pronunciation: "いだく",
        meaningZh: "怀有；心存",
        partOfSpeech: "动词",
        examples: [],
      },
    });

    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        word: "抱く",
        context: "不安を抱く",
        pronunciation: "いだく",
      }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(lookupWordMock).toHaveBeenCalledWith("抱く", "不安を抱く", "いだく");
  });

  it("hides internal app error messages", async () => {
    lookupWordMock.mockRejectedValue(
      new AppError("DATABASE_URL is not configured", 503, "CONFIGURATION_ERROR")
    );

    const { POST } = await import("@/app/api/words/lookup/route");
    const request = new Request("http://localhost/api/words/lookup", {
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
});
