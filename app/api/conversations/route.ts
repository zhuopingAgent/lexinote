import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { CreateConversationSessionRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationService();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<CreateConversationSessionRequest>(request);
    return NextResponse.json(
      { session: await conversationService.createSession(body.mode) },
      { status: 201 }
    );
  } catch (error) {
    return toErrorResponse(error, "POST /api/conversations failed");
  }
}
