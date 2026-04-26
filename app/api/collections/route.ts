import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionService,
} from "@/app/api/services";
import type {
  CollectionListResponse,
  CollectionResponse,
  CreateCollectionRequest,
} from "@/shared/types/api";
import { AppError, ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionService = getCollectionService();

export async function GET() {
  ensureAutoFilterJobRunnerStarted();

  try {
    const collections = await collectionService.listCollections();
    const response: CollectionListResponse = { collections };

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
      console.error("GET /api/collections failed", error);
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

export async function POST(request: Request) {
  ensureAutoFilterJobRunnerStarted();

  try {
    let body: Partial<CreateCollectionRequest>;

    try {
      body = (await request.json()) as Partial<CreateCollectionRequest>;
    } catch {
      throw new ValidationError("request body must be valid JSON");
    }

    if (typeof body.name !== "string") {
      throw new ValidationError("name must be a string");
    }

    if (body.description !== undefined && typeof body.description !== "string") {
      throw new ValidationError("description must be a string");
    }

    const collection = await collectionService.createCollection(
      body.name,
      body.description
    );
    const response: CollectionResponse = { collection };

    return NextResponse.json(response, { status: 201 });
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
      console.error("POST /api/collections failed", error);
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
