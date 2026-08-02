import {
  jsonRequest,
  requestJson,
  requestWithoutResponseBody,
} from "@/app/lib/api-client";
import type {
  GrammarBootstrapResponse,
  GrammarDetailResponse,
  GrammarFavoritesResponse,
  GrammarReviewResponse,
  GrammarSearchResponse,
  GrammarTaxonomyResponse,
} from "@/shared/types/grammar";

export type GrammarSearchParams = {
  query?: string;
  category?: string;
  group?: string;
  dimension?: string;
  stage?: string;
  module?: string;
  practicality?: string;
  learningStatus?: string;
  limit?: number;
  offset?: number;
  userId?: string;
};

function buildGrammarQuery(params: GrammarSearchParams) {
  const query = new URLSearchParams();
  const values: Array<[string, string | number | undefined]> = [
    ["query", params.query],
    ["category", params.category],
    ["group", params.group],
    ["dimension", params.dimension],
    ["stage", params.stage],
    ["module", params.module],
    ["practicality", params.practicality],
    ["learningStatus", params.learningStatus],
    ["limit", params.limit],
    ["offset", params.offset],
    ["userId", params.userId],
  ];

  for (const [key, value] of values) {
    if (value !== undefined && value !== "") {
      query.set(key, String(value));
    }
  }

  return query.toString();
}

export function fetchGrammarBootstrap(
  params: GrammarSearchParams,
  signal?: AbortSignal
) {
  return requestJson<GrammarBootstrapResponse>(
    `/api/grammar/bootstrap?${buildGrammarQuery(params)}`,
    { signal }
  );
}

export function fetchGrammarSearch(
  params: GrammarSearchParams,
  signal?: AbortSignal
) {
  return requestJson<GrammarSearchResponse>(
    `/api/grammar?${buildGrammarQuery(params)}`,
    { signal }
  );
}

export function fetchGrammarDetail(
  grammarPointId: string,
  signal?: AbortSignal
) {
  return requestJson<GrammarDetailResponse>(`/api/grammar/${grammarPointId}`, {
    signal,
  });
}

export function fetchGrammarTaxonomy(signal?: AbortSignal) {
  return requestJson<GrammarTaxonomyResponse>("/api/grammar/taxonomy", {
    signal,
  });
}

export function fetchGrammarFavorites(signal?: AbortSignal) {
  return requestJson<GrammarFavoritesResponse>("/api/favorites", { signal });
}

export function addGrammarFavorite(grammarPointId: string) {
  return requestJson<{ ok: true }>(
    "/api/favorites",
    jsonRequest("POST", { grammarPointId })
  );
}

export function removeGrammarFavorite(grammarPointId: string) {
  const params = new URLSearchParams({ grammarPointId });
  return requestWithoutResponseBody(`/api/favorites?${params}`, {
    method: "DELETE",
  });
}

export function fetchGrammarReview(signal?: AbortSignal) {
  return requestJson<GrammarReviewResponse>("/api/review/today", { signal });
}
