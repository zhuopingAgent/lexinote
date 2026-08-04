import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestAiGatewayStructuredText,
  requestAiGatewayTextStream,
} from "@/shared/ai/gateway";
import {
  AiGatewayNoProvidersError,
  AiGatewayRateLimitedError,
} from "@/shared/utils/errors";

const request = {
  url: "https://ai-gateway.example/v1/responses",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer test",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("AI Gateway model fallback serialization", () => {
  it("sends the primary and fallback models for streaming", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(new ReadableStream<Uint8Array>(), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestAiGatewayTextStream(request, {
      role: "defaultTeacher",
      maxOutputTokens: 500,
      fallbackModels: ["google/gemini-2.5-flash"],
      messages: [{ role: "user", content: "你好" }],
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.providerOptions.gateway.models).toEqual([
      "openai/gpt-4.1-mini",
      "google/gemini-2.5-flash",
    ]);
  });

  it("sends fallbacks without duplicating the primary model", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ output_text: "{}" })
    );
    vi.stubGlobal("fetch", fetchMock);

    await requestAiGatewayStructuredText(request, {
      role: "cheap",
      maxOutputTokens: 500,
      fallbackModels: ["openai/gpt-5-nano", "google/gemini-2.5-flash-lite"],
      messages: [{ role: "user", content: "分析" }],
      schemaName: "test",
      schema: { type: "object" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.providerOptions.gateway.models).toEqual([
      "openai/gpt-5-nano",
      "google/gemini-2.5-flash-lite",
    ]);
  });

  it("preserves Gateway 429 classification through the request wrapper", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 429 }))
    );

    await expect(
      requestAiGatewayStructuredText(request, {
        role: "cheap",
        maxOutputTokens: 500,
        fallbackModels: ["google/gemini-2.5-flash-lite"],
        messages: [{ role: "user", content: "分析" }],
        schemaName: "test",
        schema: { type: "object" },
      })
    ).rejects.toBeInstanceOf(AiGatewayRateLimitedError);
  });

  it("classifies a restricted no-provider response for conversation calls", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json(
          { error: { type: "no_providers_available" } },
          { status: 403 }
        )
      )
    );

    await expect(
      requestAiGatewayTextStream(request, {
        role: "defaultTeacher",
        maxOutputTokens: 500,
        messages: [{ role: "user", content: "你好" }],
      })
    ).rejects.toBeInstanceOf(AiGatewayNoProvidersError);
    expect(warn).toHaveBeenCalledWith(
      "AI Gateway request failed",
      expect.objectContaining({
        status: 403,
        upstreamCode: "no_providers_available",
      })
    );
  });
});
