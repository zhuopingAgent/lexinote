import { CollectionRepository } from "@/features/collections/infrastructure/CollectionRepository";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import type {
  AddCollectionWordResponse,
  AddCollectionWordsResponse,
  DictionaryEntryCandidate,
} from "@/shared/types/api";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

export class CollectionWordService {
  constructor(
    private readonly collectionRepository: CollectionRepository,
    private readonly dictionaryService: JapaneseDictionaryService
  ) {}

  private selectCandidate(
    candidates: DictionaryEntryCandidate[],
    pronunciation?: string
  ) {
    if (!pronunciation) {
      return candidates[0];
    }

    return candidates.find((candidate) => candidate.pronunciation === pronunciation);
  }

  async addWord(
    collectionId: number,
    rawWord: string,
    rawPronunciation?: string
  ): Promise<AddCollectionWordResponse> {
    const word = rawWord.trim();
    const pronunciation = rawPronunciation?.trim() || undefined;

    if (!word) {
      throw new ValidationError("请输入要添加的单词。");
    }

    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    const candidates = await this.dictionaryService.findEntryCandidates(word);
    if (candidates.length === 0) {
      throw new ValidationError("本地词典里还没有这个单词，请先查询一次再添加。");
    }

    if (!pronunciation && candidates.length > 1) {
      return {
        status: "requires_selection",
        candidates,
      };
    }

    const candidate = this.selectCandidate(candidates, pronunciation);
    if (!candidate) {
      throw new ValidationError("未找到对应读音的词条。");
    }

    const status = await this.collectionRepository.addWordToCollection(
      collectionId,
      candidate.wordId
    );

    return {
      status,
      candidate,
    };
  }

  async addWordsByIds(
    collectionId: number,
    rawWordIds: number[]
  ): Promise<AddCollectionWordsResponse> {
    if (!Array.isArray(rawWordIds) || rawWordIds.length === 0) {
      throw new ValidationError("请至少选择一个词条。");
    }

    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    const uniqueWordIds = Array.from(
      new Set(
        rawWordIds.filter((wordId) => Number.isInteger(wordId) && wordId > 0)
      )
    );

    if (uniqueWordIds.length === 0) {
      throw new ValidationError("请选择有效的词条后再添加。");
    }

    const addedCount = await this.collectionRepository.addWordsToCollection(
      collectionId,
      uniqueWordIds
    );

    return {
      addedCount,
      skippedCount: uniqueWordIds.length - addedCount,
    };
  }

  async removeWord(collectionId: number, wordId: number): Promise<void> {
    if (!Number.isInteger(wordId) || wordId <= 0) {
      throw new ValidationError("请选择有效的词条后再移除。");
    }

    const collection = await this.collectionRepository.findById(collectionId);
    if (!collection) {
      throw new NotFoundError("未找到这个 collection。");
    }

    const removed = await this.collectionRepository.removeWordFromCollection(
      collectionId,
      wordId
    );

    if (!removed) {
      throw new NotFoundError("这个词条不在当前 collection 中。");
    }
  }
}
