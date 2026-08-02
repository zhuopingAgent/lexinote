import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "@/shared/db/postgres-errors";
import {
  toInteger,
  toIsoString,
  toNullableIsoString,
} from "@/shared/db/values";

describe("database value mapping", () => {
  it("normalizes database timestamps", () => {
    const timestamp = "2026-08-02T10:00:00.000Z";

    expect(toIsoString(timestamp)).toBe(timestamp);
    expect(toIsoString(new Date(timestamp))).toBe(timestamp);
    expect(toNullableIsoString(null)).toBeNull();
    expect(toNullableIsoString(timestamp)).toBe(timestamp);
  });

  it("strictly parses integer row values", () => {
    expect(toInteger(7, "word_id")).toBe(7);
    expect(toInteger("7", "word_id")).toBe(7);
    expect(() => toInteger("invalid", "word_id")).toThrow(
      "word_id must be an integer"
    );
  });

  it("recognizes only PostgreSQL unique violations", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
