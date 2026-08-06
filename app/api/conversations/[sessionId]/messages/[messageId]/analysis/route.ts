import { NextResponse } from "next/server";
import { getConversationAnalysisService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { AnalyzeConversationMessageRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationAnalysisService();

export async function POST(
  request: Request,
  context: { params: Promise<{ sessionId: string; messageId: string }> }
) {
  try {
    const { sessionId, messageId } = await context.params;
    const body = await readJsonBody<AnalyzeConversationMessageRequest>(request);
    return NextResponse.json(
      await conversationService.analyzeMessage(sessionId, messageId, body)
    );
  } catch (error) {
    return toErrorResponse(
      error,
      "POST /api/conversations/[sessionId]/messages/[messageId]/analysis failed"
    );
  }
}
