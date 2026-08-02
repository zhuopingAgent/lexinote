import { NextResponse } from "next/server";
import { getConversationLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const learningService = getConversationLearningService();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await context.params;
    return NextResponse.json({ item: await learningService.dismiss(itemId) });
  } catch (error) {
    return toErrorResponse(
      error,
      "DELETE /api/conversation/learning-items/[itemId] failed"
    );
  }
}
