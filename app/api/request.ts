import { ValidationError } from "@/shared/utils/errors";

export async function readJsonBody<T>(request: Request): Promise<Partial<T>> {
  try {
    return (await request.json()) as Partial<T>;
  } catch {
    throw new ValidationError("request body must be valid JSON");
  }
}

export function parsePositiveIntegerParam(value: string, fieldName: string) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new ValidationError(`${fieldName} must be a positive integer`);
  }

  return parsed;
}
