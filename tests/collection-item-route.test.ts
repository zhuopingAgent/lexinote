import { beforeEach, describe, expect, it, vi } from "vitest";

const updateCollectionMock = vi.fn();
const deleteCollectionMock = vi.fn();
const getCollectionDetailMock = vi.fn();

vi.mock("@/features/collections/application/CollectionService", () => ({
  CollectionService: class {
    getCollectionDetail = getCollectionDetailMock;
    updateCollection = updateCollectionMock;
    deleteCollection = deleteCollectionMock;
  },
}));

vi.mock("@/features/collections/infrastructure/CollectionRepository", () => ({
  CollectionRepository: class {},
}));

describe("PATCH/DELETE /api/collections/[collectionId]", () => {
  beforeEach(() => {
    getCollectionDetailMock.mockReset();
    updateCollectionMock.mockReset();
    deleteCollectionMock.mockReset();
  });

  it("returns a collection detail payload", async () => {
    getCollectionDetailMock.mockResolvedValue({
      collectionId: 3,
      name: "JLPT N3",
      description: "",
      wordCount: 2,
      createdAt: "2026-04-12T00:00:00.000Z",
      words: [
        {
          wordId: 11,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ],
    });

    const { GET } = await import("@/app/api/collections/[collectionId]/route");
    const response = await GET(new Request("http://localhost/api/collections/3"), {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collection: {
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
        words: [
          {
            wordId: 11,
            word: "抱く",
            pronunciation: "いだく",
            meaningZh: "怀有；心存",
            partOfSpeech: "动词",
          },
        ],
      },
    });
    expect(getCollectionDetailMock).toHaveBeenCalledWith(3);
  });

  it("returns 400 when collectionId is invalid", async () => {
    const { PATCH } = await import("@/app/api/collections/[collectionId]/route");
    const request = new Request("http://localhost/api/collections/nope", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "新名字" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ collectionId: "nope" }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "collectionId must be a positive integer",
      },
    });
  });

  it("updates a collection", async () => {
    updateCollectionMock.mockResolvedValue({
      collectionId: 3,
      name: "新名字",
      description: "",
      wordCount: 4,
      createdAt: "2026-04-12T00:00:00.000Z",
    });

    const { PATCH } = await import("@/app/api/collections/[collectionId]/route");
    const request = new Request("http://localhost/api/collections/3", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "新名字" }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collection: {
        collectionId: 3,
        name: "新名字",
        description: "",
        wordCount: 4,
        createdAt: "2026-04-12T00:00:00.000Z",
      },
    });
    expect(updateCollectionMock).toHaveBeenCalledWith(3, { name: "新名字" });
  });

  it("deletes a collection", async () => {
    deleteCollectionMock.mockResolvedValue(undefined);

    const { DELETE } = await import("@/app/api/collections/[collectionId]/route");
    const response = await DELETE(new Request("http://localhost/api/collections/3"), {
      params: Promise.resolve({ collectionId: "3" }),
    });

    expect(response.status).toBe(204);
    expect(deleteCollectionMock).toHaveBeenCalledWith(3);
  });
});
