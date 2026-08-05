import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const conversationService = getConversationService();

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const { sessionId, messageId } = await context.params;
    return NextResponse.json(
      await conversationService.maintainSession(sessionId, messageId)
    );
  } catch (error) {
    return toErrorResponse(
      error,
      "POST /api/conversations/[sessionId]/messages/[messageId]/maintenance failed"
    );
  }
}
