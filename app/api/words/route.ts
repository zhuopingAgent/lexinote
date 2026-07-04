import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getVocabularyCoreService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import type { DictionaryOverviewResponse } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const vocabularyCoreService = getVocabularyCoreService();

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
    const { words, nextCursor } = await vocabularyCoreService.listWordsPage({
      query,
      cursor,
      limit,
    });
    const response: DictionaryOverviewResponse = { words, nextCursor };

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "GET /api/words failed");
  }
}
