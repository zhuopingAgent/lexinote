import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const conversationService = getConversationService();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await conversationService.bootstrap({
        query: url.searchParams.get("query") ?? undefined,
        cursor: url.searchParams.get("cursor"),
      })
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/conversation/bootstrap failed");
  }
}
