import { buildJaWordLookupPrompt } from "@/features/ai-lookup/prompts/jaWordLookup";
import type { DictionaryEntry } from "@/shared/types/api";

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
};

const FALLBACK_TEXT = "需结合上下文确认";
const MAX_OUTPUT_TOKENS = 300;

function buildFallbackEntry(word: string): DictionaryEntry {
  return {
    word,
    pronunciation: FALLBACK_TEXT,
    partOfSpeech: FALLBACK_TEXT,
    meaningZh: FALLBACK_TEXT,
  };
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

function parseLookupOutput(word: string, text: string): DictionaryEntry | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as RawLookupOutput;

    if (
      typeof parsed.pronunciation !== "string" ||
      typeof parsed.partOfSpeech !== "string" ||
      typeof parsed.meaningZh !== "string"
    ) {
      return null;
    }

    return {
      word,
      pronunciation: parsed.pronunciation.trim() || FALLBACK_TEXT,
      partOfSpeech: parsed.partOfSpeech.trim() || FALLBACK_TEXT,
      meaningZh: parsed.meaningZh.trim() || FALLBACK_TEXT,
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
  async inferWordEntry(word: string): Promise<DictionaryEntry> {
    const apiKey = process.env.OPENAI_API_KEY;
    const fallback = buildFallbackEntry(word);

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
                "你是日语词条整理助手。请为中文母语者补全一个日语词的基础词条信息。输出中文，准确、克制，只返回所需字段。",
            },
            {
              role: "user",
              content: buildJaWordLookupPrompt(word),
            },
          ],
        }),
      });

      if (!response.ok) {
        return fallback;
      }

      const data = (await response.json()) as OpenAiResponse;
      return parseLookupOutput(word, extractResponseText(data)) ?? fallback;
    } catch {
      return fallback;
    }
  }
}
