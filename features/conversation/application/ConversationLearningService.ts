import type { CollectionWordService } from "@/features/collections/application/CollectionWordService";
import type { GrammarLearningService } from "@/features/grammar-learning/application/GrammarLearningService";
import type { VocabularyCoreService } from "@/features/vocabulary-core/application/VocabularyCoreService";
import type { WordLookupService } from "@/features/word-lookup/application/WordLookupService";
import type {
  ConversationLearningItemStore,
  ConversationSessionStore,
} from "@/features/conversation/application/ports";
import { assertUuid } from "@/features/conversation/domain/validation";
import { DEFAULT_GRAMMAR_USER_ID } from "@/shared/db/sql/grammar.sql";
import type {
  PromoteConversationLearningItemRequest,
  PromoteConversationLearningItemResponse,
} from "@/shared/types/conversation";
import { NotFoundError, ValidationError } from "@/shared/utils/errors";

export class ConversationLearningService {
  constructor(
    private readonly repository: ConversationLearningItemStore &
      ConversationSessionStore,
    private readonly vocabularyCoreService: VocabularyCoreService,
    private readonly wordLookupService: WordLookupService,
    private readonly collectionWordService: CollectionWordService,
    private readonly grammarLearningService: GrammarLearningService
  ) {}

  async promote(
    itemId: string,
    input: PromoteConversationLearningItemRequest,
    userId = DEFAULT_GRAMMAR_USER_ID
  ): Promise<PromoteConversationLearningItemResponse> {
    assertUuid(itemId, "itemId");
    const item = await this.repository.findLearningItem(itemId, userId);
    if (!item) {
      throw new NotFoundError("未找到这个学习项。");
    }

    if (item.status === "saved") {
      return { item };
    }

    if (item.kind === "grammar") {
      const grammarPointId = input.grammarPointId?.trim();
      if (!grammarPointId) {
        throw new ValidationError("请选择要加入复习的具体语法义项。");
      }

      await this.grammarLearningService.addToReview({
        userId,
        grammarPointId,
        source: {
          learningItemId: item.id,
          sessionId: item.sessionId,
        },
      });
      const savedItem = await this.repository.updateLearningItem({
        itemId,
        userId,
        status: "saved",
        grammarPointId,
      });
      if (!savedItem) {
        throw new NotFoundError("未找到这个学习项。");
      }
      return { item: savedItem };
    }

    const preferences = await this.repository.getPreferences(userId);
    const collectionId = input.collectionId ?? preferences.defaultCollectionId;
    if (!collectionId || !Number.isInteger(collectionId) || collectionId <= 0) {
      throw new ValidationError("请选择要加入的单词本。");
    }

    let candidates = await this.vocabularyCoreService.findEntryCandidates(
      item.surfaceForm
    );
    if (candidates.length === 0) {
      const lookupResult = await this.wordLookupService.lookupWord(
        item.surfaceForm
      );
      if (
        item.kind === "expression" &&
        lookupResult.entry.word === item.surfaceForm &&
        lookupResult.metadata?.persistenceStatus === "saved"
      ) {
        await this.vocabularyCoreService.saveEntry({
          ...lookupResult.entry,
          word: item.surfaceForm,
          partOfSpeech: "固定表达/搭配",
        });
      }
      candidates = await this.vocabularyCoreService.findEntryCandidates(
        item.surfaceForm
      );
    }

    if (candidates.length === 0) {
      throw new ValidationError("暂时无法生成可保存的标准词条。");
    }

    const requestedPronunciation = input.pronunciation?.trim() || "";
    const selectedCandidate = requestedPronunciation
      ? candidates.find(
          (candidate) => candidate.pronunciation === requestedPronunciation
        )
      : candidates.length === 1
        ? candidates[0]
        : null;

    if (!selectedCandidate) {
      return {
        item,
        requiresSelection: true,
        pronunciationCandidates: candidates,
      };
    }

    const result = await this.collectionWordService.addWord(
      collectionId,
      selectedCandidate.word,
      selectedCandidate.pronunciation
    );
    if (result.status === "requires_selection") {
      return {
        item,
        requiresSelection: true,
        pronunciationCandidates: result.candidates,
      };
    }

    const savedItem = await this.repository.updateLearningItem({
      itemId,
      userId,
      status: "saved",
      wordId: selectedCandidate.wordId,
      collectionId,
    });
    if (!savedItem) {
      throw new NotFoundError("未找到这个学习项。");
    }

    return { item: savedItem };
  }

  async dismiss(itemId: string, userId = DEFAULT_GRAMMAR_USER_ID) {
    assertUuid(itemId, "itemId");
    const item = await this.repository.updateLearningItem({
      itemId,
      userId,
      status: "dismissed",
    });
    if (!item) {
      throw new NotFoundError("未找到这个学习项。");
    }
    return item;
  }

  async listGrammarInbox(userId = DEFAULT_GRAMMAR_USER_ID) {
    return this.repository.listReviewInbox(userId);
  }
}
