export function summarizeMeaning(meaning: string) {
  return meaning.split(/[；;。]/)[0]?.trim() || meaning.trim();
}
