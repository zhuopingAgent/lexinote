import type {
  ConversationAiPort,
  ConversationCollectionPort,
  ConversationGrammarPort,
  ConversationStore,
} from "@/features/conversation/application/ports";
import type {
  ConversationAnalysis,
  ConversationLearningItem,
  ConversationMemory,
  ConversationMessage,
  ConversationPreferences,
  ConversationSession,
} from "@/shared/types/conversation";

export const TEST_SESSION_ID = "11111111-1111-4111-8111-111111111111";
export const TEST_USER_MESSAGE_ID = "22222222-2222-4222-8222-222222222222";
export const TEST_ASSISTANT_MESSAGE_ID =
  "33333333-3333-4333-8333-333333333333";
export const TEST_ANALYSIS_ID = "44444444-4444-4444-8444-444444444444";

export const testPreferences: ConversationPreferences = {
  defaultMode: "chat",
  translationStyle: "natural_first",
  defaultRegister: "auto",
  defaultCollectionId: null,
};

export function makeConversationSession(
  overrides: Partial<ConversationSession> = {}
): ConversationSession {
  return {
    id: TEST_SESSION_ID,
    title: "新对话",
    mode: "chat",
    summary: "",
    summaryThroughAt: null,
    titleIsManual: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeConversationMessage(
  overrides: Partial<ConversationMessage> = {}
): ConversationMessage {
  return {
    id: TEST_USER_MESSAGE_ID,
    sessionId: TEST_SESSION_ID,
    role: "user",
    content: "試してみます",
    mode: "chat",
    status: "completed",
    parentMessageId: null,
    modelName: null,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-01-01T00:01:00.000Z",
    updatedAt: "2026-01-01T00:01:00.000Z",
    completedAt: "2026-01-01T00:01:00.000Z",
    ...overrides,
  };
}

export function makeConversationAnalysis(
  overrides: Partial<ConversationAnalysis> = {}
): ConversationAnalysis {
  return {
    id: TEST_ANALYSIS_ID,
    sessionId: TEST_SESSION_ID,
    messageId: TEST_ASSISTANT_MESSAGE_ID,
    revision: 1,
    status: "running",
    focus: "all",
    instruction: "",
    overview: "",
    isCurrent: false,
    modelName: "test-analysis-model",
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-01-01T00:03:00.000Z",
    updatedAt: "2026-01-01T00:03:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

export function makeConversationMemory(
  overrides: Partial<ConversationMemory> = {}
): ConversationMemory {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    sessionId: TEST_SESSION_ID,
    scope: "session",
    kind: "context",
    content: "对方是客户",
    status: "active",
    sourceMessageId: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

export function makeConversationLearningItem(
  overrides: Partial<ConversationLearningItem> = {}
): ConversationLearningItem {
  return {
    id: "66666666-6666-4666-8666-666666666666",
    sessionId: TEST_SESSION_ID,
    sourceMessageId: TEST_ASSISTANT_MESSAGE_ID,
    analysisId: TEST_ANALYSIS_ID,
    kind: "grammar",
    surfaceForm: "〜てみる",
    reading: null,
    meaningZh: "试着……",
    explanationZh: "表示尝试做某事。",
    sourceExcerpt: "試してみます",
    status: "suggested",
    grammarCandidates: [],
    wordId: null,
    grammarPointId: null,
    collectionId: null,
    errorMessage: null,
    createdAt: "2026-01-01T00:04:00.000Z",
    updatedAt: "2026-01-01T00:04:00.000Z",
    ...overrides,
  };
}

export function createConversationStore(
  overrides: Partial<ConversationStore> = {}
): ConversationStore {
  const defaults: ConversationStore = {
    async listSessions() {
      return [];
    },
    async createSession() {
      return makeConversationSession();
    },
    async findSession() {
      return makeConversationSession();
    },
    async updateSession() {
      return makeConversationSession();
    },
    async deleteSession() {
      return true;
    },
    async getPreferences() {
      return testPreferences;
    },
    async updatePreferences() {
      return testPreferences;
    },
    async saveMaintenance() {
      return null;
    },
    async listMessages() {
      return [];
    },
    async listContextMessages() {
      return [];
    },
    async findMessage() {
      return null;
    },
    async findMessageByClientId() {
      return null;
    },
    async insertUserMessage() {
      return makeConversationMessage();
    },
    async insertAssistantMessage() {
      return makeConversationMessage({
        id: TEST_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        content: "",
        status: "streaming",
        parentMessageId: TEST_USER_MESSAGE_ID,
      });
    },
    async restartAssistantMessage() {
      return null;
    },
    async completeAssistantMessage(_messageId, _userId, content) {
      return makeConversationMessage({
        id: TEST_ASSISTANT_MESSAGE_ID,
        role: "assistant",
        content,
        parentMessageId: TEST_USER_MESSAGE_ID,
      });
    },
    async failAssistantMessage(input) {
      return makeConversationMessage({
        id: input.messageId,
        role: "assistant",
        content: input.content,
        status: input.status,
        parentMessageId: TEST_USER_MESSAGE_ID,
        errorCode: input.errorCode,
        errorMessage: input.errorMessage,
      });
    },
    async listMemories() {
      return [];
    },
    async listActiveMemories() {
      return [];
    },
    async findMemory() {
      return null;
    },
    async insertMemory(input) {
      return makeConversationMemory({
        sessionId: input.sessionId,
        scope: input.scope,
        kind: input.kind,
        content: input.content,
        status: input.status,
        sourceMessageId: input.sourceMessageId,
      });
    },
    async updateMemory() {
      return null;
    },
    async deleteMemory() {
      return true;
    },
    async createAnalysisLease() {
      return null;
    },
    async findAnalysisByClientId() {
      return null;
    },
    async reclaimAnalysisLease() {
      return null;
    },
    async listAnalyses() {
      return [];
    },
    async completeAnalysisRecord() {
      return null;
    },
    async failAnalysisRecord() {
      return null;
    },
    async insertLearningItem() {
      return null;
    },
    async listLearningItems() {
      return [];
    },
    async listLearningItemsByAnalysis() {
      return [];
    },
    async listReviewInbox() {
      return [];
    },
    async findLearningItem() {
      return null;
    },
    async updateLearningItem() {
      return null;
    },
  };
  return { ...defaults, ...overrides };
}

export function createConversationAi(
  overrides: Partial<ConversationAiPort> = {}
): ConversationAiPort {
  const defaults: ConversationAiPort = {
    isAvailable: () => true,
    modelName: (task) => `test-${task}-model`,
    async streamReply() {
      return (async function* () {
        yield "回答";
      })();
    },
    async analyze() {
      return { overview: "", learningItems: [] };
    },
    async maintainSession() {
      return { title: null, summary: "", memories: [] };
    },
  };
  return { ...defaults, ...overrides };
}

export function createConversationCollections(
  overrides: Partial<ConversationCollectionPort> = {}
): ConversationCollectionPort {
  const defaults: ConversationCollectionPort = {
    async listCollections() {
      return [];
    },
    async getCollectionDetail() {
      throw new Error("collection detail was not configured for this test");
    },
  };
  return { ...defaults, ...overrides };
}

export function createConversationGrammar(
  overrides: Partial<ConversationGrammarPort> = {}
): ConversationGrammarPort {
  const defaults: ConversationGrammarPort = {
    async searchGrammarPoints() {
      return { items: [] };
    },
    async getGrammarPointDetail() {
      throw new Error("grammar detail was not configured for this test");
    },
  };
  return { ...defaults, ...overrides };
}
