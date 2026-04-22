import { describe, expect, it, vi } from "vitest";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

describe("CollectionService", () => {
  it("creates a collection when the name is valid and unique", async () => {
    const repository = {
      findRecordByName: vi.fn().mockResolvedValue(null),
      createCollection: vi.fn().mockResolvedValue({
        collectionId: 1,
        name: "易混词",
        description: "",
        wordCount: 0,
        createdAt: "2026-04-12T00:00:00.000Z",
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(service.createCollection("  易混词  ")).resolves.toEqual({
      collectionId: 1,
      name: "易混词",
      description: "",
      wordCount: 0,
      createdAt: "2026-04-12T00:00:00.000Z",
    });
    expect(repository.createCollection).toHaveBeenCalledWith("易混词", "");
  });

  it("rejects duplicate collection names", async () => {
    const repository = {
      findRecordByName: vi.fn().mockResolvedValue({
        collection_id: 2,
        name: "商务表达",
        description: "",
        created_at: "2026-04-12T00:00:00.000Z",
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(service.createCollection("商务表达")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("updates a collection name", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "旧名字",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
      }),
      findRecordByName: vi.fn().mockResolvedValue(null),
      updateCollection: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "新名字",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(service.updateCollection(3, { name: " 新名字 " })).resolves.toEqual({
      collectionId: 3,
      name: "新名字",
      description: "",
      wordCount: 2,
      createdAt: "2026-04-12T00:00:00.000Z",
    });
    expect(repository.updateCollection).toHaveBeenCalledWith(3, "新名字", "");
  });

  it("throws when deleting a missing collection", async () => {
    const repository = {
      deleteCollection: vi.fn().mockResolvedValue(false),
    };

    const service = new CollectionService(repository as never);

    await expect(service.deleteCollection(99)).rejects.toBeInstanceOf(NotFoundError);
  });
});
