export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly exposeMessage: boolean;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    exposeMessage = false
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.exposeMessage = exposeMessage;
  }
}

export const AI_GATEWAY_BUDGET_EXCEEDED_CODE =
  "AI_GATEWAY_BUDGET_EXCEEDED";
export const AI_GATEWAY_BUDGET_EXCEEDED_MESSAGE =
  "Vercel AI Gateway 余额或预算额度已用完，请在 Vercel 中充值或调整预算后再试。";
export const AI_GATEWAY_RATE_LIMITED_CODE = "AI_GATEWAY_RATE_LIMITED";
export const AI_GATEWAY_RATE_LIMITED_MESSAGE =
  "AI 服务请求过于频繁，请稍后重试。";

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export class AiGatewayBudgetExceededError extends AppError {
  constructor(message = AI_GATEWAY_BUDGET_EXCEEDED_MESSAGE) {
    super(message, 402, AI_GATEWAY_BUDGET_EXCEEDED_CODE, true);
    this.name = "AiGatewayBudgetExceededError";
  }
}

export class AiGatewayRateLimitedError extends AppError {
  constructor(message = AI_GATEWAY_RATE_LIMITED_MESSAGE) {
    super(message, 429, AI_GATEWAY_RATE_LIMITED_CODE, true);
    this.name = "AiGatewayRateLimitedError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, "VALIDATION_ERROR", true);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, "NOT_FOUND", true);
    this.name = "NotFoundError";
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, code = "SERVICE_UNAVAILABLE") {
    super(message, 503, code, false);
    this.name = "ServiceUnavailableError";
  }
}

export class ConfigurationError extends ServiceUnavailableError {
  constructor(message: string) {
    super(message, "CONFIGURATION_ERROR");
    this.name = "ConfigurationError";
  }
}

export class DependencyError extends ServiceUnavailableError {
  constructor(message: string) {
    super(message, "DEPENDENCY_ERROR");
    this.name = "DependencyError";
  }
}
