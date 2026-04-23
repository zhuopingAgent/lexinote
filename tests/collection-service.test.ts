import { describe, expect, it, vi } from "vitest";
import { CollectionService } from "@/features/collections/application/CollectionService";

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
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(service.createCollection("  易混词  ")).resolves.toEqual({
      collectionId: 1,
      name: "易混词",
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

    await expect(service.createCollection("商务表达")).rejects.toMatchObject({
      message: "这个 collection 名称已经存在，请换一个。",
    });
  });

  it("updates a collection name", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "旧名字",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      }),
      findRecordByName: vi.fn().mockResolvedValue(null),
      updateCollection: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "新名字",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(service.updateCollection(3, { name: " 新名字 " })).resolves.toEqual({
      collectionId: 3,
      name: "新名字",
      description: "",
      wordCount: 2,
      createdAt: "2026-04-12T00:00:00.000Z",
      autoFilterEnabled: false,
      autoFilterCriteria: "",
      autoFilterSyncStatus: "idle",
      autoFilterLastRunAt: null,
      autoFilterLastError: "",
      autoFilterRuleVersion: 1,
    });
    expect(repository.updateCollection).toHaveBeenCalledWith(
      3,
      "新名字",
      "",
      false,
      "",
      "idle",
      null,
      "",
      1
    );
  });

  it("does not treat the current collection name as a duplicate when saving auto-filter settings", async () => {
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 2,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: false,
          autoFilterCriteria: "",
          autoFilterSyncStatus: "idle",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 1,
        })
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 2,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: true,
          autoFilterCriteria: "收录 JLPT N3 常见词",
          autoFilterSyncStatus: "pending",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 2,
        }),
      findRecordByName: vi.fn().mockResolvedValue({
        collection_id: "3",
        name: "JLPT N3",
        description: "",
        created_at: "2026-04-12T00:00:00.000Z",
        auto_filter_enabled: false,
        auto_filter_criteria: "",
        auto_filter_sync_status: "idle",
        auto_filter_last_run_at: null,
        auto_filter_last_error: "",
        auto_filter_rule_version: "1",
      }),
      updateCollection: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "pending",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 2,
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(
      service.updateCollection(3, {
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
      })
    ).resolves.toEqual({
      collectionId: 3,
      name: "JLPT N3",
      description: "",
      wordCount: 2,
      createdAt: "2026-04-12T00:00:00.000Z",
      autoFilterEnabled: true,
      autoFilterCriteria: "收录 JLPT N3 常见词",
      autoFilterSyncStatus: "pending",
      autoFilterLastRunAt: null,
      autoFilterLastError: "",
      autoFilterRuleVersion: 2,
    });
  });

  it("requires criteria when AI auto-filter is enabled", async () => {
    const repository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: false,
        autoFilterCriteria: "",
        autoFilterSyncStatus: "idle",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 1,
      }),
    };

    const service = new CollectionService(repository as never);

    await expect(
      service.updateCollection(3, { autoFilterEnabled: true, autoFilterCriteria: "  " })
    ).rejects.toMatchObject({
      message: "开启 AI 自动筛选时，请填写筛选条件。",
    });
  });

  it("re-syncs existing words after enabling AI auto-filter", async () => {
    const repository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 1,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: false,
          autoFilterCriteria: "",
          autoFilterSyncStatus: "idle",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 1,
        })
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 4,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: true,
          autoFilterCriteria: "收录 JLPT N3 常见词",
          autoFilterSyncStatus: "pending",
          autoFilterLastRunAt: null,
          autoFilterLastError: "",
          autoFilterRuleVersion: 2,
        }),
      findRecordByName: vi.fn().mockResolvedValue(null),
      updateCollection: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 1,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "pending",
        autoFilterLastRunAt: null,
        autoFilterLastError: "",
        autoFilterRuleVersion: 2,
      }),
    };
    const autoFilterJobService = {
      enqueueCollectionSync: vi.fn().mockResolvedValue(undefined),
    };

    const service = new CollectionService(
      repository as never,
      autoFilterJobService as never
    );

    await expect(
      service.updateCollection(3, {
        autoFilterEnabled: true,
        autoFilterCriteria: " 收录 JLPT N3 常见词 ",
      })
    ).resolves.toEqual({
      collectionId: 3,
      name: "JLPT N3",
      description: "",
      wordCount: 1,
      createdAt: "2026-04-12T00:00:00.000Z",
      autoFilterEnabled: true,
      autoFilterCriteria: "收录 JLPT N3 常见词",
      autoFilterSyncStatus: "pending",
      autoFilterLastRunAt: null,
      autoFilterLastError: "",
      autoFilterRuleVersion: 2,
    });

    expect(autoFilterJobService.enqueueCollectionSync).toHaveBeenCalledWith(3, 2);
  });

  it("throws when deleting a missing collection", async () => {
    const repository = {
      deleteCollection: vi.fn().mockResolvedValue(false),
    };

    const service = new CollectionService(repository as never);

    await expect(service.deleteCollection(99)).rejects.toMatchObject({
      message: "未找到这个 collection。",
    });
  });
});
