import { NextResponse } from "next/server";
import {
  ensureAutoFilterJobRunnerStarted,
  getCollectionService,
} from "@/app/api/services";
import { toErrorResponse } from "@/app/api/http-error";
import { parsePositiveIntegerParam, readJsonBody } from "@/app/api/request";
import type {
  CollectionDetailResponse,
  CollectionResponse,
  UpdateCollectionRequest,
} from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export const runtime = "nodejs";

const collectionService = getCollectionService();

export async function GET(
  _request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    const collection = await collectionService.getCollectionDetail(collectionId);
    const response: CollectionDetailResponse = { collection };

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "GET /api/collections/[collectionId] failed");
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const body = await readJsonBody<UpdateCollectionRequest>(request);

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
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    const collection = await collectionService.updateCollection(collectionId, body);
    const response: CollectionResponse = { collection };

    return NextResponse.json(response);
  } catch (error) {
    return toErrorResponse(error, "PATCH /api/collections/[collectionId] failed");
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ collectionId: string }> }
) {
  ensureAutoFilterJobRunnerStarted();

  try {
    const { collectionId: rawCollectionId } = await context.params;
    const collectionId = parsePositiveIntegerParam(rawCollectionId, "collectionId");
    await collectionService.deleteCollection(collectionId);

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, "DELETE /api/collections/[collectionId] failed");
  }
}
