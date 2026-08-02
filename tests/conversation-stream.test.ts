import { describe, expect, it, vi } from "vitest";
import { consumeConversationEventStream } from "@/app/lib/conversation-stream";
import { parseAiGatewayTextStream } from "@/shared/ai/gateway";
import type { ConversationStreamEvent } from "@/shared/types/conversation";

function chunkedStream(chunks: string[]) {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(encoder.encode(chunk)));
      controller.close();
    },
  });
}

describe("conversation SSE parsing", () => {
  it("parses AI Gateway text deltas split across arbitrary chunks", async () => {
    const stream = chunkedStream([
      "event: response.output_text.delta\r\ndata: {\"type\":\"response.output_",
      "text.delta\",\"delta\":\"おは\"}\r\n\r\nevent: response.output_text.delta\n",
      "data: {\"type\":\"response.output_text.delta\",\"delta\":\"よう\"}\n\n",
      "data: [DONE]\n\n",
    ]);
    const deltas: string[] = [];

    for await (const delta of parseAiGatewayTextStream(stream)) {
      deltas.push(delta);
    }

    expect(deltas).toEqual(["おは", "よう"]);
  });

  it("surfaces an AI Gateway failure delivered after a successful HTTP response", async () => {
    const stream = chunkedStream([
      'data: {"type":"response.output_text.delta","delta":"途中"}\n\n',
      'data: {"type":"response.failed","response":{"error":{"message":"上游生成失败"}}}\n\n',
    ]);

    await expect(
      (async () => {
        for await (const delta of parseAiGatewayTextStream(stream)) {
          expect(delta).toBe("途中");
        }
      })()
    ).rejects.toThrow("上游生成失败");
  });

  it("parses application events split between event and data boundaries", async () => {
    const completed = {
      type: "completed",
      message: { id: "assistant-1" },
    };
    const response = new Response(
      chunkedStream([
        "event: assistant_created\ndata: {\"type\":\"assistant_created\",\"userMessage\":{\"id\":\"user-1\"},",
        "\"assistantMessage\":{\"id\":\"assistant-1\"}}\n\n",
        `event: completed\ndata: ${JSON.stringify(completed)}\n`,
        "\n",
      ])
    );
    const events: ConversationStreamEvent[] = [];
    const callback = vi.fn((event: ConversationStreamEvent) => events.push(event));

    await consumeConversationEventStream(response, callback);

    expect(callback).toHaveBeenCalledTimes(2);
    expect(events.map((event) => event.type)).toEqual([
      "assistant_created",
      "completed",
    ]);
  });
});
