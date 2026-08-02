import { describe, expect, it } from "vitest";
import {
  assertUuid,
  isUuid,
} from "@/features/conversation/domain/validation";
import { ValidationError } from "@/shared/utils/errors";

describe("conversation identifier validation", () => {
  it("accepts UUIDs regardless of letter case", () => {
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    expect(() =>
      assertUuid("123e4567-e89b-12d3-a456-426614174000", "sessionId")
    ).not.toThrow();
  });

  it.each(["", "session-1", "123e4567-e89b-12d3-a456"])(
    "rejects invalid identifier %j",
    (value) => {
      expect(isUuid(value)).toBe(false);
      expect(() => assertUuid(value, "sessionId")).toThrowError(
        new ValidationError("sessionId must be a valid UUID")
      );
    }
  );
});
