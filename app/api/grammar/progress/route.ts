import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    return NextResponse.json(
      await grammarLearningService.getProgress(
        url.searchParams.get("userId") ?? undefined
      )
    );
  } catch (error) {
    return toErrorResponse(error, "GET /api/grammar/progress failed");
  }
}
