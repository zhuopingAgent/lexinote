import { NextResponse } from "next/server";
import { getConversationLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const learningService = getConversationLearningService();

export async function GET() {
  try {
    return NextResponse.json({
      items: await learningService.listGrammarInbox(),
    });
  } catch (error) {
    return toErrorResponse(error, "GET /api/conversation/review-inbox failed");
  }
}
