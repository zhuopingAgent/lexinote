export function mergeUniqueWordEntriesById<T extends { wordId: number }>(
  currentEntries: T[],
  nextEntries: T[]
) {
  const mergedEntries = [...currentEntries];
  const existingWordIds = new Set(currentEntries.map((entry) => entry.wordId));

  for (const entry of nextEntries) {
    if (!existingWordIds.has(entry.wordId)) {
      existingWordIds.add(entry.wordId);
      mergedEntries.push(entry);
    }
  }

  return mergedEntries;
}
