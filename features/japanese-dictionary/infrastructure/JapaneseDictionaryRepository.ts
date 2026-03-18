import {
  AI_ONLY_PLACEHOLDER_MEANING,
  SELECT_DICTIONARY_ENTRY_SQL,
  UPSERT_AI_ONLY_PLACEHOLDER_SQL,
} from "@/shared/db/sql/dictionary.sql";
import { query } from "@/shared/db/query";
import type { DictionaryEntry } from "@/shared/types/api";

type DictionaryEntryRow = {
  word: string;
  reading: string | null;
  meaning_zh: string;
  part_of_speech: string | null;
};

export class JapaneseDictionaryRepository {
  async findByWord(word: string): Promise<DictionaryEntry | null> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRY_SQL, [
      word,
      AI_ONLY_PLACEHOLDER_MEANING,
    ]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      word: row.word,
      reading: row.reading,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
    };
  }

  async saveAiOnlyPlaceholder(word: string): Promise<void> {
    await query(UPSERT_AI_ONLY_PLACEHOLDER_SQL, [word, AI_ONLY_PLACEHOLDER_MEANING]);
  }
}
