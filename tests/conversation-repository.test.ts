import { beforeEach, describe, expect, it, vi } from "vitest";

const { query, transactionQuery, withTransaction } = vi.hoisted(() => {
  const transactionQuery = vi.fn();
  return {
    query: vi.fn(),
    transactionQuery,
    withTransaction: vi.fn(async (operation: (client: unknown) => unknown) =>
      operation({ query: transactionQuery, release: vi.fn() })
    ),
  };
});

vi.mock("@/shared/db/query", () => ({ query, withTransaction }));

import { ConversationRepository } from "@/features/conversation/infrastructure/ConversationRepository";
import {
  COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
  LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
  LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL,
} from "@/shared/db/sql/conversation.sql";
import {
  TEST_ANALYSIS_ID,
  TEST_SESSION_ID,
  TEST_USER_MESSAGE_ID,
} from "@/tests/conversation-test-doubles";

const USER_ID = "00000000-0000-0000-0000-000000000001";
const LEASE_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function analysisRow() {
  return {
    id: TEST_ANALYSIS_ID,
    session_id: TEST_SESSION_ID,
    message_id: "33333333-3333-4333-8333-333333333333",
    revision: 1,
    status: "completed",
    focus: "all",
    instruction: "",
    overview: "重点",
    is_current: true,
    lease_token: LEASE_TOKEN,
    model_name: "test-model",
    error_code: null,
    error_message: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:01.000Z",
    completed_at: "2026-01-01T00:00:01.000Z",
  };
}

describe("ConversationRepository", () => {
  beforeEach(() => {
    query.mockReset();
    transactionQuery.mockReset();
    withTransaction.mockClear();
  });

  it("bounds context reads at the target message", async () => {
    query.mockResolvedValue([]);
    const repository = new ConversationRepository();

    await repository.listContextMessages(
      TEST_SESSION_ID,
      USER_ID,
      16,
      TEST_USER_MESSAGE_ID
    );

    expect(query).toHaveBeenCalledWith(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL, [
      TEST_SESSION_ID,
      USER_ID,
      16,
      TEST_USER_MESSAGE_ID,
    ]);
  });

  it("locks the parent message before finalizing the current analysis", async () => {
    transactionQuery
      .mockResolvedValueOnce({ rows: [{ id: TEST_USER_MESSAGE_ID }] })
      .mockResolvedValueOnce({ rows: [analysisRow()] });
    const repository = new ConversationRepository();

    const result = await repository.completeAnalysisRecord({
      analysisId: TEST_ANALYSIS_ID,
      userId: USER_ID,
      leaseToken: LEASE_TOKEN,
      overview: "重点",
    });

    expect(withTransaction).toHaveBeenCalledOnce();
    expect(transactionQuery.mock.calls).toEqual([
      [LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL, [TEST_ANALYSIS_ID, USER_ID, LEASE_TOKEN]],
      [
        COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
        [TEST_ANALYSIS_ID, USER_ID, LEASE_TOKEN, "重点"],
      ],
    ]);
    expect(result).toMatchObject({ status: "completed", isCurrent: true });
  });

  it("does not finalize after losing the analysis lease", async () => {
    transactionQuery.mockResolvedValueOnce({ rows: [] });
    const repository = new ConversationRepository();

    await expect(
      repository.completeAnalysisRecord({
        analysisId: TEST_ANALYSIS_ID,
        userId: USER_ID,
        leaseToken: LEASE_TOKEN,
        overview: "重点",
      })
    ).resolves.toBeNull();
    expect(transactionQuery).toHaveBeenCalledTimes(1);
  });
});
