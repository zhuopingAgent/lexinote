import { NextResponse } from "next/server";
import { LlmClient } from "@/features/ai-lookup/infrastructure/LlmClient";
import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";
import { CollectionAutoFilterService } from "@/features/collections/application/CollectionAutoFilterService";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionAutoFilterJobRepository } from "@/features/collections/infrastructure/CollectionAutoFilterJobRepository";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import { JapaneseDictionaryRepository } from "@/features/japanese-dictionary/infrastructure/JapaneseDictionaryRepository";
import type {
  CollectionDetailResponse,
  CollectionResponse,
  UpdateCollectionRequest,
} from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionRepository = new CollectionRepository();
const autoFilterJobService = new CollectionAutoFilterJobService(
  new CollectionAutoFilterJobRepository(),
  collectionRepository,
  new CollectionAutoFilterService(
    collectionRepository,
    new JapaneseDictionaryService(new JapaneseDictionaryRepository()),
    new LlmClient()
  )
);
const collectionService = new CollectionService(
  collectionRepository,
  autoFilterJobService
);

function parseCollectionId(rawCollectionId: string) {
  const collectionId = Number(rawCollectionId);

  if (!Number.isInteger(collectionId) || collectionId <= 0) {
    throw new ValidationError("collectionId must be a positive integer");
  }

  return collectionId;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  try {
    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parseCollectionId(rawCollectionId);
    const collection = await collectionService.getCollectionDetail(collectionId);
    const response: CollectionDetailResponse = { collection };

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
      console.error("GET /api/collections/[collectionId] failed", error);
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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  try {
    let body: Partial<UpdateCollectionRequest>;

    try {
      body = (await request.json()) as Partial<UpdateCollectionRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (body.name !== undefined && typeof body.name !== "string") {
      throw new ValidationError("name must be a string");
    }

    if (body.description !== undefined && typeof body.description !== "string") {
      throw new ValidationError("description must be a string");
    }

    if (
      body.autoFilterEnabled !== undefined &&
      typeof body.autoFilterEnabled !== "boolean"
    ) {
      throw new ValidationError("autoFilterEnabled must be a boolean");
    }

    if (
      body.autoFilterCriteria !== undefined &&
      typeof body.autoFilterCriteria !== "string"
    ) {
      throw new ValidationError("autoFilterCriteria must be a string");
    }

    if (
      body.resyncAutoFilter !== undefined &&
      typeof body.resyncAutoFilter !== "boolean"
    ) {
      throw new ValidationError("resyncAutoFilter must be a boolean");
    }

    if (
      body.name === undefined &&
      body.description === undefined &&
      body.autoFilterEnabled === undefined &&
      body.autoFilterCriteria === undefined &&
      body.resyncAutoFilter === undefined
    ) {
      throw new ValidationError("at least one field must be provided");
    }

    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parseCollectionId(rawCollectionId);
    const collection = await collectionService.updateCollection(collectionId, body);
    const response: CollectionResponse = { collection };

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
      console.error("PATCH /api/collections/[collectionId] failed", error);
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

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  try {
    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parseCollectionId(rawCollectionId);
    await collectionService.deleteCollection(collectionId);

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
      console.error("DELETE /api/collections/[collectionId] failed", error);
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
