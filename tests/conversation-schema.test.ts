import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
  DELETE_CONVERSATION_SESSION_SQL,
  FAIL_CONVERSATION_ANALYSIS_RECORD_SQL,
  INSERT_CONVERSATION_ANALYSIS_SQL,
  INSERT_CONVERSATION_LEARNING_ITEM_SQL,
  LIST_CONVERSATION_ANALYSES_SQL,
  LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
  LIST_CONVERSATION_LEARNING_ITEMS_SQL,
  LIST_CONVERSATION_MESSAGES_SQL,
  LIST_CONVERSATION_REVIEW_INBOX_SQL,
  LIST_CONVERSATION_SESSIONS_SQL,
  LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL,
  RECLAIM_CONVERSATION_ANALYSIS_SQL,
  RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  SAVE_CONVERSATION_MAINTENANCE_SQL,
  UPDATE_CONVERSATION_PREFERENCES_SQL,
} from "@/shared/db/sql/conversation.sql";
import { UPSERT_REVIEW_RECORD_FROM_CONVERSATION_SQL } from "@/shared/db/sql/grammar.sql";

describe("conversation schema and persistence semantics", () => {
  const schema = readFileSync(
    path.join(process.cwd(), "shared/db/sql/schema.sql"),
    "utf8"
  );

  it("defines the six user-scoped conversation tables non-destructively", () => {
    for (const table of [
      "conversation_sessions",
      "conversation_messages",
      "conversation_preferences",
      "conversation_memories",
      "conversation_analyses",
      "conversation_learning_items",
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).toContain("UNIQUE (session_id, client_message_id)");
    expect(schema).toContain("UNIQUE (session_id, client_analysis_id)");
    expect(schema).toContain("analysis_id UUID REFERENCES conversation_analyses(id)");
    expect(schema).toContain("mode TEXT NOT NULL DEFAULT 'chat'");
    expect(schema).toMatch(
      /status IN \(\s*'suggested',\s*'active',\s*'dismissed'\s*\)/
    );
    expect(schema).toContain("scope = 'global' AND session_id IS NULL");
  });

  it("deletes unconfirmed session output while retaining promoted records", () => {
    expect(DELETE_CONVERSATION_SESSION_SQL).toContain("status <> 'active'");
    expect(DELETE_CONVERSATION_SESSION_SQL).toContain("'needs_review'");
    expect(DELETE_CONVERSATION_SESSION_SQL).not.toMatch(
      /status IN \([^)]*'saved'/
    );
    expect(DELETE_CONVERSATION_SESSION_SQL).toContain(
      "SELECT COUNT(*) FROM removed_suggestions"
    );
    expect(schema).toContain(
      "session_id UUID REFERENCES conversation_sessions(id) ON DELETE SET NULL"
    );
  });

  it("keeps uniquely matched grammar suggestions out of the manual inbox", () => {
    expect(LIST_CONVERSATION_REVIEW_INBOX_SQL).toContain(
      "status IN ('needs_review', 'failed')"
    );
    expect(LIST_CONVERSATION_REVIEW_INBOX_SQL).not.toContain("'suggested'");
  });

  it("returns the current analysis candidate while preserving saved items", () => {
    expect(LIST_CONVERSATION_LEARNING_ITEMS_SQL).toContain("ROW_NUMBER() OVER");
    expect(LIST_CONVERSATION_LEARNING_ITEMS_SQL).toContain(
      "REPLACE(REPLACE(BTRIM(surface_form), '～', '〜'), '~', '〜')"
    );
    expect(LIST_CONVERSATION_LEARNING_ITEMS_SQL).toContain(
      "REGEXP_REPLACE(BTRIM(meaning_zh)"
    );
    expect(LIST_CONVERSATION_LEARNING_ITEMS_SQL).toContain(
      "duplicate_rank = 1"
    );
    expect(LIST_CONVERSATION_LEARNING_ITEMS_SQL).toContain(
      "SELECT id FROM conversation_analyses WHERE is_current"
    );
  });

  it("updates preferences as atomic partial mutations", () => {
    expect(UPDATE_CONVERSATION_PREFERENCES_SQL).toContain(
      "WHEN $2::boolean THEN $3::text"
    );
    expect(UPDATE_CONVERSATION_PREFERENCES_SQL).toContain(
      "WHEN $4::boolean THEN $5::text"
    );
    expect(UPDATE_CONVERSATION_PREFERENCES_SQL).toContain(
      "WHEN $6::boolean THEN $7::bigint"
    );
    expect(UPDATE_CONVERSATION_PREFERENCES_SQL).not.toContain(
      "default_mode = $2::text"
    );
  });

  it("restarts failed answers in place without changing their idempotency key", () => {
    expect(RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL).toContain(
      "status IN ('failed', 'cancelled')"
    );
    expect(RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL).toContain(
      "status = 'streaming'"
    );
    expect(RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL).not.toContain(
      "client_message_id ="
    );
  });

  it("creates versioned analysis records only on request", () => {
    expect(COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL).not.toContain(
      "analysis_status"
    );
    expect(COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL).toContain(
      "WITH completed_message AS"
    );
    expect(COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL).toContain(
      "UPDATE conversation_sessions"
    );
    expect(INSERT_CONVERSATION_ANALYSIS_SQL).toContain("client_analysis_id");
    expect(INSERT_CONVERSATION_ANALYSIS_SQL).toContain("lease_token");
    expect(INSERT_CONVERSATION_ANALYSIS_SQL).toContain(
      "message.status = 'completed'"
    );
    expect(RECLAIM_CONVERSATION_ANALYSIS_SQL).toContain(
      "INTERVAL '5 minutes'"
    );
    expect(RECLAIM_CONVERSATION_ANALYSIS_SQL).toContain("status = 'failed'");
    expect(RECLAIM_CONVERSATION_ANALYSIS_SQL).toContain(
      "lease_token = $5::uuid"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "analysis_id IS DISTINCT FROM $1::uuid"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "status IN ('suggested', 'needs_review')"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "previous.status IN ('completed', 'failed')"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "current_analysis.revision > target.revision"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "dismissed_stale_target_items AS"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "is_current = EXISTS (SELECT 1 FROM winning_target)"
    );
    expect(LIST_CONVERSATION_ANALYSES_SQL).toContain("PARTITION BY message_id");
    expect(LIST_CONVERSATION_ANALYSES_SQL).toContain(
      "is_current OR latest_rank = 1"
    );
    expect(LIST_CONVERSATION_ANALYSES_SQL).not.toContain("LIMIT 200");
  });

  it("fences every analysis write with the active lease", () => {
    expect(schema).toContain(
      "lease_token UUID NOT NULL DEFAULT gen_random_uuid()"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "analysis.lease_token = $3::uuid"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "FOR UPDATE OF message"
    );
    expect(LOCK_CONVERSATION_ANALYSIS_MESSAGE_SQL).toContain(
      "FOR UPDATE OF message"
    );
    expect(COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "message_id IN (SELECT id FROM locked_message)"
    );
    expect(FAIL_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "lease_token = $3::uuid"
    );
    expect(FAIL_CONVERSATION_ANALYSIS_RECORD_SQL).toContain(
      "status = 'running'"
    );
    expect(INSERT_CONVERSATION_LEARNING_ITEM_SQL).toContain(
      "lease_token = $13::uuid"
    );
    expect(INSERT_CONVERSATION_LEARNING_ITEM_SQL).toContain("FOR SHARE");
  });

  it("bounds model context at the message that triggered the workflow", () => {
    expect(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL).toContain(
      "WITH boundary_message AS"
    );
    expect(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL).toContain(
      "WHERE id = $4::uuid"
    );
    expect(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL).toContain(
      "SELECT created_at, id"
    );
    expect(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL).toContain(
      "status = 'completed'"
    );
    expect(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL).not.toContain("'cancelled'");
  });

  it("resolves pagination boundaries inside PostgreSQL before timestamp fallback", () => {
    expect(LIST_CONVERSATION_SESSIONS_SQL).toContain(
      "WITH cursor_session AS"
    );
    expect(LIST_CONVERSATION_SESSIONS_SQL).toContain(
      "EXISTS (SELECT 1 FROM cursor_session)"
    );
    expect(LIST_CONVERSATION_MESSAGES_SQL).toContain(
      "WITH cursor_message AS"
    );
    expect(LIST_CONVERSATION_MESSAGES_SQL).toContain(
      "EXISTS (SELECT 1 FROM cursor_message)"
    );
  });

  it("advances summary and memory suggestions in one monotonic statement", () => {
    expect(SAVE_CONVERSATION_MAINTENANCE_SQL).toContain(
      "WITH advanced_session AS"
    );
    expect(SAVE_CONVERSATION_MAINTENANCE_SQL).toContain(
      "summary_through_at < $5::timestamptz"
    );
    expect(SAVE_CONVERSATION_MAINTENANCE_SQL).toContain(
      "inserted_memories AS"
    );
    expect(SAVE_CONVERSATION_MAINTENANCE_SQL).toContain(
      "WHERE EXISTS (SELECT 1 FROM advanced_session)"
    );
    expect(schema).toContain("summary_through_at TIMESTAMPTZ");
  });

  it("adds conversation grammar as due learning evidence without a mistake", () => {
    expect(UPSERT_REVIEW_RECORD_FROM_CONVERSATION_SQL).toContain(
      "VALUES ($1::uuid, $2::uuid, 'learning', NOW(), 0, NULL)"
    );
    expect(UPSERT_REVIEW_RECORD_FROM_CONVERSATION_SQL).not.toContain(
      "mistake_count = mistake_count + 1"
    );
    expect(UPSERT_REVIEW_RECORD_FROM_CONVERSATION_SQL).toContain("'mastered'");
  });
});
