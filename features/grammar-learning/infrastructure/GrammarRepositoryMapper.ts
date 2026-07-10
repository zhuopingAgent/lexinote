import {
  normalizeFeedbackSeverity,
  normalizeGrammarErrorCode,
} from "@/features/grammar-learning/domain/feedback";
import type {
  AIFeedbackIssue,
  ComparisonSet,
  ComparisonDecisionRule,
  ComparisonLearnerMistake,
  ComparisonMemberDifference,
  ComparisonMinimalPair,
  ComparisonSetMember,
  GrammarConnection,
  GrammarCurriculumPlacement,
  GrammarFormSibling,
  GrammarMigrationTarget,
  GrammarPointStatus,
  GrammarPointSummary,
  GrammarPointType,
  GrammarPrerequisite,
  GrammarReviewAggregateItem,
  GrammarReviewAggregations,
  GrammarTag,
  GrammarTaxonomyTag,
  LearningStage,
  Practicality,
  ReviewStatus,
  SpokenOrWritten,
  TaxonomyStatus,
} from "@/shared/types/grammar";
import type {
  ComparisonSetRow,
  GrammarSummaryRow,
  TagRow,
} from "@/features/grammar-learning/infrastructure/GrammarRepositoryRows";

export function toInteger(value: number | string | null | undefined, fallback = 0) {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) ? parsed : fallback;
  }

  return fallback;
}
export function toIsoString(value: string | Date | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function parseJsonArray(value: unknown): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export function parseStringArray(value: unknown): string[] {
  return parseJsonArray(value).filter((item): item is string => typeof item === "string");
}

function parseJsonObject(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  return null;
}

function parseTags(value: unknown): GrammarTag[] {
  const tags: GrammarTag[] = [];

  for (const item of parseJsonArray(value)) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const record = item as Record<string, unknown>;
    const nameEn = typeof record.nameEn === "string" ? record.nameEn : "";
    const nameZh = typeof record.nameZh === "string" ? record.nameZh : "";

    if (!nameEn || !nameZh) {
      continue;
    }

    tags.push({
      nameEn,
      nameZh,
      description:
        typeof record.description === "string" ? record.description : undefined,
      priority: toInteger(
        typeof record.priority === "number" || typeof record.priority === "string"
          ? record.priority
          : undefined
      ),
    });
  }

  return tags.sort((left, right) => (left.priority ?? 0) - (right.priority ?? 0));
}

export function parseMistakeTypes(value: unknown): string[] {
  return parseStringArray(value);
}

export function parseFeedbackIssues(options: {
  issues: unknown;
  mistakeTypes: unknown;
  fallbackExplanation?: string | null;
  fallbackCorrection?: string | null;
  grammarPointId?: string | null;
}): AIFeedbackIssue[] {
  const issues = new Map<string, AIFeedbackIssue>();

  for (const item of parseJsonArray(options.issues)) {
    const record = parseJsonObject(item);
    if (!record) {
      continue;
    }

    const errorTypeCode = normalizeGrammarErrorCode(record.errorTypeCode);
    if (!errorTypeCode || issues.has(errorTypeCode)) {
      continue;
    }

    issues.set(errorTypeCode, {
      errorTypeCode,
      severity: normalizeFeedbackSeverity(record.severity),
      explanation:
        typeof record.explanation === "string" && record.explanation
          ? record.explanation
          : options.fallbackExplanation ?? "发现需要复习的问题。",
      correction:
        typeof record.correction === "string"
          ? record.correction
          : options.fallbackCorrection ?? "",
      relatedGrammarPointId:
        typeof record.relatedGrammarPointId === "string"
          ? record.relatedGrammarPointId
          : options.grammarPointId ?? null,
    });
  }

  for (const mistakeType of parseMistakeTypes(options.mistakeTypes)) {
    const errorTypeCode = normalizeGrammarErrorCode(mistakeType);
    if (!errorTypeCode || issues.has(errorTypeCode)) {
      continue;
    }

    issues.set(errorTypeCode, {
      errorTypeCode,
      severity: "medium",
      explanation: options.fallbackExplanation ?? "发现需要复习的问题。",
      correction: options.fallbackCorrection ?? "",
      relatedGrammarPointId: options.grammarPointId ?? null,
    });
  }

  return Array.from(issues.values());
}

function parseReviewAggregateItems(value: unknown): GrammarReviewAggregateItem[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const key = typeof record.key === "string" ? record.key : "";
    const label = typeof record.label === "string" ? record.label : "";
    if (!key || !label) {
      return [];
    }

    return [
      {
        key,
        label,
        count: toInteger(
          typeof record.count === "number" || typeof record.count === "string"
            ? record.count
            : undefined
        ),
        grammarPointId:
          typeof record.grammarPointId === "string"
            ? record.grammarPointId
            : undefined,
        senseKey:
          typeof record.senseKey === "string" ? record.senseKey : undefined,
      },
    ];
  });
}

export function parseReviewAggregations(value: unknown): GrammarReviewAggregations {
  const record = parseJsonObject(value);

  return {
    grammarPoints: parseReviewAggregateItems(record?.grammarPoints),
    errorTypes: parseReviewAggregateItems(record?.errorTypes),
    scenarios: parseReviewAggregateItems(record?.scenarios),
    registers: parseReviewAggregateItems(record?.registers),
  };
}

function parsePracticality(value: string): Practicality {
  return value === "S" ||
    value === "A" ||
    value === "B" ||
    value === "C" ||
    value === "D"
    ? value
    : "B";
}

function parseSpokenOrWritten(value: string): SpokenOrWritten {
  return value === "spoken" || value === "written" || value === "both"
    ? value
    : "both";
}

export function parseReviewStatus(value: string): ReviewStatus {
  return value === "new" ||
    value === "learning" ||
    value === "reviewing" ||
    value === "mastered"
    ? value
    : "new";
}

export function parseTaxonomyStatus(value: string): TaxonomyStatus {
  return value === "hidden" || value === "deprecated" ? value : "active";
}

function parseGrammarPointStatus(value: string): GrammarPointStatus {
  return value === "migrated" || value === "hidden" || value === "deprecated"
    ? value
    : "active";
}

function parseGrammarPointType(value: string): GrammarPointType {
  return value === "conjugation" ||
    value === "sentence_pattern" ||
    value === "syntax_concept" ||
    value === "particle" ||
    value === "collocation" ||
    value === "register_concept" ||
    value === "discourse_marker"
    ? value
    : "grammar_pattern";
}

function parseTaxonomyTag(value: unknown): GrammarTaxonomyTag | null {
  const record = parseJsonObject(value);
  if (!record) {
    return null;
  }

  const id = typeof record.id === "string" ? record.id : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  const dimensionId =
    typeof record.dimensionId === "string" ? record.dimensionId : "";
  const dimensionSlug =
    typeof record.dimensionSlug === "string" ? record.dimensionSlug : "";
  const dimensionNameZh =
    typeof record.dimensionNameZh === "string" ? record.dimensionNameZh : "";
  const dimensionNameEn =
    typeof record.dimensionNameEn === "string" ? record.dimensionNameEn : "";
  const nameZh = typeof record.nameZh === "string" ? record.nameZh : "";
  const nameEn = typeof record.nameEn === "string" ? record.nameEn : "";

  if (
    !id ||
    !slug ||
    !dimensionId ||
    !dimensionSlug ||
    !dimensionNameZh ||
    !dimensionNameEn ||
    !nameZh ||
    !nameEn
  ) {
    return null;
  }

  return {
    id,
    slug,
    dimensionId,
    dimensionSlug,
    dimensionNameZh,
    dimensionNameEn,
    nameZh,
    nameEn,
    displayOrder: toInteger(
      typeof record.displayOrder === "number" || typeof record.displayOrder === "string"
        ? record.displayOrder
        : undefined
    ),
  };
}

function parseTaxonomyTags(value: unknown): GrammarTaxonomyTag[] {
  return parseJsonArray(value)
    .map((item) => parseTaxonomyTag(item))
    .filter((item): item is GrammarTaxonomyTag => item !== null);
}

function parseLearningStage(value: unknown): LearningStage | null {
  const record = parseJsonObject(value);
  if (!record) {
    return null;
  }

  const id = typeof record.id === "string" ? record.id : "";
  const slug = typeof record.slug === "string" ? record.slug : "";
  const nameZh = typeof record.nameZh === "string" ? record.nameZh : "";
  const description =
    typeof record.description === "string" ? record.description : "";

  if (!id || !slug || !nameZh) {
    return null;
  }

  return {
    id,
    slug,
    nameZh,
    description,
    displayOrder: toInteger(
      typeof record.displayOrder === "number" ||
        typeof record.displayOrder === "string"
        ? record.displayOrder
        : undefined
    ),
    status: parseTaxonomyStatus(
      typeof record.status === "string" ? record.status : "active"
    ),
  };
}

function parseCurriculum(value: unknown): GrammarCurriculumPlacement | null {
  const record = parseJsonObject(value);
  const stage = record ? parseLearningStage(record.stage) : null;
  if (!record || !stage) {
    return null;
  }

  return {
    stage,
    level: toInteger(
      typeof record.level === "number" || typeof record.level === "string"
        ? record.level
        : undefined
    ),
    recommendedOrder: toInteger(
      typeof record.recommendedOrder === "number" ||
        typeof record.recommendedOrder === "string"
        ? record.recommendedOrder
        : undefined
    ),
  };
}

export function parseConnections(value: unknown): GrammarConnection[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const baseType = record.baseType;
    const requiredForm =
      typeof record.requiredForm === "string" ? record.requiredForm : "";
    const pattern = typeof record.pattern === "string" ? record.pattern : "";
    if (
      (baseType !== "verb" &&
        baseType !== "i_adjective" &&
        baseType !== "na_adjective" &&
        baseType !== "noun" &&
        baseType !== "clause") ||
      !requiredForm ||
      !pattern
    ) {
      return [];
    }

    return [
      {
        baseType,
        requiredForm,
        pattern,
        notes: typeof record.notes === "string" ? record.notes : "",
        sortOrder: toInteger(
          typeof record.sortOrder === "number" ||
            typeof record.sortOrder === "string"
            ? record.sortOrder
            : undefined
        ),
      },
    ];
  });
}

export function parsePrerequisites(value: unknown): GrammarPrerequisite[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const grammarPointId =
      typeof record.grammarPointId === "string" ? record.grammarPointId : "";
    const grammarPoint =
      typeof record.grammarPoint === "string" ? record.grammarPoint : "";
    const canonicalForm =
      typeof record.canonicalForm === "string" ? record.canonicalForm : "";
    const senseKey = typeof record.senseKey === "string" ? record.senseKey : "";
    const relationType = record.relationType;
    if (
      !grammarPointId ||
      !grammarPoint ||
      !canonicalForm ||
      !senseKey ||
      (relationType !== "required" && relationType !== "recommended")
    ) {
      return [];
    }

    return [{ grammarPointId, grammarPoint, canonicalForm, senseKey, relationType }];
  });
}

export function parseFormSiblings(value: unknown): GrammarFormSibling[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const id = typeof record.id === "string" ? record.id : "";
    const grammarPoint =
      typeof record.grammarPoint === "string" ? record.grammarPoint : "";
    const canonicalForm =
      typeof record.canonicalForm === "string" ? record.canonicalForm : "";
    const senseKey = typeof record.senseKey === "string" ? record.senseKey : "";
    const coreMeaning =
      typeof record.coreMeaning === "string" ? record.coreMeaning : "";
    if (!id || !grammarPoint || !canonicalForm || !senseKey || !coreMeaning) {
      return [];
    }

    return [
      {
        id,
        grammarPoint,
        canonicalForm,
        senseKey,
        coreMeaning,
        status: parseGrammarPointStatus(
          typeof record.status === "string" ? record.status : "active"
        ),
      },
    ];
  });
}

function parseMigrationTarget(value: unknown): GrammarMigrationTarget | null {
  const record = parseJsonObject(value);
  if (!record) {
    return null;
  }

  const kind = record.kind;
  const slug = typeof record.slug === "string" ? record.slug : "";
  const nameZh = typeof record.nameZh === "string" ? record.nameZh : "";

  if ((kind !== "comparison_set" && kind !== "error_type") || !slug || !nameZh) {
    return null;
  }

  return { kind, slug, nameZh };
}

function parseComparisonMembers(value: unknown): ComparisonSetMember[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const grammarPointId =
      typeof record.grammarPointId === "string" ? record.grammarPointId : "";
    const grammarPoint =
      typeof record.grammarPoint === "string" ? record.grammarPoint : "";
    const canonicalForm =
      typeof record.canonicalForm === "string" ? record.canonicalForm : "";
    const senseKey = typeof record.senseKey === "string" ? record.senseKey : "";

    if (!grammarPointId || !grammarPoint || !canonicalForm || !senseKey) {
      return [];
    }

    return [
      {
        grammarPointId,
        grammarPoint,
        canonicalForm,
        senseKey,
        sortOrder: toInteger(
          typeof record.sortOrder === "number" || typeof record.sortOrder === "string"
            ? record.sortOrder
            : undefined
        ),
      },
    ];
  });
}

function parseComparisonDecisionRules(value: unknown): ComparisonDecisionRule[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const conditionZh =
      typeof record.conditionZh === "string" ? record.conditionZh : "";
    const explanationZh =
      typeof record.explanationZh === "string" ? record.explanationZh : "";
    const preferredMemberPosition = toInteger(
      typeof record.preferredMemberPosition === "number" ||
        typeof record.preferredMemberPosition === "string"
        ? record.preferredMemberPosition
        : undefined
    );

    return conditionZh && explanationZh && preferredMemberPosition > 0
      ? [{ conditionZh, preferredMemberPosition, explanationZh }]
      : [];
  });
}

function parseComparisonDifferences(value: unknown): ComparisonMemberDifference[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const descriptionZh =
      typeof record.descriptionZh === "string" ? record.descriptionZh : "";
    const memberPosition = toInteger(
      typeof record.memberPosition === "number" ||
        typeof record.memberPosition === "string"
        ? record.memberPosition
        : undefined
    );

    return descriptionZh && memberPosition > 0
      ? [{ memberPosition, descriptionZh }]
      : [];
  });
}

function parseComparisonMinimalPairs(value: unknown): ComparisonMinimalPair[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const contextZh = typeof record.contextZh === "string" ? record.contextZh : "";
    const explanationZh =
      typeof record.explanationZh === "string" ? record.explanationZh : "";
    const sentences = parseJsonArray(record.sentences).flatMap((sentenceItem) => {
      const sentence = parseJsonObject(sentenceItem);
      if (!sentence) {
        return [];
      }

      const memberPosition = toInteger(
        typeof sentence.memberPosition === "number" ||
          typeof sentence.memberPosition === "string"
          ? sentence.memberPosition
          : undefined
      );
      const jp = typeof sentence.jp === "string" ? sentence.jp : "";
      const zh = typeof sentence.zh === "string" ? sentence.zh : "";

      return memberPosition > 0 && jp && zh
        ? [
            {
              memberPosition,
              jp,
              zh,
              acceptable:
                typeof sentence.acceptable === "boolean"
                  ? sentence.acceptable
                  : undefined,
              notesZh:
                typeof sentence.notesZh === "string"
                  ? sentence.notesZh
                  : undefined,
            },
          ]
        : [];
    });

    return contextZh && explanationZh && sentences.length > 0
      ? [{ contextZh, sentences, explanationZh }]
      : [];
  });
}

function parseComparisonLearnerMistakes(value: unknown): ComparisonLearnerMistake[] {
  return parseJsonArray(value).flatMap((item) => {
    const record = parseJsonObject(item);
    if (!record) {
      return [];
    }

    const descriptionZh =
      typeof record.descriptionZh === "string" ? record.descriptionZh : "";
    const correctionZh =
      typeof record.correctionZh === "string" ? record.correctionZh : "";

    return descriptionZh && correctionZh ? [{ descriptionZh, correctionZh }] : [];
  });
}

export function mapComparisonSetRow(row: ComparisonSetRow): ComparisonSet {
  return {
    id: row.id,
    slug: row.slug,
    nameZh: row.name_zh,
    summary: row.summary,
    commonMeaning: row.common_meaning,
    decisionRules: parseComparisonDecisionRules(row.decision_rules),
    connectionDifferences: parseComparisonDifferences(
      row.connection_differences
    ),
    registerDifferences: parseComparisonDifferences(row.register_differences),
    interchangeableCases: parseStringArray(row.interchangeable_cases),
    nonInterchangeableCases: parseStringArray(row.non_interchangeable_cases),
    minimalPairExamples: parseComparisonMinimalPairs(row.minimal_pair_examples),
    learnerMistakes: parseComparisonLearnerMistakes(row.learner_mistakes),
    status: parseTaxonomyStatus(row.status),
    members: parseComparisonMembers(row.members),
  };
}

export function mapTagRow(row: TagRow): GrammarTag {
  return {
    nameEn: row.name_en,
    nameZh: row.name_zh,
    description: row.description ?? undefined,
    priority: toInteger(row.priority),
  };
}

export function mapSummaryRow(row: GrammarSummaryRow): GrammarPointSummary {
  return {
    id: row.id,
    grammarPoint: row.grammar_point,
    pointType: parseGrammarPointType(row.point_type),
    canonicalForm: row.canonical_form,
    senseKey: row.sense_key,
    formGroupSlug: row.form_group_slug,
    status: parseGrammarPointStatus(row.status),
    primaryCategory: parseTaxonomyTag(row.primary_category),
    taxonomyTags: parseTaxonomyTags(row.taxonomy_tags),
    curriculum: parseCurriculum(row.curriculum),
    migrationTarget: parseMigrationTarget(row.migration_target),
    reading: row.reading,
    categoryId: row.category_id,
    categorySlug: row.category_slug,
    categoryNameZh: row.category_name_zh,
    categoryNameEn: row.category_name_en,
    categoryGroupSlug: row.category_group_slug,
    categoryGroupNameZh: row.category_group_name_zh,
    categoryGroupNameEn: row.category_group_name_en,
    subCategory: row.sub_category,
    coreMeaning: row.core_meaning,
    naturalTranslation: row.natural_translation,
    structure: row.structure,
    practicality: parsePracticality(row.practicality),
    spokenOrWritten: parseSpokenOrWritten(row.spoken_or_written),
    sceneTags: parseTags(row.scene_tags),
    registerTags: parseTags(row.register_tags),
    isFavorite: row.is_favorite,
  };
}
