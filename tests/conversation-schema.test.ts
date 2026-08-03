import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLAIM_CONVERSATION_ANALYSIS_SQL,
  DELETE_CONVERSATION_SESSION_SQL,
  LIST_CONVERSATION_LEARNING_ITEMS_SQL,
  LIST_CONVERSATION_REVIEW_INBOX_SQL,
  RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  UPDATE_CONVERSATION_PREFERENCES_SQL,
  UPDATE_CONVERSATION_SUMMARY_SQL,
} from "@/shared/db/sql/conversation.sql";
import { UPSERT_REVIEW_RECORD_FROM_CONVERSATION_SQL } from "@/shared/db/sql/grammar.sql";

describe("conversation schema and persistence semantics", () => {
  const schema = readFileSync(
    path.join(process.cwd(), "shared/db/sql/schema.sql"),
    "utf8"
  );

  it("defines the five user-scoped conversation tables non-destructively", () => {
    for (const table of [
      "conversation_sessions",
      "conversation_messages",
      "conversation_preferences",
      "conversation_memories",
      "conversation_learning_items",
    ]) {
      expect(schema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(schema).toContain("UNIQUE (session_id, client_message_id)");
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

  it("returns only the first persisted copy of an analyzed learning candidate", () => {
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

  it("leases failed or stale analysis and protects the first automatic title", () => {
    expect(CLAIM_CONVERSATION_ANALYSIS_SQL).toContain("INTERVAL '5 minutes'");
    expect(CLAIM_CONVERSATION_ANALYSIS_SQL).toContain(
      "analysis_status IN ('pending', 'failed')"
    );
    expect(UPDATE_CONVERSATION_SUMMARY_SQL).toContain(
      "summary_updated_at IS NOT NULL"
    );
    expect(schema).toContain("summary_through_at TIMESTAMPTZ");
    expect(UPDATE_CONVERSATION_SUMMARY_SQL).toContain(
      "summary_through_at > $5::timestamptz"
    );
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
