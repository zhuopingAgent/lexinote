import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

type RouteContext = {
  params: Promise<{
    grammarPointId: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const url = new URL(request.url);
    const { grammarPointId } = await context.params;
    const result = await grammarLearningService.getGrammarPointDetail(
      grammarPointId,
      url.searchParams.get("userId") ?? undefined
    );

    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error, "GET /api/grammar/[grammarPointId] failed");
  }
}
