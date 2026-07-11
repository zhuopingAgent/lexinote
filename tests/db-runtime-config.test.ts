import { describe, expect, it } from "vitest";

import { shouldAutoInitializeDatabase } from "@/shared/db/init";
import { createPoolConfig } from "@/shared/db/pool";

describe("database runtime configuration", () => {
  it("keeps request-time schema initialization out of production by default", () => {
    expect(shouldAutoInitializeDatabase({ NODE_ENV: "production" })).toBe(false);
    expect(
      shouldAutoInitializeDatabase({ NODE_ENV: "production", VERCEL: "1" })
    ).toBe(false);
  });

  it("keeps local development auto-initialization unless explicitly disabled", () => {
    expect(shouldAutoInitializeDatabase({ NODE_ENV: "development" })).toBe(true);
    expect(
      shouldAutoInitializeDatabase({
        DATABASE_AUTO_INIT: "0",
        NODE_ENV: "development",
      })
    ).toBe(false);
  });

  it("allows production database auto-initialization only by explicit opt-in", () => {
    expect(
      shouldAutoInitializeDatabase({
        DATABASE_AUTO_INIT: "1",
        NODE_ENV: "production",
        VERCEL: "1",
      })
    ).toBe(true);
  });

  it("uses a conservative default connection pool size on Vercel", () => {
    expect(createPoolConfig({ DATABASE_URL: "postgres://local" }).max).toBe(10);
    expect(
      createPoolConfig({ DATABASE_URL: "postgres://remote", VERCEL: "1" }).max
    ).toBe(1);
  });

  it("allows the database pool size and timeouts to be configured", () => {
    expect(
      createPoolConfig({
        DATABASE_URL: "postgres://remote",
        PG_CONNECTION_TIMEOUT_MS: "7000",
        PG_IDLE_TIMEOUT_MS: "3000",
        PG_POOL_MAX: "4",
        VERCEL: "1",
      })
    ).toMatchObject({
      connectionTimeoutMillis: 7000,
      idleTimeoutMillis: 3000,
      max: 4,
    });
  });
});
