import { expect, test } from "@playwright/test";
import {
  COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
  LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
  LIST_CONVERSATION_MESSAGES_SQL,
  LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL,
} from "../shared/db/sql/conversation.sql";

type PgModule = {
  Pool: new (config: { connectionString: string; max: number }) => {
    query: <T = Record<string, unknown>>(
      text: string,
      values?: readonly unknown[]
    ) => Promise<{ rows: T[] }>;
    connect: () => Promise<{
      query: <T = Record<string, unknown>>(
        text: string,
        values?: readonly unknown[]
      ) => Promise<{ rows: T[] }>;
      release: () => void;
    }>;
    end: () => Promise<void>;
  };
};

async function loadPg() {
  const moduleName = "pg";
  return (await import(moduleName)) as PgModule;
}

const USER_ID = "00000000-0000-0000-0000-000000000001";
const SESSION_ID = "c1000000-0000-4000-8000-000000000001";
const USER_MESSAGE_ID = "c2000000-0000-4000-8000-000000000001";
const EARLIER_MESSAGE_ID = "c2000000-0000-4000-8000-000000000000";
const ASSISTANT_MESSAGE_ID = "c3000000-0000-4000-8000-000000000001";
const STREAMING_MESSAGE_ID = "c3000000-0000-4000-8000-000000000002";
const ANALYSIS_A_ID = "c4000000-0000-4000-8000-000000000001";
const ANALYSIS_B_ID = "c4000000-0000-4000-8000-000000000002";
const ITEM_A_ID = "c5000000-0000-4000-8000-000000000001";
const ITEM_B_ID = "c5000000-0000-4000-8000-000000000002";
const LEASE_A = "ca000000-0000-4000-8000-000000000001";
const LEASE_B = "ca000000-0000-4000-8000-000000000002";

test("conversation persistence serializes competing analysis revisions", async () => {
  const connectionString = process.env.E2E_DATABASE_URL;
  if (!connectionString) throw new Error("E2E_DATABASE_URL is required");
  const { Pool } = await loadPg();
  const pool = new Pool({ connectionString, max: 4 });
  const first = await pool.connect();
  const second = await pool.connect();

  try {
    await pool.query(
      `
        INSERT INTO conversation_sessions (id, user_id, title, mode)
        VALUES ($1::uuid, $2::uuid, 'Persistence test', 'chat')
      `,
      [SESSION_ID, USER_ID]
    );
    await pool.query(
      `
        INSERT INTO conversation_messages (
          id, session_id, user_id, role, content, mode, status,
          client_message_id, completed_at, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'assistant', '更早的失败回答', 'chat',
          'failed', 'persistence-earlier', NOW(),
          '2026-01-01T00:01:00.123400Z'::timestamptz,
          '2026-01-01T00:01:00.123400Z'::timestamptz
        )
      `,
      [EARLIER_MESSAGE_ID, SESSION_ID, USER_ID]
    );
    await pool.query(
      `
        INSERT INTO conversation_messages (
          id, session_id, user_id, role, content, mode, status,
          client_message_id, completed_at, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'user', '試してみます', 'chat',
          'completed', 'persistence-user', NOW(),
          '2026-01-01T00:01:00.123456Z'::timestamptz,
          '2026-01-01T00:01:00.123456Z'::timestamptz
        )
      `,
      [USER_MESSAGE_ID, SESSION_ID, USER_ID]
    );
    await pool.query(
      `
        INSERT INTO conversation_messages (
          id, session_id, user_id, role, content, mode, status,
          parent_message_id, client_message_id, completed_at, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'assistant', '我会试试看。', 'chat',
          'completed', $4::uuid, 'persistence-assistant', NOW(),
          '2026-01-01T00:02:00.654321Z'::timestamptz,
          '2026-01-01T00:02:00.654321Z'::timestamptz
        )
      `,
      [ASSISTANT_MESSAGE_ID, SESSION_ID, USER_ID, USER_MESSAGE_ID]
    );
    await pool.query(
      `
        INSERT INTO conversation_analyses (
          id, user_id, session_id, message_id, client_analysis_id,
          focus, status, lease_token
        ) VALUES
          ($1::uuid, $2::uuid, $3::uuid, $4::uuid, 'analysis-a', 'all', 'running', $6::uuid),
          ($5::uuid, $2::uuid, $3::uuid, $4::uuid, 'analysis-b', 'all', 'running', $7::uuid)
      `,
      [
        ANALYSIS_A_ID,
        USER_ID,
        SESSION_ID,
        ASSISTANT_MESSAGE_ID,
        ANALYSIS_B_ID,
        LEASE_A,
        LEASE_B,
      ]
    );
    await pool.query(
      `
        INSERT INTO conversation_learning_items (
          id, user_id, session_id, source_message_id, analysis_id,
          kind, surface_form, meaning_zh, explanation_zh, source_excerpt, status
        ) VALUES
          ($1::uuid, $2::uuid, $3::uuid, $4::uuid, $5::uuid,
           'grammar', '〜てみる', '尝试', '版本 A', '試してみます', 'suggested'),
          ($6::uuid, $2::uuid, $3::uuid, $4::uuid, $7::uuid,
           'grammar', '〜てみる', '尝试', '版本 B', '試してみます', 'suggested')
      `,
      [
        ITEM_A_ID,
        USER_ID,
        SESSION_ID,
        ASSISTANT_MESSAGE_ID,
        ANALYSIS_A_ID,
        ITEM_B_ID,
        ANALYSIS_B_ID,
      ]
    );

    const olderMessages = await pool.query<{ id: string }>(
      LIST_CONVERSATION_MESSAGES_SQL,
      [
        SESSION_ID,
        USER_ID,
        "2026-01-01T00:01:00.123Z",
        USER_MESSAGE_ID,
        50,
      ]
    );
    expect(olderMessages.rows.map((row) => row.id)).toEqual([
      EARLIER_MESSAGE_ID,
    ]);

    const context = await pool.query<{ id: string }>(
      LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
      [SESSION_ID, USER_ID, 16, USER_MESSAGE_ID]
    );
    expect(context.rows.map((row) => row.id)).toEqual([USER_MESSAGE_ID]);

    const maintenanceContext = await pool.query<{ id: string }>(
      LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
      [SESSION_ID, USER_ID, 16, ASSISTANT_MESSAGE_ID]
    );
    expect(maintenanceContext.rows.map((row) => row.id)).toEqual([
      USER_MESSAGE_ID,
      ASSISTANT_MESSAGE_ID,
    ]);

    await pool.query(
      `
        INSERT INTO conversation_messages (
          id, session_id, user_id, role, content, mode, status,
          parent_message_id, client_message_id, created_at, updated_at
        ) VALUES (
          $1::uuid, $2::uuid, $3::uuid, 'assistant', '', 'chat',
          'streaming', $4::uuid, 'persistence-streaming',
          '2026-01-01T00:03:00.111222Z'::timestamptz,
          '2026-01-01T00:03:00.111222Z'::timestamptz
        )
      `,
      [STREAMING_MESSAGE_ID, SESSION_ID, USER_ID, USER_MESSAGE_ID]
    );
    const completedMessage = await pool.query<{ id: string; status: string }>(
      COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL,
      [STREAMING_MESSAGE_ID, USER_ID, "原子完成"]
    );
    expect(completedMessage.rows[0]).toMatchObject({
      id: STREAMING_MESSAGE_ID,
      status: "completed",
    });
    const touchedSession = await pool.query<{ updated: boolean }>(
      `
        SELECT updated_at > '2026-01-01T00:03:00.111222Z'::timestamptz AS updated
        FROM conversation_sessions
        WHERE id = $1::uuid
      `,
      [SESSION_ID]
    );
    expect(touchedSession.rows[0]?.updated).toBe(true);

    await first.query("BEGIN");
    await second.query("BEGIN");
    await first.query(LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL, [
      ANALYSIS_A_ID,
      USER_ID,
      LEASE_A,
    ]);
    const waitingForMessageLock = second.query(
      LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL,
      [ANALYSIS_B_ID, USER_ID, LEASE_B]
    );

    await first.query(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL, [
      ANALYSIS_A_ID,
      USER_ID,
      LEASE_A,
      "版本 A",
    ]);
    await first.query("COMMIT");
    await waitingForMessageLock;

    const whileSecondRuns = await pool.query<{ id: string; status: string }>(
      `SELECT id::text, status FROM conversation_learning_items WHERE id = $1::uuid`,
      [ITEM_B_ID]
    );
    expect(whileSecondRuns.rows[0]).toEqual({ id: ITEM_B_ID, status: "suggested" });

    await second.query(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL, [
      ANALYSIS_B_ID,
      USER_ID,
      LEASE_B,
      "版本 B",
    ]);
    await second.query("COMMIT");

    const analyses = await pool.query<{ id: string; is_current: boolean }>(
      `
        SELECT id::text, is_current
        FROM conversation_analyses
        WHERE message_id = $1::uuid
        ORDER BY id
      `,
      [ASSISTANT_MESSAGE_ID]
    );
    expect(analyses.rows).toEqual([
      { id: ANALYSIS_A_ID, is_current: false },
      { id: ANALYSIS_B_ID, is_current: true },
    ]);

    const items = await pool.query<{ id: string; status: string }>(
      `
        SELECT id::text, status
        FROM conversation_learning_items
        WHERE id IN ($1::uuid, $2::uuid)
        ORDER BY id
      `,
      [ITEM_A_ID, ITEM_B_ID]
    );
    expect(items.rows).toEqual([
      { id: ITEM_A_ID, status: "dismissed" },
      { id: ITEM_B_ID, status: "suggested" },
    ]);
  } finally {
    await first.query("ROLLBACK").catch(() => undefined);
    await second.query("ROLLBACK").catch(() => undefined);
    first.release();
    second.release();
    await pool.query(
      `DELETE FROM conversation_learning_items WHERE id IN ($1::uuid, $2::uuid)`,
      [ITEM_A_ID, ITEM_B_ID]
    );
    await pool.query(`DELETE FROM conversation_sessions WHERE id = $1::uuid`, [
      SESSION_ID,
    ]);
    await pool.end();
  }
});
