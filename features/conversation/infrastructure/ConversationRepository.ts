import { query } from "@/shared/db/query";
import { toIsoString, toNullableIsoString } from "@/shared/db/values";
import {
  CLAIM_CONVERSATION_ANALYSIS_SQL,
  COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
  COMPLETE_CONVERSATION_ANALYSIS_SQL,
  DELETE_ANALYSIS_SUGGESTIONS_SQL,
  DELETE_CONVERSATION_MEMORY_SQL,
  DELETE_CONVERSATION_SESSION_SQL,
  FAIL_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  FAIL_CONVERSATION_ANALYSIS_RECORD_SQL,
  FAIL_CONVERSATION_ANALYSIS_SQL,
  INSERT_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  INSERT_CONVERSATION_ANALYSIS_SQL,
  INSERT_CONVERSATION_LEARNING_ITEM_SQL,
  INSERT_CONVERSATION_MEMORY_SQL,
  INSERT_CONVERSATION_SESSION_SQL,
  INSERT_USER_CONVERSATION_MESSAGE_SQL,
  LIST_ACTIVE_CONVERSATION_MEMORIES_SQL,
  LIST_CONVERSATION_ANALYSES_SQL,
  LIST_CONVERSATION_CONTEXT_MESSAGES_SQL,
  LIST_CONVERSATION_LEARNING_ITEMS_SQL,
  LIST_CONVERSATION_LEARNING_ITEMS_BY_ANALYSIS_SQL,
  LIST_CONVERSATION_MEMORIES_SQL,
  LIST_CONVERSATION_MESSAGES_SQL,
  LIST_CONVERSATION_REVIEW_INBOX_SQL,
  LIST_CONVERSATION_SESSIONS_SQL,
  RECLAIM_CONVERSATION_ANALYSIS_SQL,
  RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL,
  SELECT_CONVERSATION_LEARNING_ITEM_SQL,
  SELECT_CONVERSATION_ANALYSIS_BY_CLIENT_ID_SQL,
  SELECT_CONVERSATION_MEMORY_SQL,
  SELECT_CONVERSATION_MESSAGE_BY_CLIENT_ID_SQL,
  SELECT_CONVERSATION_MESSAGE_SQL,
  SELECT_CONVERSATION_PREFERENCES_SQL,
  SELECT_CONVERSATION_SESSION_SQL,
  TOUCH_CONVERSATION_SESSION_SQL,
  UPDATE_CONVERSATION_LEARNING_ITEM_SQL,
  UPDATE_CONVERSATION_MEMORY_SQL,
  UPDATE_CONVERSATION_PREFERENCES_SQL,
  UPDATE_CONVERSATION_SESSION_SQL,
  UPDATE_CONVERSATION_SUMMARY_SQL,
  UPSERT_DEFAULT_CONVERSATION_PREFERENCES_SQL,
} from "@/shared/db/sql/conversation.sql";
import type {
  ConversationAnalysis,
  ConversationAnalysisFocus,
  ConversationAnalysisStatus,
  ConversationGrammarCandidate,
  ConversationLearningItem,
  ConversationLearningItemKind,
  ConversationLearningItemStatus,
  ConversationMemory,
  ConversationMemoryKind,
  ConversationMemoryScope,
  ConversationMemoryStatus,
  ConversationMessage,
  ConversationMessageDetails,
  ConversationMessageStatus,
  ConversationMode,
  ConversationPreferences,
  ConversationRegister,
  ConversationSession,
  UpdateConversationPreferencesRequest,
} from "@/shared/types/conversation";

type SessionRow = {
  id: string;
  title: string;
  mode: ConversationMode;
  summary: string;
  summary_through_at: string | Date | null;
  title_is_manual: boolean;
  created_at: string | Date;
  updated_at: string | Date;
};

type AnalysisRow = {
  id: string;
  session_id: string;
  message_id: string;
  revision: number | string;
  status: ConversationAnalysisStatus;
  focus: ConversationAnalysisFocus;
  instruction: string;
  overview: string;
  is_current: boolean;
  model_name: string | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
  completed_at: string | Date | null;
};

type MessageRow = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  mode: ConversationMode | null;
  status: ConversationMessageStatus;
  parent_message_id: string | null;
  model_name: string | null;
  error_code: string | null;
  error_message: string | null;
  details: unknown;
  analysis_status: ConversationAnalysisStatus;
  created_at: string | Date;
  updated_at: string | Date;
  completed_at: string | Date | null;
};

type PreferenceRow = {
  default_mode: ConversationMode;
  translation_style: "natural_first";
  default_register: ConversationRegister;
  default_collection_id: number | string | null;
};

type MemoryRow = {
  id: string;
  session_id: string | null;
  scope: ConversationMemoryScope;
  kind: ConversationMemoryKind;
  content: string;
  status: ConversationMemoryStatus;
  source_message_id: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

type LearningItemRow = {
  id: string;
  session_id: string | null;
  source_message_id: string | null;
  analysis_id: string | null;
  kind: ConversationLearningItemKind;
  surface_form: string;
  reading: string | null;
  meaning_zh: string;
  explanation_zh: string;
  source_excerpt: string;
  status: ConversationLearningItemStatus;
  grammar_candidates: unknown;
  word_id: number | string | null;
  grammar_point_id: string | null;
  collection_id: number | string | null;
  error_message: string | null;
  created_at: string | Date;
  updated_at: string | Date;
};

function toNullableInteger(value: number | string | null) {
  if (value === null) {
    return null;
  }
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : value;
  return Number.isInteger(parsed) ? parsed : null;
}

function parseDetails(value: unknown): ConversationMessageDetails {
  if (!value || typeof value !== "object") {
    return { literalTranslation: null, nuanceNotes: [], keyPoints: [] };
  }
  const record = value as Record<string, unknown>;
  return {
    literalTranslation:
      typeof record.literalTranslation === "string"
        ? record.literalTranslation
        : null,
    nuanceNotes: Array.isArray(record.nuanceNotes)
      ? record.nuanceNotes.filter((item): item is string => typeof item === "string")
      : [],
    keyPoints: Array.isArray(record.keyPoints)
      ? record.keyPoints.filter((item): item is string => typeof item === "string")
      : [],
  };
}

function parseGrammarCandidates(value: unknown): ConversationGrammarCandidate[] {
  if (typeof value === "string") {
    try {
      return parseGrammarCandidates(JSON.parse(value));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is ConversationGrammarCandidate => {
    if (!item || typeof item !== "object") {
      return false;
    }
    const candidate = item as Record<string, unknown>;
    return (
      typeof candidate.grammarPointId === "string" &&
      typeof candidate.grammarPoint === "string" &&
      typeof candidate.canonicalForm === "string" &&
      typeof candidate.senseKey === "string" &&
      typeof candidate.coreMeaning === "string"
    );
  });
}

export class ConversationRepository {
  mapSession(row: SessionRow): ConversationSession {
    return {
      id: row.id,
      title: row.title,
      mode: row.mode,
      summary: row.summary,
      summaryThroughAt: toNullableIsoString(row.summary_through_at),
      titleIsManual: row.title_is_manual,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  mapAnalysis(row: AnalysisRow): ConversationAnalysis {
    return {
      id: row.id,
      sessionId: row.session_id,
      messageId: row.message_id,
      revision: Number(row.revision),
      status: row.status,
      focus: row.focus,
      instruction: row.instruction,
      overview: row.overview,
      isCurrent: row.is_current,
      modelName: row.model_name,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      completedAt: toNullableIsoString(row.completed_at),
    };
  }

  mapMessage(row: MessageRow): ConversationMessage {
    return {
      id: row.id,
      sessionId: row.session_id,
      role: row.role,
      content: row.content,
      mode: row.mode,
      status: row.status,
      parentMessageId: row.parent_message_id,
      modelName: row.model_name,
      errorCode: row.error_code,
      errorMessage: row.error_message,
      details: parseDetails(row.details),
      analysisStatus: row.analysis_status,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
      completedAt: toNullableIsoString(row.completed_at),
    };
  }

  mapMemory(row: MemoryRow): ConversationMemory {
    return {
      id: row.id,
      sessionId: row.session_id,
      scope: row.scope,
      kind: row.kind,
      content: row.content,
      status: row.status,
      sourceMessageId: row.source_message_id,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  mapLearningItem(row: LearningItemRow): ConversationLearningItem {
    return {
      id: row.id,
      sessionId: row.session_id,
      sourceMessageId: row.source_message_id,
      analysisId: row.analysis_id,
      kind: row.kind,
      surfaceForm: row.surface_form,
      reading: row.reading,
      meaningZh: row.meaning_zh,
      explanationZh: row.explanation_zh,
      sourceExcerpt: row.source_excerpt,
      status: row.status,
      grammarCandidates: parseGrammarCandidates(row.grammar_candidates),
      wordId: toNullableInteger(row.word_id),
      grammarPointId: row.grammar_point_id,
      collectionId: toNullableInteger(row.collection_id),
      errorMessage: row.error_message,
      createdAt: toIsoString(row.created_at),
      updatedAt: toIsoString(row.updated_at),
    };
  }

  async listSessions(input: {
    userId: string;
    query?: string;
    cursor?: { updatedAt: string; id: string } | null;
    limit: number;
  }) {
    const rows = await query<SessionRow>(LIST_CONVERSATION_SESSIONS_SQL, [
      input.userId,
      input.query ? `%${input.query}%` : "",
      input.cursor?.updatedAt ?? null,
      input.cursor?.id ?? null,
      input.limit,
    ]);
    return rows.map((row) => this.mapSession(row));
  }

  async createSession(userId: string, mode: ConversationMode) {
    const rows = await query<SessionRow>(INSERT_CONVERSATION_SESSION_SQL, [
      userId,
      mode,
    ]);
    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async findSession(sessionId: string, userId: string) {
    const rows = await query<SessionRow>(SELECT_CONVERSATION_SESSION_SQL, [
      sessionId,
      userId,
    ]);
    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async updateSession(input: {
    sessionId: string;
    userId: string;
    title: string;
    mode: ConversationMode;
    titleIsManual: boolean;
  }) {
    const rows = await query<SessionRow>(UPDATE_CONVERSATION_SESSION_SQL, [
      input.sessionId,
      input.userId,
      input.title,
      input.mode,
      input.titleIsManual,
    ]);
    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async deleteSession(sessionId: string, userId: string) {
    const rows = await query<{ id: string }>(DELETE_CONVERSATION_SESSION_SQL, [
      sessionId,
      userId,
    ]);
    return Boolean(rows[0]);
  }

  async touchSession(sessionId: string, userId: string) {
    await query(TOUCH_CONVERSATION_SESSION_SQL, [sessionId, userId]);
  }

  async getPreferences(userId: string): Promise<ConversationPreferences> {
    await query(UPSERT_DEFAULT_CONVERSATION_PREFERENCES_SQL, [userId]);
    const rows = await query<PreferenceRow>(SELECT_CONVERSATION_PREFERENCES_SQL, [
      userId,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error("conversation preferences could not be loaded");
    }
    return {
      defaultMode: row.default_mode,
      translationStyle: row.translation_style,
      defaultRegister: row.default_register,
      defaultCollectionId: toNullableInteger(row.default_collection_id),
    };
  }

  async updatePreferences(
    userId: string,
    preferences: UpdateConversationPreferencesRequest
  ) {
    await this.getPreferences(userId);
    const rows = await query<PreferenceRow>(UPDATE_CONVERSATION_PREFERENCES_SQL, [
      userId,
      preferences.defaultMode !== undefined,
      preferences.defaultMode ?? null,
      preferences.defaultRegister !== undefined,
      preferences.defaultRegister ?? null,
      preferences.defaultCollectionId !== undefined,
      preferences.defaultCollectionId ?? null,
    ]);
    const row = rows[0];
    if (!row) {
      throw new Error("conversation preferences could not be updated");
    }
    return {
      defaultMode: row.default_mode,
      translationStyle: row.translation_style,
      defaultRegister: row.default_register,
      defaultCollectionId: toNullableInteger(row.default_collection_id),
    } satisfies ConversationPreferences;
  }

  async listMessages(input: {
    sessionId: string;
    userId: string;
    cursor?: { createdAt: string; id: string } | null;
    limit: number;
  }) {
    const rows = await query<MessageRow>(LIST_CONVERSATION_MESSAGES_SQL, [
      input.sessionId,
      input.userId,
      input.cursor?.createdAt ?? null,
      input.cursor?.id ?? null,
      input.limit,
    ]);
    return rows.map((row) => this.mapMessage(row));
  }

  async listContextMessages(sessionId: string, userId: string, limit: number) {
    const rows = await query<MessageRow>(LIST_CONVERSATION_CONTEXT_MESSAGES_SQL, [
      sessionId,
      userId,
      limit,
    ]);
    return rows.map((row) => this.mapMessage(row));
  }

  async findMessage(messageId: string, userId: string) {
    const rows = await query<MessageRow>(SELECT_CONVERSATION_MESSAGE_SQL, [
      messageId,
      userId,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async findMessageByClientId(
    sessionId: string,
    userId: string,
    clientMessageId: string
  ) {
    const rows = await query<MessageRow>(
      SELECT_CONVERSATION_MESSAGE_BY_CLIENT_ID_SQL,
      [sessionId, userId, clientMessageId]
    );
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async insertUserMessage(input: {
    sessionId: string;
    userId: string;
    content: string;
    mode: ConversationMode;
    clientMessageId: string;
  }) {
    const rows = await query<MessageRow>(INSERT_USER_CONVERSATION_MESSAGE_SQL, [
      input.sessionId,
      input.userId,
      input.content,
      input.mode,
      input.clientMessageId,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async insertAssistantMessage(input: {
    sessionId: string;
    userId: string;
    mode: ConversationMode;
    parentMessageId: string;
    modelName: string;
    clientMessageId: string;
  }) {
    const rows = await query<MessageRow>(INSERT_ASSISTANT_CONVERSATION_MESSAGE_SQL, [
      input.sessionId,
      input.userId,
      input.mode,
      input.parentMessageId,
      input.modelName,
      input.clientMessageId,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async restartAssistantMessage(input: {
    messageId: string;
    userId: string;
    mode: ConversationMode;
    modelName: string;
  }) {
    const rows = await query<MessageRow>(
      RESTART_ASSISTANT_CONVERSATION_MESSAGE_SQL,
      [input.messageId, input.userId, input.mode, input.modelName]
    );
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async completeAssistantMessage(messageId: string, userId: string, content: string) {
    const rows = await query<MessageRow>(COMPLETE_ASSISTANT_CONVERSATION_MESSAGE_SQL, [
      messageId,
      userId,
      content,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async failAssistantMessage(input: {
    messageId: string;
    userId: string;
    content: string;
    status: "failed" | "cancelled";
    errorCode: string;
    errorMessage: string;
  }) {
    const rows = await query<MessageRow>(FAIL_ASSISTANT_CONVERSATION_MESSAGE_SQL, [
      input.messageId,
      input.userId,
      input.content,
      input.status,
      input.errorCode,
      input.errorMessage,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async createAnalysis(input: {
    sessionId: string;
    messageId: string;
    userId: string;
    clientAnalysisId: string;
    focus: ConversationAnalysisFocus;
    instruction: string;
    modelName: string;
  }) {
    const rows = await query<AnalysisRow>(INSERT_CONVERSATION_ANALYSIS_SQL, [
      input.sessionId,
      input.messageId,
      input.userId,
      input.clientAnalysisId,
      input.focus,
      input.instruction,
      input.modelName,
    ]);
    return rows[0] ? this.mapAnalysis(rows[0]) : null;
  }

  async findAnalysisByClientId(
    sessionId: string,
    userId: string,
    clientAnalysisId: string
  ) {
    const rows = await query<AnalysisRow>(
      SELECT_CONVERSATION_ANALYSIS_BY_CLIENT_ID_SQL,
      [sessionId, userId, clientAnalysisId]
    );
    return rows[0] ? this.mapAnalysis(rows[0]) : null;
  }

  async reclaimAnalysis(input: {
    sessionId: string;
    messageId: string;
    userId: string;
    clientAnalysisId: string;
  }) {
    const rows = await query<AnalysisRow>(RECLAIM_CONVERSATION_ANALYSIS_SQL, [
      input.sessionId,
      input.messageId,
      input.userId,
      input.clientAnalysisId,
    ]);
    return rows[0] ? this.mapAnalysis(rows[0]) : null;
  }

  async listAnalyses(sessionId: string, userId: string) {
    const rows = await query<AnalysisRow>(LIST_CONVERSATION_ANALYSES_SQL, [
      sessionId,
      userId,
    ]);
    return rows.map((row) => this.mapAnalysis(row));
  }

  async completeAnalysisRecord(
    analysisId: string,
    userId: string,
    overview: string
  ) {
    const rows = await query<AnalysisRow>(
      COMPLETE_CONVERSATION_ANALYSIS_RECORD_SQL,
      [analysisId, userId, overview]
    );
    return rows[0] ? this.mapAnalysis(rows[0]) : null;
  }

  async failAnalysisRecord(
    analysisId: string,
    userId: string,
    errorCode: string,
    errorMessage: string
  ) {
    const rows = await query<AnalysisRow>(FAIL_CONVERSATION_ANALYSIS_RECORD_SQL, [
      analysisId,
      userId,
      errorCode,
      errorMessage,
    ]);
    return rows[0] ? this.mapAnalysis(rows[0]) : null;
  }

  async claimAnalysis(messageId: string, userId: string) {
    const rows = await query<MessageRow>(CLAIM_CONVERSATION_ANALYSIS_SQL, [
      messageId,
      userId,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async completeAnalysis(
    messageId: string,
    userId: string,
    details: ConversationMessageDetails
  ) {
    const rows = await query<MessageRow>(COMPLETE_CONVERSATION_ANALYSIS_SQL, [
      messageId,
      userId,
      JSON.stringify(details),
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async failAnalysis(
    messageId: string,
    userId: string,
    errorCode: string,
    errorMessage: string
  ) {
    const rows = await query<MessageRow>(FAIL_CONVERSATION_ANALYSIS_SQL, [
      messageId,
      userId,
      errorCode,
      errorMessage,
    ]);
    return rows[0] ? this.mapMessage(rows[0]) : null;
  }

  async updateSummary(input: {
    sessionId: string;
    userId: string;
    summary: string;
    title?: string | null;
    throughAt: string;
  }) {
    const rows = await query<SessionRow>(UPDATE_CONVERSATION_SUMMARY_SQL, [
      input.sessionId,
      input.userId,
      input.summary,
      input.title ?? "",
      input.throughAt,
    ]);
    return rows[0] ? this.mapSession(rows[0]) : null;
  }

  async listMemories(userId: string, sessionId?: string | null) {
    const rows = await query<MemoryRow>(LIST_CONVERSATION_MEMORIES_SQL, [
      userId,
      sessionId ?? null,
    ]);
    return rows.map((row) => this.mapMemory(row));
  }

  async listActiveMemories(userId: string, sessionId: string) {
    const rows = await query<MemoryRow>(LIST_ACTIVE_CONVERSATION_MEMORIES_SQL, [
      userId,
      sessionId,
    ]);
    return rows.map((row) => this.mapMemory(row));
  }

  async findMemory(memoryId: string, userId: string) {
    const rows = await query<MemoryRow>(SELECT_CONVERSATION_MEMORY_SQL, [
      memoryId,
      userId,
    ]);
    return rows[0] ? this.mapMemory(rows[0]) : null;
  }

  async insertMemory(input: {
    userId: string;
    sessionId: string | null;
    scope: ConversationMemoryScope;
    kind: ConversationMemoryKind;
    content: string;
    status: ConversationMemoryStatus;
    sourceMessageId: string | null;
  }) {
    const rows = await query<MemoryRow>(INSERT_CONVERSATION_MEMORY_SQL, [
      input.userId,
      input.sessionId,
      input.scope,
      input.kind,
      input.content,
      input.status,
      input.sourceMessageId,
    ]);
    return this.mapMemory(rows[0]);
  }

  async updateMemory(
    memoryId: string,
    userId: string,
    content: string,
    status: ConversationMemoryStatus
  ) {
    const rows = await query<MemoryRow>(UPDATE_CONVERSATION_MEMORY_SQL, [
      memoryId,
      userId,
      content,
      status,
    ]);
    return rows[0] ? this.mapMemory(rows[0]) : null;
  }

  async deleteMemory(memoryId: string, userId: string) {
    const rows = await query<{ id: string }>(DELETE_CONVERSATION_MEMORY_SQL, [
      memoryId,
      userId,
    ]);
    return Boolean(rows[0]);
  }

  async clearAnalysisSuggestions(messageId: string, userId: string) {
    await query(DELETE_ANALYSIS_SUGGESTIONS_SQL, [messageId, userId]);
  }

  async insertLearningItem(input: {
    userId: string;
    sessionId: string;
    sourceMessageId: string;
    analysisId?: string | null;
    kind: ConversationLearningItemKind;
    surfaceForm: string;
    reading: string | null;
    meaningZh: string;
    explanationZh: string;
    sourceExcerpt: string;
    status: ConversationLearningItemStatus;
    grammarCandidates: ConversationGrammarCandidate[];
  }) {
    const rows = await query<LearningItemRow>(INSERT_CONVERSATION_LEARNING_ITEM_SQL, [
      input.userId,
      input.sessionId,
      input.sourceMessageId,
      input.analysisId ?? null,
      input.kind,
      input.surfaceForm,
      input.reading,
      input.meaningZh,
      input.explanationZh,
      input.sourceExcerpt,
      input.status,
      JSON.stringify(input.grammarCandidates),
    ]);
    return this.mapLearningItem(rows[0]);
  }

  async listLearningItems(sessionId: string, userId: string) {
    const rows = await query<LearningItemRow>(LIST_CONVERSATION_LEARNING_ITEMS_SQL, [
      sessionId,
      userId,
    ]);
    return rows.map((row) => this.mapLearningItem(row));
  }

  async listLearningItemsByAnalysis(analysisId: string, userId: string) {
    const rows = await query<LearningItemRow>(
      LIST_CONVERSATION_LEARNING_ITEMS_BY_ANALYSIS_SQL,
      [analysisId, userId]
    );
    return rows.map((row) => this.mapLearningItem(row));
  }

  async listReviewInbox(userId: string) {
    const rows = await query<LearningItemRow>(LIST_CONVERSATION_REVIEW_INBOX_SQL, [
      userId,
    ]);
    return rows.map((row) => this.mapLearningItem(row));
  }

  async findLearningItem(itemId: string, userId: string) {
    const rows = await query<LearningItemRow>(SELECT_CONVERSATION_LEARNING_ITEM_SQL, [
      itemId,
      userId,
    ]);
    return rows[0] ? this.mapLearningItem(rows[0]) : null;
  }

  async updateLearningItem(input: {
    itemId: string;
    userId: string;
    status: ConversationLearningItemStatus;
    wordId?: number | null;
    grammarPointId?: string | null;
    collectionId?: number | null;
    errorMessage?: string | null;
  }) {
    const rows = await query<LearningItemRow>(UPDATE_CONVERSATION_LEARNING_ITEM_SQL, [
      input.itemId,
      input.userId,
      input.status,
      input.wordId ?? null,
      input.grammarPointId ?? null,
      input.collectionId ?? null,
      input.errorMessage ?? null,
    ]);
    return rows[0] ? this.mapLearningItem(rows[0]) : null;
  }
}
