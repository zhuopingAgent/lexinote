import { describe, expect, it, vi } from "vitest";
import { ConversationSessionService } from "@/features/conversation/application/ConversationSessionService";
import {
  TEST_SESSION_ID,
  createConversationAi,
  createConversationCollections,
  createConversationStore,
  makeConversationSession,
  testPreferences,
} from "@/tests/conversation-test-doubles";

describe("ConversationSessionService", () => {
  it("bootstraps paginated sessions, preferences, memories, and collections", async () => {
    const sessions = Array.from({ length: 31 }, (_, index) =>
      makeConversationSession({
        id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
        updatedAt: new Date(Date.UTC(2026, 0, 31 - index)).toISOString(),
      })
    );
    const listSessions = vi.fn().mockResolvedValue(sessions);
    const store = createConversationStore({ listSessions });
    const service = new ConversationSessionService(
      store,
      createConversationAi({ isAvailable: () => false }),
      createConversationCollections({
        listCollections: vi.fn().mockResolvedValue([
          {
            collectionId: 1,
            name: "默认",
            description: "",
            wordCount: 0,
            autoFilterEnabled: false,
            autoFilterCriteria: "",
            autoFilterRuleVersion: 1,
            autoFilterSyncStatus: "idle",
            autoFilterLastRunAt: null,
            autoFilterLastError: "",
            autoFilterLastSyncedRuleVersion: null,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
          },
        ]),
      })
    );

    const result = await service.bootstrap({ query: " 练习 " });

    expect(result.aiAvailable).toBe(false);
    expect(result.sessions).toHaveLength(30);
    expect(result.nextCursor).not.toBeNull();
    expect(result.preferences).toEqual(testPreferences);
    expect(result.collections).toHaveLength(1);
    expect(listSessions).toHaveBeenCalledWith(
      expect.objectContaining({ query: "练习", limit: 31 })
    );
  });

  it("does not load child records outside session ownership", async () => {
    const listMessages = vi.fn();
    const service = new ConversationSessionService(
      createConversationStore({
        findSession: vi.fn().mockResolvedValue(null),
        listMessages,
      }),
      createConversationAi(),
      createConversationCollections()
    );

    await expect(
      service.getSession("11111111-1111-4111-8111-111111111111")
    ).rejects.toThrow("未找到这个对话");
    expect(listMessages).not.toHaveBeenCalled();
  });

  it("rejects malformed cursors before paginated repository access", async () => {
    const listMessages = vi.fn();
    const service = new ConversationSessionService(
      createConversationStore({ listMessages }),
      createConversationAi(),
      createConversationCollections()
    );

    await expect(
      service.getSession(
        "11111111-1111-4111-8111-111111111111",
        Buffer.from(JSON.stringify({ id: "bad", createdAt: "yesterday" })).toString(
          "base64url"
        )
      )
    ).rejects.toThrow("cursor is invalid");
    expect(listMessages).not.toHaveBeenCalled();
  });

  it("rejects a malformed message cursor before loading child records", async () => {
    const listMessages = vi.fn();
    const service = new ConversationSessionService(
      createConversationStore({ listMessages }),
      createConversationAi(),
      createConversationCollections()
    );
    const cursor = Buffer.from(
      JSON.stringify({ createdAt: "not-a-date", id: "not-a-uuid" })
    ).toString("base64url");

    await expect(service.getSession(TEST_SESSION_ID, cursor)).rejects.toThrow(
      "cursor is invalid"
    );
    expect(listMessages).not.toHaveBeenCalled();
  });

  it("passes only supplied preference fields to an atomic update", async () => {
    const updatePreferences = vi.fn().mockResolvedValue({
      ...testPreferences,
      defaultRegister: "polite",
    });
    const service = new ConversationSessionService(
      createConversationStore({ updatePreferences }),
      createConversationAi(),
      createConversationCollections()
    );

    await service.updatePreferences({ defaultRegister: "polite" });

    expect(updatePreferences).toHaveBeenCalledWith(
      expect.any(String),
      { defaultRegister: "polite" }
    );
  });

  it("verifies a default collection before persisting it", async () => {
    const getCollectionDetail = vi.fn().mockResolvedValue({});
    const updatePreferences = vi.fn().mockResolvedValue({
      ...testPreferences,
      defaultCollectionId: 7,
    });
    const service = new ConversationSessionService(
      createConversationStore({ updatePreferences }),
      createConversationAi(),
      createConversationCollections({ getCollectionDetail })
    );

    await service.updatePreferences({ defaultCollectionId: 7 });

    expect(getCollectionDetail).toHaveBeenCalledWith(7);
    expect(updatePreferences).toHaveBeenCalledWith(
      expect.any(String),
      { defaultCollectionId: 7 }
    );
  });

  it("requires ownership before creating a session memory", async () => {
    const insertMemory = vi.fn();
    const service = new ConversationSessionService(
      createConversationStore({
        findSession: vi.fn().mockResolvedValue(null),
        insertMemory,
      }),
      createConversationAi(),
      createConversationCollections()
    );

    await expect(
      service.createMemory({
        sessionId: "11111111-1111-4111-8111-111111111111",
        scope: "session",
        kind: "context",
        content: "对方是客户",
      })
    ).rejects.toThrow("未找到这个对话");
    expect(insertMemory).not.toHaveBeenCalled();
  });
});
