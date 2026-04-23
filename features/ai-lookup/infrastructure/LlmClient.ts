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
  DictionaryEntry,
  DictionaryExample,
} from "@/shared/types/api";

type OpenAiTextItem = {
  type?: string;
  text?: string;
};

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    content?: OpenAiTextItem[];
  }>;
};

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

function extractResponseText(data: OpenAiResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  return (
    data.output
      ?.flatMap((message) => message.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean)
      .join("\n")
      .trim() ?? ""
  );
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

function resolveModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.4";
}

function buildRequestConfig(model: string) {
  if (model === "gpt-5-mini" || model === "gpt-5-nano") {
    return {
      model,
      max_output_tokens: MAX_OUTPUT_TOKENS,
      reasoning: {
        effort: "minimal",
      } as const,
    };
  }

  return {
    model,
    max_output_tokens: MAX_OUTPUT_TOKENS,
  };
}

function buildBaseFormRequestConfig(model: string) {
  if (model === "gpt-5-mini" || model === "gpt-5-nano") {
    return {
      model,
      max_output_tokens: BASE_FORM_MAX_OUTPUT_TOKENS,
      reasoning: {
        effort: "minimal",
      } as const,
    };
  }

  return {
    model,
    max_output_tokens: BASE_FORM_MAX_OUTPUT_TOKENS,
  };
}

function buildReconcileRequestConfig(model: string) {
  if (model === "gpt-5-mini" || model === "gpt-5-nano") {
    return {
      model,
      max_output_tokens: RECONCILE_MAX_OUTPUT_TOKENS,
      reasoning: {
        effort: "minimal",
      } as const,
    };
  }

  return {
    model,
    max_output_tokens: RECONCILE_MAX_OUTPUT_TOKENS,
  };
}

function buildCollectionFilterRequestConfig(model: string, maxOutputTokens: number) {
  if (model === "gpt-5-mini" || model === "gpt-5-nano") {
    return {
      model,
      max_output_tokens: maxOutputTokens,
      reasoning: {
        effort: "minimal",
      } as const,
    };
  }

  return {
    model,
    max_output_tokens: maxOutputTokens,
  };
}

export class LlmClient {
  async resolveLookupWord(
    word: string,
    context?: string
  ): Promise<BaseFormResolution | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildBaseFormRequestConfig(resolveModel()),
          input: [
            {
              role: "system",
              content:
                "你是日语词形归一助手。请把用户输入转换成最适合查词的日语词典形或基本形，只返回要求的 JSON。",
            },
            {
              role: "user",
              content: buildJaWordBaseFormPrompt(word, context),
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseLookupWord(extractResponseText(data));
    } catch {
      return null;
    }
  }

  async completeWordEntry(
    word: string,
    baseEntry?: KnownEntryFields,
    context?: string
  ): Promise<DictionaryEntry> {
    const apiKey = process.env.OPENAI_API_KEY;
    const fallback = buildFallbackEntry(word, baseEntry);

    if (!apiKey) {
      return fallback;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildRequestConfig(resolveModel()),
          input: [
            {
              role: "system",
              content:
                "你是日语词条整理助手。请为中文母语者整理一个日语词的基础词条信息和例句。输出中文，准确、自然，只返回所需字段。",
            },
            {
              role: "user",
              content: buildJaWordLookupPrompt(word, baseEntry, context),
            },
          ],
        }),
      });

      if (!response.ok) {
        return fallback;
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseLookupOutput(word, extractResponseText(data), baseEntry) ?? fallback;
    } catch {
      return fallback;
    }
  }

  async reconcileWordEntry(
    word: string,
    genericEntry: DictionaryEntry,
    contextualEntry: DictionaryEntry,
    context: string
  ): Promise<DictionaryEntry | null> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return null;
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildReconcileRequestConfig(resolveModel()),
          input: [
            {
              role: "system",
              content:
                "你是日语词条校准助手。请比较通用词条和语境词条，只在差异已经足以影响默认查词结果时，才输出可持久化的综合词条 JSON。",
            },
            {
              role: "user",
              content: buildJaWordReconcilePrompt(
                word,
                genericEntry,
                contextualEntry,
                context
              ),
            },
          ],
        }),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseReconciledLookupOutput(
        word,
        extractResponseText(data),
        genericEntry,
        contextualEntry
      );
    } catch {
      return null;
    }
  }

  async matchEntryToCollections(
    entry: AutoFilterDictionaryEntry,
    collections: CollectionAutoFilterRule[]
  ): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || collections.length === 0) {
      return [];
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildCollectionFilterRequestConfig(
            resolveModel(),
            COLLECTION_FILTER_MAX_OUTPUT_TOKENS
          ),
          input: [
            {
              role: "system",
              content:
                "你是日语词条自动归类助手。请根据 collection 的筛选条件，谨慎判断这个词条应该加入哪些 collection，只返回所需 JSON。",
            },
            {
              role: "user",
              content: buildEntryCollectionAutoFilterPrompt(entry, collections),
            },
          ],
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseCollectionMatchOutput(extractResponseText(data));
    } catch {
      return [];
    }
  }

  async matchEntriesToCollection(
    collection: CollectionAutoFilterRule,
    entries: AutoFilterDictionaryEntry[]
  ): Promise<number[]> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey || entries.length === 0) {
      return [];
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          ...buildCollectionFilterRequestConfig(
            resolveModel(),
            COLLECTION_BACKFILL_MAX_OUTPUT_TOKENS
          ),
          input: [
            {
              role: "system",
              content:
                "你是日语词条自动归类助手。请根据 collection 的筛选条件，从候选词条中保守地挑出真正应该加入的项目，只返回所需 JSON。",
            },
            {
              role: "user",
              content: buildCollectionBackfillPrompt(collection, entries),
            },
          ],
        }),
      });

      if (!response.ok) {
        return [];
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseWordMatchOutput(extractResponseText(data));
    } catch {
      return [];
    }
  }
}
