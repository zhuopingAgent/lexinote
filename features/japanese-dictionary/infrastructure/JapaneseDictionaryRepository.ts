import {
  LIST_DICTIONARY_OVERVIEW_SQL,
  LIST_DICTIONARY_ENTRY_CANDIDATES_SQL,
  SELECT_DICTIONARY_ENTRY_RECORD_BY_KEY_SQL,
  SELECT_DICTIONARY_ENTRY_CANDIDATES_BY_WORD_SQL,
  SELECT_DICTIONARY_ENTRY_BY_ID_SQL,
  SELECT_DICTIONARY_ENTRY_BY_KEY_SQL,
  SELECT_DICTIONARY_ENTRIES_BY_WORD_SQL,
  SELECT_DICTIONARY_ENTRY_BY_WORD_SQL,
  UPSERT_DICTIONARY_ENTRY_SQL,
} from "@/shared/db/sql/dictionary.sql";
import { query } from "@/shared/db/query";
import type {
  DictionaryEntry,
  DictionaryEntryCandidate,
  DictionaryEntryDetail,
  DictionaryOverviewItem,
  DictionaryExample,
  SavedDictionaryEntry,
} from "@/shared/types/api";

type DictionaryEntryRow = {
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
  examples: unknown;
};

type DictionaryEntryCandidateRow = {
  word_id: number | string;
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
};

type DictionaryOverviewRow = {
  word_id: number | string;
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
  created_at: string | Date;
};

type DictionaryEntryDetailRow = {
  word_id: number | string;
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
  examples: unknown;
  created_at: string | Date;
};

type DictionaryEntryRecordRow = {
  word_id: number | string;
};

function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toInteger(value: number | string, fieldName: string) {
  const nextValue =
    typeof value === "string" ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(nextValue)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return nextValue;
}

function parseExamples(value: unknown): DictionaryExample[] {
  if (typeof value === "string") {
    try {
      return parseExamples(JSON.parse(value));
    } catch {
      return [];
    }
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const example = item as Record<string, unknown>;
      if (
        typeof example.japanese !== "string" ||
        typeof example.reading !== "string" ||
        typeof example.translationZh !== "string"
      ) {
        return null;
      }

      return {
        japanese: example.japanese,
        reading: example.reading,
        translationZh: example.translationZh,
      };
    })
    .filter((item): item is DictionaryExample => item !== null);
}

function encodeCursor(createdAt: string, wordId: number) {
  return Buffer.from(
    JSON.stringify({
      createdAt,
      wordId,
    })
  ).toString("base64url");
}

function decodeCursor(cursor?: string) {
  if (!cursor?.trim()) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    ) as {
      createdAt?: unknown;
      wordId?: unknown;
    };

    if (
      typeof parsed.createdAt !== "string" ||
      !parsed.createdAt ||
      !(typeof parsed.wordId === "number" || typeof parsed.wordId === "string")
    ) {
      return null;
    }

    const wordId =
      typeof parsed.wordId === "string"
        ? Number.parseInt(parsed.wordId, 10)
        : parsed.wordId;

    if (!Number.isInteger(wordId) || wordId <= 0) {
      return null;
    }

    return {
      createdAt: parsed.createdAt,
      wordId,
    };
  } catch {
    return null;
  }
}

export class JapaneseDictionaryRepository {
  private mapRow(row: DictionaryEntryRow): DictionaryEntry {
    return {
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
      examples: parseExamples(row.examples),
    };
  }

  private mapCandidateRow(
    row: DictionaryEntryCandidateRow
  ): DictionaryEntryCandidate {
    return {
      wordId: toInteger(row.word_id, "word_id"),
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
    };
  }

  private mapOverviewRow(row: DictionaryOverviewRow): DictionaryOverviewItem {
    return {
      wordId: toInteger(row.word_id, "word_id"),
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
      createdAt: toIsoString(row.created_at),
    };
  }

  private mapDetailRow(row: DictionaryEntryDetailRow): DictionaryEntryDetail {
    return {
      wordId: toInteger(row.word_id, "word_id"),
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
      examples: parseExamples(row.examples),
      createdAt: toIsoString(row.created_at),
    };
  }

  async findAllByWord(word: string): Promise<DictionaryEntry[]> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRIES_BY_WORD_SQL, [
      word,
    ]);

    return rows.map((row) => this.mapRow(row));
  }

  async findEntryCandidatesByWord(word: string): Promise<DictionaryEntryCandidate[]> {
    const rows = await query<DictionaryEntryCandidateRow>(
      SELECT_DICTIONARY_ENTRY_CANDIDATES_BY_WORD_SQL,
      [word]
    );

    return rows.map((row) => this.mapCandidateRow(row));
  }

  async listEntryCandidates(): Promise<DictionaryEntryCandidate[]> {
    const rows = await query<DictionaryEntryCandidateRow>(
      LIST_DICTIONARY_ENTRY_CANDIDATES_SQL
    );

    return rows.map((row) => this.mapCandidateRow(row));
  }

  async listOverviewEntries(): Promise<DictionaryOverviewItem[]> {
    const rows = await query<DictionaryOverviewRow>(LIST_DICTIONARY_OVERVIEW_SQL);
    return rows.map((row) => this.mapOverviewRow(row));
  }

  async listWordsPage(options?: {
    query?: string;
    cursor?: string;
    limit?: number;
  }): Promise<{ words: DictionaryOverviewItem[]; nextCursor: string | null }> {
    const normalizedQuery = options?.query?.trim() ?? "";
    const normalizedLimit = Math.min(Math.max(options?.limit ?? 24, 1), 100);
    const decodedCursor = decodeCursor(options?.cursor);
    const values: unknown[] = [];
    const conditions: string[] = [];

    if (normalizedQuery) {
      values.push(`%${normalizedQuery}%`);
      const searchIndex = values.length;
      conditions.push(
        `(word ILIKE $${searchIndex} OR pronunciation ILIKE $${searchIndex} OR meaning_zh ILIKE $${searchIndex} OR part_of_speech ILIKE $${searchIndex})`
      );
    }

    if (decodedCursor) {
      values.push(decodedCursor.createdAt);
      const createdAtIndex = values.length;
      values.push(decodedCursor.wordId);
      const wordIdIndex = values.length;
      conditions.push(
        `(created_at, word_id) < ($${createdAtIndex}::timestamptz, $${wordIdIndex}::bigint)`
      );
    }

    values.push(normalizedLimit + 1);
    const limitIndex = values.length;
    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
    const sql = `
      SELECT
        word_id,
        word,
        pronunciation,
        meaning_zh,
        part_of_speech,
        created_at
      FROM japanese_dictionary_entries
      ${whereClause}
      ORDER BY created_at DESC, word_id DESC
      LIMIT $${limitIndex}
    `;

    const rows = await query<DictionaryOverviewRow>(sql, values);
    const pageRows = rows.slice(0, normalizedLimit);
    const words = pageRows.map((row) => this.mapOverviewRow(row));
    const lastRow = pageRows[pageRows.length - 1];

    return {
      words,
      nextCursor:
        rows.length > normalizedLimit && lastRow
          ? encodeCursor(
              toIsoString(lastRow.created_at),
              toInteger(lastRow.word_id, "word_id")
            )
          : null,
    };
  }

  async findEntryDetailById(wordId: number): Promise<DictionaryEntryDetail | null> {
    const rows = await query<DictionaryEntryDetailRow>(
      SELECT_DICTIONARY_ENTRY_BY_ID_SQL,
      [wordId]
    );
    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapDetailRow(row);
  }

  async findByWord(word: string): Promise<DictionaryEntry | null> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRY_BY_WORD_SQL, [
      word,
    ]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async findByKey(
    word: string,
    pronunciation: string
  ): Promise<DictionaryEntry | null> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRY_BY_KEY_SQL, [
      word,
      pronunciation,
    ]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return this.mapRow(row);
  }

  async upsertEntry(entry: DictionaryEntry): Promise<SavedDictionaryEntry> {
    const existingRows = await query<DictionaryEntryRecordRow>(
      SELECT_DICTIONARY_ENTRY_RECORD_BY_KEY_SQL,
      [entry.word, entry.pronunciation]
    );
    const existingWordId = existingRows[0]?.word_id;

    await query(UPSERT_DICTIONARY_ENTRY_SQL, [
      entry.word,
      entry.pronunciation,
      entry.meaningZh,
      entry.partOfSpeech,
      JSON.stringify(entry.examples),
    ]);

    if (existingWordId !== undefined) {
      return {
        wordId: toInteger(existingWordId, "word_id"),
        isNewEntry: false,
      } satisfies SavedDictionaryEntry;
    }

    const createdRows = await query<DictionaryEntryRecordRow>(
      SELECT_DICTIONARY_ENTRY_RECORD_BY_KEY_SQL,
      [entry.word, entry.pronunciation]
    );
    const createdWordId = createdRows[0]?.word_id;

    if (createdWordId === undefined) {
      throw new Error("upserted dictionary entry could not be reloaded");
    }

    return {
      wordId: toInteger(createdWordId, "word_id"),
      isNewEntry: true,
    } satisfies SavedDictionaryEntry;
  }
}
