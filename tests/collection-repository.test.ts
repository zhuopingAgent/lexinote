import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();

vi.mock("@/shared/db/query", () => ({
  query: queryMock,
}));

describe("CollectionRepository", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("normalizes bigint-backed collection fields to numbers", async () => {
    queryMock.mockResolvedValue([
      {
        collection_id: "3",
        name: "JLPT N3",
        description: "",
        word_count: "2",
        created_at: "2026-04-12T12:22:26.149Z",
        auto_filter_enabled: true,
        auto_filter_criteria: "收录 JLPT N3 常见词",
        auto_filter_sync_status: "completed",
        auto_filter_last_run_at: "2026-04-12T12:30:00.000Z",
        auto_filter_last_error: "",
        auto_filter_rule_version: "4",
      },
    ]);

    const { CollectionRepository } = await import(
      "@/features/collections/infrastructure/CollectionRepository"
    );

    const repository = new CollectionRepository();

    await expect(repository.listCollections()).resolves.toEqual([
      {
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 2,
        createdAt: "2026-04-12T12:22:26.149Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "completed",
        autoFilterLastRunAt: "2026-04-12T12:30:00.000Z",
        autoFilterLastError: "",
        autoFilterRuleVersion: 4,
        autoFilterLastSyncedRuleVersion: null,
      },
    ]);
  });
});
