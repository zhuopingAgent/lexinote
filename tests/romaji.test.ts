import { describe, expect, it } from "vitest";
import { toRomaji } from "@/features/japanese-dictionary/domain/romaji";

describe("kana romanization", () => {
  it.each([
    ["たべる", "taberu"],
    ["きょう", "kyou"],
    ["がっこう", "gakkou"],
    ["コーヒー", "koohii"],
    ["きぼう を いだく", "kibou o idaku"],
  ])("preserves the existing conversion for %s", (reading, expected) => {
    expect(toRomaji(reading)).toBe(expected);
  });

  it("returns trimmed input when unsupported characters are present", () => {
    expect(toRomaji("  食べる  ")).toBe("食べる");
    expect(toRomaji("たべる。")).toBe("たべる。");
  });
});
