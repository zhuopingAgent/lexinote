import { NextResponse } from "next/server";
import { CollectionService } from "@/features/collections/application/CollectionService";
import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import type {
  CollectionDetailResponse,
  CollectionResponse,
  UpdateCollectionRequest,
} from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionService = new CollectionService(new CollectionRepository());

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

    if (body.name === undefined && body.description === undefined) {
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
