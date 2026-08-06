import { beforeEach, describe, expect, it, vi } from "vitest";

const { ensureDatabaseReady, getPool } = vi.hoisted(() => ({
  ensureDatabaseReady: vi.fn(),
  getPool: vi.fn(),
}));

vi.mock("@/shared/db/init", () => ({ ensureDatabaseReady }));
vi.mock("@/shared/db/pool", () => ({ getPool }));

import { withTransaction } from "@/shared/db/query";

describe("database transactions", () => {
  beforeEach(() => {
    ensureDatabaseReady.mockReset().mockResolvedValue(undefined);
    getPool.mockReset();
  });

  it("commits an operation on one checked-out connection", async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    getPool.mockResolvedValue({ connect: vi.fn().mockResolvedValue({ query, release }) });

    await expect(
      withTransaction(async (client) => {
        await client.query("SELECT 1");
        return "done";
      })
    ).resolves.toBe("done");

    expect(query.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      "SELECT 1",
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledWith(false);
  });

  it("rolls back and preserves the operation error", async () => {
    const operationError = new Error("operation failed");
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const release = vi.fn();
    getPool.mockResolvedValue({ connect: vi.fn().mockResolvedValue({ query, release }) });

    await expect(
      withTransaction(async () => {
        throw operationError;
      })
    ).rejects.toBe(operationError);

    expect(query.mock.calls.map(([sql]) => sql)).toEqual(["BEGIN", "ROLLBACK"]);
    expect(release).toHaveBeenCalledWith(false);
  });

  it("discards a connection when rollback itself fails", async () => {
    const operationError = new Error("operation failed");
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error("rollback failed"));
    const release = vi.fn();
    getPool.mockResolvedValue({ connect: vi.fn().mockResolvedValue({ query, release }) });

    await expect(
      withTransaction(async () => {
        throw operationError;
      })
    ).rejects.toBe(operationError);
    expect(release).toHaveBeenCalledWith(true);
  });
});
