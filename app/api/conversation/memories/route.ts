import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { CreateConversationMemoryRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationService();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<CreateConversationMemoryRequest>(request);
    return NextResponse.json(
      { memory: await conversationService.createMemory(body as CreateConversationMemoryRequest) },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/conversation/memories failed");
  }
}
