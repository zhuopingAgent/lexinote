import { describe, expect, it } from "vitest";
import {
  mergeById,
  replaceSessionByActivity,
  sortSessionsByActivity,
  updateSessionActivity,
  upsertSessionByActivity,
} from "@/app/lib/conversation-state";
import type { ConversationSession } from "@/shared/types/conversation";

function session(
  id: string,
  updatedAt: string,
  title = id
): ConversationSession {
  return {
    id,
    title,
    mode: "auto",
    summary: "",
    titleIsManual: false,
    createdAt: "2026-08-01T00:00:00.000Z",
    updatedAt,
  };
}

describe("conversation state helpers", () => {
  it("merges replacements in place and appends new records", () => {
    expect(
      mergeById(
        [{ id: "a", value: 1 }, { id: "b", value: 2 }],
        [{ id: "a", value: 3 }, { id: "c", value: 4 }]
      )
    ).toEqual([
      { id: "a", value: 3 },
      { id: "b", value: 2 },
      { id: "c", value: 4 },
    ]);
  });

  it("sorts sessions by activity with a deterministic id tie-breaker", () => {
    const timestamp = "2026-08-02T10:00:00.000Z";
    expect(
      sortSessionsByActivity([
        session("a", timestamp),
        session("c", timestamp),
        session("b", "2026-08-02T11:00:00.000Z"),
      ]).map((item) => item.id)
    ).toEqual(["b", "c", "a"]);
  });

  it("upserts sessions while preserving activity ordering", () => {
    const current = [
      session("a", "2026-08-02T10:00:00.000Z"),
      session("b", "2026-08-02T09:00:00.000Z"),
    ];
    const updated = session("b", "2026-08-02T11:00:00.000Z", "updated");
    const inserted = session("c", "2026-08-02T08:00:00.000Z");

    expect(upsertSessionByActivity(current, updated)).toEqual([updated, current[0]]);
    expect(upsertSessionByActivity(current, inserted).map((item) => item.id)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("keeps replacement and activity updates non-inserting", () => {
    const current = [session("a", "2026-08-02T10:00:00.000Z")];

    expect(
      replaceSessionByActivity(
        current,
        session("missing", "2026-08-02T12:00:00.000Z")
      )
    ).toEqual(current);
    expect(
      updateSessionActivity(current, "missing", "2026-08-02T12:00:00.000Z")
    ).toEqual(current);
  });
});
