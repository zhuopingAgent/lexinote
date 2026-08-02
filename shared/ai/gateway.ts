import {
  rethrowAiQuotaError,
  throwIfOpenAiQuotaExhausted,
} from "@/shared/utils/ai-api-errors";

export const AI_MODELS = {
  cheap: "openai/gpt-5-nano",
  defaultTeacher: "openai/gpt-4.1-mini",
  premiumTeacher: "openai/gpt-5-mini",
  longContext: "alibaba/qwen3.7-plus",
  speech: "openai/whisper-1",
} as const;

export type AiModelRole = keyof typeof AI_MODELS;
export type AiTextModelRole = Exclude<AiModelRole, "speech">;
export type AiReasoningEffort = "minimal" | "low" | "medium" | "high";

export type AiGatewayInputMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type AiGatewayTextPrompt = {
  role: AiTextModelRole;
  maxOutputTokens: number;
  systemPrompt: string;
  userPrompt: string;
};

type AiGatewayMessagesPrompt = {
  role: AiTextModelRole;
  maxOutputTokens: number;
  messages: AiGatewayInputMessage[];
  signal?: AbortSignal;
};

type AiGatewayStructuredPrompt = AiGatewayMessagesPrompt & {
  schemaName: string;
  schema: Record<string, unknown>;
};

type AiGatewayTextRequestConfig = {
  model: string;
  max_output_tokens: number;
  reasoning?: {
    effort: AiReasoningEffort;
  };
};

type AiGatewayTextItem = {
  type?: string;
  text?: string;
};

export type AiGatewayResponse = {
  output_text?: string;
  output?: Array<{
    content?: AiGatewayTextItem[];
  }>;
};

const DEFAULT_AI_GATEWAY_BASE_URL = "https://ai-gateway.vercel.sh/v1";

export function resolveAiModel(role: AiModelRole) {
  return AI_MODELS[role];
}

export function resolveAiTextModel(role: AiTextModelRole) {
  return AI_MODELS[role];
}

export function resolveAiReasoningEffort(
  role: AiTextModelRole
): AiReasoningEffort | null {
  if (role === "cheap") {
    return "minimal";
  }

  if (role === "premiumTeacher") {
    return "low";
  }

  return null;
}

export function buildAiGatewayTextRequestConfig(
  role: AiTextModelRole,
  maxOutputTokens: number
): AiGatewayTextRequestConfig {
  const reasoningEffort = resolveAiReasoningEffort(role);

  if (reasoningEffort) {
    return {
      model: resolveAiTextModel(role),
      max_output_tokens: maxOutputTokens,
      reasoning: {
        effort: reasoningEffort,
      },
    };
  }

  return {
    model: resolveAiTextModel(role),
    max_output_tokens: maxOutputTokens,
  };
}

export function resolveAiGatewayApiKey() {
  return (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim() ||
    ""
  );
}

export function hasAiGatewayCredentials() {
  return Boolean(resolveAiGatewayApiKey());
}

export function resolveAiGatewayBaseUrl() {
  return (
    process.env.AI_GATEWAY_BASE_URL?.trim().replace(/\/+$/, "") ||
    DEFAULT_AI_GATEWAY_BASE_URL
  );
}

export function resolveAiGatewayResponsesUrl() {
  return `${resolveAiGatewayBaseUrl()}/responses`;
}

export function resolveAiGatewayRequest() {
  const apiKey = resolveAiGatewayApiKey();

  if (!apiKey) {
    return null;
  }

  return {
    url: resolveAiGatewayResponsesUrl(),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  };
}

export async function requestAiGatewayText(
  request: NonNullable<ReturnType<typeof resolveAiGatewayRequest>>,
  prompt: AiGatewayTextPrompt
): Promise<string | null> {
  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      body: JSON.stringify({
        ...buildAiGatewayTextRequestConfig(prompt.role, prompt.maxOutputTokens),
        input: [
          {
            role: "system",
            content: prompt.systemPrompt,
          },
          {
            role: "user",
            content: prompt.userPrompt,
          },
        ],
      }),
    });

    await throwIfOpenAiQuotaExhausted(response);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as AiGatewayResponse;
    return extractAiGatewayResponseText(data);
  } catch (error) {
    rethrowAiQuotaError(error);
    return null;
  }
}

function buildGatewayInput(messages: AiGatewayInputMessage[]) {
  return messages.map((message) => ({
    type: "message",
    role: message.role,
    content: message.content,
  }));
}

export async function requestAiGatewayTextStream(
  request: NonNullable<ReturnType<typeof resolveAiGatewayRequest>>,
  prompt: AiGatewayMessagesPrompt
): Promise<AsyncIterable<string> | null> {
  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      signal: prompt.signal,
      body: JSON.stringify({
        ...buildAiGatewayTextRequestConfig(prompt.role, prompt.maxOutputTokens),
        input: buildGatewayInput(prompt.messages),
        stream: true,
      }),
    });

    await throwIfOpenAiQuotaExhausted(response);

    if (!response.ok || !response.body) {
      return null;
    }

    return parseAiGatewayTextStream(response.body);
  } catch (error) {
    rethrowAiQuotaError(error);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

export async function requestAiGatewayStructuredText(
  request: NonNullable<ReturnType<typeof resolveAiGatewayRequest>>,
  prompt: AiGatewayStructuredPrompt
): Promise<string | null> {
  try {
    const response = await fetch(request.url, {
      method: "POST",
      headers: request.headers,
      signal: prompt.signal,
      body: JSON.stringify({
        ...buildAiGatewayTextRequestConfig(prompt.role, prompt.maxOutputTokens),
        input: buildGatewayInput(prompt.messages),
        text: {
          format: {
            type: "json_schema",
            name: prompt.schemaName,
            strict: true,
            schema: prompt.schema,
          },
        },
      }),
    });

    await throwIfOpenAiQuotaExhausted(response);

    if (!response.ok) {
      return null;
    }

    return extractAiGatewayResponseText((await response.json()) as AiGatewayResponse);
  } catch (error) {
    rethrowAiQuotaError(error);
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    return null;
  }
}

export async function* parseAiGatewayTextStream(
  stream: ReadableStream<Uint8Array>
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function readEvent(block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();

    if (!data || data === "[DONE]") {
      return "";
    }

    let event: {
      type?: unknown;
      delta?: unknown;
      message?: unknown;
      error?: { message?: unknown };
      response?: { error?: { message?: unknown } };
    };
    try {
      event = JSON.parse(data) as typeof event;
    } catch {
      return "";
    }

    if (event.type === "error" || event.type === "response.failed") {
      const message =
        (typeof event.message === "string" && event.message) ||
        (typeof event.error?.message === "string" && event.error.message) ||
        (typeof event.response?.error?.message === "string" &&
          event.response.error.message) ||
        "AI Gateway stream failed";
      throw new Error(message);
    }

    return event.type === "response.output_text.delta" &&
      typeof event.delta === "string"
      ? event.delta
      : "";
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";

      for (const block of blocks) {
        const delta = readEvent(block);
        if (delta) {
          yield delta;
        }
      }

      if (done) {
        break;
      }
    }

    const finalDelta = readEvent(buffer);
    if (finalDelta) {
      yield finalDelta;
    }
  } finally {
    reader.releaseLock();
  }
}

export function extractAiGatewayResponseText(data: AiGatewayResponse): string {
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
