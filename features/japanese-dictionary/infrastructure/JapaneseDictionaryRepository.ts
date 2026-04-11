import {
  SELECT_DICTIONARY_ENTRY_BY_KEY_SQL,
  SELECT_DICTIONARY_ENTRIES_BY_WORD_SQL,
  SELECT_DICTIONARY_ENTRY_BY_WORD_SQL,
  UPSERT_DICTIONARY_ENTRY_SQL,
} from "@/shared/db/sql/dictionary.sql";
import { query } from "@/shared/db/query";
import type { DictionaryEntry, DictionaryExample } from "@/shared/types/api";

type DictionaryEntryRow = {
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
  examples: unknown;
};

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

  async findAllByWord(word: string): Promise<DictionaryEntry[]> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRIES_BY_WORD_SQL, [
      word,
    ]);

    return rows.map((row) => this.mapRow(row));
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

  async upsertEntry(entry: DictionaryEntry): Promise<void> {
    await query(UPSERT_DICTIONARY_ENTRY_SQL, [
      entry.word,
      entry.pronunciation,
      entry.meaningZh,
      entry.partOfSpeech,
      JSON.stringify(entry.examples),
    ]);
  }
}
