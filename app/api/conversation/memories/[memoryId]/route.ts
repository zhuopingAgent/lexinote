import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { UpdateConversationMemoryRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationService();
type RouteContext = { params: Promise<{ memoryId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { memoryId } = await context.params;
    const body = await readJsonBody<UpdateConversationMemoryRequest>(request);
    return NextResponse.json({
      memory: await conversationService.updateMemory(memoryId, body),
    });
  } catch (error) {
    return toErrorResponse(
      error,
      "PATCH /api/conversation/memories/[memoryId] failed"
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { memoryId } = await context.params;
    await conversationService.deleteMemory(memoryId);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(
      error,
      "DELETE /api/conversation/memories/[memoryId] failed"
    );
  }
}
