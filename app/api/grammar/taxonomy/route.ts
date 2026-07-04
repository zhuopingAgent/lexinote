import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function GET() {
  try {
    return NextResponse.json(await grammarLearningService.getTaxonomy());
  } catch (error) {
    return toErrorResponse(error, "GET /api/grammar/taxonomy failed");
  }
}
