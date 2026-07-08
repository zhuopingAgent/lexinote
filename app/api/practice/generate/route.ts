import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { PracticeGenerateRequest } from "@/shared/types/api";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<PracticeGenerateRequest>(request);

    return NextResponse.json(await grammarLearningService.generatePractice(body));
  } catch (error) {
    return toErrorResponse(error, "POST /api/practice/generate failed");
  }
}
