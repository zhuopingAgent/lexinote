import {
  AutoFilterRuleChangedError,
  CollectionAutoFilterService,
} from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionAutoFilterJobRepository } from "@/features/collections/infrastructure/CollectionAutoFilterJobRepository";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";

const MAX_ERROR_LENGTH = 280;

let processingPromise: Promise<void> | null = null;

function normalizeErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "AI 自动筛选执行失败，请稍后重试。";

  return message.length > MAX_ERROR_LENGTH
    ? `${message.slice(0, MAX_ERROR_LENGTH - 1)}…`
    : message;
}

function hasRetryAttemptsRemaining(job: { attemptCount?: number; maxAttempts?: number }) {
  return (job.attemptCount ?? 1) < (job.maxAttempts ?? 1);
}

export class CollectionAutoFilterJobService {
  constructor(
    private readonly jobRepository: CollectionAutoFilterJobRepository,
    private readonly collectionRepository: CollectionRepository,
    private readonly collectionAutoFilterService: CollectionAutoFilterService
  ) {}

  async enqueueCollectionSync(collectionId: number, ruleVersion: number): Promise<void> {
    await this.jobRepository.enqueueCollectionSync(collectionId, ruleVersion);
    void this.kickOff();
  }

  async enqueueEntryClassification(wordId: number): Promise<void> {
    await this.jobRepository.enqueueEntryClassification(wordId);
    void this.kickOff();
  }

  kickOff() {
    if (processingPromise) {
      return processingPromise;
    }

    processingPromise = this.processPendingJobs()
      .catch((error) => {
        console.error("Collection auto-filter job runner failed", error);
      })
      .finally(() => {
        processingPromise = null;
      });

    return processingPromise;
  }

  private async processPendingJobs() {
    while (true) {
      const job = await this.jobRepository.claimNextJob();
      if (!job) {
        return;
      }

      try {
        if (job.jobType === "collection_sync" && job.collectionId !== null) {
          await this.runCollectionSync(job.collectionId, job.ruleVersion);
        }

        if (job.jobType === "entry_classification" && job.wordId !== null) {
          await this.collectionAutoFilterService.classifyWordById(job.wordId);
        }

        await this.jobRepository.markCompleted(job.jobId);
      } catch (error) {
        const message = normalizeErrorMessage(error);
        const shouldRetry = hasRetryAttemptsRemaining(job);

        if (job.jobType === "collection_sync" && job.collectionId !== null) {
          const collection = await this.collectionRepository.findById(job.collectionId);
          await this.collectionRepository.updateAutoFilterStatus(
            job.collectionId,
            shouldRetry ? "pending" : "failed",
            new Date().toISOString(),
            message,
            collection?.autoFilterLastSyncedRuleVersion ?? null
          );
        }

        if (shouldRetry) {
          await this.jobRepository.markRetryableFailure(job.jobId, message);
        } else {
          await this.jobRepository.markFailed(job.jobId, message);
        }
      }
    }
  }

  private async runCollectionSync(collectionId: number, ruleVersion: number | null) {
    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      return;
    }

    if (!collection.autoFilterEnabled || !collection.autoFilterCriteria.trim()) {
      await this.collectionRepository.updateAutoFilterStatus(
        collectionId,
        "idle",
        collection.autoFilterLastRunAt,
        "",
        collection.autoFilterLastSyncedRuleVersion ?? null
      );
      return;
    }

    if (ruleVersion !== null && collection.autoFilterRuleVersion !== ruleVersion) {
      const hasQueuedReplacement = await this.jobRepository.hasActiveCollectionSync(
        collectionId,
        collection.autoFilterRuleVersion
      );
      await this.collectionRepository.updateAutoFilterStatus(
        collectionId,
        hasQueuedReplacement ? "pending" : "idle",
        collection.autoFilterLastRunAt,
        "",
        collection.autoFilterLastSyncedRuleVersion ?? null
      );
      return;
    }

    await this.collectionRepository.updateAutoFilterStatus(
      collectionId,
      "running",
      collection.autoFilterLastRunAt,
      "",
      collection.autoFilterLastSyncedRuleVersion ?? null
    );

    try {
      await this.collectionAutoFilterService.syncCollection(
        collectionId,
        ruleVersion ?? undefined
      );
    } catch (error) {
      if (!(error instanceof AutoFilterRuleChangedError)) {
        throw error;
      }

      const refreshedAfterRuleChange = await this.collectionRepository.findById(collectionId);
      if (!refreshedAfterRuleChange) {
        return;
      }

      const hasQueuedReplacement = await this.jobRepository.hasActiveCollectionSync(
        collectionId,
        refreshedAfterRuleChange.autoFilterRuleVersion
      );

      await this.collectionRepository.updateAutoFilterStatus(
        collectionId,
        hasQueuedReplacement ? "pending" : "idle",
        refreshedAfterRuleChange.autoFilterLastRunAt,
        "",
        refreshedAfterRuleChange.autoFilterLastSyncedRuleVersion ?? null
      );
      return;
    }

    const refreshedCollection = await this.collectionRepository.findById(collectionId);
    if (!refreshedCollection) {
      return;
    }

    await this.collectionRepository.updateAutoFilterStatus(
      collectionId,
      "completed",
      new Date().toISOString(),
      "",
      refreshedCollection.autoFilterRuleVersion
    );
  }
}
