import { describe, expect, it, vi } from "vitest";
import { ConversationMaintenanceService } from "@/features/conversation/application/ConversationMaintenanceService";
import {
  TEST_ASSISTANT_MESSAGE_ID,
  TEST_SESSION_ID,
  TEST_USER_MESSAGE_ID,
  createConversationAi,
  createConversationStore,
  makeConversationMemory,
  makeConversationMessage,
  makeConversationSession,
} from "@/tests/conversation-test-doubles";

const userMessage = makeConversationMessage({
  id: TEST_USER_MESSAGE_ID,
  content: "帮我安排下周的会议",
});
const assistantMessage = makeConversationMessage({
  id: TEST_ASSISTANT_MESSAGE_ID,
  role: "assistant",
  content: "当然，我们先确定日期。",
  parentMessageId: TEST_USER_MESSAGE_ID,
  createdAt: "2026-01-01T00:02:00.000Z",
});

describe("ConversationMaintenanceService", () => {
  it("atomically saves monotonic summary progress and memory suggestions", async () => {
    const findMessage = vi
      .fn()
      .mockResolvedValueOnce(assistantMessage)
      .mockResolvedValueOnce(userMessage);
    const maintainSession = vi.fn().mockResolvedValue({
      title: null,
      summary: "用户正在安排下周会议。",
      memories: [
        { scope: "session", kind: "context", content: "会议安排在下周" },
      ],
    });
    const savedMemory = makeConversationMemory({
      content: "会议安排在下周",
      status: "suggested",
      sourceMessageId: TEST_ASSISTANT_MESSAGE_ID,
    });
    const updatedSession = makeConversationSession({
      title: "帮我安排下周的会议",
      summary: "用户正在安排下周会议。",
      summaryThroughAt: assistantMessage.createdAt,
    });
    const saveMaintenance = vi.fn().mockResolvedValue({
      session: updatedSession,
      memories: [savedMemory],
    });
    const service = new ConversationMaintenanceService(
      createConversationStore({
        findMessage,
        listContextMessages: vi
          .fn()
          .mockResolvedValue([userMessage, assistantMessage]),
        saveMaintenance,
      }),
      createConversationAi({ maintainSession })
    );

    const result = await service.maintainSession(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID
    );

    expect(result).toEqual({
      session: updatedSession,
      memories: [savedMemory],
    });
    expect(saveMaintenance).toHaveBeenCalledWith(
      expect.objectContaining({
        throughAt: assistantMessage.createdAt,
        sourceMessageId: TEST_ASSISTANT_MESSAGE_ID,
        title: "帮我安排下周的会议",
        memories: [
          { scope: "session", kind: "context", content: "会议安排在下周" },
        ],
      })
    );
  });

  it("replays completed maintenance without calling AI", async () => {
    const session = makeConversationSession({
      summaryThroughAt: assistantMessage.createdAt,
    });
    const memory = makeConversationMemory({
      sourceMessageId: TEST_ASSISTANT_MESSAGE_ID,
      status: "suggested",
    });
    const maintainSession = vi.fn();
    const service = new ConversationMaintenanceService(
      createConversationStore({
        findSession: vi.fn().mockResolvedValue(session),
        findMessage: vi.fn().mockResolvedValue(assistantMessage),
        listMemories: vi.fn().mockImplementation(async (_userId, sessionId) =>
          sessionId === TEST_SESSION_ID ? [memory] : []
        ),
      }),
      createConversationAi({ maintainSession })
    );

    const result = await service.maintainSession(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID
    );

    expect(result.memories).toEqual([memory]);
    expect(maintainSession).not.toHaveBeenCalled();
  });

  it("treats a lost monotonic update as a concurrent successful replay", async () => {
    const initialSession = makeConversationSession();
    const concurrentSession = makeConversationSession({
      summary: "并发请求已经保存。",
      summaryThroughAt: assistantMessage.createdAt,
    });
    const memory = makeConversationMemory({
      sourceMessageId: TEST_ASSISTANT_MESSAGE_ID,
      status: "suggested",
    });
    const service = new ConversationMaintenanceService(
      createConversationStore({
        findSession: vi
          .fn()
          .mockResolvedValueOnce(initialSession)
          .mockResolvedValueOnce(concurrentSession),
        findMessage: vi
          .fn()
          .mockResolvedValueOnce(assistantMessage)
          .mockResolvedValueOnce(userMessage),
        listContextMessages: vi
          .fn()
          .mockResolvedValue([userMessage, assistantMessage]),
        saveMaintenance: vi.fn().mockResolvedValue(null),
        listMemories: vi.fn().mockImplementation(async (_userId, sessionId) =>
          sessionId === TEST_SESSION_ID ? [memory] : []
        ),
      }),
      createConversationAi({
        maintainSession: vi.fn().mockResolvedValue({
          title: null,
          summary: "本请求的摘要。",
          memories: [],
        }),
      })
    );

    const result = await service.maintainSession(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID
    );

    expect(result.session).toBe(concurrentSession);
    expect(result.memories).toEqual([memory]);
  });

  it("catches up every unmaintained turn only through the target response", async () => {
    const missedUser = makeConversationMessage({
      id: "77777777-7777-4777-8777-777777777777",
      content: "先确认一下时间。",
      createdAt: "2026-01-01T00:00:30.000Z",
    });
    const missedAssistant = makeConversationMessage({
      id: "88888888-8888-4888-8888-888888888888",
      role: "assistant",
      content: "好的，请告诉我希望的时间。",
      parentMessageId: missedUser.id,
      createdAt: "2026-01-01T00:00:40.000Z",
    });
    const context = [missedUser, missedAssistant, userMessage, assistantMessage];
    const listContextMessages = vi.fn().mockResolvedValue(context);
    const maintainSession = vi.fn().mockResolvedValue({
      title: "新对话",
      summary: "已确认时间并开始安排会议。",
      memories: [],
    });
    const service = new ConversationMaintenanceService(
      createConversationStore({
        findMessage: vi
          .fn()
          .mockResolvedValueOnce(assistantMessage)
          .mockResolvedValueOnce(userMessage),
        listContextMessages,
        saveMaintenance: vi.fn().mockResolvedValue({
          session: makeConversationSession({
            summaryThroughAt: assistantMessage.createdAt,
          }),
          memories: [],
        }),
      }),
      createConversationAi({ maintainSession })
    );

    await service.maintainSession(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID);

    expect(listContextMessages).toHaveBeenCalledWith(
      TEST_SESSION_ID,
      expect.any(String),
      expect.any(Number),
      assistantMessage.id
    );
    expect(maintainSession).toHaveBeenCalledWith(
      expect.objectContaining({ messages: context })
    );
  });
});
