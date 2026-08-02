import type { AutoFilterDictionaryEntry } from "@/shared/types/collections";

function normalizeRuleText(value: string) {
  return value.toLowerCase().replace(/\s+/g, "");
}

function tokenizeEntryForRuleMatch(entry: AutoFilterDictionaryEntry) {
  return Array.from(
    new Set(
      [
        entry.word,
        entry.pronunciation,
        entry.meaningZh,
        entry.partOfSpeech,
        ...entry.meaningZh.split(/[；;、,，。/／\s]+/),
      ]
        .map((token) => token.trim())
        .filter((token) => token.length >= 2)
    )
  );
}

export function ruleTextMatchesEntry(
  ruleText: string,
  entry: AutoFilterDictionaryEntry
) {
  const normalizedRuleText = normalizeRuleText(ruleText);

  if (!normalizedRuleText) {
    return false;
  }

  return tokenizeEntryForRuleMatch(entry).some((token) =>
    normalizedRuleText.includes(normalizeRuleText(token))
  );
}
