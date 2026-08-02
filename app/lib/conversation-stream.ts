import type { ConversationStreamEvent } from "@/shared/types/conversation";

export async function consumeConversationEventStream(
  response: Response,
  onEvent: (event: ConversationStreamEvent) => void
) {
  if (!response.body) {
    throw new Error("回答流不可用。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  function consumeBlock(block: string) {
    const data = block
      .split(/\r?\n/)
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
      .trim();
    if (!data) {
      return;
    }
    onEvent(JSON.parse(data) as ConversationStreamEvent);
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += decoder.decode(value, { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() ?? "";
      blocks.forEach(consumeBlock);
      if (done) {
        break;
      }
    }
    if (buffer.trim()) {
      consumeBlock(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}
