import type { CollectionSummary } from "@/shared/types/collections";

export type ConversationMode =
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
  | "not_requested"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type ConversationSession = {
  id: string;
  title: string;
  mode: ConversationMode;
  summary: string;
  titleIsManual: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConversationMessageDetails = {
  literalTranslation?: string | null;
  nuanceNotes: string[];
  keyPoints: string[];
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
  details: ConversationMessageDetails;
  analysisStatus: ConversationAnalysisStatus;
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

export type ConversationAnalysisResponse = {
  message: ConversationMessage;
  session: ConversationSession;
  memories: ConversationMemory[];
  learningItems: ConversationLearningItem[];
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
