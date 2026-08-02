export type Practicality = "S" | "A" | "B" | "C" | "D";

export type SpokenOrWritten = "spoken" | "written" | "both";

export type GrammarPointType =
  | "grammar_pattern"
  | "conjugation"
  | "sentence_pattern"
  | "syntax_concept"
  | "particle"
  | "collocation"
  | "register_concept"
  | "discourse_marker";

export type GrammarPointStatus = "active" | "migrated" | "hidden" | "deprecated";

export type TaxonomyStatus = "active" | "hidden" | "deprecated";

export type GrammarSceneTag =
  | "restaurant"
  | "shopping"
  | "hospital"
  | "workplace"
  | "email"
  | "phone_call"
  | "customer_service"
  | "government_office"
  | "transportation"
  | "housing"
  | "school"
  | "friend_chat"
  | "family"
  | "travel"
  | "interview"
  | "online_chat"
  | "daily_life";

export type GrammarRegisterTag =
  | "casual"
  | "polite"
  | "business"
  | "formal"
  | "written"
  | "customer"
  | "academic"
  | "news"
  | "rough"
  | "soft";

export type GrammarTag = {
  nameEn: string;
  nameZh: string;
  description?: string;
  priority?: number;
};
export type GrammarCategoryGroup = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  description: string;
  priority: number;
  isMvp: boolean;
};

export type GrammarCategory = {
  id: string;
  slug: string;
  groupId?: string | null;
  groupSlug?: string | null;
  groupNameZh?: string | null;
  groupNameEn?: string | null;
  groupDescription?: string | null;
  groupPriority?: number | null;
  nameZh: string;
  nameEn: string;
  description: string;
  exampleExpressions: string[];
  priority: number;
  isMvp: boolean;
};

export type KnowledgeDimension = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  description: string;
  displayOrder: number;
  status: TaxonomyStatus;
};

export type TaxonomyNode = {
  id: string;
  slug: string;
  dimensionId: string;
  dimensionSlug: string;
  dimensionNameZh: string;
  dimensionNameEn: string;
  nameZh: string;
  nameEn: string;
  description: string;
  exampleExpressions: string[];
  displayOrder: number;
  status: TaxonomyStatus;
};

export type GrammarTaxonomyTag = Pick<
  TaxonomyNode,
  | "id"
  | "slug"
  | "dimensionId"
  | "dimensionSlug"
  | "dimensionNameZh"
  | "dimensionNameEn"
  | "nameZh"
  | "nameEn"
  | "displayOrder"
>;

export type GrammarConnectionBaseType =
  | "verb"
  | "i_adjective"
  | "na_adjective"
  | "noun"
  | "clause";

export type GrammarConnection = {
  baseType: GrammarConnectionBaseType;
  requiredForm: string;
  pattern: string;
  notes: string;
  sortOrder: number;
};

export type GrammarPrerequisiteRelation = "required" | "recommended";

export type GrammarPrerequisite = {
  grammarPointId: string;
  grammarPoint: string;
  canonicalForm: string;
  senseKey: string;
  relationType: GrammarPrerequisiteRelation;
};

export type LearningStage = {
  id: string;
  slug: string;
  nameZh: string;
  description: string;
  displayOrder: number;
  status: TaxonomyStatus;
};

export type LearningModule = {
  id: string;
  stageId: string;
  stageSlug: string;
  stageNameZh: string;
  slug: string;
  nameZh: string;
  description: string;
  displayOrder: number;
  status: TaxonomyStatus;
};

export type GrammarCurriculumPlacement = {
  stage: LearningStage;
  module: LearningModule | null;
  level: number;
  recommendedOrder: number;
  moduleOrder: number | null;
};

export type GrammarFormSibling = {
  id: string;
  grammarPoint: string;
  canonicalForm: string;
  senseKey: string;
  coreMeaning: string;
  status: GrammarPointStatus;
};

export type ComparisonSetMember = {
  grammarPointId: string;
  grammarPoint: string;
  canonicalForm: string;
  senseKey: string;
  sortOrder: number;
};

export type ComparisonDecisionRule = {
  conditionZh: string;
  preferredMemberPosition: number;
  explanationZh: string;
};

export type ComparisonMemberDifference = {
  memberPosition: number;
  descriptionZh: string;
};

export type ComparisonMinimalPairSentence = {
  memberPosition: number;
  jp: string;
  zh: string;
  acceptable?: boolean;
  notesZh?: string;
};

export type ComparisonMinimalPair = {
  contextZh: string;
  sentences: ComparisonMinimalPairSentence[];
  explanationZh: string;
};

export type ComparisonLearnerMistake = {
  descriptionZh: string;
  correctionZh: string;
};

export type ComparisonSet = {
  id: string;
  slug: string;
  nameZh: string;
  summary: string;
  commonMeaning: string;
  decisionRules: ComparisonDecisionRule[];
  connectionDifferences: ComparisonMemberDifference[];
  registerDifferences: ComparisonMemberDifference[];
  interchangeableCases: string[];
  nonInterchangeableCases: string[];
  minimalPairExamples: ComparisonMinimalPair[];
  learnerMistakes: ComparisonLearnerMistake[];
  status: TaxonomyStatus;
  members: ComparisonSetMember[];
};

export type GrammarErrorType = {
  id: string;
  code: string;
  nameZh: string;
  description: string;
  parentId?: string | null;
  defaultSeverity: "low" | "medium" | "high" | "critical";
  status: TaxonomyStatus;
};

export type GrammarMigrationTarget = {
  kind: "comparison_set" | "error_type";
  slug: string;
  nameZh: string;
};

export type GrammarPointSummary = {
  id: string;
  grammarPoint: string;
  pointType: GrammarPointType;
  canonicalForm: string;
  senseKey: string;
  formGroupSlug?: string | null;
  status: GrammarPointStatus;
  primaryCategory: GrammarTaxonomyTag | null;
  taxonomyTags: GrammarTaxonomyTag[];
  curriculum: GrammarCurriculumPlacement | null;
  migrationTarget?: GrammarMigrationTarget | null;
  reading?: string | null;
  categoryId: string | null;
  categorySlug?: string | null;
  categoryNameZh?: string | null;
  categoryNameEn?: string | null;
  categoryGroupSlug?: string | null;
  categoryGroupNameZh?: string | null;
  categoryGroupNameEn?: string | null;
  subCategory?: string | null;
  coreMeaning: string;
  naturalTranslation?: string | null;
  structure?: string | null;
  practicality: Practicality;
  spokenOrWritten: SpokenOrWritten;
  sceneTags: GrammarTag[];
  registerTags: GrammarTag[];
  isFavorite?: boolean;
  learningStatus: ReviewStatus | null;
};

export type GrammarExample = {
  id: string;
  jp: string;
  zh?: string | null;
  sceneTag?: GrammarTag | null;
  registerTag?: GrammarTag | null;
  difficulty: number;
  naturalnessScore?: number | null;
  notes?: string | null;
};

export type SimilarGrammarRelation = {
  id: string;
  grammarPointId: string;
  similarGrammarPointId: string;
  similarGrammarPointText: string;
  differenceSummary: string;
  exampleA?: string | null;
  exampleB?: string | null;
  notes?: string | null;
};

export type GrammarPointDetail = GrammarPointSummary & {
  usage?: string | null;
  notes?: string | null;
  jlptLevel?: string | null;
  commonMistakes: string[];
  connections: GrammarConnection[];
  prerequisites: GrammarPrerequisite[];
  formSiblings: GrammarFormSibling[];
  comparisonSets: ComparisonSet[];
  examples: GrammarExample[];
  similarGrammar: SimilarGrammarRelation[];
};

export type GrammarSearchResponse = {
  items: GrammarPointSummary[];
};

export type GrammarDetailResponse = {
  grammarPoint: GrammarPointDetail;
};

export type GrammarTaxonomyResponse = {
  knowledgeDimensions: KnowledgeDimension[];
  taxonomyNodes: TaxonomyNode[];
  learningStages: LearningStage[];
  learningModules: LearningModule[];
  comparisonSets: ComparisonSet[];
  errorTypes: GrammarErrorType[];
  categoryGroups: GrammarCategoryGroup[];
  categories: GrammarCategory[];
  sceneTags: GrammarTag[];
  registerTags: GrammarTag[];
};

export type GrammarNavigationTaxonomyResponse = Pick<
  GrammarTaxonomyResponse,
  "knowledgeDimensions" | "taxonomyNodes" | "learningStages" | "learningModules"
>;

export type GrammarBootstrapResponse = {
  progress: GrammarProgressResponse;
  search: GrammarSearchResponse;
  taxonomy: GrammarNavigationTaxonomyResponse;
};

export type PracticeLevel = 1 | 2 | 3 | 4 | 5;

export type PracticeReferenceAnswer = {
  jp: string;
  zh: string;
  noteZh: string;
};

export type PracticeGenerateRequest = {
  grammarPointId: string;
  sceneTag?: GrammarSceneTag | string;
  registerTag?: GrammarRegisterTag | string;
  level?: PracticeLevel | number;
};

export type PracticeGenerateResponse = {
  prompt: string;
  referenceAnswers: PracticeReferenceAnswer[];
  hints: string[];
  grammarPoint: GrammarPointSummary;
  sceneTag?: GrammarTag | null;
  registerTag?: GrammarTag | null;
  source: "ai" | "fallback";
};

export type SentencePracticeInput = {
  userId?: string;
  grammarPointId: string;
  sentence: string;
  sceneTag?: GrammarSceneTag | string;
  registerTag?: GrammarRegisterTag | string;
  promptText?: string;
  answerContract?: unknown;
  rubric?: unknown;
};

export type AIFeedbackBetterVersion = {
  sentence: string;
  registerTag?: string | null;
  explanationZh: string;
};

export type FeedbackIssueSeverity = "low" | "medium" | "high" | "critical";

export type GrammarErrorCode =
  | "conjugation_error"
  | "connection_error"
  | "particle_error"
  | "tense_aspect_error"
  | "giving_receiving_direction_error"
  | "semantic_error"
  | "register_mismatch"
  | "collocation_error"
  | "literal_translation"
  | "unnatural_expression";

export type AIFeedbackIssue = {
  errorTypeCode: GrammarErrorCode;
  severity: FeedbackIssueSeverity;
  explanation: string;
  correction: string;
  relatedGrammarPointId: string | null;
  role?: "root" | "secondary";
  confidence?: number;
  evidenceSpan?: string | null;
  affectedDimensions?: Array<
    "grammar" | "meaning" | "naturalness" | "register" | "contextFit"
  >;
};

export type AIFeedbackResult = {
  isCorrect: boolean;
  grammarScore: number;
  meaningScore: number;
  naturalnessScore: number;
  registerScore: number;
  sceneFitScore: number;
  issues: AIFeedbackIssue[];
  explanation: string;
  nextHint: string;
  feedbackText: string;
  correctedSentence?: string | null;
  betterVersions: AIFeedbackBetterVersion[];
  mistakeTypes: string[];
  nextPracticePrompt?: string | null;
};

export type PracticeSubmitResponse = AIFeedbackResult & {
  userSentenceId: string;
  feedbackId: string;
  source: "ai" | "fallback";
};

export type FavoriteGrammarRequest = {
  userId?: string;
  grammarPointId: string;
};

export type GrammarFavoritesResponse = {
  items: GrammarPointSummary[];
};

export type ReviewStatus = "new" | "learning" | "reviewing" | "mastered";

export type GrammarReviewItem = {
  reviewRecordId: string;
  grammarPoint: GrammarPointSummary;
  status: ReviewStatus;
  mistakeCount: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
  latestSentence?: string | null;
  latestFeedback?: string | null;
  correctedSentence?: string | null;
  mistakeTypes: string[];
  issues: AIFeedbackIssue[];
  meaningScore?: number | null;
  explanation?: string | null;
  nextHint?: string | null;
  sceneTag?: GrammarTag | null;
  registerTag?: GrammarTag | null;
  objectiveProgress?: GrammarObjectiveProgress[];
  overallEstimate?: number | null;
};

export type GrammarReviewAggregateItem = {
  key: string;
  label: string;
  count: number;
  grammarPointId?: string;
  senseKey?: string;
};

export type GrammarReviewAggregations = {
  grammarPoints: GrammarReviewAggregateItem[];
  errorTypes: GrammarReviewAggregateItem[];
  scenarios: GrammarReviewAggregateItem[];
  registers: GrammarReviewAggregateItem[];
};

export type GrammarLearningObjective =
  | "meaning"
  | "form_connection"
  | "grammar_selection"
  | "register_control"
  | "collocation_naturalness"
  | "discourse_function";

export type GrammarObjectiveProgress = {
  learningObjective:
    GrammarLearningObjective;
  estimate: number;
  confidence: number;
  attempts: number;
  assistedAttempts: number;
  exposureCount: number;
  recentErrorCodes: string[];
  nextReviewAt: string | null;
};

export type GrammarObjectiveRecommendation = GrammarObjectiveProgress & {
  grammarPointId: string;
  grammarPoint: string;
  coreMeaning: string;
  senseKey: string;
  overallEstimate: number;
  overallConfidence: number;
  objectives: GrammarObjectiveProgress[];
  reasonZh: string;
};

export type GrammarReviewResponse = {
  items: GrammarReviewItem[];
  aggregations: GrammarReviewAggregations;
  objectiveRecommendations?: GrammarObjectiveRecommendation[];
};

export type GrammarProgressGroup = {
  id: string;
  slug: string;
  nameZh: string;
  nameEn: string;
  description: string;
  priority: number;
  totalCount: number;
  startedCount: number;
  masteredCount: number;
  reviewCount: number;
  favoriteCount: number;
};

export type GrammarProgressResponse = {
  totalGrammarPoints: number;
  startedCount: number;
  masteredCount: number;
  reviewCount: number;
  favoriteCount: number;
  groupProgress: GrammarProgressGroup[];
};
