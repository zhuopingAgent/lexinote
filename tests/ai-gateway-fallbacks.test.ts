import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestAiGatewayStructuredText,
  requestAiGatewayTextStream,
} from "@/shared/ai/gateway";

const request = {
  url: "https://ai-gateway.example/v1/responses",
  headers: {
    "Content-Type": "application/json",
    Authorization: "Bearer test",
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
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
});
