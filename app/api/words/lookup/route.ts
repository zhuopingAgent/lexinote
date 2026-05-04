import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getWordLookupService,
} from "@/app/api/services";
import { AppError, ValidationError } from "@/shared/utils/errors";
import type { WordLookupRequest } from "@/shared/types/api";

export const runtime = "nodejs";

const wordLookupService = getWordLookupService();

export async function POST(request: Request) {
  ensureAutoFilterJobRunnerStarted();

  try {
    let body: Partial<WordLookupRequest>;

    try {
      body = (await request.json()) as Partial<WordLookupRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (typeof body.word !== "string") {
      throw new ValidationError("word must be a string");
    }

    if (body.context !== undefined && typeof body.context !== "string") {
      throw new ValidationError("context must be a string");
    }

    if (body.pronunciation !== undefined && typeof body.pronunciation !== "string") {
      throw new ValidationError("pronunciation must be a string");
    }

    const result = await wordLookupService.lookupWord(
      body.word,
      body.context,
      body.pronunciation
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AppError) {
      return NextResponse.json(
        {
          error: {
            code: error.code,
            message: error.exposeMessage
              ? error.message
              : "Service temporarily unavailable",
          },
        },
        { status: error.statusCode }
      );
    }

    if (error instanceof Error) {
      console.error("POST /api/words/lookup failed", error);
    }

    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Internal server error",
        },
      },
      { status: 500 }
    );
  }
}
