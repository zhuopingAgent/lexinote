import type { WordData } from "@/app/components/word-card";
import { toRomaji } from "@/features/japanese-dictionary/domain/romaji";
import type {
  DictionaryEntry,
  WordLookupResponse,
} from "@/shared/types/dictionary";

export function getResultEntries(result: WordLookupResponse): DictionaryEntry[] {
  return result.entries && result.entries.length > 0
    ? result.entries
    : [result.entry];
}

export function mapEntryToWordData(entry: DictionaryEntry): WordData {
  return {
    word: entry.word,
    reading: entry.pronunciation,
    romaji: toRomaji(entry.pronunciation),
    partOfSpeech: entry.partOfSpeech,
    meanings: entry.meaningZh.trim() ? [entry.meaningZh.trim()] : [],
    examples: entry.examples.map((example) => ({
      japanese: example.japanese,
      reading: example.reading,
      translation: example.translationZh,
    })),
  };
}

export function mapResultToWordData(result: WordLookupResponse): WordData {
  return mapEntryToWordData(result.entry);
}

export function mapResultToWordDataList(result: WordLookupResponse): WordData[] {
  return getResultEntries(result).map((entry) => mapEntryToWordData(entry));
}
