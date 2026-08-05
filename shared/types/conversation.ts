import type { CollectionSummary } from "@/shared/types/collections";

export type ConversationMode =
  | "chat"
  | "auto"
  | "zh_to_ja"
  | "ja_to_zh"
  | "polish_ja"
  | "explain_ja";

export type ConversationRegister = "auto" | "casual" | "polite" | "business";
export type ConversationMessageStatus =
  | "streaming"
  | "completed"
  | "failed"
  | "cancelled";
export type ConversationAnalysisStatus =
  | "running"
  | "completed"
  | "failed";

export type ConversationAnalysisFocus =
  | "all"
  | "grammar"
  | "vocabulary"
  | "expressions";

export type ConversationSession = {
  id: string;
  title: string;
  mode: ConversationMode;
  summary: string;
  summaryThroughAt: string | null;
  titleIsManual: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessage = {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  mode: ConversationMode | null;
  status: ConversationMessageStatus;
  parentMessageId: string | null;
  modelName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ConversationPreferences = {
  defaultMode: ConversationMode;
  translationStyle: "natural_first";
  defaultRegister: ConversationRegister;
  defaultCollectionId: number | null;
};

export type ConversationMemoryScope = "session" | "global";
export type ConversationMemoryStatus = "suggested" | "active" | "dismissed";
export type ConversationMemoryKind = "preference" | "context" | "goal";

export type ConversationMemory = {
  id: string;
  sessionId: string | null;
  scope: ConversationMemoryScope;
  kind: ConversationMemoryKind;
  content: string;
  status: ConversationMemoryStatus;
  sourceMessageId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationGrammarCandidate = {
  grammarPointId: string;
  grammarPoint: string;
  canonicalForm: string;
  senseKey: string;
  coreMeaning: string;
};

export type ConversationLearningItemKind =
  | "vocabulary"
  | "expression"
  | "grammar";
export type ConversationLearningItemStatus =
  | "suggested"
  | "needs_review"
  | "saved"
  | "dismissed"
  | "failed";

export type ConversationLearningItem = {
  id: string;
  sessionId: string | null;
  sourceMessageId: string | null;
  analysisId: string | null;
  kind: ConversationLearningItemKind;
  surfaceForm: string;
  reading: string | null;
  meaningZh: string;
  explanationZh: string;
  sourceExcerpt: string;
  status: ConversationLearningItemStatus;
  grammarCandidates: ConversationGrammarCandidate[];
  wordId: number | null;
  grammarPointId: string | null;
  collectionId: number | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationAnalysis = {
  id: string;
  sessionId: string;
  messageId: string;
  revision: number;
  status: ConversationAnalysisStatus;
  focus: ConversationAnalysisFocus;
  instruction: string;
  overview: string;
  isCurrent: boolean;
  modelName: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type ConversationBootstrapResponse = {
  aiAvailable: boolean;
  sessions: ConversationSession[];
  nextCursor: string | null;
  preferences: ConversationPreferences;
  globalMemories: ConversationMemory[];
  collections: CollectionSummary[];
};

export type ConversationSessionResponse = {
  session: ConversationSession;
  messages: ConversationMessage[];
  memories: ConversationMemory[];
  analyses: ConversationAnalysis[];
  learningItems: ConversationLearningItem[];
  olderMessagesCursor: string | null;
};

export type CreateConversationSessionRequest = {
  mode?: ConversationMode;
};

export type UpdateConversationSessionRequest = {
  title?: string;
  mode?: ConversationMode;
};

export type SendConversationMessageRequest = {
  clientMessageId: string;
  content: string;
  mode?: ConversationMode;
  retryParentMessageId?: string;
  retryAssistantMessageId?: string;
};

export type UpdateConversationPreferencesRequest = Partial<
  ConversationPreferences
>;

export type CreateConversationMemoryRequest = {
  sessionId?: string | null;
  scope: ConversationMemoryScope;
  kind: ConversationMemoryKind;
  content: string;
};

export type UpdateConversationMemoryRequest = {
  content?: string;
  status?: ConversationMemoryStatus;
};

export type PromoteConversationLearningItemRequest = {
  collectionId?: number;
  pronunciation?: string;
  grammarPointId?: string;
};

export type PromoteConversationLearningItemResponse = {
  item: ConversationLearningItem;
  requiresSelection?: boolean;
  pronunciationCandidates?: Array<{
    wordId: number;
    word: string;
    pronunciation: string;
    meaningZh: string;
    partOfSpeech: string;
  }>;
};

export type AnalyzeConversationMessageRequest = {
  clientAnalysisId: string;
  focus?: ConversationAnalysisFocus;
  instruction?: string;
};

export type ConversationAnalysisResponse = {
  analysis: ConversationAnalysis;
  learningItems: ConversationLearningItem[];
};

export type ConversationMaintenanceResponse = {
  session: ConversationSession;
  memories: ConversationMemory[];
};

export type ConversationStreamEvent =
  | {
      type: "assistant_created";
      userMessage: ConversationMessage;
      assistantMessage: ConversationMessage;
    }
  | { type: "text_delta"; delta: string }
  | { type: "completed"; message: ConversationMessage }
  | {
      type: "error";
      code: string;
      message: string;
      retryable: boolean;
      assistantMessage?: ConversationMessage;
    };

export type ConversationReviewInboxResponse = {
  items: ConversationLearningItem[];
};
