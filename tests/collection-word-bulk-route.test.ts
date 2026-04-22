import { beforeEach, describe, expect, it, vi } from "vitest";

const addWordsByIdsMock = vi.fn();

vi.mock("@/features/collections/application/CollectionWordService", () => ({
  CollectionWordService: class {
    addWordsByIds = addWordsByIdsMock;
  },
}));

vi.mock("@/features/collections/infrastructure/CollectionRepository", () => ({
  CollectionRepository: class {},
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

describe("POST /api/collections/[collectionId]/words/bulk", () => {
  beforeEach(() => {
    addWordsByIdsMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import(
      "@/app/api/collections/[collectionId]/words/bulk/route"
    );
    const request = new Request("http://localhost/api/collections/3/words/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wordIds: "nope" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "wordIds must be an array",
      },
    });
  });

  it("adds multiple words to the collection", async () => {
    addWordsByIdsMock.mockResolvedValue({
      addedCount: 2,
      skippedCount: 1,
    });

    const { POST } = await import(
      "@/app/api/collections/[collectionId]/words/bulk/route"
    );
    const request = new Request("http://localhost/api/collections/3/words/bulk", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ wordIds: [11, 12, 13] }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      addedCount: 2,
      skippedCount: 1,
    });
    expect(addWordsByIdsMock).toHaveBeenCalledWith(3, [11, 12, 13]);
  });
});
