import {
  DELETE_COLLECTION_SQL,
  INSERT_COLLECTION_SQL,
  INSERT_COLLECTION_WORD_SQL,
  INSERT_COLLECTION_WORDS_SQL,
  LIST_COLLECTIONS_SQL,
  SELECT_COLLECTION_BY_ID_SQL,
  SELECT_COLLECTION_RECORD_BY_NAME_SQL,
  SELECT_COLLECTION_WORDS_BY_COLLECTION_ID_SQL,
  UPDATE_COLLECTION_SQL,
} from "@/shared/db/sql/collections.sql";
import { query } from "@/shared/db/query";
import type {
  CollectionDetail,
  CollectionSummary,
  CollectionWordItem,
} from "@/shared/types/api";

type CollectionSummaryRow = {
  collection_id: number;
  name: string;
  description: string;
  word_count: number;
  created_at: string | Date;
};

type CollectionRecordRow = {
  collection_id: number;
  name: string;
  description: string;
  created_at: string | Date;
};

type CollectionIdRow = {
  collection_id: number;
};

type CollectionWordRow = {
  word_id: number;
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export class CollectionRepository {
  private mapSummaryRow(row: CollectionSummaryRow): CollectionSummary {
    return {
      collectionId: row.collection_id,
      name: row.name,
      description: row.description,
      wordCount: row.word_count,
      createdAt: toIsoString(row.created_at),
    };
  }

  async listCollections(): Promise<CollectionSummary[]> {
    const rows = await query<CollectionSummaryRow>(LIST_COLLECTIONS_SQL);
    return rows.map((row) => this.mapSummaryRow(row));
  }

  async findById(collectionId: number): Promise<CollectionSummary | null> {
    const rows = await query<CollectionSummaryRow>(SELECT_COLLECTION_BY_ID_SQL, [
      collectionId,
    ]);
    const row = rows[0];

    return row ? this.mapSummaryRow(row) : null;
  }

  async findDetailById(collectionId: number): Promise<CollectionDetail | null> {
    const collection = await this.findById(collectionId);
    if (!collection) {
      return null;
    }

    const wordRows = await query<CollectionWordRow>(
      SELECT_COLLECTION_WORDS_BY_COLLECTION_ID_SQL,
      [collectionId]
    );

    const words: CollectionWordItem[] = wordRows.map((row) => ({
      wordId: row.word_id,
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
    }));

    return {
      ...collection,
      words,
    };
  }

  async findRecordByName(name: string): Promise<CollectionRecordRow | null> {
    const rows = await query<CollectionRecordRow>(SELECT_COLLECTION_RECORD_BY_NAME_SQL, [
      name,
    ]);
    return rows[0] ?? null;
  }

  async createCollection(name: string, description: string): Promise<CollectionSummary> {
    const rows = await query<CollectionIdRow>(INSERT_COLLECTION_SQL, [name, description]);
    const collectionId = rows[0]?.collection_id;

    if (!collectionId) {
      throw new Error("failed to create collection");
    }

    const collection = await this.findById(collectionId);
    if (!collection) {
      throw new Error("created collection could not be loaded");
    }

    return collection;
  }

  async updateCollection(
    collectionId: number,
    name: string,
    description: string
  ): Promise<CollectionSummary | null> {
    const rows = await query<CollectionIdRow>(UPDATE_COLLECTION_SQL, [
      collectionId,
      name,
      description,
    ]);

    if (!rows[0]) {
      return null;
    }

    return this.findById(collectionId);
  }

  async deleteCollection(collectionId: number): Promise<boolean> {
    const existingCollection = await this.findById(collectionId);
    if (!existingCollection) {
      return false;
    }

    await query(DELETE_COLLECTION_SQL, [collectionId]);
    return true;
  }

  async addWordToCollection(
    collectionId: number,
    wordId: number
  ): Promise<"added" | "already_exists"> {
    const rows = await query<{ word_id: number }>(INSERT_COLLECTION_WORD_SQL, [
      collectionId,
      wordId,
    ]);

    return rows[0] ? "added" : "already_exists";
  }

  async addWordsToCollection(
    collectionId: number,
    wordIds: number[]
  ): Promise<number> {
    const rows = await query<{ word_id: number }>(INSERT_COLLECTION_WORDS_SQL, [
      collectionId,
      wordIds,
    ]);

    return rows.length;
  }
}
