import { isConversationMode } from "@/features/conversation/domain/conversation";
import type {
  ConversationMode,
  ConversationRegister,
} from "@/shared/types/conversation";
import { ValidationError } from "@/shared/utils/errors";

export function normalizeConversationMode(
  value: unknown,
  fallback: ConversationMode
): ConversationMode {
  if (value === undefined || value === null || value === "") return fallback;
  if (!isConversationMode(value)) {
    throw new ValidationError("mode is invalid");
  }
  return value;
}

export function normalizeConversationRegister(
  value: unknown
): ConversationRegister {
  if (
    value === "auto" ||
    value === "casual" ||
    value === "polite" ||
    value === "business"
  ) {
    return value;
  }
  throw new ValidationError("defaultRegister is invalid");
}
