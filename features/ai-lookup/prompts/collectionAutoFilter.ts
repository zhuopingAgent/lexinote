import type {
  AutoFilterDictionaryEntry,
  CollectionAutoFilterRule,
} from "@/shared/types/api";

function sanitizeExamples(entry: AutoFilterDictionaryEntry) {
  return (entry.examples ?? []).slice(0, 3).map((example) => ({
    japanese: example.japanese,
    translationZh: example.translationZh,
  }));
}

export function buildEntryCollectionAutoFilterPrompt(
  entry: AutoFilterDictionaryEntry,
  collections: CollectionAutoFilterRule[]
) {
  return `
请根据下面这个日语词条的信息，判断它应该自动加入哪些 collection。

判断原则：
1. 只根据词条本身的词义、词性和例句判断。
2. collection 名称和筛选条件要同时参考，但以筛选条件为主。
3. 不确定时宁可不选，不要勉强归类。
4. 只返回 collectionId，不要解释。

词条 JSON：
${JSON.stringify(
  {
    wordId: entry.wordId,
    word: entry.word,
    pronunciation: entry.pronunciation,
    partOfSpeech: entry.partOfSpeech,
    meaningZh: entry.meaningZh,
    examples: sanitizeExamples(entry),
  },
  null,
  2
)}

候选 collections JSON：
${JSON.stringify(collections, null, 2)}

只返回这样的 JSON：
{"matchingCollectionIds":[1,2]}
`.trim();
}

export function buildCollectionBackfillPrompt(
  collection: CollectionAutoFilterRule,
  entries: AutoFilterDictionaryEntry[]
) {
  return `
请根据 collection 的筛选条件，从候选日语词条中挑出应该自动加入这个 collection 的词条。

判断原则：
1. 只根据词条本身的词义、词性和例句判断。
2. 不确定时宁可不选。
3. 不要扩展、不解释，只返回 wordId。

collection JSON：
${JSON.stringify(collection, null, 2)}

候选词条 JSON：
${JSON.stringify(
  entries.map((entry) => ({
    wordId: entry.wordId,
    word: entry.word,
    pronunciation: entry.pronunciation,
    partOfSpeech: entry.partOfSpeech,
    meaningZh: entry.meaningZh,
    examples: sanitizeExamples(entry),
  })),
  null,
  2
)}

只返回这样的 JSON：
{"matchingWordIds":[11,15]}
`.trim();
}
