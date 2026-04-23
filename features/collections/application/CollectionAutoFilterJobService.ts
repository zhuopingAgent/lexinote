import { CollectionAutoFilterService } from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionAutoFilterJobRepository } from "@/features/collections/infrastructure/CollectionAutoFilterJobRepository";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";

const MAX_JOBS_PER_RUN = 8;
const MAX_ERROR_LENGTH = 280;

let processingPromise: Promise<void> | null = null;

function normalizeErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "AI 自动筛选执行失败，请稍后重试。";

  return message.length > MAX_ERROR_LENGTH
    ? `${message.slice(0, MAX_ERROR_LENGTH - 1)}…`
    : message;
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
    for (let index = 0; index < MAX_JOBS_PER_RUN; index += 1) {
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
        if (job.jobType === "collection_sync" && job.collectionId !== null) {
          await this.collectionRepository.updateAutoFilterStatus(
            job.collectionId,
            "failed",
            new Date().toISOString(),
            normalizeErrorMessage(error)
          );
        }

        await this.jobRepository.markFailed(job.jobId, normalizeErrorMessage(error));
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
        ""
      );
      return;
    }

    if (ruleVersion !== null && collection.autoFilterRuleVersion !== ruleVersion) {
      await this.collectionRepository.updateAutoFilterStatus(
        collectionId,
        "pending",
        collection.autoFilterLastRunAt,
        ""
      );
      await this.jobRepository.enqueueCollectionSync(
        collectionId,
        collection.autoFilterRuleVersion
      );
      return;
    }

    await this.collectionRepository.updateAutoFilterStatus(
      collectionId,
      "running",
      collection.autoFilterLastRunAt,
      ""
    );

    await this.collectionAutoFilterService.syncCollection(collectionId);

    const refreshedCollection = await this.collectionRepository.findById(collectionId);
    if (!refreshedCollection) {
      return;
    }

    if (
      ruleVersion !== null &&
      refreshedCollection.autoFilterRuleVersion !== ruleVersion
    ) {
      await this.collectionRepository.updateAutoFilterStatus(
        collectionId,
        "pending",
        refreshedCollection.autoFilterLastRunAt,
        ""
      );
      await this.jobRepository.enqueueCollectionSync(
        collectionId,
        refreshedCollection.autoFilterRuleVersion
      );
      return;
    }

    await this.collectionRepository.updateAutoFilterStatus(
      collectionId,
      "completed",
      new Date().toISOString(),
      ""
    );
  }
}
