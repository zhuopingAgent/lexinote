import { buildJaWordLookupPrompt } from "@/features/ai-lookup/prompts/jaWordLookup";
import type { DictionaryEntry, DictionaryExample } from "@/shared/types/api";

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

type KnownEntryFields = Pick<
  DictionaryEntry,
  "pronunciation" | "partOfSpeech" | "meaningZh"
>;

const FALLBACK_TEXT = "需结合上下文确认";
const MAX_OUTPUT_TOKENS = 300;

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

export class LlmClient {
  async completeWordEntry(
    word: string,
    baseEntry?: KnownEntryFields
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
              content: buildJaWordLookupPrompt(word, baseEntry),
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
}
