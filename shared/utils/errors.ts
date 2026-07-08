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

export const AI_QUOTA_EXHAUSTED_CODE = "AI_QUOTA_EXHAUSTED";
export const AI_QUOTA_EXHAUSTED_MESSAGE =
  "AI API 账户余额或额度已用完，请充值或更新账单后再试。";

export function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export class AiQuotaExhaustedError extends AppError {
  constructor(message = AI_QUOTA_EXHAUSTED_MESSAGE) {
    super(message, 402, AI_QUOTA_EXHAUSTED_CODE, true);
    this.name = "AiQuotaExhaustedError";
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
