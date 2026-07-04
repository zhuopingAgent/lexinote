type ErrorResponse = {
  error?: {
    message?: unknown;
  };
};

function readErrorMessage(data: unknown) {
  if (!data || typeof data !== "object" || !("error" in data)) {
    return "";
  }

  const error = (data as ErrorResponse).error;
  return typeof error?.message === "string" ? error.message : "";
}

export async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as unknown;

  if (!response.ok) {
    throw new Error(readErrorMessage(data) || "请求失败，请稍后再试。");
  }

  return data as T;
}
