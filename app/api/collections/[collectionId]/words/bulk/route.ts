import { NextResponse } from "next/server";
import { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import type {
  AddCollectionWordsRequest,
  AddCollectionWordsResponse,
} from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionWordService = new CollectionWordService(
  new CollectionRepository(),
  new JapaneseDictionaryService(new JapaneseDictionaryRepository())
);

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
  try {
    let body: Partial<AddCollectionWordsRequest>;

    try {
      body = (await request.json()) as Partial<AddCollectionWordsRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (!Array.isArray(body.wordIds)) {
      throw new ValidationError("wordIds must be an array");
    }

    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parseCollectionId(rawCollectionId);
    const result = await collectionWordService.addWordsByIds(
      collectionId,
      body.wordIds
    );
    const response: AddCollectionWordsResponse = result;

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
      console.error("POST /api/collections/[collectionId]/words/bulk failed", error);
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
