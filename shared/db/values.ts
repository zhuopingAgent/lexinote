export function toIsoString(value: string | Date) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function toNullableIsoString(value: string | Date | null) {
  return value ? toIsoString(value) : null;
}

export function toInteger(value: number | string, fieldName: string) {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;

  if (!Number.isInteger(parsed)) {
    throw new Error(`${fieldName} must be an integer`);
  }

  return parsed;
}
