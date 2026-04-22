import { beforeEach, describe, expect, it, vi } from "vitest";

const addWordMock = vi.fn();

vi.mock("@/features/collections/application/CollectionWordService", () => ({
  CollectionWordService: class {
    addWord = addWordMock;
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

describe("POST /api/collections/[collectionId]/words", () => {
  beforeEach(() => {
    addWordMock.mockReset();
  });

  it("returns 400 for invalid payload", async () => {
    const { POST } = await import(
      "@/app/api/collections/[collectionId]/words/route"
    );
    const request = new Request("http://localhost/api/collections/3/words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: 123 }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "word must be a string",
      },
    });
  });

  it("returns candidates when selection is required", async () => {
    addWordMock.mockResolvedValue({
      status: "requires_selection",
      candidates: [
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ],
    });

    const { POST } = await import(
      "@/app/api/collections/[collectionId]/words/route"
    );
    const request = new Request("http://localhost/api/collections/3/words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "抱く" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "requires_selection",
      candidates: [
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ],
    });
    expect(addWordMock).toHaveBeenCalledWith(3, "抱く", undefined);
  });

  it("adds the word to the collection", async () => {
    addWordMock.mockResolvedValue({
      status: "added",
      candidate: {
        wordId: 12,
        word: "抱く",
        pronunciation: "いだく",
        meaningZh: "怀有；心存",
        partOfSpeech: "动词",
      },
    });

    const { POST } = await import(
      "@/app/api/collections/[collectionId]/words/route"
    );
    const request = new Request("http://localhost/api/collections/3/words", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ word: "抱く", pronunciation: "いだく" }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: "added",
      candidate: {
        wordId: 12,
        word: "抱く",
        pronunciation: "いだく",
        meaningZh: "怀有；心存",
        partOfSpeech: "动词",
      },
    });
    expect(addWordMock).toHaveBeenCalledWith(3, "抱く", "いだく");
  });
});
