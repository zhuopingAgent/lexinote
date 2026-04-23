import { describe, expect, it, vi } from "vitest";
import { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

describe("CollectionWordService", () => {
  it("returns candidates when the local dictionary has multiple entries", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordToCollection: vi.fn(),
    };
    const dictionaryService = {
      findEntryCandidates: vi.fn().mockResolvedValue([
        {
          wordId: 11,
          word: "抱く",
          pronunciation: "だく",
          meaningZh: "抱住；拥抱",
          partOfSpeech: "动词",
        },
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ]),
    };

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWord(3, "抱く")).resolves.toEqual({
      status: "requires_selection",
      candidates: [
        {
          wordId: 11,
          word: "抱く",
          pronunciation: "だく",
          meaningZh: "抱住；拥抱",
          partOfSpeech: "动词",
        },
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ],
    });
    expect(collectionRepository.addWordToCollection).not.toHaveBeenCalled();
  });

  it("adds the selected candidate to the collection", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordToCollection: vi.fn().mockResolvedValue("added"),
    };
    const dictionaryService = {
      findEntryCandidates: vi.fn().mockResolvedValue([
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ]),
    };

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWord(3, "抱く", "いだく")).resolves.toEqual({
      status: "added",
      candidate: {
        wordId: 12,
        word: "抱く",
        pronunciation: "いだく",
        meaningZh: "怀有；心存",
        partOfSpeech: "动词",
      },
    });
    expect(collectionRepository.addWordToCollection).toHaveBeenCalledWith(3, 12);
  });

  it("returns already_exists when the same word is already in the collection", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordToCollection: vi.fn().mockResolvedValue("already_exists"),
    };
    const dictionaryService = {
      findEntryCandidates: vi.fn().mockResolvedValue([
        {
          wordId: 12,
          word: "抱く",
          pronunciation: "いだく",
          meaningZh: "怀有；心存",
          partOfSpeech: "动词",
        },
      ]),
    };

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWord(3, "抱く", "いだく")).resolves.toEqual({
      status: "already_exists",
      candidate: {
        wordId: 12,
        word: "抱く",
        pronunciation: "いだく",
        meaningZh: "怀有；心存",
        partOfSpeech: "动词",
      },
    });
    expect(collectionRepository.addWordToCollection).toHaveBeenCalledWith(3, 12);
  });

  it("throws when the word is not in the local dictionary", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
    };
    const dictionaryService = {
      findEntryCandidates: vi.fn().mockResolvedValue([]),
    };

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWord(3, "未知語")).rejects.toBeInstanceOf(
      ValidationError
    );
  });

  it("throws when the collection does not exist", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue(null),
    };
    const dictionaryService = {
      findEntryCandidates: vi.fn(),
    };

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWord(99, "抱く")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("adds multiple word ids to a collection", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordsToCollection: vi.fn().mockResolvedValue(2),
    };
    const dictionaryService = {};

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWordsByIds(3, [11, 12, 12])).resolves.toEqual({
      addedCount: 2,
      skippedCount: 0,
    });
    expect(collectionRepository.addWordsToCollection).toHaveBeenCalledWith(3, [11, 12]);
  });

  it("reports all selected ids as skipped when they already exist in the collection", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordsToCollection: vi.fn().mockResolvedValue(0),
    };
    const dictionaryService = {};

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWordsByIds(3, [11, 12])).resolves.toEqual({
      addedCount: 0,
      skippedCount: 2,
    });
    expect(collectionRepository.addWordsToCollection).toHaveBeenCalledWith(3, [11, 12]);
  });

  it("throws a readable error when all word ids are invalid", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      addWordsToCollection: vi.fn(),
    };
    const dictionaryService = {};

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.addWordsByIds(3, [0, -1, Number.NaN])).rejects.toMatchObject({
      message: "请选择有效的词条后再添加。",
    });
    expect(collectionRepository.addWordsToCollection).not.toHaveBeenCalled();
  });

  it("removes a word from the collection", async () => {
    const collectionRepository = {
      findById: vi.fn().mockResolvedValue({
        collectionId: 3,
        name: "JLPT N3",
      }),
      removeWordFromCollection: vi.fn().mockResolvedValue(true),
    };
    const dictionaryService = {};

    const service = new CollectionWordService(
      collectionRepository as never,
      dictionaryService as never
    );

    await expect(service.removeWord(3, 12)).resolves.toBeUndefined();
    expect(collectionRepository.removeWordFromCollection).toHaveBeenCalledWith(3, 12);
  });
});
