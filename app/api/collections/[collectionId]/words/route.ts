import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { parsePositiveIntegerParam, readJsonBody } from "@/app/api/request";
import type {
  AddCollectionWordRequest,
  AddCollectionWordResponse,
} from "@/shared/types/collections";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = getCollectionWordService();

export async function POST(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const body = await readJsonBody<AddCollectionWordRequest>(request);

    if (typeof body.word !== "string") {
      throw new ValidationError("word must be a string");
    }

    if (body.pronunciation !== undefined && typeof body.pronunciation !== "string") {
      throw new ValidationError("pronunciation must be a string");
    }

    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    const result = await collectionWordService.addWord(
      collectionId,
      body.word,
      body.pronunciation
    );
    const response: AddCollectionWordResponse = result;

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "POST /api/collections/[collectionId]/words failed");
  }
}
