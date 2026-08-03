import { AiGatewayBudgetExceededError } from "@/shared/utils/errors";

const AI_GATEWAY_BUDGET_EXCEEDED_STATUS = 402;

export function throwIfAiGatewayBudgetExceeded(response: Response) {
  if (!response.ok && response.status === AI_GATEWAY_BUDGET_EXCEEDED_STATUS) {
    throw new AiGatewayBudgetExceededError();
  }
}

export function rethrowAiGatewayBudgetError(error: unknown) {
  if (error instanceof AiGatewayBudgetExceededError) {
    throw error;
  }
}
