import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = getCollectionWordService();

function parsePositiveInteger(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }

  return parsed;
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ collectionId: string; wordId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const { collectionId: rawCollectionId, wordId: rawWordId } = await context.params;
    const collectionId = parsePositiveInteger(rawCollectionId, "collectionId");
    const wordId = parsePositiveInteger(rawWordId, "wordId");

    await collectionWordService.removeWord(collectionId, wordId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(
      error,
      "DELETE /api/collections/[collectionId]/words/[wordId] failed"
    );
  }
}
