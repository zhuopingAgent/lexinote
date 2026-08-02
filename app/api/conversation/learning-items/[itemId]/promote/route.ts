import { NextResponse } from "next/server";
import { getConversationLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { PromoteConversationLearningItemRequest } from "@/shared/types/conversation";

export const runtime = "nodejs";

const learningService = getConversationLearningService();

export async function POST(
  request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params;
    const body = await readJsonBody<PromoteConversationLearningItemRequest>(request);
    return NextResponse.json(await learningService.promote(itemId, body));
  } catch (error) {
    return toErrorResponse(
      error,
      "POST /api/conversation/learning-items/[itemId]/promote failed"
    );
  }
}
