import type {
  AIFeedbackResult,
  GrammarPointType,
  GrammarPointSummary,
  GrammarTaxonomyTag,
  Practicality,
  PracticeReferenceAnswer,
} from "@/shared/types/grammar";

export type PracticeSkillDimension =
  | "meaning_discrimination"
  | "form_connection"
  | "contrast_selection"
  | "register_control"
  | "contextual_production"
  | "transfer_naturalness";

export type PracticeExerciseType =
  | "meaning_choice"
  | "form_repair"
  | "contrast_choice"
  | "register_rewrite"
  | "guided_translation"
  | "contextual_response";

export type PracticeDifficulty = 1 | 2 | 3 | 4;
export type PracticeResponseMode = "text" | "choice";
export type PracticeSessionEntryMode = "daily" | "focus" | "review";
export type PracticeSessionStatus = "active" | "completed" | "abandoned";
export type PracticeExerciseStatus = "active" | "completed" | "revealed";

export type PracticeContext = {
  sceneSlug: string;
  sceneLabel: string;
  speakerRole: string;
  listenerRole: string;
  socialDistance: "close" | "familiar" | "unfamiliar";
  hierarchy: "speaker_higher" | "equal" | "listener_higher";
  requestBurden: "none" | "low" | "medium" | "high";
  medium: "spoken" | "message" | "email" | "written";
  communicativeGoal: string;
  knownContext: string;
  requiredDetail: string;
  registerPreset: "casual" | "polite" | "business";
  registerLabel: string;
};

export type PracticeExerciseOption = {
  id: string;
  label: string;
};

export type PracticeGrammarPoint = {
  id: string;
  grammarPoint: string;
  pointType: GrammarPointType;
  practicality: Practicality;
  primaryCategory: GrammarTaxonomyTag | null;
};

export type PracticeSession = {
  id: string;
  entryMode: PracticeSessionEntryMode;
  status: PracticeSessionStatus;
  focusGrammarPointId: string;
  plannedExerciseCount: number;
  completedExerciseCount: number;
  startedAt: string;
  completedAt: string | null;
};

export type PracticeSessionProgress = {
  current: number;
  completed: number;
  total: number;
};

export type PracticeExercise = {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  skillDimension: PracticeSkillDimension;
  exerciseType: PracticeExerciseType;
  difficulty: PracticeDifficulty;
  responseMode: PracticeResponseMode;
  status: PracticeExerciseStatus;
  prompt: string;
  context: PracticeContext;
  options: PracticeExerciseOption[];
  hintsRevealed: number;
  hasMoreHints: boolean;
  attemptCount: number;
  source: "ai" | "fallback" | "deterministic";
  grammarPoint: PracticeGrammarPoint;
};

export type PracticeSkillState = {
  grammarPointId: string;
  skillDimension: PracticeSkillDimension;
  estimate: number;
  confidence: number;
  attempts: number;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  recentErrorCodes: string[];
};

export type PracticeMasteryEvidence = {
  skillDimension: PracticeSkillDimension;
  score: number;
  independent: boolean;
  hintCount: number;
  attemptNumber: number;
  contextNovelty: number;
  estimate: number;
  confidence: number;
  nextReviewAt: string;
};

export type PracticeSessionCreateRequest = {
  userId?: string;
  grammarPointId?: string;
  entryMode?: PracticeSessionEntryMode;
  preferredScene?: string;
  preferredRegister?: string;
  plannedExerciseCount?: number;
  clientSessionKey: string;
};

export type PracticeSessionResponse = {
  session: PracticeSession;
  progress: PracticeSessionProgress;
  exercise: PracticeExercise | null;
  summary: PracticeSessionSummary | null;
};

export type PracticeAttemptRequest = {
  userId?: string;
  answer?: string;
  selectedOptionId?: string;
};

export type PracticeAttemptResponse = {
  attemptId: string;
  feedback: AIFeedbackResult;
  canRetry: boolean;
  canReveal: boolean;
  exerciseCompleted: boolean;
  referenceAnswers: PracticeReferenceAnswer[];
  evidence: PracticeMasteryEvidence;
};

export type PracticeHintResponse = {
  hint: string | null;
  hintsRevealed: number;
  hasMoreHints: boolean;
};

export type PracticeRevealResponse = {
  referenceAnswers: PracticeReferenceAnswer[];
  evidence: PracticeMasteryEvidence;
};

export type PracticeSessionSkillSummary = {
  skillDimension: PracticeSkillDimension;
  evidenceCount: number;
  averageScore: number;
  estimate: number;
  confidence: number;
};

export type PracticeSessionSummary = {
  sessionId: string;
  grammarPoint: GrammarPointSummary;
  completedExerciseCount: number;
  plannedExerciseCount: number;
  skillSummaries: PracticeSessionSkillSummary[];
};
