import { describe, expect, it } from "vitest";
import {
  createTwoFactorSessionCookie,
  createTotpOtpAuthUri,
  decodeBase32Secret,
  generateTotpCode,
  sanitizeTwoFactorRedirect,
  verifyTotpCode,
  verifyTwoFactorSetupToken,
  verifyTwoFactorSessionCookie,
  type TwoFactorSettings,
} from "@/shared/auth/two-factor";

const RFC_6238_TEST_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function createSettings(overrides: Partial<TwoFactorSettings> = {}) {
  return {
    cookieSecret: "cookie-secret",
    sessionSeconds: 60,
    totpSecret: RFC_6238_TEST_SECRET,
    ...overrides,
  };
}

describe("two-factor helpers", () => {
  it("decodes base32 TOTP secrets", () => {
    expect(Array.from(decodeBase32Secret(RFC_6238_TEST_SECRET))).toEqual(
      Array.from(Buffer.from("12345678901234567890"))
    );
  });

  it("generates and verifies RFC 6238-compatible 6-digit TOTP codes", async () => {
    await expect(generateTotpCode(RFC_6238_TEST_SECRET, 59_000)).resolves.toBe(
      "287082"
    );
    await expect(
      verifyTotpCode(RFC_6238_TEST_SECRET, "287082", 59_000)
    ).resolves.toBe(true);
    await expect(
      verifyTotpCode(RFC_6238_TEST_SECRET, "000000", 59_000)
    ).resolves.toBe(false);
  });

  it("creates signed session cookies and rejects tampered values", async () => {
    const settings = createSettings();
    const cookie = await createTwoFactorSessionCookie(settings, 1_000);

    await expect(
      verifyTwoFactorSessionCookie(cookie, settings, 2_000)
    ).resolves.toBe(true);
    await expect(
      verifyTwoFactorSessionCookie(`${cookie}x`, settings, 2_000)
    ).resolves.toBe(false);
  });

  it("expires session cookies", async () => {
    const settings = createSettings({ sessionSeconds: 1 });
    const cookie = await createTwoFactorSessionCookie(settings, 1_000);

    await expect(
      verifyTwoFactorSessionCookie(cookie, settings, 3_000)
    ).resolves.toBe(false);
  });

  it("invalidates sessions when the TOTP secret rotates", async () => {
    const settings = createSettings();
    const cookie = await createTwoFactorSessionCookie(settings, 1_000);

    await expect(
      verifyTwoFactorSessionCookie(
        cookie,
        createSettings({
          totpSecret: "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP",
        }),
        2_000
      )
    ).resolves.toBe(false);
  });

  it("sanitizes redirect targets", () => {
    expect(sanitizeTwoFactorRedirect("/collections/add?x=1")).toBe(
      "/collections/add?x=1"
    );
    expect(sanitizeTwoFactorRedirect("https://example.com")).toBe("/");
    expect(sanitizeTwoFactorRedirect("//example.com")).toBe("/");
    expect(sanitizeTwoFactorRedirect("/auth/two-factor")).toBe("/");
  });

  it("creates authenticator-compatible otpauth URIs", () => {
    expect(
      createTotpOtpAuthUri({
        account: "admin@example.com",
        issuer: "LexiNote",
        secret: RFC_6238_TEST_SECRET,
      })
    ).toBe(
      "otpauth://totp/LexiNote:admin%40example.com?algorithm=SHA1&digits=6&issuer=LexiNote&period=30&secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"
    );
  });

  it("verifies setup tokens without accepting missing or partial values", () => {
    expect(
      verifyTwoFactorSetupToken("setup-secret", {
        APP_TWO_FACTOR_SETUP_TOKEN: "setup-secret",
      })
    ).toBe(true);
    expect(
      verifyTwoFactorSetupToken("setup", {
        APP_TWO_FACTOR_SETUP_TOKEN: "setup-secret",
      })
    ).toBe(false);
    expect(verifyTwoFactorSetupToken("setup-secret", {})).toBe(false);
  });
});
