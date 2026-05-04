import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import type {
  AddCollectionWordRequest,
  AddCollectionWordResponse,
} from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = getCollectionWordService();

function parseCollectionId(rawCollectionId: string) {
  const collectionId = Number(rawCollectionId);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    throw new ValidationError("collectionId must be a positive integer");
  }

  return collectionId;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    let body: Partial<AddCollectionWordRequest>;

    try {
      body = (await request.json()) as Partial<AddCollectionWordRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (typeof body.word !== "string") {
      throw new ValidationError("word must be a string");
    }

    if (body.pronunciation !== undefined && typeof body.pronunciation !== "string") {
      throw new ValidationError("pronunciation must be a string");
    }

    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parseCollectionId(rawCollectionId);
    const result = await collectionWordService.addWord(
      collectionId,
      body.word,
      body.pronunciation
    );
    const response: AddCollectionWordResponse = result;

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
      console.error("POST /api/collections/[collectionId]/words failed", error);
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
