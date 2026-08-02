import { readJson } from "@/app/lib/api-client";
import type { CollectionResponse, CollectionSummary } from "@/shared/types/collections";
import type {
  ConversationAnalysisResponse,
  ConversationBootstrapResponse,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMode,
  ConversationPreferences,
  ConversationSession,
  ConversationSessionResponse,
  CreateConversationMemoryRequest,
  PromoteConversationLearningItemRequest,
  PromoteConversationLearningItemResponse,
  SendConversationMessageRequest,
  UpdateConversationMemoryRequest,
  UpdateConversationPreferencesRequest,
  UpdateConversationSessionRequest,
} from "@/shared/types/conversation";

const JSON_HEADERS = { "Content-Type": "application/json" } as const;

async function requestJson<T>(url: string, init?: RequestInit) {
  return readJson<T>(await fetch(url, init));
}

async function requestWithoutResponseBody(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (!response.ok) await readJson<never>(response);
}

function jsonRequest(method: string, body: unknown, signal?: AbortSignal): RequestInit {
  return {
    method,
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
    signal,
  };
}

export function fetchConversationBootstrap({
  query,
  cursor,
  signal,
}: {
  query?: string;
  cursor?: string;
  signal?: AbortSignal;
} = {}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  if (cursor) params.set("cursor", cursor);
  return requestJson<ConversationBootstrapResponse>(
    `/api/conversation/bootstrap?${params}`,
    { signal }
  );
}

export function fetchConversationSession(
  sessionId: string,
  { cursor, signal }: { cursor?: string; signal?: AbortSignal } = {}
) {
  const suffix = cursor
    ? `?cursor=${encodeURIComponent(cursor)}`
    : "";
  return requestJson<ConversationSessionResponse>(
    `/api/conversations/${sessionId}${suffix}`,
    { signal }
  );
}

export async function createConversationSession(mode: ConversationMode) {
  const result = await requestJson<{ session: ConversationSession }>(
    "/api/conversations",
    jsonRequest("POST", { mode })
  );
  return result.session;
}

export function analyzeConversationMessage(sessionId: string, messageId: string) {
  return requestJson<ConversationAnalysisResponse>(
    `/api/conversations/${sessionId}/messages/${messageId}/analysis`,
    { method: "POST" }
  );
}

export async function streamConversationMessage(
  sessionId: string,
  input: SendConversationMessageRequest,
  signal: AbortSignal
) {
  const response = await fetch(
    `/api/conversations/${sessionId}/messages`,
    jsonRequest("POST", input, signal)
  );
  if (!response.ok) await readJson<never>(response);
  return response;
}

export async function updateConversationSession(
  sessionId: string,
  input: UpdateConversationSessionRequest
) {
  const result = await requestJson<{ session: ConversationSession }>(
    `/api/conversations/${sessionId}`,
    jsonRequest("PATCH", input)
  );
  return result.session;
}

export function deleteConversationSession(sessionId: string) {
  return requestWithoutResponseBody(`/api/conversations/${sessionId}`, {
    method: "DELETE",
  });
}

export async function updateConversationPreferences(
  input: UpdateConversationPreferencesRequest
) {
  const result = await requestJson<{ preferences: ConversationPreferences }>(
    "/api/conversation/preferences",
    jsonRequest("PATCH", input)
  );
  return result.preferences;
}

export async function createConversationCollection(
  name: string
): Promise<CollectionSummary> {
  const result = await requestJson<CollectionResponse>(
    "/api/collections",
    jsonRequest("POST", { name })
  );
  return result.collection;
}

export async function createConversationMemory(
  input: CreateConversationMemoryRequest
) {
  const result = await requestJson<{ memory: ConversationMemory }>(
    "/api/conversation/memories",
    jsonRequest("POST", input)
  );
  return result.memory;
}

export async function updateConversationMemory(
  memoryId: string,
  input: UpdateConversationMemoryRequest
) {
  const result = await requestJson<{ memory: ConversationMemory }>(
    `/api/conversation/memories/${memoryId}`,
    jsonRequest("PATCH", input)
  );
  return result.memory;
}

export function deleteConversationMemory(memoryId: string) {
  return requestWithoutResponseBody(`/api/conversation/memories/${memoryId}`, {
    method: "DELETE",
  });
}

export function promoteConversationLearningItem(
  itemId: string,
  input: PromoteConversationLearningItemRequest
) {
  return requestJson<PromoteConversationLearningItemResponse>(
    `/api/conversation/learning-items/${itemId}/promote`,
    jsonRequest("POST", input)
  );
}

export async function dismissConversationLearningItem(itemId: string) {
  const result = await requestJson<{ item: ConversationLearningItem }>(
    `/api/conversation/learning-items/${itemId}`,
    { method: "DELETE" }
  );
  return result.item;
}
