import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import type {
  CollectionListResponse,
  CollectionResponse,
  CreateCollectionRequest,
} from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionService = getCollectionService();

export async function GET() {
  ensureAutoFilterJobRunnerStarted();

  try {
    const collections = await collectionService.listCollections();
    const response: CollectionListResponse = { collections };

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "GET /api/collections failed");
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
    return toErrorResponse(error, "POST /api/collections failed");
  }
}
