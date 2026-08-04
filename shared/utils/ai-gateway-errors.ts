import {
  AiGatewayBudgetExceededError,
  AiGatewayNoProvidersError,
  AiGatewayRateLimitedError,
} from "@/shared/utils/errors";

const AI_GATEWAY_BUDGET_EXCEEDED_STATUS = 402;
const AI_GATEWAY_RATE_LIMITED_STATUS = 429;

export function throwIfAiGatewayBudgetExceeded(response: Response) {
  if (!response.ok && response.status === AI_GATEWAY_BUDGET_EXCEEDED_STATUS) {
    throw new AiGatewayBudgetExceededError();
  }
}

export function throwIfAiGatewayRateLimited(response: Response) {
  if (!response.ok && response.status === AI_GATEWAY_RATE_LIMITED_STATUS) {
    throw new AiGatewayRateLimitedError();
  }
}

export function rethrowAiGatewayBudgetError(error: unknown) {
  if (
    error instanceof AiGatewayBudgetExceededError ||
    error instanceof AiGatewayNoProvidersError ||
    error instanceof AiGatewayRateLimitedError
  ) {
    throw error;
  }
}
