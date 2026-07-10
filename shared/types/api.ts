export type WordLookupRequest = {
  word: string;
  context?: string;
  pronunciation?: string;
};

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

export type ComparisonSetMember = {
  grammarPointId: string;
  grammarPoint: string;
  canonicalForm: string;
  senseKey: string;
  sortOrder: number;
};

export type ComparisonSet = {
  id: string;
  slug: string;
  nameZh: string;
  summary: string;
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
  notes?: string | null;
  jlptLevel?: string | null;
  commonMistakes: string[];
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
  comparisonSets: ComparisonSet[];
  errorTypes: GrammarErrorType[];
  categoryGroups: GrammarCategoryGroup[];
  categories: GrammarCategory[];
  sceneTags: GrammarTag[];
  registerTags: GrammarTag[];
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
};

export type AIFeedbackBetterVersion = {
  sentence: string;
  registerTag?: string | null;
  explanationZh: string;
};

export type AIFeedbackResult = {
  isCorrect: boolean;
  grammarScore: number;
  naturalnessScore: number;
  registerScore: number;
  sceneFitScore: number;
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
};

export type GrammarReviewResponse = {
  items: GrammarReviewItem[];
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

export type AutoFilterSyncStatus =
  | "idle"
  | "pending"
  | "running"
  | "completed"
  | "failed";

export type CollectionWordSource = "manual" | "auto";

export type CollectionSummary = {
  collectionId: number;
  name: string;
  description: string;
  wordCount: number;
  createdAt: string;
  autoFilterEnabled: boolean;
  autoFilterCriteria: string;
  autoFilterSyncStatus: AutoFilterSyncStatus;
  autoFilterLastRunAt: string | null;
  autoFilterLastError: string;
  autoFilterRuleVersion: number;
  autoFilterLastSyncedRuleVersion?: number | null;
};

export type CollectionWordItem = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  source: CollectionWordSource;
  matchedRuleVersion: number | null;
};

export type DictionaryEntryCandidate = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  createdAt?: string;
};

export type DictionaryOverviewItem = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  createdAt: string;
};

export type DictionaryEntryDetail = DictionaryEntry & {
  wordId: number;
  createdAt: string;
};

export type SavedDictionaryEntry = {
  wordId: number;
  isNewEntry: boolean;
};

export type CollectionAutoFilterRule = {
  collectionId: number;
  name: string;
  autoFilterCriteria: string;
  autoFilterRuleVersion: number;
};

export type AutoFilterDictionaryEntry = {
  wordId: number;
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  examples?: DictionaryExample[];
};

export type CollectionDetail = CollectionSummary & {
  words: CollectionWordItem[];
};

export type CollectionListResponse = {
  collections: CollectionSummary[];
};

export type CollectionResponse = {
  collection: CollectionSummary;
};

export type CollectionDetailResponse = {
  collection: CollectionDetail;
};

export type AddCollectionWordRequest = {
  word: string;
  pronunciation?: string;
};

export type AddCollectionWordResponse =
  | {
      status: "added" | "already_exists";
      candidate: DictionaryEntryCandidate;
    }
  | {
      status: "requires_selection";
      candidates: DictionaryEntryCandidate[];
    };

export type AddCollectionWordsRequest = {
  wordIds: number[];
};

export type AddCollectionWordsResponse = {
  addedCount: number;
  skippedCount: number;
};

export type DictionaryOverviewResponse = {
  words: DictionaryOverviewItem[];
  nextCursor: string | null;
};

export type CreateCollectionRequest = {
  name: string;
  description?: string;
};

export type UpdateCollectionRequest = {
  name?: string;
  description?: string;
  autoFilterEnabled?: boolean;
  autoFilterCriteria?: string;
  resyncAutoFilter?: boolean;
};

export type LookupSource = "dictionary" | "ai";

export type LookupResolutionType =
  | "exact"
  | "local_base_form"
  | "ai_base_form"
  | "ai_generated";

export type LookupPersistenceStatus =
  | "saved"
  | "not_saved"
  | "not_persistable";

export type LookupExampleStatus = "ready" | "missing";

export type DictionaryExample = {
  japanese: string;
  reading: string;
  translationZh: string;
};

export type DictionaryEntry = {
  word: string;
  pronunciation: string;
  meaningZh: string;
  partOfSpeech: string;
  examples: DictionaryExample[];
};

export type WordLookupResponse = {
  word: string;
  lookupWord: string;
  lookupReason?: string;
  source: LookupSource;
  entry: DictionaryEntry;
  entries?: DictionaryEntry[];
  metadata?: {
    resolutionType: LookupResolutionType;
    isContextual: boolean;
    persistenceStatus: LookupPersistenceStatus;
    selectedPronunciation: string;
    exampleStatus: LookupExampleStatus;
  };
};
