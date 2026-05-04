import { describe, expect, it, vi } from "vitest";
import {
  AutoFilterRuleChangedError,
} from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";

describe("CollectionAutoFilterJobService", () => {
  it("drains the queue until no pending jobs remain", async () => {
    const jobs = Array.from({ length: 10 }, (_, index) => ({
      jobId: index + 1,
      jobType: "entry_classification" as const,
      collectionId: null,
      wordId: index + 100,
      ruleVersion: null,
    }));

    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce(jobs[0])
        .mockResolvedValueOnce(jobs[1])
        .mockResolvedValueOnce(jobs[2])
        .mockResolvedValueOnce(jobs[3])
        .mockResolvedValueOnce(jobs[4])
        .mockResolvedValueOnce(jobs[5])
        .mockResolvedValueOnce(jobs[6])
        .mockResolvedValueOnce(jobs[7])
        .mockResolvedValueOnce(jobs[8])
        .mockResolvedValueOnce(jobs[9])
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const collectionRepository = {
      findById: vi.fn(),
      updateAutoFilterStatus: vi.fn(),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn().mockResolvedValue(1),
      syncCollection: vi.fn(),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(collectionAutoFilterService.classifyWordById).toHaveBeenCalledTimes(10);
    expect(jobRepository.markCompleted).toHaveBeenCalledTimes(10);
    expect(jobRepository.markFailed).not.toHaveBeenCalled();
  });

  it("marks stale collection jobs as idle when no replacement job exists", async () => {
    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: 1,
          jobType: "collection_sync" as const,
          collectionId: 3,
          wordId: null,
          ruleVersion: 2,
        })
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      hasActiveCollectionSync: vi.fn().mockResolvedValue(false),
    };
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 1,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "pending",
        autoFilterLastRunAt: "2026-04-12T03:00:00.000Z",
        autoFilterLastError: "",
        autoFilterRuleVersion: 3,
        autoFilterLastSyncedRuleVersion: 1,
      }),
      updateAutoFilterStatus: vi.fn().mockResolvedValue(undefined),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn(),
      syncCollection: vi.fn(),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(collectionRepository.updateAutoFilterStatus).toHaveBeenCalledWith(
      3,
      "idle",
      "2026-04-12T03:00:00.000Z",
      "",
      1
    );
    expect(collectionAutoFilterService.syncCollection).not.toHaveBeenCalled();
    expect(jobRepository.markCompleted).toHaveBeenCalledWith(1);
  });

  it("keeps status pending when a replacement collection sync job already exists", async () => {
    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: 1,
          jobType: "collection_sync" as const,
          collectionId: 3,
          wordId: null,
          ruleVersion: 2,
        })
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      hasActiveCollectionSync: vi.fn().mockResolvedValue(true),
    };
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
        description: "",
        wordCount: 1,
        createdAt: "2026-04-12T00:00:00.000Z",
        autoFilterEnabled: true,
        autoFilterCriteria: "收录 JLPT N3 常见词",
        autoFilterSyncStatus: "pending",
        autoFilterLastRunAt: "2026-04-12T03:00:00.000Z",
        autoFilterLastError: "",
        autoFilterRuleVersion: 3,
        autoFilterLastSyncedRuleVersion: 1,
      }),
      updateAutoFilterStatus: vi.fn().mockResolvedValue(undefined),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn(),
      syncCollection: vi.fn(),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(collectionRepository.updateAutoFilterStatus).toHaveBeenCalledWith(
      3,
      "pending",
      "2026-04-12T03:00:00.000Z",
      "",
      1
    );
  });

  it("does not fail the job when the rule changes during sync", async () => {
    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: 1,
          jobType: "collection_sync" as const,
          collectionId: 3,
          wordId: null,
          ruleVersion: 2,
        })
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
      hasActiveCollectionSync: vi.fn().mockResolvedValue(false),
    };
    const collectionRepository = {
      findById: vi
        .fn()
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 1,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: true,
          autoFilterCriteria: "收录 JLPT N3 常见词",
          autoFilterSyncStatus: "pending",
          autoFilterLastRunAt: "2026-04-12T03:00:00.000Z",
          autoFilterLastError: "",
          autoFilterRuleVersion: 2,
          autoFilterLastSyncedRuleVersion: 1,
        })
        .mockResolvedValueOnce({
          collectionId: 3,
          name: "JLPT N3",
          description: "",
          wordCount: 1,
          createdAt: "2026-04-12T00:00:00.000Z",
          autoFilterEnabled: true,
          autoFilterCriteria: "收录新版 JLPT N3 常见词",
          autoFilterSyncStatus: "running",
          autoFilterLastRunAt: "2026-04-12T03:00:00.000Z",
          autoFilterLastError: "",
          autoFilterRuleVersion: 3,
          autoFilterLastSyncedRuleVersion: 1,
        }),
      updateAutoFilterStatus: vi.fn().mockResolvedValue(undefined),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn(),
      syncCollection: vi.fn().mockRejectedValue(new AutoFilterRuleChangedError()),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(jobRepository.markFailed).not.toHaveBeenCalled();
    expect(jobRepository.markCompleted).toHaveBeenCalledWith(1);
    expect(collectionRepository.updateAutoFilterStatus).toHaveBeenLastCalledWith(
      3,
      "idle",
      "2026-04-12T03:00:00.000Z",
      "",
      1
    );
  });

  it("requeues transient entry classification failures while attempts remain", async () => {
    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: 1,
          jobType: "entry_classification" as const,
          collectionId: null,
          wordId: 22,
          ruleVersion: null,
          attemptCount: 1,
          maxAttempts: 3,
        })
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markRetryableFailure: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const collectionRepository = {
      findById: vi.fn(),
      updateAutoFilterStatus: vi.fn(),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn().mockRejectedValue(new Error("temporary LLM failure")),
      syncCollection: vi.fn(),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(jobRepository.markRetryableFailure).toHaveBeenCalledWith(
      1,
      "temporary LLM failure"
    );
    expect(jobRepository.markFailed).not.toHaveBeenCalled();
  });

  it("marks a job failed when the final attempt fails", async () => {
    const jobRepository = {
      claimNextJob: vi
        .fn()
        .mockResolvedValueOnce({
          jobId: 1,
          jobType: "entry_classification" as const,
          collectionId: null,
          wordId: 22,
          ruleVersion: null,
          attemptCount: 3,
          maxAttempts: 3,
        })
        .mockResolvedValueOnce(null),
      markCompleted: vi.fn().mockResolvedValue(undefined),
      markRetryableFailure: vi.fn().mockResolvedValue(undefined),
      markFailed: vi.fn().mockResolvedValue(undefined),
    };
    const collectionRepository = {
      findById: vi.fn(),
      updateAutoFilterStatus: vi.fn(),
    };
    const collectionAutoFilterService = {
      classifyWordById: vi.fn().mockRejectedValue(new Error("permanent failure")),
      syncCollection: vi.fn(),
    };

    const service = new CollectionAutoFilterJobService(
      jobRepository as never,
      collectionRepository as never,
      collectionAutoFilterService as never
    );

    await service.kickOff();

    expect(jobRepository.markRetryableFailure).not.toHaveBeenCalled();
    expect(jobRepository.markFailed).toHaveBeenCalledWith(1, "permanent failure");
  });
});
