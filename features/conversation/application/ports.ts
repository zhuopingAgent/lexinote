import type { AiGatewayInputMessage } from "@/shared/ai/gateway";
import type { CollectionDetail, CollectionSummary } from "@/shared/types/collections";
import type {
  ConversationAnalysis,
  ConversationAnalysisFocus,
  ConversationGrammarCandidate,
  ConversationLearningItem,
  ConversationLearningItemKind,
  ConversationLearningItemStatus,
  ConversationMemory,
  ConversationMemoryKind,
  ConversationMemoryScope,
  ConversationMemoryStatus,
  ConversationMessage,
  ConversationMode,
  ConversationPreferences,
  ConversationSession,
  UpdateConversationPreferencesRequest,
} from "@/shared/types/conversation";
import type {
  ConversationLearningAnalysisOutput,
  ConversationAnalysisMemory,
  ConversationMaintenanceOutput,
} from "@/features/conversation/domain/conversation";
import type {
  GrammarDetailResponse,
  GrammarSearchResponse,
} from "@/shared/types/grammar";

export type ConversationAnalysisLease = {
  analysis: ConversationAnalysis;
  leaseToken: string;
};

export interface ConversationSessionStore {
  listSessions(input: {
    userId: string;
    query?: string;
    cursor?: { updatedAt: string; id: string } | null;
    limit: number;
  }): Promise<ConversationSession[]>;
  createSession(userId: string, mode: ConversationMode): Promise<ConversationSession | null>;
  findSession(sessionId: string, userId: string): Promise<ConversationSession | null>;
  updateSession(input: {
    sessionId: string;
    userId: string;
    title: string;
    mode: ConversationMode;
    titleIsManual: boolean;
  }): Promise<ConversationSession | null>;
  deleteSession(sessionId: string, userId: string): Promise<boolean>;
  getPreferences(userId: string): Promise<ConversationPreferences>;
  updatePreferences(
    userId: string,
    preferences: UpdateConversationPreferencesRequest
  ): Promise<ConversationPreferences>;
  saveMaintenance(input: {
    sessionId: string;
    userId: string;
    summary: string;
    title?: string | null;
    throughAt: string;
    sourceMessageId: string;
    memories: ConversationAnalysisMemory[];
  }): Promise<{
    session: ConversationSession;
    memories: ConversationMemory[];
  } | null>;
}

export interface ConversationMessageStore {
  listMessages(input: {
    sessionId: string;
    userId: string;
    cursor?: { createdAt: string; id: string } | null;
    limit: number;
  }): Promise<ConversationMessage[]>;
  listContextMessages(
    sessionId: string,
    userId: string,
    limit: number,
    throughMessageId?: string
  ): Promise<ConversationMessage[]>;
  findMessage(messageId: string, userId: string): Promise<ConversationMessage | null>;
  findMessageByClientId(
    sessionId: string,
    userId: string,
    clientMessageId: string
  ): Promise<ConversationMessage | null>;
  insertUserMessage(input: {
    sessionId: string;
    userId: string;
    content: string;
    mode: ConversationMode;
    clientMessageId: string;
  }): Promise<ConversationMessage | null>;
  insertAssistantMessage(input: {
    sessionId: string;
    userId: string;
    mode: ConversationMode;
    parentMessageId: string;
    modelName: string;
    clientMessageId: string;
  }): Promise<ConversationMessage | null>;
  restartAssistantMessage(input: {
    messageId: string;
    userId: string;
    mode: ConversationMode;
    modelName: string;
  }): Promise<ConversationMessage | null>;
  completeAssistantMessage(
    messageId: string,
    userId: string,
    content: string
  ): Promise<ConversationMessage | null>;
  failAssistantMessage(input: {
    messageId: string;
    userId: string;
    content: string;
    status: "failed" | "cancelled";
    errorCode: string;
    errorMessage: string;
  }): Promise<ConversationMessage | null>;
}

export interface ConversationMemoryStore {
  listMemories(userId: string, sessionId?: string | null): Promise<ConversationMemory[]>;
  listActiveMemories(userId: string, sessionId: string): Promise<ConversationMemory[]>;
  findMemory(memoryId: string, userId: string): Promise<ConversationMemory | null>;
  insertMemory(input: {
    userId: string;
    sessionId: string | null;
    scope: ConversationMemoryScope;
    kind: ConversationMemoryKind;
    content: string;
    status: ConversationMemoryStatus;
    sourceMessageId: string | null;
  }): Promise<ConversationMemory>;
  updateMemory(
    memoryId: string,
    userId: string,
    content: string,
    status: ConversationMemoryStatus
  ): Promise<ConversationMemory | null>;
  deleteMemory(memoryId: string, userId: string): Promise<boolean>;
}

export interface ConversationAnalysisStore {
  createAnalysisLease(input: {
    sessionId: string;
    messageId: string;
    userId: string;
    clientAnalysisId: string;
    focus: ConversationAnalysisFocus;
    instruction: string;
    modelName: string;
    leaseToken: string;
  }): Promise<ConversationAnalysisLease | null>;
  findAnalysisByClientId(
    sessionId: string,
    userId: string,
    clientAnalysisId: string
  ): Promise<ConversationAnalysis | null>;
  reclaimAnalysisLease(input: {
    sessionId: string;
    messageId: string;
    userId: string;
    clientAnalysisId: string;
    leaseToken: string;
  }): Promise<ConversationAnalysisLease | null>;
  listAnalyses(sessionId: string, userId: string): Promise<ConversationAnalysis[]>;
  completeAnalysisRecord(input: {
    analysisId: string;
    userId: string;
    leaseToken: string;
    overview: string;
  }): Promise<ConversationAnalysis | null>;
  failAnalysisRecord(input: {
    analysisId: string;
    userId: string;
    leaseToken: string;
    errorCode: string;
    errorMessage: string;
  }): Promise<ConversationAnalysis | null>;
}

export interface ConversationLearningItemStore {
  insertLearningItem(input: {
    userId: string;
    sessionId: string;
    sourceMessageId: string;
    analysisId: string;
    leaseToken: string;
    kind: ConversationLearningItemKind;
    surfaceForm: string;
    reading: string | null;
    meaningZh: string;
    explanationZh: string;
    sourceExcerpt: string;
    status: ConversationLearningItemStatus;
    grammarCandidates: ConversationGrammarCandidate[];
  }): Promise<ConversationLearningItem | null>;
  listLearningItems(sessionId: string, userId: string): Promise<ConversationLearningItem[]>;
  listLearningItemsByAnalysis(
    analysisId: string,
    userId: string
  ): Promise<ConversationLearningItem[]>;
  listReviewInbox(userId: string): Promise<ConversationLearningItem[]>;
  findLearningItem(itemId: string, userId: string): Promise<ConversationLearningItem | null>;
  updateLearningItem(input: {
    itemId: string;
    userId: string;
    status: ConversationLearningItemStatus;
    wordId?: number | null;
    grammarPointId?: string | null;
    collectionId?: number | null;
    errorMessage?: string | null;
  }): Promise<ConversationLearningItem | null>;
}

export interface ConversationStore
  extends ConversationSessionStore,
    ConversationMessageStore,
    ConversationMemoryStore,
    ConversationAnalysisStore,
    ConversationLearningItemStore {}

export interface ConversationAiPort {
  isAvailable(): boolean;
  modelName(task: "reply" | "analysis"): string;
  streamReply(
    messages: AiGatewayInputMessage[],
    signal?: AbortSignal
  ): Promise<AsyncIterable<string> | null>;
  analyze(input: {
    messages: ConversationMessage[];
    focus: ConversationAnalysisFocus;
    instruction: string;
    signal?: AbortSignal;
  }): Promise<ConversationLearningAnalysisOutput | null>;
  maintainSession(input: {
    session: ConversationSession;
    messages: ConversationMessage[];
    signal?: AbortSignal;
  }): Promise<ConversationMaintenanceOutput | null>;
}

export interface ConversationCollectionPort {
  listCollections(): Promise<CollectionSummary[]>;
  getCollectionDetail(collectionId: number): Promise<CollectionDetail>;
}

export interface ConversationGrammarSearchPort {
  searchGrammarPoints(options: {
    query?: string;
    limit?: number;
    userId?: string;
  }): Promise<GrammarSearchResponse>;
}

export interface ConversationGrammarPort extends ConversationGrammarSearchPort {
  getGrammarPointDetail(
    grammarPointId: string,
    userId?: string
  ): Promise<GrammarDetailResponse>;
}
