import { describe, expect, it, vi } from "vitest";
import { ConversationAnalysisService } from "@/features/conversation/application/ConversationAnalysisService";
import {
  TEST_ANALYSIS_ID,
  TEST_ASSISTANT_MESSAGE_ID,
  TEST_SESSION_ID,
  TEST_USER_MESSAGE_ID,
  createConversationAi,
  createConversationGrammar,
  createConversationStore,
  makeConversationAnalysis,
  makeConversationLearningItem,
  makeConversationMessage,
} from "@/tests/conversation-test-doubles";

const LEASE_TOKEN = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const userMessage = makeConversationMessage({ id: TEST_USER_MESSAGE_ID });
const assistantMessage = makeConversationMessage({
  id: TEST_ASSISTANT_MESSAGE_ID,
  role: "assistant",
  content: "我会试试看。",
  parentMessageId: TEST_USER_MESSAGE_ID,
});

function findTurnMessage(messageId: string) {
  return Promise.resolve(
    messageId === TEST_ASSISTANT_MESSAGE_ID ? assistantMessage : userMessage
  );
}

function analysisOutput() {
  return {
    overview: "重点是尝试表达。",
    learningItems: [
      {
        kind: "grammar" as const,
        surfaceForm: "〜てみる",
        reading: null,
        meaningZh: "试着……",
        explanationZh: "表示尝试做某事。",
        sourceExcerpt: "試してみます",
      },
    ],
  };
}

describe("ConversationAnalysisService", () => {
  it("persists candidates and completion under one analysis lease", async () => {
    const analysis = makeConversationAnalysis();
    const item = makeConversationLearningItem();
    const createAnalysisLease = vi.fn().mockResolvedValue({
      analysis,
      leaseToken: LEASE_TOKEN,
    });
    const insertLearningItem = vi.fn().mockResolvedValue(item);
    const completeAnalysisRecord = vi.fn().mockResolvedValue(
      makeConversationAnalysis({
        status: "completed",
        isCurrent: true,
        overview: "重点是尝试表达。",
      })
    );
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        createAnalysisLease,
        insertLearningItem,
        completeAnalysisRecord,
      }),
      createConversationAi({ analyze: vi.fn().mockResolvedValue(analysisOutput()) }),
      createConversationGrammar({
        searchGrammarPoints: vi.fn().mockResolvedValue({
          items: [
            {
              id: "77777777-7777-4777-8777-777777777777",
              grammarPoint: "〜てみる",
              canonicalForm: "〜てみる",
              senseKey: "attempt",
              coreMeaning: "尝试",
            },
          ],
        }),
      }),
      () => LEASE_TOKEN
    );

    const result = await service.analyzeMessage(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID,
      { clientAnalysisId: "analysis-1", focus: "grammar" }
    );

    expect(result.learningItems).toEqual([item]);
    expect(createAnalysisLease).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: LEASE_TOKEN })
    );
    expect(insertLearningItem).toHaveBeenCalledWith(
      expect.objectContaining({
        analysisId: TEST_ANALYSIS_ID,
        leaseToken: LEASE_TOKEN,
        status: "suggested",
      })
    );
    expect(completeAnalysisRecord).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: LEASE_TOKEN })
    );
  });

  it("replays a completed idempotent analysis without calling AI", async () => {
    const completed = makeConversationAnalysis({
      status: "completed",
      isCurrent: true,
      focus: "grammar",
      overview: "已完成",
    });
    const item = makeConversationLearningItem();
    const analyze = vi.fn();
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn().mockResolvedValue(assistantMessage),
        findAnalysisByClientId: vi.fn().mockResolvedValue(completed),
        listLearningItemsByAnalysis: vi.fn().mockResolvedValue([item]),
      }),
      createConversationAi({ analyze }),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    await expect(
      service.analyzeMessage(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID, {
        clientAnalysisId: "analysis-1",
        focus: "grammar",
      })
    ).resolves.toEqual({ analysis: completed, learningItems: [item] });
    expect(analyze).not.toHaveBeenCalled();
  });

  it("rejects an idempotency key reused with different intent", async () => {
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn().mockResolvedValue(assistantMessage),
        findAnalysisByClientId: vi.fn().mockResolvedValue(
          makeConversationAnalysis({ focus: "grammar", instruction: "原始意图" })
        ),
      }),
      createConversationAi(),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    await expect(
      service.analyzeMessage(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID, {
        clientAnalysisId: "analysis-1",
        focus: "grammar",
        instruction: "不同意图",
      })
    ).rejects.toThrow("clientAnalysisId 的分析参数不一致");
  });

  it("does not repeat an unresolved candidate from another turn", async () => {
    const historicalItem = makeConversationLearningItem({
      sourceMessageId: "88888888-8888-4888-8888-888888888888",
      status: "suggested",
    });
    const insertLearningItem = vi.fn();
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        createAnalysisLease: vi.fn().mockResolvedValue({
          analysis: makeConversationAnalysis(),
          leaseToken: LEASE_TOKEN,
        }),
        listLearningItems: vi.fn().mockResolvedValue([historicalItem]),
        insertLearningItem,
        completeAnalysisRecord: vi.fn().mockResolvedValue(
          makeConversationAnalysis({ status: "completed", isCurrent: true })
        ),
      }),
      createConversationAi({ analyze: vi.fn().mockResolvedValue(analysisOutput()) }),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    const result = await service.analyzeMessage(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID,
      { clientAnalysisId: "analysis-2", focus: "grammar" }
    );

    expect(result.learningItems).toEqual([]);
    expect(insertLearningItem).not.toHaveBeenCalled();
  });

  it("allows reanalysis of the same turn to replace its undecided candidate", async () => {
    const previousItem = makeConversationLearningItem({ status: "suggested" });
    const replacement = makeConversationLearningItem({
      id: "99999999-9999-4999-8999-999999999999",
    });
    const insertLearningItem = vi.fn().mockResolvedValue(replacement);
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        createAnalysisLease: vi.fn().mockResolvedValue({
          analysis: makeConversationAnalysis(),
          leaseToken: LEASE_TOKEN,
        }),
        listLearningItems: vi.fn().mockResolvedValue([previousItem]),
        insertLearningItem,
        completeAnalysisRecord: vi.fn().mockResolvedValue(
          makeConversationAnalysis({ status: "completed", isCurrent: true })
        ),
      }),
      createConversationAi({ analyze: vi.fn().mockResolvedValue(analysisOutput()) }),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    const result = await service.analyzeMessage(
      TEST_SESSION_ID,
      TEST_ASSISTANT_MESSAGE_ID,
      { clientAnalysisId: "analysis-3", focus: "grammar" }
    );

    expect(result.learningItems).toEqual([replacement]);
    expect(insertLearningItem).toHaveBeenCalledOnce();
  });

  it("cannot let a stale worker complete or fail a reclaimed analysis", async () => {
    const failAnalysisRecord = vi.fn().mockResolvedValue(null);
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        createAnalysisLease: vi.fn().mockResolvedValue({
          analysis: makeConversationAnalysis(),
          leaseToken: LEASE_TOKEN,
        }),
        completeAnalysisRecord: vi.fn().mockResolvedValue(null),
        failAnalysisRecord,
      }),
      createConversationAi({
        analyze: vi
          .fn()
          .mockResolvedValue({ overview: "没有候选", learningItems: [] }),
      }),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    await expect(
      service.analyzeMessage(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID, {
        clientAnalysisId: "analysis-stale",
      })
    ).rejects.toThrow("analysis lease was lost");
    expect(failAnalysisRecord).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: LEASE_TOKEN })
    );
  });

  it("reclaims failed analysis with a fresh token", async () => {
    const reclaimedToken = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
    const reclaimAnalysisLease = vi.fn().mockResolvedValue({
      analysis: makeConversationAnalysis(),
      leaseToken: reclaimedToken,
    });
    const completeAnalysisRecord = vi.fn().mockResolvedValue(
      makeConversationAnalysis({ status: "completed", isCurrent: true })
    );
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        findAnalysisByClientId: vi.fn().mockResolvedValue(
          makeConversationAnalysis({ status: "failed" })
        ),
        reclaimAnalysisLease,
        completeAnalysisRecord,
      }),
      createConversationAi({
        analyze: vi
          .fn()
          .mockResolvedValue({ overview: "重试成功", learningItems: [] }),
      }),
      createConversationGrammar(),
      () => reclaimedToken
    );

    await service.analyzeMessage(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID, {
      clientAnalysisId: "analysis-retry",
    });

    expect(reclaimAnalysisLease).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: reclaimedToken })
    );
    expect(completeAnalysisRecord).toHaveBeenCalledWith(
      expect.objectContaining({ leaseToken: reclaimedToken })
    );
  });

  it("fails the leased analysis when structured analysis is unavailable", async () => {
    const failAnalysisRecord = vi.fn().mockResolvedValue(
      makeConversationAnalysis({ status: "failed" })
    );
    const service = new ConversationAnalysisService(
      createConversationStore({
        findMessage: vi.fn(findTurnMessage),
        createAnalysisLease: vi.fn().mockResolvedValue({
          analysis: makeConversationAnalysis(),
          leaseToken: LEASE_TOKEN,
        }),
        failAnalysisRecord,
      }),
      createConversationAi({ analyze: vi.fn().mockResolvedValue(null) }),
      createConversationGrammar(),
      () => LEASE_TOKEN
    );

    await expect(
      service.analyzeMessage(TEST_SESSION_ID, TEST_ASSISTANT_MESSAGE_ID, {
        clientAnalysisId: "analysis-invalid-output",
      })
    ).rejects.toThrow("conversation analysis failed");
    expect(failAnalysisRecord).toHaveBeenCalledWith({
      analysisId: TEST_ANALYSIS_ID,
      userId: expect.any(String),
      leaseToken: LEASE_TOKEN,
      errorCode: "ANALYSIS_FAILED",
      errorMessage: "学习分析失败，请重试。",
    });
  });
});
