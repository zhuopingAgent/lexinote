import { buildJaWordBaseFormPrompt } from "@/features/ai-lookup/prompts/jaWordBaseForm";
import {
  buildCollectionBackfillPrompt,
  buildEntryCollectionAutoFilterPrompt,
} from "@/features/ai-lookup/prompts/collectionAutoFilter";
import { buildJaWordReconcilePrompt } from "@/features/ai-lookup/prompts/jaWordReconcile";
import { buildJaWordLookupPrompt } from "@/features/ai-lookup/prompts/jaWordLookup";
import type {
  AutoFilterDictionaryEntry,
  CollectionAutoFilterRule,
} from "@/shared/types/collections";
import type {
  DictionaryEntry,
  DictionaryExample,
} from "@/shared/types/dictionary";
import {
  requestAiGatewayText,
  resolveAiGatewayRequest,
} from "@/shared/ai/gateway";

type RawLookupOutput = {
  pronunciation?: unknown;
  partOfSpeech?: unknown;
  meaningZh?: unknown;
  examples?: unknown;
};

type RawBaseFormOutput = {
  lookupWord?: unknown;
  lookupReason?: unknown;
};

type RawReconcileOutput = {
  shouldPersist?: unknown;
  pronunciation?: unknown;
  partOfSpeech?: unknown;
  meaningZh?: unknown;
  examples?: unknown;
};

type RawCollectionMatchOutput = {
  matchingCollectionIds?: unknown;
};

type RawWordMatchOutput = {
  matchingWordIds?: unknown;
};

type BaseFormResolution = {
  lookupWord: string;
  lookupReason: string;
};

type KnownEntryFields = Pick<
  DictionaryEntry,
  "pronunciation" | "partOfSpeech" | "meaningZh"
>;

const FALLBACK_TEXT = "需结合上下文确认";
const BASE_FORM_MAX_OUTPUT_TOKENS = 120;
const MAX_OUTPUT_TOKENS = 300;
const RECONCILE_MAX_OUTPUT_TOKENS = 360;
const COLLECTION_FILTER_MAX_OUTPUT_TOKENS = 320;
const COLLECTION_BACKFILL_MAX_OUTPUT_TOKENS = 520;

function buildFallbackEntry(
  word: string,
  baseEntry?: KnownEntryFields
): DictionaryEntry {
  return {
    word,
    pronunciation: baseEntry?.pronunciation ?? FALLBACK_TEXT,
    partOfSpeech: baseEntry?.partOfSpeech ?? FALLBACK_TEXT,
    meaningZh: baseEntry?.meaningZh ?? FALLBACK_TEXT,
    examples: [],
  };
}
function sanitizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function parseExamples(value: unknown): DictionaryExample[] | null {
  if (!Array.isArray(value) || value.length !== 3) {
    return null;
  }

  const parsed = value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const example = item as Record<string, unknown>;
      const japanese = sanitizeText(example.japanese);
      const reading = sanitizeText(example.reading);
      const translationZh = sanitizeText(example.translationZh);

      if (!japanese || !reading || !translationZh) {
        return null;
      }

      return {
        japanese,
        reading,
        translationZh,
      };
    })
    .filter((item): item is DictionaryExample => item !== null);

  return parsed.length === 3 ? parsed : null;
}

function parseLookupWord(text: string): BaseFormResolution | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as RawBaseFormOutput;
    const lookupWord = sanitizeText(parsed.lookupWord);
    const lookupReason = sanitizeText(parsed.lookupReason);

    if (!lookupWord || !lookupReason) {
      return null;
    }

    return {
      lookupWord,
      lookupReason,
    };
  } catch {
    return null;
  }
}

function parseIntegerArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => {
          if (typeof item === "number") {
            return item;
          }

          if (typeof item === "string" && item.trim()) {
            return Number.parseInt(item, 10);
          }

          return Number.NaN;
        })
        .filter((item) => Number.isInteger(item) && item > 0)
    )
  );
}

function parseCollectionMatchOutput(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]) as RawCollectionMatchOutput;
    return parseIntegerArray(parsed.matchingCollectionIds);
  } catch {
    return [];
  }
}

function parseWordMatchOutput(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return [];
  }

  try {
    const parsed = JSON.parse(match[0]) as RawWordMatchOutput;
    return parseIntegerArray(parsed.matchingWordIds);
  } catch {
    return [];
  }
}

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

function ruleTextMatchesEntry(ruleText: string, entry: AutoFilterDictionaryEntry) {
  const normalizedRuleText = normalizeRuleText(ruleText);

  if (!normalizedRuleText) {
    return false;
  }

  return tokenizeEntryForRuleMatch(entry).some((token) =>
    normalizedRuleText.includes(normalizeRuleText(token))
  );
}

function fallbackCollectionMatches(
  entry: AutoFilterDictionaryEntry,
  collections: CollectionAutoFilterRule[]
) {
  return collections
    .filter((collection) =>
      ruleTextMatchesEntry(
        `${collection.name}\n${collection.autoFilterCriteria}`,
        entry
      )
    )
    .map((collection) => collection.collectionId);
}

function fallbackWordMatches(
  collection: CollectionAutoFilterRule,
  entries: AutoFilterDictionaryEntry[]
) {
  const ruleText = `${collection.name}\n${collection.autoFilterCriteria}`;

  return entries
    .filter((entry) => ruleTextMatchesEntry(ruleText, entry))
    .map((entry) => entry.wordId);
}

function parseReconciledLookupOutput(
  word: string,
  text: string,
  genericEntry: DictionaryEntry,
  contextualEntry: DictionaryEntry
): DictionaryEntry | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as RawReconcileOutput;

    if (parsed.shouldPersist !== true) {
      return null;
    }

    const examples = parseExamples(parsed.examples);
    if (!examples) {
      return null;
    }

    return {
      word,
      pronunciation:
        sanitizeText(parsed.pronunciation) ||
        contextualEntry.pronunciation ||
        genericEntry.pronunciation ||
        FALLBACK_TEXT,
      partOfSpeech:
        sanitizeText(parsed.partOfSpeech) ||
        contextualEntry.partOfSpeech ||
        genericEntry.partOfSpeech ||
        FALLBACK_TEXT,
      meaningZh:
        sanitizeText(parsed.meaningZh) ||
        contextualEntry.meaningZh ||
        genericEntry.meaningZh ||
        FALLBACK_TEXT,
      examples,
    };
  } catch {
    return null;
  }
}

function parseLookupOutput(
  word: string,
  text: string,
  baseEntry?: KnownEntryFields
): DictionaryEntry | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as RawLookupOutput;
    const examples = parseExamples(parsed.examples);
    const pronunciation =
      sanitizeText(parsed.pronunciation) || baseEntry?.pronunciation || FALLBACK_TEXT;
    const partOfSpeech =
      sanitizeText(parsed.partOfSpeech) || baseEntry?.partOfSpeech || FALLBACK_TEXT;
    const meaningZh =
      sanitizeText(parsed.meaningZh) || baseEntry?.meaningZh || FALLBACK_TEXT;

    if (!examples) {
      return null;
    }

    return {
      word,
      pronunciation,
      partOfSpeech,
      meaningZh,
      examples,
    };
  } catch {
    return null;
  }
}

export class LlmClient {
  async resolveLookupWord(
    word: string,
    context?: string
  ): Promise<BaseFormResolution | null> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    if (!aiGatewayRequest) {
      return null;
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "cheap",
      maxOutputTokens: BASE_FORM_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语词形归一助手。请把用户输入转换成最适合查词的日语词典形或基本形，只返回要求的 JSON。",
      userPrompt: buildJaWordBaseFormPrompt(word, context),
    });

    return responseText ? parseLookupWord(responseText) : null;
  }

  async completeWordEntry(
    word: string,
    baseEntry?: KnownEntryFields,
    context?: string
  ): Promise<DictionaryEntry> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallback = buildFallbackEntry(word, baseEntry);

    if (!aiGatewayRequest) {
      return fallback;
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "defaultTeacher",
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语词条整理助手。请为中文母语者整理一个日语词的基础词条信息和例句。输出中文，准确、自然，只返回所需字段。",
      userPrompt: buildJaWordLookupPrompt(word, baseEntry, context),
    });

    return responseText
      ? parseLookupOutput(word, responseText, baseEntry) ?? fallback
      : fallback;
  }

  async reconcileWordEntry(
    word: string,
    genericEntry: DictionaryEntry,
    contextualEntry: DictionaryEntry,
    context: string
  ): Promise<DictionaryEntry | null> {
    const aiGatewayRequest = resolveAiGatewayRequest();

    if (!aiGatewayRequest) {
      return null;
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "premiumTeacher",
      maxOutputTokens: RECONCILE_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语词条校准助手。请比较通用词条和语境词条，只在差异已经足以影响默认查词结果时，才输出可持久化的综合词条 JSON。",
      userPrompt: buildJaWordReconcilePrompt(
        word,
        genericEntry,
        contextualEntry,
        context
      ),
    });

    return responseText
      ? parseReconciledLookupOutput(
          word,
          responseText,
          genericEntry,
          contextualEntry
        )
      : null;
  }

  async matchEntryToCollections(
    entry: AutoFilterDictionaryEntry,
    collections: CollectionAutoFilterRule[]
  ): Promise<number[]> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallbackMatches = fallbackCollectionMatches(entry, collections);

    if (!aiGatewayRequest || collections.length === 0) {
      return [];
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "cheap",
      maxOutputTokens: COLLECTION_FILTER_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语词条自动归类助手。请根据 collection 的筛选条件，谨慎判断这个词条应该加入哪些 collection，只返回所需 JSON。",
      userPrompt: buildEntryCollectionAutoFilterPrompt(entry, collections),
    });

    if (!responseText) {
      return fallbackMatches;
    }

    const matches = parseCollectionMatchOutput(responseText);
    return Array.from(new Set([...matches, ...fallbackMatches]));
  }

  async matchEntriesToCollection(
    collection: CollectionAutoFilterRule,
    entries: AutoFilterDictionaryEntry[]
  ): Promise<number[]> {
    const aiGatewayRequest = resolveAiGatewayRequest();
    const fallbackMatches = fallbackWordMatches(collection, entries);

    if (!aiGatewayRequest || entries.length === 0) {
      return [];
    }

    const responseText = await requestAiGatewayText(aiGatewayRequest, {
      role: "defaultTeacher",
      maxOutputTokens: COLLECTION_BACKFILL_MAX_OUTPUT_TOKENS,
      systemPrompt:
        "你是日语词条自动归类助手。请根据 collection 的筛选条件，从候选词条中保守地挑出真正应该加入的项目，只返回所需 JSON。",
      userPrompt: buildCollectionBackfillPrompt(collection, entries),
    });

    if (!responseText) {
      return fallbackMatches;
    }

    const matches = parseWordMatchOutput(responseText);
    return Array.from(new Set([...matches, ...fallbackMatches]));
  }
}
