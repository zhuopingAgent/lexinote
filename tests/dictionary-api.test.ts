import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/app/lib/api-client";
import {
  fetchDictionaryOverview,
  lookupDictionaryWord,
} from "@/app/lib/dictionary-api";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("dictionary API client", () => {
  it("encodes overview pagination and forwards the abort signal", async () => {
    const controller = new AbortController();
    const response = { words: [], nextCursor: null };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchDictionaryOverview({
        query: "食べる 練習",
        cursor: "2026-08-02T10:00:00Z|7",
        limit: 24,
        signal: controller.signal,
      })
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/words?query=%E9%A3%9F%E3%81%B9%E3%82%8B+%E7%B7%B4%E7%BF%92&limit=24&cursor=2026-08-02T10%3A00%3A00Z%7C7",
      { signal: controller.signal }
    );
  });

  it("uses the overview fallback message for malformed errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ unexpected: true }, 500))
    );

    await expect(
      fetchDictionaryOverview({ limit: 24 })
    ).rejects.toThrow("请求失败");
  });

  it("serializes lookup input and preserves structured errors", async () => {
    const input = {
      word: "食べました",
      context: "昨日の夕食",
      pronunciation: "たべました",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ word: "食べる" }))
      .mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "AI_GATEWAY_BUDGET_EXCEEDED",
              message: "Gateway 额度已用尽",
            },
          },
          402
        )
      );
    vi.stubGlobal("fetch", fetchMock);

    await lookupDictionaryWord(input);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/words/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal: undefined,
    });

    const error = await lookupDictionaryWord(input).catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "AI_GATEWAY_BUDGET_EXCEEDED",
      message: "Gateway 额度已用尽",
      statusCode: 402,
    });
  });
});
