import { getConversationMessageService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { SendConversationMessageRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const conversationService = getConversationMessageService();

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await context.params;
    const body = await readJsonBody<SendConversationMessageRequest>(request);
    const stream = await conversationService.streamMessage(
      sessionId,
      body,
      request.signal
    );
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return toErrorResponse(error, "POST /api/conversations/[sessionId]/messages failed");
  }
}
