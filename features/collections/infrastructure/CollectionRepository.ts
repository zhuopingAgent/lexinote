import {
  CLEAR_COLLECTION_AUTO_WORDS_SQL,
  DELETE_COLLECTION_SQL,
  DELETE_COLLECTION_WORD_SQL,
  INSERT_COLLECTION_SQL,
  INSERT_WORD_INTO_COLLECTIONS_SQL,
  INSERT_COLLECTION_WORD_SQL,
  INSERT_COLLECTION_WORDS_SQL,
  LIST_AUTO_FILTER_COLLECTIONS_SQL,
  LIST_COLLECTIONS_SQL,
  SELECT_COLLECTION_BY_ID_SQL,
  SELECT_COLLECTION_RECORD_BY_NAME_SQL,
  SELECT_COLLECTION_WORDS_BY_COLLECTION_ID_SQL,
  UPDATE_COLLECTION_AUTO_FILTER_STATUS_SQL,
  UPDATE_COLLECTION_SQL,
  REPLACE_COLLECTION_AUTO_WORDS_SQL,
} from "@/shared/db/sql/collections.sql";
import { query } from "@/shared/db/query";
import type {
  AutoFilterSyncStatus,
  CollectionAutoFilterRule,
  CollectionDetail,
  CollectionSummary,
  CollectionWordItem,
} from "@/shared/types/api";

type CollectionSummaryRow = {
  collection_id: number | string;
  name: string;
  description: string;
  word_count: number | string;
  created_at: string | Date;
  auto_filter_enabled: boolean;
  auto_filter_criteria: string;
  auto_filter_sync_status: AutoFilterSyncStatus;
  auto_filter_last_run_at: string | Date | null;
  auto_filter_last_error: string;
  auto_filter_rule_version: number | string;
};

type CollectionRecordRow = {
  collection_id: number | string;
  name: string;
  description: string;
  created_at: string | Date;
  auto_filter_enabled: boolean;
  auto_filter_criteria: string;
  auto_filter_sync_status: AutoFilterSyncStatus;
  auto_filter_last_run_at: string | Date | null;
  auto_filter_last_error: string;
  auto_filter_rule_version: number | string;
};

type CollectionIdRow = {
  collection_id: number | string;
};

type CollectionWordRow = {
  word_id: number | string;
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
  source: "manual" | "auto";
  matched_rule_version: number | string | null;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableIsoString(value: string | Date | null) {
  if (!value) {
    return null;
  }

  return toIsoString(value);
}

function toInteger(value: number | string, fieldName: string) {
  const nextValue =
    typeof value === "string" ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(nextValue)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return nextValue;
}

export class CollectionRepository {
  private mapSummaryRow(row: CollectionSummaryRow): CollectionSummary {
    return {
      collectionId: toInteger(row.collection_id, "collection_id"),
      name: row.name,
      description: row.description,
      wordCount: toInteger(row.word_count, "word_count"),
      createdAt: toIsoString(row.created_at),
      autoFilterEnabled: row.auto_filter_enabled,
      autoFilterCriteria: row.auto_filter_criteria,
      autoFilterSyncStatus: row.auto_filter_sync_status,
      autoFilterLastRunAt: toNullableIsoString(row.auto_filter_last_run_at),
      autoFilterLastError: row.auto_filter_last_error,
      autoFilterRuleVersion: toInteger(
        row.auto_filter_rule_version,
        "auto_filter_rule_version"
      ),
    };
  }

  async listAutoFilterCollections(): Promise<CollectionAutoFilterRule[]> {
    const rows = await query<
      Pick<
        CollectionSummaryRow,
        | "collection_id"
        | "name"
        | "auto_filter_criteria"
        | "auto_filter_rule_version"
      >
    >(LIST_AUTO_FILTER_COLLECTIONS_SQL);

    return rows.map((row) => ({
      collectionId: toInteger(row.collection_id, "collection_id"),
      name: row.name,
      autoFilterCriteria: row.auto_filter_criteria,
      autoFilterRuleVersion: toInteger(
        row.auto_filter_rule_version,
        "auto_filter_rule_version"
      ),
    }));
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
      wordId: toInteger(row.word_id, "word_id"),
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
      source: row.source,
      matchedRuleVersion:
        row.matched_rule_version === null
          ? null
          : toInteger(row.matched_rule_version, "matched_rule_version"),
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
    const rawCollectionId = rows[0]?.collection_id;

    if (rawCollectionId === undefined) {
      throw new Error("failed to create collection");
    }

    const collectionId = toInteger(rawCollectionId, "collection_id");

    const collection = await this.findById(collectionId);
    if (!collection) {
      throw new Error("created collection could not be loaded");
    }

    return collection;
  }

  async updateCollection(
    collectionId: number,
    name: string,
    description: string,
    autoFilterEnabled: boolean,
    autoFilterCriteria: string,
    autoFilterSyncStatus: AutoFilterSyncStatus,
    autoFilterLastRunAt: string | null,
    autoFilterLastError: string,
    autoFilterRuleVersion: number
  ): Promise<CollectionSummary | null> {
    const rows = await query<CollectionIdRow>(UPDATE_COLLECTION_SQL, [
      collectionId,
      name,
      description,
      autoFilterEnabled,
      autoFilterCriteria,
      autoFilterSyncStatus,
      autoFilterLastRunAt,
      autoFilterLastError,
      autoFilterRuleVersion,
    ]);

    if (!rows[0]) {
      return null;
    }

    return this.findById(collectionId);
  }

  async updateAutoFilterStatus(
    collectionId: number,
    status: AutoFilterSyncStatus,
    lastRunAt: string | null,
    lastError: string
  ): Promise<CollectionSummary | null> {
    const rows = await query<CollectionIdRow>(UPDATE_COLLECTION_AUTO_FILTER_STATUS_SQL, [
      collectionId,
      status,
      lastRunAt,
      lastError,
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
    const rows = await query<{ word_id: number | string }>(INSERT_COLLECTION_WORD_SQL, [
      collectionId,
      wordId,
    ]);

    return rows[0] ? "added" : "already_exists";
  }

  async addWordsToCollection(
    collectionId: number,
    wordIds: number[]
  ): Promise<number> {
    const rows = await query<{ word_id: number | string }>(INSERT_COLLECTION_WORDS_SQL, [
      collectionId,
      wordIds,
    ]);

    return rows.length;
  }

  async addWordToCollections(wordId: number, collectionIds: number[]): Promise<number> {
    const rows = await query<{ collection_id: number | string }>(
      INSERT_WORD_INTO_COLLECTIONS_SQL,
      [collectionIds, wordId]
    );

    return rows.length;
  }

  async replaceAutoWords(
    collectionId: number,
    ruleVersion: number,
    wordIds: number[]
  ): Promise<number> {
    if (wordIds.length === 0) {
      await query(CLEAR_COLLECTION_AUTO_WORDS_SQL, [collectionId]);
      return 0;
    }

    const rows = await query<{ word_id: number | string }>(
      REPLACE_COLLECTION_AUTO_WORDS_SQL,
      [collectionId, ruleVersion, wordIds]
    );

    return rows.length;
  }

  async removeWordFromCollection(collectionId: number, wordId: number): Promise<boolean> {
    const rows = await query<{ word_id: number | string }>(DELETE_COLLECTION_WORD_SQL, [
      collectionId,
      wordId,
    ]);

    return Boolean(rows[0]);
  }
}
