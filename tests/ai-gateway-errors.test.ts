import { describe, expect, it } from "vitest";
import { throwIfAiGatewayBudgetExceeded } from "@/shared/utils/ai-gateway-errors";
import {
  AI_GATEWAY_BUDGET_EXCEEDED_CODE,
  AiGatewayBudgetExceededError,
} from "@/shared/utils/errors";

describe("AI Gateway error classification", () => {
  it("classifies Gateway 402 responses as budget errors", () => {
    const response = new Response(null, { status: 402 });

    expect(() => throwIfAiGatewayBudgetExceeded(response)).toThrowError(
      AiGatewayBudgetExceededError
    );

    try {
      throwIfAiGatewayBudgetExceeded(response);
    } catch (error) {
      expect(error).toMatchObject({
        code: AI_GATEWAY_BUDGET_EXCEEDED_CODE,
        statusCode: 402,
      });
    }
  });

  it.each([
    [429, "insufficient_quota", "Please check billing or credit limits."],
    [403, "insufficient_funds", "Billing access is not configured."],
    [500, "provider_error", "The upstream provider reported a credit error."],
  ])(
    "does not infer a budget error from a %i response body",
    (status, code, message) => {
      const response = new Response(
        JSON.stringify({ error: { code, message } }),
        { status, headers: { "Content-Type": "application/json" } }
      );

      expect(() => throwIfAiGatewayBudgetExceeded(response)).not.toThrow();
    }
  );
});
