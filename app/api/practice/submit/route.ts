import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { readJsonBody } from "@/app/api/request";
import type { SentencePracticeInput } from "@/shared/types/grammar";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function POST(request: Request) {
  try {
    const body = await readJsonBody<SentencePracticeInput>(request);

    return NextResponse.json(await grammarLearningService.submitSentence(body));
  } catch (error) {
    return toErrorResponse(error, "POST /api/practice/submit failed");
  }
}
