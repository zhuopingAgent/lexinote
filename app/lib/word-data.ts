import type { WordLookupResponse } from "@/shared/types/api";
import type { WordData } from "@/app/components/word-card";

const WORD_DATA_ENRICHMENTS: Record<string, Partial<WordData>> = {
  食べる: {
    partOfSpeech: "動詞（一段活用）",
    jlptLevel: "N5",
    meanings: [
      "食物を口に入れて味わい、噛んで飲み込む",
      "生計を立てる",
    ],
    examples: [
      {
        japanese: "朝ごはんを食べましたか。",
        reading: "あさごはん を たべました か。",
        english: "Did you eat breakfast?",
      },
      {
        japanese: "寿司を食べたいです。",
        reading: "すし を たべたい です。",
        english: "I want to eat sushi.",
      },
    ],
  },
};

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

export function mapResultToWordData(result: WordLookupResponse): WordData {
  const enrichment = WORD_DATA_ENRICHMENTS[result.entry.word] ?? {};

  return {
    word: result.entry.word,
    reading: result.entry.pronunciation,
    romaji: enrichment.romaji ?? toRomaji(result.entry.pronunciation),
    partOfSpeech: enrichment.partOfSpeech ?? result.entry.partOfSpeech,
    meanings: enrichment.meanings ?? splitMeanings(result.entry.meaningZh),
    examples: enrichment.examples ?? [],
    jlptLevel: enrichment.jlptLevel,
  };
}

function splitMeanings(meaningZh: string) {
  const items = meaningZh
    .split(/[；;、,/]/)
    .map((item) => item.trim())
    .filter(Boolean);

  return items.length > 0 ? items : [meaningZh];
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
