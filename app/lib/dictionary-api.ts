import {
  jsonRequest,
  readResponseErrorMessage,
  requestJson,
} from "@/app/lib/api-client";
import type {
  DictionaryOverviewResponse,
  WordLookupRequest,
  WordLookupResponse,
} from "@/shared/types/dictionary";

export async function fetchDictionaryOverview({
  query,
  cursor,
  limit,
  signal,
}: {
  query?: string;
  cursor?: string;
  limit: number;
  signal?: AbortSignal;
}) {
  const params = new URLSearchParams();
  if (query) params.set("query", query);
  params.set("limit", String(limit));
  if (cursor) params.set("cursor", cursor);

  const response = await fetch(`/api/words?${params}`, { signal });
  if (!response.ok) {
    throw new Error(await readResponseErrorMessage(response, "请求失败"));
  }
  return response.json() as Promise<DictionaryOverviewResponse>;
}

export function lookupDictionaryWord(
  input: WordLookupRequest,
  signal?: AbortSignal
) {
  return requestJson<WordLookupResponse>(
    "/api/words/lookup",
    jsonRequest("POST", input, { signal })
  );
}
