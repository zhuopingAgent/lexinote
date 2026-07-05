import { AiQuotaExhaustedError } from "@/shared/utils/errors";

type OpenAiErrorPayload = {
  error?: {
    code?: unknown;
    message?: unknown;
    type?: unknown;
  };
};

const QUOTA_ERROR_PATTERNS = [
  /insufficient[_\s-]?quota/,
  /billing[_\s-]?hard[_\s-]?limit/,
  /quota[_\s-]?exceeded/,
  /exceeded your current quota/,
  /account balance/,
  /credit/,
  /billing/,
  /payment required/,
];

function readOpenAiErrorText(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return "";
  }

  const error = (data as OpenAiErrorPayload).error;
  return [error?.code, error?.type, error?.message]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .toLowerCase();
}

export function isOpenAiQuotaExhaustedPayload(data: unknown, status: number) {
  if (status === 402) {
    return true;
  }

  const text = readOpenAiErrorText(data);
  return QUOTA_ERROR_PATTERNS.some((pattern) => pattern.test(text));
}

export async function throwIfOpenAiQuotaExhausted(response: Response) {
  if (response.ok) {
    return;
  }

  const data = await response
    .clone()
    .json()
    .catch(() => null);

  if (isOpenAiQuotaExhaustedPayload(data, response.status)) {
    throw new AiQuotaExhaustedError();
  }
}
