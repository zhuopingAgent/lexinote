import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/app/lib/api-client";
import {
  addGrammarFavorite,
  fetchGrammarBootstrap,
  fetchGrammarDetail,
  fetchGrammarSearch,
  removeGrammarFavorite,
} from "@/app/lib/grammar-api";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("grammar API client", () => {
  it("encodes search filters in a stable order and forwards the abort signal", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ items: [] }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchGrammarSearch(
      {
        query: "敬语 请求",
        category: "request_forms",
        dimension: "expression_function",
        practicality: "5",
        learningStatus: "learning",
        limit: 37,
        offset: 36,
      },
      controller.signal
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grammar?query=%E6%95%AC%E8%AF%AD+%E8%AF%B7%E6%B1%82&category=request_forms&dimension=expression_function&practicality=5&learningStatus=learning&limit=37&offset=36",
      { signal: controller.signal }
    );
  });

  it("loads bootstrap data through the bootstrap endpoint", async () => {
    const response = { taxonomy: {}, progress: {}, search: { items: [] } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchGrammarBootstrap({ dimension: "expression_function", limit: 37 })
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grammar/bootstrap?dimension=expression_function&limit=37",
      { signal: undefined }
    );
  });

  it("loads a concrete grammar detail without changing its identifier", async () => {
    const response = { grammarPoint: { id: "grammar-1" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchGrammarDetail("stable-sense-key")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/grammar/stable-sense-key",
      { signal: undefined }
    );
  });

  it("adds and removes favorites through their existing contracts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ ok: true }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(addGrammarFavorite("grammar 1")).resolves.toEqual({ ok: true });
    await expect(removeGrammarFavorite("grammar 1")).resolves.toBeUndefined();

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/favorites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ grammarPointId: "grammar 1" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/favorites?grammarPointId=grammar+1",
      { method: "DELETE" }
    );
  });

  it("preserves structured errors from favorite deletion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "GRAMMAR_NOT_FOUND", message: "未找到语法点" } },
          404
        )
      )
    );

    const error = await removeGrammarFavorite("missing").catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "GRAMMAR_NOT_FOUND",
      message: "未找到语法点",
      statusCode: 404,
    });
  });
});
