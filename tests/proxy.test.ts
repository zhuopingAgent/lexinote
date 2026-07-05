import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { proxy } from "@/proxy";
import {
  createTwoFactorSessionCookie,
  getTwoFactorSettings,
  TWO_FACTOR_COOKIE_NAME,
  TWO_FACTOR_REQUIRED_CODE,
  TWO_FACTOR_REQUIRED_MESSAGE,
} from "@/shared/auth/two-factor";

const TEST_TOTP_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

function createRequest(
  path = "/api/words",
  options: {
    authorization?: string;
    cookie?: string;
    headers?: Record<string, string>;
  } = {}
) {
  return new NextRequest(`http://localhost${path}`, {
    headers: {
      ...(options.authorization ? { authorization: options.authorization } : {}),
      ...(options.cookie ? { cookie: options.cookie } : {}),
      ...options.headers,
    },
  });
}

function basicAuth(username: string, password: string, scheme = "Basic") {
  const value = Buffer.from(`${username}:${password}`).toString("base64");
  return `${scheme} ${value}`;
}

describe("proxy Basic Auth", () => {
  beforeEach(() => {
    delete process.env.APP_BASIC_AUTH_USERNAME;
    delete process.env.APP_BASIC_AUTH_PASSWORD;
    delete process.env.APP_TWO_FACTOR_TOTP_SECRET;
    delete process.env.APP_TWO_FACTOR_COOKIE_SECRET;
    delete process.env.APP_TWO_FACTOR_SESSION_SECONDS;
  });

  it("allows requests when Basic Auth and 2FA are disabled", async () => {
    const response = await proxy(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("challenges unauthenticated requests when Basic Auth is enabled", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = await proxy(createRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Basic realm="LexiNote", charset="UTF-8"'
    );
    await expect(response.text()).resolves.toBe("Authentication required");
  });

  it("accepts the default username with the configured password", () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    return expect(
      proxy(createRequest("/api/words", {
        authorization: basicAuth("lexinote", "secret"),
      }))
    ).resolves.toHaveProperty("status", 200);
  });

  it("accepts case-insensitive auth schemes and custom usernames", async () => {
    process.env.APP_BASIC_AUTH_USERNAME = "admin";
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = await proxy(
      createRequest("/api/words", {
        authorization: basicAuth("admin", "secret", "basic"),
      })
    );

    expect(response.status).toBe(200);
  });

  it("rejects wrong credentials", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = await proxy(
      createRequest("/api/words", {
        authorization: basicAuth("lexinote", "wrong"),
      })
    );

    expect(response.status).toBe(401);
  });

  it("returns a 2FA JSON challenge for API requests without a valid 2FA session", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";

    const response = await proxy(
      createRequest("/api/words", {
        authorization: basicAuth("lexinote", "secret"),
      })
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: TWO_FACTOR_REQUIRED_CODE,
        message: TWO_FACTOR_REQUIRED_MESSAGE,
      },
    });
  });

  it("redirects page requests without a valid 2FA session to the 2FA page", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";

    const response = await proxy(
      createRequest("/", {
        authorization: basicAuth("lexinote", "secret"),
        headers: { accept: "text/html" },
      })
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost/auth/two-factor?next=%2F"
    );
  });

  it("allows 2FA challenge routes before a 2FA session exists", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";

    const response = await proxy(
      createRequest("/auth/two-factor", {
        authorization: basicAuth("lexinote", "secret"),
      })
    );

    expect(response.status).toBe(200);
  });

  it("allows the protected 2FA setup route to perform its own token check", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";

    const response = await proxy(
      createRequest("/auth/two-factor/setup?token=setup-secret", {
        authorization: basicAuth("lexinote", "secret"),
      })
    );

    expect(response.status).toBe(200);
  });

  it("accepts requests with a valid 2FA session cookie", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";
    process.env.APP_TWO_FACTOR_TOTP_SECRET = TEST_TOTP_SECRET;
    process.env.APP_TWO_FACTOR_COOKIE_SECRET = "cookie-secret";

    const settings = getTwoFactorSettings();
    expect(settings).not.toBeNull();
    const sessionCookie = await createTwoFactorSessionCookie(settings!);

    const response = await proxy(
      createRequest("/api/words", {
        authorization: basicAuth("lexinote", "secret"),
        cookie: `${TWO_FACTOR_COOKIE_NAME}=${sessionCookie}`,
      })
    );

    expect(response.status).toBe(200);
  });
});
