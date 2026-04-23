import { NextResponse } from "next/server";
import { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = new CollectionWordService(
  new CollectionRepository(),
  new JapaneseDictionaryService(new JapaneseDictionaryRepository())
);

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
