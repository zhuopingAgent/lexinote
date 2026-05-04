export type VocabularyEntryKey = {
  word: string;
  pronunciation: string;
};

export function normalizeVocabularyEntryKey(
  entryKey: VocabularyEntryKey
): VocabularyEntryKey {
  return {
    word: entryKey.word.trim(),
    pronunciation: entryKey.pronunciation.trim(),
  };
}

export function buildVocabularyEntryKeyId(entryKey: VocabularyEntryKey): string {
  const normalizedEntryKey = normalizeVocabularyEntryKey(entryKey);

  return `${normalizedEntryKey.word}\u0000${normalizedEntryKey.pronunciation}`;
}
