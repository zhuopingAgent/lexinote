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

type AiGatewayTextPrompt = {
  role: AiTextModelRole;
  maxOutputTokens: number;
  systemPrompt: string;
  userPrompt: string;
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
