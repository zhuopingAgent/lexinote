import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/app/lib/api-client";
import {
  addCollectionWord,
  addCollectionWords,
  createCollection,
  deleteCollection,
  fetchCollections,
  removeCollectionWord,
  updateCollection,
} from "@/app/lib/collection-api";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("collection API client", () => {
  it("loads collections with cancellation support", async () => {
    const controller = new AbortController();
    const response = { collections: [] };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchCollections(controller.signal)).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/collections", {
      signal: controller.signal,
    });
  });

  it("serializes collection creation and updates", async () => {
    const response = { collection: { collectionId: 3, name: "敬语" } };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(response, 201))
      .mockResolvedValueOnce(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await createCollection({ name: "敬语" });
    await updateCollection(3, {
      name: "请求敬语",
      autoFilterEnabled: true,
      autoFilterCriteria: "请求表达",
    });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "敬语" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/collections/3", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "请求敬语",
        autoFilterEnabled: true,
        autoFilterCriteria: "请求表达",
      }),
    });
  });

  it("serializes single and bulk word additions", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ status: "added" }))
      .mockResolvedValueOnce(jsonResponse({ addedCount: 2, skippedCount: 0 }));
    vi.stubGlobal("fetch", fetchMock);

    await addCollectionWord(3, { word: "頼む", pronunciation: "たのむ" });
    await addCollectionWords(3, { wordIds: [7, 8] });

    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/collections/3/words", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ word: "頼む", pronunciation: "たのむ" }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/collections/3/words/bulk",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordIds: [7, 8] }),
      }
    );
  });

  it("accepts no-content collection and word deletion", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteCollection(3)).resolves.toBeUndefined();
    await expect(removeCollectionWord(3, 7)).resolves.toBeUndefined();
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/collections/3", {
      method: "DELETE",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/collections/3/words/7",
      { method: "DELETE" }
    );
  });

  it("preserves structured errors for collection mutations", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "COLLECTION_NOT_FOUND", message: "单词本不存在" } },
          404
        )
      )
    );

    const error = await deleteCollection(99).catch((caught) => caught);

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "COLLECTION_NOT_FOUND",
      message: "单词本不存在",
      statusCode: 404,
    });
  });
});
