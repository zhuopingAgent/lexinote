import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const result = await grammarLearningService.searchGrammarPoints({
      query: url.searchParams.get("query") ?? undefined,
      categorySlug: url.searchParams.get("category") ?? undefined,
      groupSlug: url.searchParams.get("group") ?? undefined,
      dimensionSlug: url.searchParams.get("dimension") ?? undefined,
      stageSlug: url.searchParams.get("stage") ?? undefined,
      moduleSlug: url.searchParams.get("module") ?? undefined,
      limit: url.searchParams.get("limit") ?? undefined,
      offset: url.searchParams.get("offset") ?? undefined,
      userId: url.searchParams.get("userId") ?? undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "GET /api/grammar failed");
  }
}
