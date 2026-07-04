import { NextResponse } from "next/server";
import { getGrammarLearningService } from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import type { SentencePracticeInput } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const grammarLearningService = getGrammarLearningService();

export async function POST(request: Request) {
  try {
    let body: Partial<SentencePracticeInput>;

    try {
      body = (await request.json()) as Partial<SentencePracticeInput>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    return NextResponse.json(await grammarLearningService.submitSentence(body));
  } catch (error) {
    return toErrorResponse(error, "POST /api/practice/submit failed");
  }
}
