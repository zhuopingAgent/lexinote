import { NextResponse } from "next/server";
import { AIWordLookupService } from "@/features/ai-lookup/application/AIWordLookupService";
import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { WordLookupService } from "@/features/word-lookup/application/WordLookupService";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { AppError, ValidationError } from "@/shared/utils/errors";
import type { WordLookupRequest } from "@/shared/types/api";

export const runtime = "nodejs";

const wordLookupService = new WordLookupService(
  new JapaneseDictionaryService(new JapaneseDictionaryRepository()),
  new AIWordLookupService(new LlmClient())
);

export async function POST(request: Request) {
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
