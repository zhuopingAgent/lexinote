import { isUuid } from "@/features/conversation/domain/validation";
import { ValidationError } from "@/shared/utils/errors";

export function encodeConversationCursor(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function decodeConversationCursor<T extends object>(
  cursor?: string | null
): T | null {
  if (!cursor?.trim()) return null;
  try {
    const value: unknown = JSON.parse(
      Buffer.from(cursor, "base64url").toString("utf8")
    );
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("cursor payload is not an object");
    }
    return value as T;
  } catch {
    throw new ValidationError("cursor is invalid");
  }
}

export function assertConversationCursorPosition(
  cursor: { id?: unknown; updatedAt?: unknown; createdAt?: unknown } | null
) {
  if (!cursor) return;
  const timestamp = cursor.updatedAt ?? cursor.createdAt;
  if (
    typeof cursor.id !== "string" ||
    !isUuid(cursor.id) ||
    typeof timestamp !== "string" ||
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new ValidationError("cursor is invalid");
  }
}
