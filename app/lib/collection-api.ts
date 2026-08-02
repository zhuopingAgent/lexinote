import {
  jsonRequest,
  readResponseErrorMessage,
  requestJson,
  requestWithoutResponseBody,
} from "@/app/lib/api-client";
import type {
  AddCollectionWordRequest,
  AddCollectionWordResponse,
  AddCollectionWordsRequest,
  AddCollectionWordsResponse,
  CollectionListResponse,
  CollectionResponse,
  CreateCollectionRequest,
  UpdateCollectionRequest,
} from "@/shared/types/collections";

export function fetchCollections(signal?: AbortSignal) {
  return requestJson<CollectionListResponse>("/api/collections", { signal });
}

export function createCollection(input: CreateCollectionRequest) {
  return requestJson<CollectionResponse>(
    "/api/collections",
    jsonRequest("POST", input)
  );
}

export function updateCollection(
  collectionId: number,
  input: UpdateCollectionRequest
) {
  return requestJson<CollectionResponse>(
    `/api/collections/${collectionId}`,
    jsonRequest("PATCH", input)
  );
}

export function deleteCollection(collectionId: number) {
  return requestWithoutResponseBody(`/api/collections/${collectionId}`, {
    method: "DELETE",
  });
}

export function addCollectionWord(
  collectionId: number,
  input: AddCollectionWordRequest
) {
  return requestJson<AddCollectionWordResponse>(
    `/api/collections/${collectionId}/words`,
    jsonRequest("POST", input)
  );
}

export function addCollectionWords(
  collectionId: number,
  input: AddCollectionWordsRequest
) {
  return requestJson<AddCollectionWordsResponse>(
    `/api/collections/${collectionId}/words/bulk`,
    jsonRequest("POST", input)
  );
}

export async function removeCollectionWord(
  collectionId: number,
  wordId: number
) {
  const response = await fetch(
    `/api/collections/${collectionId}/words/${wordId}`,
    { method: "DELETE" }
  );
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, "请求失败"));
  }
}
