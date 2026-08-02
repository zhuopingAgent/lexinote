import { ValidationError } from "@/shared/utils/errors";

export async function readJsonBody<T>(request: Request): Promise<Partial<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    throw new ValidationError("request body must be valid JSON");
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("request body must be a JSON object");
  }

  return body as Partial<T>;
}

export function parsePositiveIntegerParam(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }

  return parsed;
}
