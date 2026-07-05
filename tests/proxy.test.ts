import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it } from "vitest";

import { proxy } from "@/proxy";

function createRequest(authorization?: string) {
  return new NextRequest("http://localhost/api/words", {
    headers: authorization ? { authorization } : undefined,
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
  });

  it("allows requests when Basic Auth is disabled", () => {
    const response = proxy(createRequest());

    expect(response.status).toBe(200);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("challenges unauthenticated requests when Basic Auth is enabled", async () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = proxy(createRequest());

    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toBe(
      'Basic realm="LexiNote", charset="UTF-8"'
    );
    await expect(response.text()).resolves.toBe("Authentication required");
  });

  it("accepts the default username with the configured password", () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = proxy(createRequest(basicAuth("lexinote", "secret")));

    expect(response.status).toBe(200);
    expect(response.headers.get("WWW-Authenticate")).toBeNull();
  });

  it("accepts case-insensitive auth schemes and custom usernames", () => {
    process.env.APP_BASIC_AUTH_USERNAME = "admin";
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = proxy(createRequest(basicAuth("admin", "secret", "basic")));

    expect(response.status).toBe(200);
  });

  it("rejects wrong credentials", () => {
    process.env.APP_BASIC_AUTH_PASSWORD = "secret";

    const response = proxy(createRequest(basicAuth("lexinote", "wrong")));

    expect(response.status).toBe(401);
  });
});
