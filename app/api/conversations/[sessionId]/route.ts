import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { UpdateConversationSessionRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationService();
type RouteContext = { params: Promise<{ sessionId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const cursor = new URL(request.url).searchParams.get("cursor");
    return NextResponse.json(
      await conversationService.getSession(sessionId, cursor)
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/conversations/[sessionId] failed");
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    const body = await readJsonBody<UpdateConversationSessionRequest>(request);
    return NextResponse.json({
      session: await conversationService.updateSession(sessionId, body),
    });
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/conversations/[sessionId] failed");
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { sessionId } = await context.params;
    await conversationService.deleteSession(sessionId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/conversations/[sessionId] failed");
  }
}
