import { beforeEach, describe, expect, it, vi } from "vitest";

const createSessionMock = vi.fn();
const getSessionMock = vi.fn();
const nextExerciseMock = vi.fn();
const submitAttemptMock = vi.fn();
const revealHintMock = vi.fn();
const revealAnswerMock = vi.fn();
const getGenerationMetricsMock = vi.fn();

vi.mock(
  "@/features/grammar-learning/application/PracticeSessionService",
  () => ({
    PracticeSessionService: class {
      createSession = createSessionMock;
      getSession = getSessionMock;
      nextExercise = nextExerciseMock;
      submitAttempt = submitAttemptMock;
      revealHint = revealHintMock;
      revealAnswer = revealAnswerMock;
      getGenerationMetrics = getGenerationMetricsMock;
    },
  })
);

vi.mock("@/features/grammar-learning/infrastructure/PracticeRepository", () => ({
  PracticeRepository: class {},
}));

const sessionId = "11111111-1111-4111-8111-111111111111";
const exerciseId = "22222222-2222-4222-8222-222222222222";

describe("practice session API routes", () => {
  beforeEach(() => {
    createSessionMock.mockReset();
    getSessionMock.mockReset();
    nextExerciseMock.mockReset();
    submitAttemptMock.mockReset();
    revealHintMock.mockReset();
    revealAnswerMock.mockReset();
    getGenerationMetricsMock.mockReset();
  });

  it("creates a session and preserves the service response", async () => {
    const result = {
      session: { id: sessionId, status: "active" },
      progress: { current: 1, completed: 0, total: 5 },
      exercise: { id: exerciseId },
      summary: null,
    };
    createSessionMock.mockResolvedValue(result);
    const { POST } = await import("@/app/api/practice/sessions/route");
    const requestBody = {
      clientSessionKey: "route-test",
      grammarPointId: exerciseId,
      entryMode: "focus",
    };
    const response = await POST(
      new Request("http://localhost/api/practice/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual(result);
    expect(createSessionMock).toHaveBeenCalledWith(requestBody);
  });

  it("loads and advances an existing session", async () => {
    getSessionMock.mockResolvedValue({ session: { id: sessionId } });
    nextExerciseMock.mockResolvedValue({ session: { id: sessionId }, exercise: null });
    const sessionRoute = await import(
      "@/app/api/practice/sessions/[sessionId]/route"
    );
    const nextRoute = await import(
      "@/app/api/practice/sessions/[sessionId]/next/route"
    );
    const context = { params: Promise.resolve({ sessionId }) };

    const getResponse = await sessionRoute.GET(
      new Request("http://localhost/api/practice/sessions/test"),
      context
    );
    const nextResponse = await nextRoute.POST(
      new Request("http://localhost/api/practice/sessions/test/next", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      }),
      context
    );

    expect(getResponse.status).toBe(200);
    expect(nextResponse.status).toBe(200);
    expect(getSessionMock).toHaveBeenCalledWith(sessionId, undefined);
    expect(nextExerciseMock).toHaveBeenCalledWith(sessionId, undefined);
  });

  it("routes attempts, hints, and reveal through the session service", async () => {
    submitAttemptMock.mockResolvedValue({ attemptId: "attempt", canRetry: true });
    revealHintMock.mockResolvedValue({ hint: "先判断人物关系。" });
    revealAnswerMock.mockResolvedValue({
      referenceAnswers: [],
      correctOptionId: "option-2",
    });
    const attemptsRoute = await import(
      "@/app/api/practice/exercises/[exerciseId]/attempts/route"
    );
    const hintsRoute = await import(
      "@/app/api/practice/exercises/[exerciseId]/hints/route"
    );
    const revealRoute = await import(
      "@/app/api/practice/exercises/[exerciseId]/reveal/route"
    );
    const context = { params: Promise.resolve({ exerciseId }) };
    const request = (body: object) =>
      new Request("http://localhost/api/practice/exercises/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

    const attemptResponse = await attemptsRoute.POST(
      request({ selectedOptionId: "option-1" }),
      context
    );
    const hintResponse = await hintsRoute.POST(request({}), context);
    const revealResponse = await revealRoute.POST(request({}), context);

    expect(attemptResponse.status).toBe(200);
    expect(hintResponse.status).toBe(200);
    expect(revealResponse.status).toBe(200);
    await expect(revealResponse.json()).resolves.toEqual(
      expect.objectContaining({ correctOptionId: "option-2" })
    );
    expect(submitAttemptMock).toHaveBeenCalledWith(exerciseId, {
      selectedOptionId: "option-1",
    });
    expect(revealHintMock).toHaveBeenCalledWith(exerciseId, undefined);
    expect(revealAnswerMock).toHaveBeenCalledWith(exerciseId, undefined);
  });

  it("returns server-side practice quality metrics without answer content", async () => {
    const metrics = {
      generatedItemCount: 12,
      aiGeneratedItemCount: 9,
      firstPassValidationRate: 0.75,
      repairRate: 0.2,
      fallbackRate: 0.1,
      generationLatency: 420,
      duplicateContextRate: 0,
      answerLeakCount: 0,
      ambiguousChoiceCount: 0,
      validationErrorCounts: { SCHEMA_INVALID: 2 },
      fallbackReasonCounts: { AI_GATEWAY_UNAVAILABLE: 1 },
    };
    getGenerationMetricsMock.mockResolvedValue(metrics);
    const { GET } = await import("@/app/api/practice/metrics/route");
    const response = await GET(new Request("http://localhost/api/practice/metrics"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(metrics);
    expect(getGenerationMetricsMock).toHaveBeenCalledWith(undefined);
  });
});
