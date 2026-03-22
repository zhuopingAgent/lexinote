import {
  buildJaWordForZhNativePrompt,
  buildJaWordOnlyForZhNativePrompt,
} from "@/features/ai-explanation/prompts/jaWordForZhNative";
import type {
  AIExplanationOutput,
  AIExplanationResult,
  SupportedAiModel,
} from "@/shared/types/api";

export type ExplainInput = {
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  model?: SupportedAiModel;
};

type OnTextDelta = (delta: string) => void | Promise<void>;

type ExplainOptions = {
  onTextDelta?: OnTextDelta;
  signal?: AbortSignal;
};

function buildFallbackExplanation(input: ExplainInput): AIExplanationOutput {
  return {
    actualUsage: `「${input.word}」的核心意思是“${input.meaningZh}”，理解时先结合词性和常见搭配，不要只按中文单词一一对应。`,
    commonScenarios:
      "常见于日常会话、阅读和基础写作中。真正使用时要结合前后文判断语气和自然度。",
    nuanceDifferences:
      "和表面接近的词相比，差别通常出现在语气强弱、固定搭配和使用场景上，不能只看中文释义。",
    commonMistakes:
      "中文母语者容易直接按中文直译套用，也容易忽略读音、词性变化和固定搭配。",
  };
}

function buildWordOnlyFallbackExplanation(word: string): AIExplanationOutput {
  return {
    actualUsage: `「${word}」可以先从它在句子里的位置和搭配来理解；如果没有上下文，准确用法仍需结合实际句子确认。`,
    commonScenarios:
      "建议放回真实句子、对话或例句里观察它出现的场景，再判断它在表达中的作用。",
    nuanceDifferences:
      "如果只看到单词本身，和近义词或相似表达的细微差别可能无法完全确定，需要结合上下文。",
    commonMistakes:
      "中文母语者容易只按字面直译理解单词，忽略它在不同语境下可能有不同读音、词性或含义。",
  };
}

function parseExplanationOutput(text: string): AIExplanationOutput | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]) as Partial<AIExplanationOutput>;
    if (
      typeof parsed.actualUsage !== "string" ||
      typeof parsed.commonScenarios !== "string" ||
      typeof parsed.nuanceDifferences !== "string" ||
      typeof parsed.commonMistakes !== "string"
    ) {
      return null;
    }

    return {
      actualUsage: parsed.actualUsage.trim(),
      commonScenarios: parsed.commonScenarios.trim(),
      nuanceDifferences: parsed.nuanceDifferences.trim(),
      commonMistakes: parsed.commonMistakes.trim(),
    };
  } catch {
    return null;
  }
}

type ResponsesApiOutputItem = {
  type?: string;
  text?: string;
};

type ResponsesApiMessage = {
  content?: ResponsesApiOutputItem[];
};

type ResponsesApiResponse = {
  output_text?: string;
  output?: ResponsesApiMessage[];
};

type ResponsesApiStreamEvent = {
  type?: string;
  delta?: string;
  text?: string;
};

function extractResponseText(data: ResponsesApiResponse): string {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const texts =
    data.output
      ?.flatMap((message) => message.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text?.trim() ?? "")
      .filter(Boolean) ?? [];

  return texts.join("\n").trim();
}

function resolveModel(model?: SupportedAiModel): SupportedAiModel {
  return (
    model ??
    (process.env.OPENAI_MODEL as SupportedAiModel | undefined) ??
    "gpt-5.4"
  );
}

function parseSseBlocks(buffer: string) {
  const parts = buffer.split("\n\n");
  return {
    blocks: parts.slice(0, -1),
    remainder: parts.at(-1) ?? "",
  };
}

function parseSseEvent(block: string): ResponsesApiStreamEvent | null {
  const lines = block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const dataLines = lines
    .filter((line) => line.startsWith("data: "))
    .map((line) => line.slice(6));

  if (dataLines.length === 0) {
    return null;
  }

  const payload = dataLines.join("\n");
  if (payload === "[DONE]") {
    return { type: "done" };
  }

  try {
    return JSON.parse(payload) as ResponsesApiStreamEvent;
  } catch {
    return null;
  }
}

export class LlmClient {
  private async requestStructuredExplanation(
    body: Record<string, unknown>,
    fallback: AIExplanationOutput,
    options?: ExplainOptions
  ): Promise<AIExplanationResult> {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return {
        explanation: fallback,
        explanationSource: "fallback",
      };
    }

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: options?.signal,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        return {
          explanation: fallback,
          explanationSource: "fallback",
        };
      }

      if (options?.onTextDelta && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let fullText = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            buffer += decoder.decode();
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parsed = parseSseBlocks(buffer);
          buffer = parsed.remainder;

          for (const block of parsed.blocks) {
            const event = parseSseEvent(block);
            if (!event) {
              continue;
            }

            if (event.type === "response.output_text.delta" && event.delta) {
              fullText += event.delta;
              await options.onTextDelta(event.delta);
            }

            if (event.type === "response.output_text.done" && event.text) {
              fullText = event.text;
            }
          }
        }

        const finalBlock = parseSseEvent(buffer);
        if (finalBlock?.type === "response.output_text.done" && finalBlock.text) {
          fullText = finalBlock.text;
        }

        const parsed = parseExplanationOutput(fullText.trim());
        return {
          explanation: parsed ?? fallback,
          explanationSource: parsed ? "openai" : "fallback",
        };
      }

      const data = (await response.json()) as ResponsesApiResponse;
      const parsed = parseExplanationOutput(extractResponseText(data));
      return {
        explanation: parsed ?? fallback,
        explanationSource: parsed ? "openai" : "fallback",
      };
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      return {
        explanation: fallback,
        explanationSource: "fallback",
      };
    }
  }

  async explainWordForZhNative(
    input: ExplainInput,
    options?: ExplainOptions
  ): Promise<AIExplanationResult> {
    const fallback = buildFallbackExplanation(input);

    return this.requestStructuredExplanation(
      {
        model: resolveModel(input.model),
        stream: Boolean(options?.onTextDelta),
        input: [
          {
            role: "system",
            content:
              "你是日语学习助手。面向中文母语者解释日语单词，简洁、准确、学习导向。输出中文。",
          },
          {
            role: "user",
            content: buildJaWordForZhNativePrompt(input),
          },
        ],
      },
      fallback,
      options
    );
  }

  async explainWordOnlyForZhNative(
    word: string,
    model?: SupportedAiModel,
    options?: ExplainOptions
  ): Promise<AIExplanationResult> {
    const fallback = buildWordOnlyFallbackExplanation(word);

    return this.requestStructuredExplanation(
      {
        model: resolveModel(model),
        stream: Boolean(options?.onTextDelta),
        input: [
          {
            role: "system",
            content:
              "你是日语学习助手。面向中文母语者解释日语单词，简洁、准确、学习导向。输出中文。",
          },
          {
            role: "user",
            content: buildJaWordOnlyForZhNativePrompt(word),
          },
        ],
      },
      fallback,
      options
    );
  }
}
