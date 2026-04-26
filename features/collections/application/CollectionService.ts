import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import type { CollectionDetail, CollectionSummary } from "@/shared/types/api";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}

export class CollectionService {
  constructor(
    private readonly repository: CollectionRepository,
    private readonly autoFilterJobService?: CollectionAutoFilterJobService
  ) {}

  async listCollections(): Promise<CollectionSummary[]> {
    return this.repository.listCollections();
  }

  async getCollectionDetail(collectionId: number): Promise<CollectionDetail> {
    const collection = await this.repository.findDetailById(collectionId);
    if (!collection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    return collection;
  }

  async createCollection(
    rawName: string,
    rawDescription?: string
  ): Promise<CollectionSummary> {
    const name = rawName.trim();
    const description = rawDescription?.trim() ?? "";

    if (!name) {
      throw new ValidationError("请输入 collection 名称。");
    }

    const existingCollection = await this.repository.findRecordByName(name);
    if (existingCollection) {
      throw new ValidationError("这个 collection 名称已经存在，请换一个。");
    }

    try {
      return await this.repository.createCollection(name, description);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ValidationError("这个 collection 名称已经存在，请换一个。");
      }

      throw error;
    }
  }

  async updateCollection(
    collectionId: number,
    input: {
      name?: string;
      description?: string;
      autoFilterEnabled?: boolean;
      autoFilterCriteria?: string;
      resyncAutoFilter?: boolean;
    }
  ): Promise<CollectionSummary> {
    const currentCollection = await this.repository.findById(collectionId);
    if (!currentCollection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    const nextName = input.name?.trim() ?? currentCollection.name;
    const nextDescription = input.description?.trim() ?? currentCollection.description;
    const nextAutoFilterEnabled =
      input.autoFilterEnabled ?? currentCollection.autoFilterEnabled;
    const nextAutoFilterCriteria =
      input.autoFilterCriteria?.trim() ?? currentCollection.autoFilterCriteria;
    const shouldResyncAutoFilter = input.resyncAutoFilter ?? false;
    const currentLastSyncedRuleVersion =
      currentCollection.autoFilterLastSyncedRuleVersion ?? null;

    if (!nextName) {
      throw new ValidationError("请输入 collection 名称。");
    }

    if (nextAutoFilterEnabled && !nextAutoFilterCriteria) {
      throw new ValidationError("开启 AI 自动筛选时，请填写筛选条件。");
    }

    if (shouldResyncAutoFilter && (!nextAutoFilterEnabled || !nextAutoFilterCriteria)) {
      throw new ValidationError("请先开启 AI 自动筛选并填写筛选条件，再重新同步。");
    }

    const duplicatedCollection = await this.repository.findRecordByName(nextName);
    if (
      duplicatedCollection &&
      Number(duplicatedCollection.collection_id) !== collectionId
    ) {
      throw new ValidationError("这个 collection 名称已经存在，请换一个。");
    }

    const hasAutoFilterDefinitionChanged =
      nextAutoFilterEnabled &&
      nextAutoFilterCriteria.length > 0 &&
      (nextAutoFilterEnabled !== currentCollection.autoFilterEnabled ||
        nextAutoFilterCriteria !== currentCollection.autoFilterCriteria ||
        nextName !== currentCollection.name);

    const nextAutoFilterRuleVersion = hasAutoFilterDefinitionChanged
      ? currentCollection.autoFilterRuleVersion + 1
      : currentCollection.autoFilterRuleVersion;

    const shouldQueueAutoFilterSync =
      shouldResyncAutoFilter && nextAutoFilterEnabled && nextAutoFilterCriteria.length > 0;

    const nextAutoFilterSyncStatus = !nextAutoFilterEnabled
      ? "idle"
      : shouldQueueAutoFilterSync
      ? "pending"
      : hasAutoFilterDefinitionChanged
        ? "idle"
        : nextAutoFilterEnabled
        ? currentCollection.autoFilterSyncStatus
        : "idle";

    const nextAutoFilterLastError = !nextAutoFilterEnabled
      ? ""
      : shouldQueueAutoFilterSync || hasAutoFilterDefinitionChanged
      ? ""
      : nextAutoFilterEnabled
        ? currentCollection.autoFilterLastError
        : "";
    const nextAutoFilterLastRunAt = nextAutoFilterEnabled
      ? currentCollection.autoFilterLastRunAt
      : null;
    const nextAutoFilterLastSyncedRuleVersion = nextAutoFilterEnabled
      ? currentLastSyncedRuleVersion
      : null;

    let updatedCollection;

    try {
      updatedCollection = await this.repository.updateCollection(
        collectionId,
        nextName,
        nextDescription,
        nextAutoFilterEnabled,
        nextAutoFilterCriteria,
        nextAutoFilterSyncStatus,
        nextAutoFilterLastRunAt,
        nextAutoFilterLastError,
        nextAutoFilterRuleVersion,
        nextAutoFilterLastSyncedRuleVersion
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ValidationError("这个 collection 名称已经存在，请换一个。");
      }

      throw error;
    }

    if (!updatedCollection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    if (!nextAutoFilterEnabled && currentCollection.autoFilterEnabled) {
      await this.repository.replaceAutoWords(collectionId, nextAutoFilterRuleVersion, []);
      const refreshedCollection = await this.repository.findById(collectionId);

      if (!refreshedCollection) {
        throw new NotFoundError("未找到这个 collection。");
      }

      return refreshedCollection;
    }

    if (shouldQueueAutoFilterSync) {
      await this.autoFilterJobService?.enqueueCollectionSync(
        collectionId,
        nextAutoFilterRuleVersion
      );
    }

    return updatedCollection;
  }

  async deleteCollection(collectionId: number): Promise<void> {
    const deleted = await this.repository.deleteCollection(collectionId);

    if (!deleted) {
      throw new NotFoundError("未找到这个 collection。");
    }
  }
}
