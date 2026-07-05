import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/auth/two-factor/verify/route";
import { generateTotpCode, TWO_FACTOR_COOKIE_NAME } from "@/shared/auth/two-factor";

const TEST_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function createRequest(body: Record<string, string>) {
  return new NextRequest("http://localhost/api/auth/two-factor/verify", {
    body: new URLSearchParams(body),
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    method: "POST",
  });
}

describe("POST /api/auth/two-factor/verify", () => {
  beforeEach(() => {
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";
    process.env.APP_TWO_FACTOR_SESSION_SECONDS = "60";
  });

  it("sets a signed session cookie for a valid code", async () => {
    const code = await generateTotpCode(TEST_TOTP_SECRET);
    const response = await POST(
      createRequest({ code, next: "/collections/add?collectionId=1" })
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/collections/add?collectionId=1"
    );
    expect(response.headers.get("set-cookie")).toContain(
      `${TWO_FACTOR_COOKIE_NAME}=`
    );
  });

  it("redirects back to the challenge page for an invalid code", async () => {
    const response = await POST(createRequest({ code: "000000", next: "/" }));

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/two-factor?error=invalid&next=%2F"
    );
    expect(response.headers.get("set-cookie")).toBeNull();
  });
});
