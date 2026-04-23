import { beforeEach, describe, expect, it, vi } from "vitest";

const removeWordMock = vi.fn();

vi.mock("@/features/collections/application/CollectionWordService", () => ({
  CollectionWordService: class {
    removeWord = removeWordMock;
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

describe("DELETE /api/collections/[collectionId]/words/[wordId]", () => {
  beforeEach(() => {
    removeWordMock.mockReset();
  });

  it("returns 400 for an invalid word id", async () => {
    const { DELETE } = await import(
      "@/app/api/collections/[collectionId]/words/[wordId]/route"
    );

    const response = await DELETE(
      new Request("http://localhost/api/collections/3/words/nope"),
      {
        params: Promise.resolve({ collectionId: "3", wordId: "nope" }),
      }
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "wordId must be a positive integer",
      },
    });
  });

  it("removes a word from the collection", async () => {
    removeWordMock.mockResolvedValue(undefined);

    const { DELETE } = await import(
      "@/app/api/collections/[collectionId]/words/[wordId]/route"
    );

    const response = await DELETE(
      new Request("http://localhost/api/collections/3/words/12"),
      {
        params: Promise.resolve({ collectionId: "3", wordId: "12" }),
      }
    );

    expect(response.status).toBe(204);
    expect(removeWordMock).toHaveBeenCalledWith(3, 12);
  });
});
