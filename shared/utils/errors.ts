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
