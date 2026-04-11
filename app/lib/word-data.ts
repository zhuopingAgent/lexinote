import type { DictionaryEntry, WordLookupResponse } from "@/shared/types/api";
import type { WordData } from "@/app/components/word-card";

const DIGRAPH_ROMAJI_MAP: Record<string, string> = {
  きゃ: "kya",
  きゅ: "kyu",
  きょ: "kyo",
  しゃ: "sha",
  しゅ: "shu",
  しょ: "sho",
  ちゃ: "cha",
  ちゅ: "chu",
  ちょ: "cho",
  にゃ: "nya",
  にゅ: "nyu",
  にょ: "nyo",
  ひゃ: "hya",
  ひゅ: "hyu",
  ひょ: "hyo",
  みゃ: "mya",
  みゅ: "myu",
  みょ: "myo",
  りゃ: "rya",
  りゅ: "ryu",
  りょ: "ryo",
  ぎゃ: "gya",
  ぎゅ: "gyu",
  ぎょ: "gyo",
  じゃ: "ja",
  じゅ: "ju",
  じょ: "jo",
  びゃ: "bya",
  びゅ: "byu",
  びょ: "byo",
  ぴゃ: "pya",
  ぴゅ: "pyu",
  ぴょ: "pyo",
};

const KANA_ROMAJI_MAP: Record<string, string> = {
  あ: "a",
  い: "i",
  う: "u",
  え: "e",
  お: "o",
  か: "ka",
  き: "ki",
  く: "ku",
  け: "ke",
  こ: "ko",
  さ: "sa",
  し: "shi",
  す: "su",
  せ: "se",
  そ: "so",
  た: "ta",
  ち: "chi",
  つ: "tsu",
  て: "te",
  と: "to",
  な: "na",
  に: "ni",
  ぬ: "nu",
  ね: "ne",
  の: "no",
  は: "ha",
  ひ: "hi",
  ふ: "fu",
  へ: "he",
  ほ: "ho",
  ま: "ma",
  み: "mi",
  む: "mu",
  め: "me",
  も: "mo",
  や: "ya",
  ゆ: "yu",
  よ: "yo",
  ら: "ra",
  り: "ri",
  る: "ru",
  れ: "re",
  ろ: "ro",
  わ: "wa",
  を: "o",
  ん: "n",
  が: "ga",
  ぎ: "gi",
  ぐ: "gu",
  げ: "ge",
  ご: "go",
  ざ: "za",
  じ: "ji",
  ず: "zu",
  ぜ: "ze",
  ぞ: "zo",
  だ: "da",
  ぢ: "ji",
  づ: "zu",
  で: "de",
  ど: "do",
  ば: "ba",
  び: "bi",
  ぶ: "bu",
  べ: "be",
  ぼ: "bo",
  ぱ: "pa",
  ぴ: "pi",
  ぷ: "pu",
  ぺ: "pe",
  ぽ: "po",
  ぁ: "a",
  ぃ: "i",
  ぅ: "u",
  ぇ: "e",
  ぉ: "o",
};

const ABSTRACT_ZH_MARKERS = [
  "怀有",
  "抱有",
  "心存",
  "不安",
  "疑问",
  "疑念",
  "期待",
  "希望",
  "感情",
  "想法",
  "情绪",
  "印象",
  "梦想",
];

const PHYSICAL_ZH_MARKERS = [
  "拥抱",
  "搂",
  "怀抱",
  "抱起",
  "抱住",
  "搂住",
  "抱着",
  "抱在怀里",
  "抱在胸前",
  "抱紧",
];

const ABSTRACT_JA_MARKERS = [
  "不安",
  "疑問",
  "疑念",
  "期待",
  "希望",
  "感情",
  "印象",
  "夢",
  "責任感",
  "恐れ",
  "関心",
];

const PHYSICAL_JA_MARKERS = [
  "子ども",
  "赤ん坊",
  "花束",
  "胸",
  "腕",
  "肩",
  "体",
  "猫",
  "犬",
  "抱き",
  "抱いて眠",
];

export type ResultDifferenceNote = {
  key: string;
  title: string;
  description: string;
};

type UsageFocus = "abstract" | "physical" | "mixed";

type EntryUsageProfile = {
  focus: UsageFocus;
  meaningSummary: string;
};

export function getResultEntries(result: WordLookupResponse): DictionaryEntry[] {
  return result.entries && result.entries.length > 0 ? result.entries : [result.entry];
}

export function mapEntryToWordData(entry: DictionaryEntry): WordData {
  return {
    word: entry.word,
    reading: entry.pronunciation,
    romaji: toRomaji(entry.pronunciation),
    partOfSpeech: entry.partOfSpeech,
    meanings: entry.meaningZh.trim()
      ? [entry.meaningZh.trim()]
      : [],
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

export function buildResultDifferenceOverview(entries: DictionaryEntry[]) {
  if (entries.length < 2) {
    return null;
  }

  const hasDifferentReadings =
    new Set(entries.map((entry) => entry.pronunciation)).size > 1;
  const hasDifferentMeanings =
    new Set(entries.map((entry) => summarizeMeaning(entry.meaningZh))).size > 1;
  const profiles = entries.map((entry) => analyzeEntryUsage(entry));
  const hasReliableFocusDifference =
    new Set(
      profiles
        .map((profile) => profile.focus)
        .filter((focus) => focus !== "mixed")
    ).size > 1;
  const hasDifferentRepresentativeHints =
    new Set(
      entries
        .map((entry) => collectAllRepresentativeHints(entry).join("|"))
        .filter(Boolean)
    ).size > 1;

  if (
    !hasDifferentReadings &&
    !hasDifferentMeanings &&
    !hasReliableFocusDifference &&
    !hasDifferentRepresentativeHints
  ) {
    return null;
  }

  if (hasDifferentReadings && hasDifferentMeanings) {
    return "这些结果主要区别在读音、释义重心和典型使用场景。";
  }

  if (hasDifferentReadings) {
    return "这些结果主要区别在读音和各自更常见的使用场景。";
  }

  return "这些结果的读音相同，但释义重心和例句场景有所不同。";
}

export function buildResultDifferenceNotes(
  entries: DictionaryEntry[]
): ResultDifferenceNote[] {
  const profiles = entries.map((entry) => analyzeEntryUsage(entry));
  const hasDifferentReadings =
    new Set(entries.map((entry) => entry.pronunciation)).size > 1;
  const hasDifferentMeanings =
    new Set(entries.map((entry) => summarizeMeaning(entry.meaningZh))).size > 1;
  const hasDifferentFocuses =
    new Set(
      profiles
        .map((profile) => profile.focus)
        .filter((focus) => focus !== "mixed")
    ).size > 1;

  return entries
    .map((entry, index) => {
    const profile = profiles[index];
    const otherEntries = entries.filter((_, otherIndex) => otherIndex !== index);
    const uniqueReading = otherEntries.every(
      (otherEntry) => otherEntry.pronunciation !== entry.pronunciation
    );
    const uniqueMeaning = otherEntries.every(
      (otherEntry) => summarizeMeaning(otherEntry.meaningZh) !== profile.meaningSummary
    );

    const fragments: string[] = [];

    if (hasDifferentReadings && uniqueReading) {
      fragments.push(`读作「${entry.pronunciation}」`);
    }

    if (hasDifferentMeanings && uniqueMeaning) {
      fragments.push(`释义重心是「${profile.meaningSummary}」`);
    }

    if (hasDifferentFocuses && profile.focus !== "mixed") {
      fragments.push(describeUsageFocus(profile.focus));
    } else {
      const usageClue = buildRepresentativeUsageClue(
        entry,
        profile.focus,
        otherEntries
      );
      if (usageClue) {
        fragments.push(usageClue);
      }
    }

    if (fragments.length === 0) {
      return null;
    }

    return {
      key: `${entry.word}-${entry.pronunciation}-${index}`,
      title: `${entry.pronunciation}${entry.partOfSpeech ? ` · ${entry.partOfSpeech}` : ""}`,
      description: fragments.join("，") + "。",
    };
    })
    .filter((note): note is ResultDifferenceNote => note !== null);
}

function analyzeEntryUsage(entry: DictionaryEntry): EntryUsageProfile {
  const abstractScore = countMarkerHits(entry, ABSTRACT_ZH_MARKERS, ABSTRACT_JA_MARKERS);
  const physicalScore = countMarkerHits(entry, PHYSICAL_ZH_MARKERS, PHYSICAL_JA_MARKERS);

  if (abstractScore >= physicalScore + 2) {
    return {
      focus: "abstract",
      meaningSummary: summarizeMeaning(entry.meaningZh),
    };
  }

  if (physicalScore >= abstractScore + 2) {
    return {
      focus: "physical",
      meaningSummary: summarizeMeaning(entry.meaningZh),
    };
  }

  return {
    focus: "mixed",
    meaningSummary: summarizeMeaning(entry.meaningZh),
  };
}

function countMarkerHits(
  entry: DictionaryEntry,
  zhMarkers: string[],
  jaMarkers: string[]
) {
  const zhText = `${entry.meaningZh} ${entry.examples
    .map((example) => example.translationZh)
    .join(" ")}`;
  const jaText = entry.examples
    .map((example) => `${example.japanese} ${example.reading}`)
    .join(" ");

  return (
    zhMarkers.filter((marker) => zhText.includes(marker)).length +
    jaMarkers.filter((marker) => jaText.includes(marker)).length
  );
}

function summarizeMeaning(meaning: string) {
  const normalized = meaning.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return "待补充";
  }

  return normalized.split(/[；;。]/)[0].trim();
}

function describeUsageFocus(focus: UsageFocus) {
  switch (focus) {
    case "abstract":
      return "例句更偏向不安、期待、疑问这类抽象对象的“怀有/心存”用法";
    case "physical":
      return "例句更偏向抱住、搂住或接触具体对象的动作义";
    default:
      return "例句同时覆盖动作义和引申义，适用场景更宽一些";
  }
}

function buildRepresentativeUsageClue(
  entry: DictionaryEntry,
  focus: UsageFocus,
  otherEntries: DictionaryEntry[]
) {
  const abstractHints = collectRepresentativeHints(entry, ABSTRACT_ZH_MARKERS, ABSTRACT_JA_MARKERS);
  const physicalHints = collectRepresentativeHints(entry, PHYSICAL_ZH_MARKERS, PHYSICAL_JA_MARKERS);
  const otherHints = otherEntries.flatMap((otherEntry) =>
    collectAllRepresentativeHints(otherEntry)
  );
  const uniqueAbstractHints = abstractHints.filter(
    (hint) => !otherHints.includes(hint)
  );
  const uniquePhysicalHints = physicalHints.filter(
    (hint) => !otherHints.includes(hint)
  );

  if (focus === "abstract" && uniqueAbstractHints.length > 0) {
    return `常见搭配更接近「${uniqueAbstractHints.join("・")}」这类抽象内容`;
  }

  if (focus === "physical" && uniquePhysicalHints.length > 0) {
    return `常见对象更接近「${uniquePhysicalHints.join("・")}」这类具体事物`;
  }

  if (uniqueAbstractHints.length > 0 && uniquePhysicalHints.length > 0) {
    return `例句里同时出现「${uniqueAbstractHints[0]}」这类抽象内容和「${uniquePhysicalHints[0]}」这类具体对象，用法范围更宽`;
  }

  if (uniqueAbstractHints.length > 0) {
    return `例句里更常出现「${uniqueAbstractHints.join("・")}」这类抽象搭配`;
  }

  if (uniquePhysicalHints.length > 0) {
    return `例句里更常出现「${uniquePhysicalHints.join("・")}」这类具体对象`;
  }

  return null;
}

function collectAllRepresentativeHints(entry: DictionaryEntry) {
  return [
    ...collectRepresentativeHints(entry, ABSTRACT_ZH_MARKERS, ABSTRACT_JA_MARKERS),
    ...collectRepresentativeHints(entry, PHYSICAL_ZH_MARKERS, PHYSICAL_JA_MARKERS),
  ];
}

function collectRepresentativeHints(
  entry: DictionaryEntry,
  zhMarkers: string[],
  jaMarkers: string[]
) {
  const texts = [
    entry.meaningZh,
    ...entry.examples.flatMap((example) => [
      example.japanese,
      example.reading,
      example.translationZh,
    ]),
  ];

  const hints = [...jaMarkers, ...zhMarkers].filter((marker) =>
    texts.some((text) => text.includes(marker))
  );

  return Array.from(new Set(hints)).slice(0, 2);
}

function toRomaji(reading: string) {
  const normalized = toHiragana(reading.trim());
  if (!normalized || /[^ぁ-ゖー\s]/.test(normalized)) {
    return reading.trim();
  }

  let result = "";

  for (let index = 0; index < normalized.length; index += 1) {
    const current = normalized[index];
    const pair = normalized.slice(index, index + 2);

    if (current === " ") {
      result += " ";
      continue;
    }

    if (current === "っ") {
      const nextPair = normalized.slice(index + 1, index + 3);
      const nextValue =
        DIGRAPH_ROMAJI_MAP[nextPair] ?? KANA_ROMAJI_MAP[normalized[index + 1]] ?? "";
      if (nextValue) {
        result += nextValue[0];
      }
      continue;
    }

    if (current === "ー") {
      const lastCharacter = result[result.length - 1];
      if (lastCharacter) {
        result += lastCharacter;
      }
      continue;
    }

    if (DIGRAPH_ROMAJI_MAP[pair]) {
      result += DIGRAPH_ROMAJI_MAP[pair];
      index += 1;
      continue;
    }

    result += KANA_ROMAJI_MAP[current] ?? current;
  }

  return result;
}

function toHiragana(input: string) {
  return Array.from(input)
    .map((character) => {
      const codePoint = character.charCodeAt(0);
      if (codePoint >= 0x30a1 && codePoint <= 0x30f6) {
        return String.fromCharCode(codePoint - 0x60);
      }

      return character;
    })
    .join("");
}
