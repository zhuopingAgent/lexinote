import { NextResponse } from "next/server";
import { getConversationService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { UpdateConversationPreferencesRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const conversationService = getConversationService();

export async function PATCH(request: Request) {
  try {
    const body = await readJsonBody<UpdateConversationPreferencesRequest>(request);
    return NextResponse.json({
      preferences: await conversationService.updatePreferences(body),
    });
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/conversation/preferences failed");
  }
}
