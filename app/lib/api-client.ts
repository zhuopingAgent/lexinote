import {
  AI_QUOTA_EXHAUSTED_CODE,
  AI_QUOTA_EXHAUSTED_MESSAGE,
} from "@/shared/utils/errors";

export { getErrorMessage } from "@/shared/utils/errors";

type ErrorResponse = {
  error?: {
    code?: unknown;
    message?: unknown;
  };
};

export class ApiClientError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.statusCode = statusCode;
  }
}

function readError(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return {
      code: "REQUEST_FAILED",
      message: "",
    };
  }

  const error = (data as ErrorResponse).error;
  return {
    code: typeof error?.code === "string" ? error.code : "REQUEST_FAILED",
    message: typeof error?.message === "string" ? error.message : "",
  };
}

export function isAiQuotaExhaustedError(error: unknown): error is ApiClientError {
  return error instanceof ApiClientError && error.code === AI_QUOTA_EXHAUSTED_CODE;
}

export function isAiQuotaErrorMessage(message: string | null | undefined) {
  return Boolean(
    message &&
      (message.includes(AI_QUOTA_EXHAUSTED_CODE) ||
        message.includes(AI_QUOTA_EXHAUSTED_MESSAGE))
  );
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

export async function readResponseErrorMessage(
  response: Response,
  fallback: string
) {
  const data = (await response.json()) as unknown;
  const error = readError(data);

  return error.message || fallback;
}

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    const error = readError(data);
    throw new ApiClientError(
      error.message || "请求失败，请稍后再试。",
      error.code,
      response.status
    );
  }

  return data as T;
}

export async function requestJson<T>(url: string, init?: RequestInit) {
  return readJson<T>(await fetch(url, init));
}

export function jsonRequest(
  method: string,
  body: unknown,
  options: Omit<RequestInit, "method" | "headers" | "body"> = {}
): RequestInit {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...options,
  };
}

export async function requestWithoutResponseBody(
  url: string,
  init: RequestInit
) {
  const response = await fetch(url, init);
  if (!response.ok) await readJson<never>(response);
}
