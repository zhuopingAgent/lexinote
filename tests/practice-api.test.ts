import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "@/app/lib/api-client";
import {
  advancePracticeSession,
  createPracticeSession,
  fetchPracticeGenerationMetrics,
  requestPracticeHint,
  revealPracticeAnswer,
  submitPracticeAttempt,
} from "@/app/lib/practice-api";

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("practice API client", () => {
  it("creates a no-store session and forwards the abort signal", async () => {
    const controller = new AbortController();
    const response = { session: { id: "session-1" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response, 201));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      clientSessionKey: "practice:focus:grammar-1",
      grammarPointId: "grammar-1",
      entryMode: "focus" as const,
      plannedExerciseCount: 5,
    };

    await expect(
      createPracticeSession(input, controller.signal)
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/practice/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      cache: "no-store",
      signal: controller.signal,
    });
  });

  it("submits typed attempt input to the exercise endpoint", async () => {
    const response = { attemptId: "attempt-1" };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);
    const input = { selectedOptionId: "option-2" };

    await expect(
      submitPracticeAttempt("exercise-1", input)
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice/exercises/exercise-1/attempts",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      }
    );
  });

  it.each([
    [
      "hint",
      requestPracticeHint,
      "/api/practice/exercises/exercise-1/hints",
      { hint: "助词を確認してください" },
    ],
    [
      "answer",
      revealPracticeAnswer,
      "/api/practice/exercises/exercise-1/reveal",
      { referenceAnswers: [], correctOptionId: null },
    ],
  ])("requests the %s endpoint with an empty JSON body", async (_, request, url, response) => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(request("exercise-1")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
  });

  it("advances sessions without using a cached response", async () => {
    const response = { session: { id: "session-1" } };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(advancePracticeSession("session-1")).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/practice/sessions/session-1/next",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
        cache: "no-store",
      }
    );
  });

  it("preserves structured API errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          { error: { code: "SESSION_COMPLETE", message: "本组练习已结束" } },
          409
        )
      )
    );

    const error = await advancePracticeSession("session-1").catch(
      (caught) => caught
    );

    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      code: "SESSION_COMPLETE",
      message: "本组练习已结束",
      statusCode: 409,
    });
  });

  it("loads generation metrics without using a cached response", async () => {
    const controller = new AbortController();
    const response = { generatedItemCount: 12 };
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(response));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchPracticeGenerationMetrics(controller.signal)
    ).resolves.toEqual(response);
    expect(fetchMock).toHaveBeenCalledWith("/api/practice/metrics", {
      signal: controller.signal,
      cache: "no-store",
    });
  });
});
