import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import type { CollectionDetail, CollectionSummary } from "@/shared/types/api";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

export class CollectionService {
  constructor(private readonly repository: CollectionRepository) {}

  async listCollections(): Promise<CollectionSummary[]> {
    return this.repository.listCollections();
  }

  async getCollectionDetail(collectionId: number): Promise<CollectionDetail> {
    const collection = await this.repository.findDetailById(collectionId);
    if (!collection) {
      throw new NotFoundError("collection not found");
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
      throw new ValidationError("collection name is required");
    }

    const existingCollection = await this.repository.findRecordByName(name);
    if (existingCollection) {
      throw new ValidationError("collection name already exists");
    }

    return this.repository.createCollection(name, description);
  }

  async updateCollection(
    collectionId: number,
    input: {
      name?: string;
      description?: string;
    }
  ): Promise<CollectionSummary> {
    const currentCollection = await this.repository.findById(collectionId);
    if (!currentCollection) {
      throw new NotFoundError("collection not found");
    }

    const nextName = input.name?.trim() ?? currentCollection.name;
    const nextDescription = input.description?.trim() ?? currentCollection.description;

    if (!nextName) {
      throw new ValidationError("collection name is required");
    }

    const duplicatedCollection = await this.repository.findRecordByName(nextName);
    if (
      duplicatedCollection &&
      duplicatedCollection.collection_id !== collectionId
    ) {
      throw new ValidationError("collection name already exists");
    }

    const updatedCollection = await this.repository.updateCollection(
      collectionId,
      nextName,
      nextDescription
    );

    if (!updatedCollection) {
      throw new NotFoundError("collection not found");
    }

    return updatedCollection;
  }

  async deleteCollection(collectionId: number): Promise<void> {
    const deleted = await this.repository.deleteCollection(collectionId);

    if (!deleted) {
      throw new NotFoundError("collection not found");
    }
  }
}
