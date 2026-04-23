import { beforeEach, describe, expect, it, vi } from "vitest";

const listCollectionsMock = vi.fn();
const createCollectionMock = vi.fn();

vi.mock("@/features/collections/application/CollectionService", () => ({
  CollectionService: class {
    listCollections = listCollectionsMock;
    createCollection = createCollectionMock;
  },
}));

vi.mock("@/features/collections/infrastructure/CollectionRepository", () => ({
  CollectionRepository: class {},
}));

describe("GET/POST /api/collections", () => {
  beforeEach(() => {
    listCollectionsMock.mockReset();
    createCollectionMock.mockReset();
  });

  it("returns the collection list", async () => {
    listCollectionsMock.mockResolvedValue([
      {
        collectionId: 1,
        name: "易混词",
        description: "",
        wordCount: 3,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      },
    ]);

    const { GET } = await import("@/app/api/collections/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      collections: [
        {
          collectionId: 1,
          name: "易混词",
          description: "",
          wordCount: 3,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: false,
          autoFilterCriteria: "",
          autoFilterSyncStatus: "idle",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 1,
        },
      ],
    });
  });

  it("returns 400 for invalid create payload", async () => {
    const { POST } = await import("@/app/api/collections/route");
    const request = new Request("http://localhost/api/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: 123 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "name must be a string",
      },
    });
  });

  it("creates a collection", async () => {
    createCollectionMock.mockResolvedValue({
      collectionId: 2,
      name: "商务表达",
      description: "",
      wordCount: 0,
      createdAt: "2026-04-12T00:00:00.000Z",
      autoFilterEnabled: false,
      autoFilterCriteria: "",
      autoFilterSyncStatus: "idle",
      autoFilterLastRunAt: null,
      autoFilterLastError: "",
      autoFilterRuleVersion: 1,
    });

    const { POST } = await import("@/app/api/collections/route");
    const request = new Request("http://localhost/api/collections", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "商务表达" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({
      collection: {
        collectionId: 2,
        name: "商务表达",
        description: "",
        wordCount: 0,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      },
    });
    expect(createCollectionMock).toHaveBeenCalledWith("商务表达", undefined);
  });
});
