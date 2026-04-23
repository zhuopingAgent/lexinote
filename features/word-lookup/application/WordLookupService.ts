import { AIWordLookupService } from "@/features/ai-lookup/application/AIWordLookupService";
import { CollectionAutoFilterJobService } from "@/features/collections/application/CollectionAutoFilterJobService";
import { JapaneseDictionaryService } from "@/features/japanese-dictionary/application/JapaneseDictionaryService";
import type { WordLookupResponse } from "@/shared/types/api";
import { ValidationError } from "@/shared/utils/errors";

export class WordLookupService {
  private static readonly INSTRUCTIONAL_CONTEXT_PATTERNS = [
    /(?:请|請|希望|想要|我想|帮我|幫我).{0,12}(?:解释|解釈|说明|説明|例句|例文|区别|區別|違い|ニュアンス|简单|簡單|簡単|日常会话|日常會話|日常会話|商务|商務|ビジネス)/,
    /(?:解释|解釈|说明|説明).{0,12}(?:简单|簡單|簡単|一下|区别|區別|違い|ニュアンス|对比|比較)?/,
    /(?:例句|例文).{0,12}(?:偏|风格|風格|スタイル|日常|会话|會話|会話|商务|商務|ビジネス|简单|簡單|簡単|更多|少一点)/,
    /(?:区别|區別|違い|ニュアンス|对比|比較).{0,12}(?:解释|解釈|说明|説明|一下|整理)?/,
    /(?:请用|請用|偏|更偏|寄り).{0,12}(?:日常|会话|會話|会話|商务|商務|ビジネス|简单|簡單|簡単|口语|口語)/,
  ] as const;

  constructor(
    private readonly dictionaryService: JapaneseDictionaryService,
    private readonly aiWordLookupService: AIWordLookupService,
    private readonly collectionAutoFilterJobService?: CollectionAutoFilterJobService
  ) {}

  private buildLookupResult(
    word: string,
    lookupWord: string,
    source: WordLookupResponse["source"],
    entry: WordLookupResponse["entry"],
    lookupReason?: string,
    entries?: WordLookupResponse["entries"]
  ): WordLookupResponse {
    const candidateEntries = this.buildEntriesWithPrimaryEntry(entry, entries);

    return {
      word,
      lookupWord,
      source,
      entry,
      ...(lookupReason ? { lookupReason } : {}),
      ...(candidateEntries ? { entries: candidateEntries } : {}),
    };
  }

  private buildEntriesWithPrimaryEntry(
    primaryEntry: WordLookupResponse["entry"],
    entries?: WordLookupResponse["entries"]
  ) {
    if (!entries || entries.length <= 1) {
      return undefined;
    }

    const mergedEntries = [
      primaryEntry,
      ...entries.filter(
        (entry) => entry.pronunciation !== primaryEntry.pronunciation
      ),
    ];

    return mergedEntries.length > 1 ? mergedEntries : undefined;
  }

  private selectEntry(
    entries: WordLookupResponse["entry"][],
    pronunciation?: string
  ) {
    if (!pronunciation) {
      return entries[0];
    }

    return (
      entries.find((entry) => entry.pronunciation === pronunciation) ?? entries[0]
    );
  }

  private normalizeComparableText(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "")
      .replace(/[，。、！？；;,.!?（）()「」『』【】]/g, "");
  }

  private isInstructionalContext(context: string) {
    const normalizedContext = context.replace(/\s+/g, "").toLowerCase();

    return WordLookupService.INSTRUCTIONAL_CONTEXT_PATTERNS.some((pattern) =>
      pattern.test(normalizedContext)
    );
  }

  private extractContextTokens(context: string, lookupWord: string) {
    const normalizedLookupWord = this.normalizeComparableText(lookupWord);
    const rawSegments = context
      .split(/[\s，。、！？；;,.!?（）()「」『』【】/]+/)
      .flatMap((segment) =>
        segment.split(/(?:から|まで|より|って|を|が|に|へ|と|で|や|の|も|は|か|な|ね|よ)/)
      )
      .map((segment) => segment.trim())
      .filter(Boolean);

    return Array.from(
      new Set(
        rawSegments.filter((segment) => {
          const normalizedSegment = this.normalizeComparableText(segment);
          return (
            normalizedSegment.length >= 2 &&
            normalizedSegment !== normalizedLookupWord
          );
        })
      )
    );
  }

  private scoreEntryAgainstContext(
    entry: WordLookupResponse["entry"],
    context: string,
    lookupWord: string
  ) {
    const normalizedContext = this.normalizeComparableText(context);
    const normalizedMeaning = this.normalizeComparableText(entry.meaningZh);
    const normalizedExamples = entry.examples.map((example) => ({
      japanese: this.normalizeComparableText(example.japanese),
      reading: this.normalizeComparableText(example.reading),
      translation: this.normalizeComparableText(example.translationZh),
    }));

    let score = 0;

    if (normalizedContext) {
      if (normalizedMeaning.includes(normalizedContext)) {
        score += 8;
      }

      if (
        normalizedExamples.some(
          (example) =>
            example.japanese.includes(normalizedContext) ||
            example.reading.includes(normalizedContext) ||
            example.translation.includes(normalizedContext)
        )
      ) {
        score += 10;
      }
    }

    const tokens = this.extractContextTokens(context, lookupWord);
    for (const token of tokens) {
      const normalizedToken = this.normalizeComparableText(token);

      if (normalizedMeaning.includes(normalizedToken)) {
        score += 4;
      }

      if (
        normalizedExamples.some(
          (example) =>
            example.japanese.includes(normalizedToken) ||
            example.translation.includes(normalizedToken)
        )
      ) {
        score += 4;
      }

      if (
        normalizedExamples.some((example) =>
          example.reading.includes(normalizedToken)
        )
      ) {
        score += 2;
      }
    }

    return score;
  }

  private resolveContextSelection(
    entries: WordLookupResponse["entry"][],
    context: string,
    lookupWord: string,
    pronunciation?: string
  ) {
    if (entries.length === 0) {
      return {
        selectedEntry: undefined,
        rankedEntries: entries,
        isConfident: false,
      };
    }

    if (pronunciation) {
      const selectedEntry = this.selectEntry(entries, pronunciation);
      const rankedEntries = [
        selectedEntry,
        ...entries.filter((entry) => entry.pronunciation !== selectedEntry.pronunciation),
      ];

      return {
        selectedEntry,
        rankedEntries,
        isConfident: true,
      };
    }

    const rankedEntries = entries
      .map((entry) => ({
        entry,
        score: this.scoreEntryAgainstContext(entry, context, lookupWord),
      }))
      .sort((left, right) => right.score - left.score);

    const bestMatch = rankedEntries[0];
    const secondBestScore = rankedEntries[1]?.score ?? 0;

    return {
      selectedEntry: bestMatch.entry,
      rankedEntries: rankedEntries.map((item) => item.entry),
      isConfident:
        bestMatch.score >= 4 && bestMatch.score >= secondBestScore + 2,
    };
  }

  private joinLookupReasons(...reasons: Array<string | undefined>) {
    const uniqueReasons = Array.from(
      new Set(reasons.map((reason) => reason?.trim()).filter(Boolean))
    );

    return uniqueReasons.length > 0 ? uniqueReasons.join(" ") : undefined;
  }

  private toComparableKana(text: string) {
    return text
      .trim()
      .replace(/\s+/g, "")
      .replace(/[ァ-ヶ]/g, (character) =>
        String.fromCharCode(character.charCodeAt(0) - 0x60)
      );
  }

  private getDictionaryFormKanaSuffix(word: string) {
    const match = word.match(/[ぁ-ゖァ-ヶー]+$/);
    return match ? this.toComparableKana(match[0]) : "";
  }

  private hasDictionaryFormPronunciation(word: string, pronunciation: string) {
    const normalizedPronunciation = this.toComparableKana(pronunciation);
    const kanaSuffix = this.getDictionaryFormKanaSuffix(word);

    if (!normalizedPronunciation) {
      return false;
    }

    if (!kanaSuffix) {
      return true;
    }

    return normalizedPronunciation.endsWith(kanaSuffix);
  }

  private normalizeEntryPronunciation(
    lookupWord: string,
    entry: WordLookupResponse["entry"],
    fallbackPronunciation?: string
  ) {
    if (this.hasDictionaryFormPronunciation(lookupWord, entry.pronunciation)) {
      return entry;
    }

    if (!fallbackPronunciation) {
      return entry;
    }

    return {
      ...entry,
      pronunciation: fallbackPronunciation,
    };
  }

  private async persistEntryIfNeeded(
    entry: WordLookupResponse["entry"],
    lookupWord: string,
    context?: string
  ) {
    if (entry.examples.length === 0 || context) {
      return;
    }

    if (!this.hasDictionaryFormPronunciation(lookupWord, entry.pronunciation)) {
      return;
    }

    const savedEntry = await this.dictionaryService.saveEntry(entry);

    if (!savedEntry.isNewEntry) {
      return;
    }

    await this.collectionAutoFilterJobService?.enqueueEntryClassification(savedEntry.wordId);
  }

  private async getGenericEntry(
    lookupWord: string,
    existingEntry?: WordLookupResponse["entry"],
    shouldPersist = true
  ) {
    if (existingEntry?.examples.length) {
      return existingEntry;
    }

    const genericEntry = await this.aiWordLookupService.completeEntry(
      lookupWord,
      existingEntry
    );

    const normalizedEntry = this.normalizeEntryPronunciation(
      lookupWord,
      genericEntry,
      existingEntry?.pronunciation
    );

    if (shouldPersist) {
      await this.persistEntryIfNeeded(normalizedEntry, lookupWord);
    }

    return normalizedEntry;
  }

  private async getContextualEntry(
    lookupWord: string,
    genericEntry: WordLookupResponse["entry"],
    context: string
  ) {
    return this.aiWordLookupService.completeEntry(lookupWord, genericEntry, context);
  }

  private async buildContextAwareResult(
    word: string,
    lookupWord: string,
    source: WordLookupResponse["source"],
    context: string,
    existingEntry?: WordLookupResponse["entry"],
    lookupReason?: string,
    entries?: WordLookupResponse["entries"]
  ): Promise<WordLookupResponse> {
    const shouldPersistGenericEntryImmediately = Boolean(existingEntry);
    const genericEntry = await this.getGenericEntry(
      lookupWord,
      existingEntry,
      shouldPersistGenericEntryImmediately
    );
    const rawContextualEntry = await this.getContextualEntry(
      lookupWord,
      genericEntry,
      context
    );
    const contextualEntry = this.normalizeEntryPronunciation(
      lookupWord,
      rawContextualEntry,
      genericEntry.pronunciation
    );

    const reconciledEntry = await this.aiWordLookupService.reconcileEntries(
      lookupWord,
      genericEntry,
      contextualEntry,
      context
    );
    const normalizedReconciledEntry = reconciledEntry
      ? this.normalizeEntryPronunciation(
          lookupWord,
          reconciledEntry,
          genericEntry.pronunciation
        )
      : null;

    if (normalizedReconciledEntry) {
      await this.persistEntryIfNeeded(normalizedReconciledEntry, lookupWord);
    } else if (!shouldPersistGenericEntryImmediately) {
      await this.persistEntryIfNeeded(genericEntry, lookupWord);
    }

    if (contextualEntry.pronunciation !== genericEntry.pronunciation) {
      return this.buildLookupResult(
        word,
        lookupWord,
        source,
        contextualEntry,
        lookupReason,
        entries
      );
    }

    return this.buildLookupResult(
      word,
      lookupWord,
      source,
      normalizedReconciledEntry ?? contextualEntry,
      lookupReason,
      entries
    );
  }

  async lookupWord(
    rawWord: string,
    rawContext?: string,
    rawPronunciation?: string
  ): Promise<WordLookupResponse> {
    const word = rawWord.trim();
    const context = rawContext?.trim() || undefined;
    const pronunciation = rawPronunciation?.trim() || undefined;
    if (!word) {
      throw new ValidationError("word is required");
    }

    const entries = await this.dictionaryService.findEntries(word);
    const entry = this.selectEntry(entries, pronunciation);

    if (entry) {
      if (context) {
        if (entries.length > 1) {
          const selection = this.resolveContextSelection(
            entries,
            context,
            word,
            pronunciation
          );
          const selectedEntry = selection.selectedEntry ?? entries[0];

          if (!selection.isConfident) {
            return this.buildLookupResult(
              word,
              word,
              "dictionary",
              selectedEntry,
              "参考语境后仍有多个可能词条，请先选择更符合的一项。",
              selection.rankedEntries
            );
          }

          if (
            selectedEntry.examples.length > 0 &&
            !pronunciation &&
            !this.isInstructionalContext(context)
          ) {
            return this.buildLookupResult(
              word,
              word,
              "dictionary",
              selectedEntry,
              undefined,
              selection.rankedEntries
            );
          }

          return this.buildContextAwareResult(
            word,
            word,
            "dictionary",
            context,
            selectedEntry,
            undefined,
            selection.rankedEntries
          );
        }

        if (entry.examples.length > 0 && !this.isInstructionalContext(context)) {
          return this.buildLookupResult(word, word, "dictionary", entry);
        }

        return this.buildContextAwareResult(
          word,
          word,
          "dictionary",
          context,
          entry
        );
      }

      if (entries.length > 1) {
        return this.buildLookupResult(
          word,
          word,
          "dictionary",
          entry,
          undefined,
          entries
        );
      }

      if (entry.examples.length > 0) {
        return this.buildLookupResult(word, word, "dictionary", entry);
      }

      const completedEntry = await this.aiWordLookupService.completeEntry(
        word,
        entry,
        context
      );
      const normalizedCompletedEntry = this.normalizeEntryPronunciation(
        word,
        completedEntry,
        entry.pronunciation
      );
      await this.persistEntryIfNeeded(normalizedCompletedEntry, word, context);

      return this.buildLookupResult(
        word,
        word,
        "dictionary",
        normalizedCompletedEntry
      );
    }

    const resolved = await this.aiWordLookupService.resolveLookupWord(word, context);
    const resolvedLookupWord = resolved?.lookupWord.trim() || word;
    const lookupReason =
      resolved && resolvedLookupWord !== word ? resolved.lookupReason : undefined;

    if (resolvedLookupWord !== word) {
      const resolvedEntries = await this.dictionaryService.findEntries(resolvedLookupWord);
      const resolvedEntry = this.selectEntry(resolvedEntries, pronunciation);

      if (resolvedEntry) {
        if (context) {
          if (resolvedEntries.length > 1) {
            const selection = this.resolveContextSelection(
              resolvedEntries,
              context,
              resolvedLookupWord,
              pronunciation
            );
            const selectedEntry = selection.selectedEntry ?? resolvedEntries[0];

            if (!selection.isConfident) {
              return this.buildLookupResult(
                word,
                resolvedLookupWord,
                "dictionary",
                selectedEntry,
                this.joinLookupReasons(
                  lookupReason,
                  "参考语境后仍有多个可能词条，请先选择更符合的一项。"
                ),
                selection.rankedEntries
              );
            }

            if (
              selectedEntry.examples.length > 0 &&
              !pronunciation &&
              !this.isInstructionalContext(context)
            ) {
              return this.buildLookupResult(
                word,
                resolvedLookupWord,
                "dictionary",
                selectedEntry,
                lookupReason,
                selection.rankedEntries
              );
            }

            return this.buildContextAwareResult(
              word,
              resolvedLookupWord,
              "dictionary",
              context,
              selectedEntry,
              lookupReason,
              selection.rankedEntries
            );
          }

          if (
            resolvedEntry.examples.length > 0 &&
            !this.isInstructionalContext(context)
          ) {
            return this.buildLookupResult(
              word,
              resolvedLookupWord,
              "dictionary",
              resolvedEntry,
              lookupReason
            );
          }

          return this.buildContextAwareResult(
            word,
            resolvedLookupWord,
            "dictionary",
            context,
            resolvedEntry,
            lookupReason
          );
        }

        if (resolvedEntries.length > 1) {
          return this.buildLookupResult(
            word,
            resolvedLookupWord,
            "dictionary",
            resolvedEntry,
            lookupReason,
            resolvedEntries
          );
        }

        if (resolvedEntry.examples.length > 0) {
          return this.buildLookupResult(
            word,
            resolvedLookupWord,
            "dictionary",
            resolvedEntry,
            lookupReason
          );
        }

        const completedResolvedEntry = await this.aiWordLookupService.completeEntry(
          resolvedLookupWord,
          resolvedEntry,
          context
        );
        const normalizedCompletedResolvedEntry = this.normalizeEntryPronunciation(
          resolvedLookupWord,
          completedResolvedEntry,
          resolvedEntry.pronunciation
        );
        await this.persistEntryIfNeeded(
          normalizedCompletedResolvedEntry,
          resolvedLookupWord,
          context
        );

        return this.buildLookupResult(
          word,
          resolvedLookupWord,
          "dictionary",
          normalizedCompletedResolvedEntry,
          lookupReason
        );
      }
    }

    if (context) {
      return this.buildContextAwareResult(
        word,
        resolvedLookupWord,
        "ai",
        context,
        undefined,
        lookupReason
      );
    }

    const completedEntry = await this.aiWordLookupService.completeEntry(
      resolvedLookupWord,
      undefined,
      context
    );

    await this.persistEntryIfNeeded(completedEntry, resolvedLookupWord, context);

    return this.buildLookupResult(
      word,
      resolvedLookupWord,
      "ai",
      completedEntry,
      lookupReason
    );
  }
}
