import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { parsePositiveIntegerParam } from "@/app/api/request";

export const runtime = "nodejs";

const collectionWordService = getCollectionWordService();

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ collectionId: string; wordId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const { collectionId: rawCollectionId, wordId: rawWordId } = await context.params;
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    const wordId = parsePositiveIntegerParam(rawWordId, "wordId");

    await collectionWordService.removeWord(collectionId, wordId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(
      error,
      "DELETE /api/collections/[collectionId]/words/[wordId] failed"
    );
  }
}
