import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getDictionaryService,
} from "@/app/api/services";
import type { DictionaryOverviewResponse } from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const dictionaryService = getDictionaryService();

function parseLimit(rawLimit: string | null) {
  if (rawLimit === null || rawLimit.trim() === "") {
    return 24;
  }

  const limit = Number(rawLimit);
  if (!Number.isInteger(limit) || limit <= 0) {
    throw new ValidationError("limit must be a positive integer");
  }

  return Math.min(limit, 100);
}

export async function GET(request: Request) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;
    const limit = parseLimit(url.searchParams.get("limit"));
    const { words, nextCursor } = await dictionaryService.listWordsPage({
      query,
      cursor,
      limit,
    });
    const response: DictionaryOverviewResponse = { words, nextCursor };

    return NextResponse.json(response);
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
      console.error("GET /api/words failed", error);
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
