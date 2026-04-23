import {
  CLAIM_NEXT_AUTO_FILTER_JOB_SQL,
  COMPLETE_AUTO_FILTER_JOB_SQL,
  FAIL_AUTO_FILTER_JOB_SQL,
  INSERT_COLLECTION_AUTO_FILTER_JOB_SQL,
  INSERT_ENTRY_AUTO_FILTER_JOB_SQL,
  SELECT_ACTIVE_COLLECTION_AUTO_FILTER_JOB_SQL,
  SELECT_ACTIVE_ENTRY_AUTO_FILTER_JOB_SQL,
} from "@/shared/db/sql/auto-filter-jobs.sql";
import { query } from "@/shared/db/query";

export type AutoFilterJob = {
  jobId: number;
  jobType: "collection_sync" | "entry_classification";
  collectionId: number | null;
  wordId: number | null;
  ruleVersion: number | null;
};

type AutoFilterJobRow = {
  job_id: number | string;
  job_type: "collection_sync" | "entry_classification";
  collection_id: number | string | null;
  word_id: number | string | null;
  rule_version: number | string | null;
};

function toInteger(value: number | string, fieldName: string) {
  const nextValue =
    typeof value === "string" ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(nextValue)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return nextValue;
}

function mapJobRow(row: AutoFilterJobRow): AutoFilterJob {
  return {
    jobId: toInteger(row.job_id, "job_id"),
    jobType: row.job_type,
    collectionId:
      row.collection_id === null
        ? null
        : toInteger(row.collection_id, "collection_id"),
    wordId: row.word_id === null ? null : toInteger(row.word_id, "word_id"),
    ruleVersion:
      row.rule_version === null
        ? null
        : toInteger(row.rule_version, "rule_version"),
  };
}

export class CollectionAutoFilterJobRepository {
  async enqueueCollectionSync(collectionId: number, ruleVersion: number): Promise<boolean> {
    const existingRows = await query<{ job_id: number | string }>(
      SELECT_ACTIVE_COLLECTION_AUTO_FILTER_JOB_SQL,
      [collectionId]
    );

    if (existingRows[0]) {
      return false;
    }

    await query(INSERT_COLLECTION_AUTO_FILTER_JOB_SQL, [collectionId, ruleVersion]);
    return true;
  }

  async enqueueEntryClassification(wordId: number): Promise<boolean> {
    const existingRows = await query<{ job_id: number | string }>(
      SELECT_ACTIVE_ENTRY_AUTO_FILTER_JOB_SQL,
      [wordId]
    );

    if (existingRows[0]) {
      return false;
    }

    await query(INSERT_ENTRY_AUTO_FILTER_JOB_SQL, [wordId]);
    return true;
  }

  async claimNextJob(): Promise<AutoFilterJob | null> {
    const rows = await query<AutoFilterJobRow>(CLAIM_NEXT_AUTO_FILTER_JOB_SQL);
    const row = rows[0];
    return row ? mapJobRow(row) : null;
  }

  async markCompleted(jobId: number): Promise<void> {
    await query(COMPLETE_AUTO_FILTER_JOB_SQL, [jobId]);
  }

  async markFailed(jobId: number, message: string): Promise<void> {
    await query(FAIL_AUTO_FILTER_JOB_SQL, [jobId, message]);
  }
}
