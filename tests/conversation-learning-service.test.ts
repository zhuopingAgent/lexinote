import { describe, expect, it, vi } from "vitest";
import { ConversationLearningService } from "@/features/conversation/application/ConversationLearningService";
import { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import type { ConversationLearningItem } from "@/shared/types/conversation";
import { ValidationError } from "@/shared/utils/errors";

const ITEM_ID = "11111111-1111-4111-8111-111111111111";
const SESSION_ID = "22222222-2222-4222-8222-222222222222";
const GRAMMAR_POINT_ID = "33333333-3333-4333-8333-333333333333";

function learningItem(
  overrides: Partial<ConversationLearningItem> = {}
): ConversationLearningItem {
  return {
    id: ITEM_ID,
    sessionId: SESSION_ID,
    sourceMessageId: "44444444-4444-4444-8444-444444444444",
    kind: "vocabulary",
    surfaceForm: "抱く",
    reading: null,
    meaningZh: "抱；怀有",
    explanationZh: "根据读音意义不同",
    sourceExcerpt: "不安を抱いています",
    status: "suggested",
    grammarCandidates: [],
    wordId: null,
    grammarPointId: null,
    collectionId: null,
    errorMessage: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const candidates = [
  {
    wordId: 11,
    word: "抱く",
    pronunciation: "だく",
    meaningZh: "抱住",
    partOfSpeech: "动词",
  },
  {
    wordId: 12,
    word: "抱く",
    pronunciation: "いだく",
    meaningZh: "怀有",
    partOfSpeech: "动词",
  },
];

function makeService(input?: {
  item?: ConversationLearningItem;
  findCandidates?: ReturnType<typeof vi.fn>;
  saveEntry?: ReturnType<typeof vi.fn>;
  lookupWord?: ReturnType<typeof vi.fn>;
  addWord?: ReturnType<typeof vi.fn>;
  updateItem?: ReturnType<typeof vi.fn>;
  addToReview?: ReturnType<typeof vi.fn>;
}) {
  const item = input?.item ?? learningItem();
  const repository = {
    findLearningItem: vi.fn().mockResolvedValue(item),
    getPreferences: vi.fn().mockResolvedValue({ defaultCollectionId: 7 }),
    updateLearningItem:
      input?.updateItem ??
      vi.fn().mockImplementation((update) =>
        Promise.resolve({
          ...item,
          status: update.status,
          wordId: update.wordId ?? null,
          grammarPointId: update.grammarPointId ?? null,
          collectionId: update.collectionId ?? null,
        })
      ),
  };
  const vocabulary = {
    findEntryCandidates:
      input?.findCandidates ?? vi.fn().mockResolvedValue([candidates[1]]),
    saveEntry:
      input?.saveEntry ??
      vi.fn().mockResolvedValue({ wordId: 13, isNewEntry: false }),
  };
  const lookup = {
    lookupWord:
      input?.lookupWord ??
      vi.fn().mockResolvedValue({
        lookupWord: item.surfaceForm,
        entry: {
          word: item.surfaceForm,
          pronunciation: item.reading ?? "",
          meaningZh: item.meaningZh,
          partOfSpeech: "短语",
          examples: [],
        },
        metadata: { persistenceStatus: "not_persistable" },
      }),
  };
  const collectionWords = {
    addWord:
      input?.addWord ??
      vi.fn().mockResolvedValue({ status: "added", candidate: candidates[1] }),
  };
  const grammar = { addToReview: input?.addToReview ?? vi.fn() };
  return {
    service: new ConversationLearningService(
      repository as never,
      vocabulary as never,
      lookup as never,
      collectionWords as never,
      grammar as never
    ),
    repository,
    vocabulary,
    lookup,
    collectionWords,
    grammar,
  };
}

describe("ConversationLearningService", () => {
  it("rejects malformed learning item ids before repository access", async () => {
    const { service, repository } = makeService();

    await expect(service.promote("not-an-id", {})).rejects.toBeInstanceOf(
      ValidationError
    );
    expect(repository.findLearningItem).not.toHaveBeenCalled();
  });

  it("requires an explicit reading when a word has multiple local entries", async () => {
    const findCandidates = vi.fn().mockResolvedValue(candidates);
    const { service, collectionWords, repository } = makeService({
      item: learningItem({ reading: "いだく" }),
      findCandidates,
    });

    await expect(service.promote(ITEM_ID, { collectionId: 7 })).resolves.toEqual({
      item: learningItem({ reading: "いだく" }),
      requiresSelection: true,
      pronunciationCandidates: candidates,
    });
    expect(collectionWords.addWord).not.toHaveBeenCalled();
    expect(repository.updateLearningItem).not.toHaveBeenCalled();
  });

  it("completes and persists a missing dictionary entry before adding it", async () => {
    const findCandidates = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([candidates[1]]);
    const addWord = vi
      .fn()
      .mockResolvedValue({ status: "already_exists", candidate: candidates[1] });
    const { service, lookup, repository } = makeService({
      findCandidates,
      addWord,
    });

    const result = await service.promote(ITEM_ID, {
      collectionId: 7,
      pronunciation: "いだく",
    });

    expect(lookup.lookupWord).toHaveBeenCalledWith("抱く");
    expect(addWord).toHaveBeenCalledWith(7, "抱く", "いだく");
    expect(repository.updateLearningItem).toHaveBeenCalledWith(
      expect.objectContaining({
        itemId: ITEM_ID,
        status: "saved",
        wordId: 12,
        collectionId: 7,
      })
    );
    expect(result.item.status).toBe("saved");
  });

  it("stores a newly generated fixed expression with its dictionary category", async () => {
    const item = learningItem({
      kind: "expression",
      surfaceForm: "お世話になる",
      reading: "おせわになる",
      meaningZh: "在这句话里承蒙关照",
    });
    const expressionCandidate = {
      wordId: 13,
      word: "お世話になる",
      pronunciation: "おせわになる",
      meaningZh: "承蒙照顾",
      partOfSpeech: "固定表达/搭配",
    };
    const findCandidates = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([expressionCandidate]);
    const saveEntry = vi
      .fn()
      .mockResolvedValue({ wordId: 13, isNewEntry: false });
    const lookupWord = vi.fn().mockResolvedValue({
      lookupWord: "お世話になる",
      entry: {
        word: "お世話になる",
        pronunciation: "おせわになる",
        meaningZh: "承蒙照顾",
        partOfSpeech: "短语",
        examples: [
          {
            japanese: "いつもお世話になっております。",
            reading: "いつもおせわになっております。",
            translationZh: "一直以来承蒙关照。",
          },
        ],
      },
      metadata: { persistenceStatus: "saved" },
    });
    const { service } = makeService({
      item,
      findCandidates,
      saveEntry,
      lookupWord,
    });

    await service.promote(ITEM_ID, { collectionId: 7 });

    expect(saveEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        word: "お世話になる",
        meaningZh: "承蒙照顾",
        partOfSpeech: "固定表达/搭配",
      })
    );
    expect(saveEntry).not.toHaveBeenCalledWith(
      expect.objectContaining({ meaningZh: item.meaningZh })
    );
  });

  it("binds a selected grammar sense and adds it to review", async () => {
    const item = learningItem({
      kind: "grammar",
      surfaceForm: "〜ていただけますか",
      status: "needs_review",
    });
    const addToReview = vi.fn().mockResolvedValue(undefined);
    const { service, repository } = makeService({ item, addToReview });

    const result = await service.promote(ITEM_ID, {
      grammarPointId: GRAMMAR_POINT_ID,
    });

    expect(addToReview).toHaveBeenCalledWith({
      userId: "00000000-0000-0000-0000-000000000001",
      grammarPointId: GRAMMAR_POINT_ID,
      source: { learningItemId: ITEM_ID, sessionId: SESSION_ID },
    });
    expect(repository.updateLearningItem).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "saved",
        grammarPointId: GRAMMAR_POINT_ID,
      })
    );
    expect(result.item.status).toBe("saved");
  });

  it("adds conversation grammar without fabricating a mistake", async () => {
    const repository = {
      findGrammarPointById: vi.fn().mockResolvedValue({ id: GRAMMAR_POINT_ID }),
      addReviewRecordFromConversation: vi.fn().mockResolvedValue(undefined),
      updateReviewRecord: vi.fn(),
      logLearningHistory: vi.fn().mockResolvedValue(undefined),
    };
    const service = new GrammarLearningService(repository as never, {} as never);

    await service.addToReview({
      grammarPointId: GRAMMAR_POINT_ID,
      source: { learningItemId: ITEM_ID, sessionId: SESSION_ID },
    });

    expect(repository.addReviewRecordFromConversation).toHaveBeenCalledWith(
      "00000000-0000-0000-0000-000000000001",
      GRAMMAR_POINT_ID
    );
    expect(repository.updateReviewRecord).not.toHaveBeenCalled();
    expect(repository.logLearningHistory).toHaveBeenCalledWith(
      expect.objectContaining({ activityType: "conversation_grammar_saved" })
    );
  });
});
