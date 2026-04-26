import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionWordService,
} from "@/app/api/services";
import { AppError, ValidationError } from "@/shared/utils/errors";

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
      console.error(
        "DELETE /api/collections/[collectionId]/words/[wordId] failed",
        error
      );
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
