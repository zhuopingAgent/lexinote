import {
  SELECT_DICTIONARY_ENTRY_SQL,
} from "@/shared/db/sql/dictionary.sql";
import { query } from "@/shared/db/query";
import type { DictionaryEntry } from "@/shared/types/api";

type DictionaryEntryRow = {
  word: string;
  pronunciation: string;
  meaning_zh: string;
  part_of_speech: string;
};

export class JapaneseDictionaryRepository {
  async findByWord(word: string): Promise<DictionaryEntry | null> {
    const rows = await query<DictionaryEntryRow>(SELECT_DICTIONARY_ENTRY_SQL, [word]);
    const row = rows[0];

    if (!row) {
      return null;
    }

    return {
      word: row.word,
      pronunciation: row.pronunciation,
      meaningZh: row.meaning_zh,
      partOfSpeech: row.part_of_speech,
      examples: [],
    };
  }
}
