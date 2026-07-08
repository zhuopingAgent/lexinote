import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { parsePositiveIntegerParam, readJsonBody } from "@/app/api/request";
import type {
  AddCollectionWordsRequest,
  AddCollectionWordsResponse,
} from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = getCollectionWordService();

export async function POST(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const body = await readJsonBody<AddCollectionWordsRequest>(request);

    if (!Array.isArray(body.wordIds)) {
      throw new ValidationError("wordIds must be an array");
    }

    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    const result = await collectionWordService.addWordsByIds(
      collectionId,
      body.wordIds
    );
    const response: AddCollectionWordsResponse = result;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(
      error,
      "POST /api/collections/[collectionId]/words/bulk failed"
    );
  }
}
