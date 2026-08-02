import { jsonRequest, requestJson } from "@/app/lib/api-client";
import type {
  PracticeAttemptRequest,
  PracticeAttemptResponse,
  PracticeHintResponse,
  PracticeGenerationMetrics,
  PracticeRevealResponse,
  PracticeSessionCreateRequest,
  PracticeSessionResponse,
} from "@/shared/types/practice";

async function postJson<T>(
  url: string,
  body: unknown,
  options: Pick<RequestInit, "cache" | "signal"> = {}
) {
  return requestJson<T>(url, jsonRequest("POST", body, options));
}

export function createPracticeSession(
  input: PracticeSessionCreateRequest,
  signal?: AbortSignal
) {
  return postJson<PracticeSessionResponse>("/api/practice/sessions", input, {
    cache: "no-store",
    signal,
  });
}

export function submitPracticeAttempt(
  exerciseId: string,
  input: PracticeAttemptRequest
) {
  return postJson<PracticeAttemptResponse>(
    `/api/practice/exercises/${exerciseId}/attempts`,
    input
  );
}

export function requestPracticeHint(exerciseId: string) {
  return postJson<PracticeHintResponse>(
    `/api/practice/exercises/${exerciseId}/hints`,
    {}
  );
}

export function revealPracticeAnswer(exerciseId: string) {
  return postJson<PracticeRevealResponse>(
    `/api/practice/exercises/${exerciseId}/reveal`,
    {}
  );
}

export function advancePracticeSession(sessionId: string) {
  return postJson<PracticeSessionResponse>(
    `/api/practice/sessions/${sessionId}/next`,
    {},
    { cache: "no-store" }
  );
}

export function fetchPracticeGenerationMetrics(signal?: AbortSignal) {
  return requestJson<PracticeGenerationMetrics>("/api/practice/metrics", {
      signal,
      cache: "no-store",
  });
}
