import type {
  DictionaryEntry,
  WordLookupResponse,
} from "@/shared/types/dictionary";

export function isIncompleteLookupResult(result: WordLookupResponse | null) {
  return result?.metadata?.persistenceStatus === "not_persistable";
}

export function buildLookupStatusBadges(result: WordLookupResponse | null) {
  if (!result) {
    return [];
  }

  const metadata = result.metadata;
  const isIncomplete = isIncompleteLookupResult(result);
  const badges = [
    result.source === "dictionary"
      ? "本地词库"
      : isIncomplete
        ? "未找到词条"
        : "AI 生成",
  ];

  if (metadata?.resolutionType === "local_base_form") {
    badges.push("本地原形还原");
  } else if (metadata?.resolutionType === "ai_base_form") {
    badges.push("AI 原形还原");
  } else if (metadata?.resolutionType === "ai_generated") {
    badges.push(isIncomplete ? "内容待补全" : "AI 补全词条");
  }

  if (metadata?.isContextual) {
    badges.push("按语境处理");
  }

  if (metadata?.persistenceStatus === "saved") {
    badges.push("已保存");
  } else if (metadata?.persistenceStatus === "not_saved") {
    badges.push("未保存");
  } else if (metadata?.persistenceStatus === "not_persistable") {
    badges.push("暂不可保存");
  }

  badges.push(
    metadata?.exampleStatus === "missing"
      ? isIncomplete
        ? "暂无例句"
        : "例句待生成"
      : "例句已就绪"
  );

  return badges;
}

export function getLookupEntryCollectionState(
  entry: DictionaryEntry,
  result: WordLookupResponse | null
) {
  if (!result) {
    return {
      canAddToCollection: false,
      addDisabledReason: "当前没有可添加的查询结果。",
    };
  }

  const isPrimaryEntry =
    entry.word === result.entry.word &&
    entry.pronunciation === result.entry.pronunciation;
  const persistenceStatus = result.metadata?.persistenceStatus;

  if (isPrimaryEntry && persistenceStatus === "not_saved") {
    return {
      canAddToCollection: false,
      addDisabledReason: "当前语境结果尚未保存，暂不能加入单词本。",
    };
  }

  if (isPrimaryEntry && persistenceStatus === "not_persistable") {
    return {
      canAddToCollection: false,
      addDisabledReason: "当前结果还不是可保存词条，暂不能加入单词本。",
    };
  }

  return {
    canAddToCollection:
      result.source === "dictionary" || persistenceStatus === "saved",
    addDisabledReason: "请先保存或生成完整词条后再加入单词本。",
  };
}
