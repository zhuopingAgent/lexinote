import {
  MAX_ANALYSIS_ITEMS,
  canonicalizeConversationGrammarSurface,
  isLowValueConversationGrammar,
  normalizeConversationGrammarForm,
} from "@/features/conversation/domain/model";
import type { ConversationAnalysisLearningItem } from "@/features/conversation/domain/structured-output";
import type { ConversationMessage } from "@/shared/types/conversation";

type HighConfidenceGrammarPattern = {
  pattern: RegExp;
  coveredPattern: RegExp;
  assistantPattern: RegExp | null;
  surfaceForm: string;
  meaningZh: string;
  explanationZh: string;
  includeAssistantSource?: boolean;
};

const HIGH_CONFIDENCE_GRAMMAR_PATTERNS: readonly HighConfidenceGrammarPattern[] = [
  {
    pattern: /[^\s。、！？「」]{1,20}(?<!から)(?<!て)(?<!で)(?<!ば)こそ/u,
    coveredPattern: /こそ/u,
    assistantPattern: null,
    surfaceForm: "〜こそ",
    meaningZh: "正是……/这次一定……",
    explanationZh: "把前接成分作为焦点加以强调，并常暗含与其他情况的对比。",
  },
  {
    pattern:
      /(?:て|で)み(?:ませんでした|ました|ません|ます|なかった|ない|よう|たい|る|た|て)(?:よ|ね)?/,
    coveredPattern:
      /(?:て|で)み(?:ませんでした|ました|ません|ます|なかった|ない|よう|たい|る|た|て)(?:よ|ね)?/,
    assistantPattern: null,
    surfaceForm: "〜てみる",
    meaningZh: "试着……",
    explanationZh: "接在动词て形后，表示尝试做某事并观察结果。",
  },
  {
    pattern: /[^\s。、！？「」]{1,20}いでした/,
    coveredPattern: /(?:いでした|かったです|い形容[詞词].*过去)/,
    assistantPattern: /かったです/,
    surfaceForm: "い形容词过去形",
    meaningZh: "表示い形容词的过去状态",
    explanationZh: "将词尾「い」变为「かった」，礼貌表达再接「です」。",
  },
  {
    pattern: /[~～〜]わけではない/,
    coveredPattern: /[~～〜]?わけではない/,
    assistantPattern: null,
    surfaceForm: "〜わけではない",
    meaningZh: "并不是……/并非……",
    explanationZh: "否定从前文可能推导出的过度结论，表示并非完全如此。",
  },
  {
    pattern: /(?:た|だ)ほうがよさそう(?:です|だ)?/,
    coveredPattern: /(?:た|だ)?ほうが(?:よさそう(?:です|だ)?|いい)/,
    assistantPattern: null,
    surfaceForm: "〜たほうがいい",
    meaningZh: "最好……",
    explanationZh: "用过去形接「ほうがいい」，表示建议采取某个做法。",
  },
  {
    pattern: /(?:て|で)もよろしいでしょうか/,
    coveredPattern: /(?:て|で)もよろしいでしょうか/,
    assistantPattern: null,
    surfaceForm: "〜てもよろしいでしょうか",
    meaningZh: "可以……吗",
    explanationZh: "郑重询问自己或己方是否可以进行某个动作。",
    includeAssistantSource: true,
  },
  {
    pattern: /(?:て|で)もらいましたです/,
    coveredPattern: /(?:て|で)もら(?:いましたです|いました|う)/,
    assistantPattern: /(?:て|で)もらいました(?:。|$)/,
    surfaceForm: "〜てもらう",
    meaningZh: "请别人做某事并接受其帮助",
    explanationZh:
      "动词て形后接「もらう」表示接受别人为自己做某事；礼貌过去式是「てもらいました」。",
  },
  {
    pattern: /(?:て|で)いただけますか/,
    coveredPattern: /(?:て|で)いただけますか/,
    assistantPattern: null,
    surfaceForm: "〜ていただけますか",
    meaningZh: "能请您……吗",
    explanationZh: "以谦让授受形式郑重请求对方做某事。",
    includeAssistantSource: true,
  },
  {
    pattern: /ないことには/,
    coveredPattern: /ないことには/,
    assistantPattern: null,
    surfaceForm: "〜ないことには",
    meaningZh: "如果不……就不能……",
    explanationZh:
      "表示前项是后项成立的必要条件，后项通常是否定、困难或无法判断的内容。",
  },
] as const;

export function extractExplicitConversationGrammarForms(content: string) {
  const requests: Array<{ surfaceForm: string; sourceExcerpt: string }> = [];
  const seen = new Set<string>();
  for (const match of content.matchAll(/[「『]([~～〜][^」』\r\n]{1,60})[」』]/g)) {
    const sourceExcerpt = match[1]?.trim() ?? "";
    const surfaceForm = canonicalizeConversationGrammarSurface(sourceExcerpt);
    const key = normalizeConversationGrammarForm(surfaceForm);
    if (!surfaceForm || seen.has(key)) continue;
    seen.add(key);
    requests.push({ surfaceForm, sourceExcerpt });
  }
  return requests;
}

function extractExplicitGrammarRequests(userTexts: string[]) {
  return userTexts.flatMap(extractExplicitConversationGrammarForms);
}

function extractExplicitVocabularyRequests(
  userTexts: string[],
  assistantTexts: string[]
) {
  const meaningZh = assistantTexts
    .map(
      (content) =>
        content.match(
          /(?:中国語|中文)(?:で|是|叫)[「『“"]([^」』”"]{1,80})[」』”"]/
        )?.[1] ?? ""
    )
    .find(Boolean);
  const requests: Array<{
    surfaceForm: string;
    sourceExcerpt: string;
    meaningZh: string;
  }> = [];
  const seen = new Set<string>();
  for (const content of userTexts) {
    if (
      !/(?:中国語|中文|汉语).*(?:何と|怎么|如何|意思|意味)|(?:何と|怎么|如何).*(?:中国語|中文|汉语)/.test(
        content
      )
    ) {
      continue;
    }
    for (const match of content.matchAll(/[「『]([^」』\r\n]{1,60})[」』]/g)) {
      const surfaceForm = match[1]?.trim() ?? "";
      const key = surfaceForm.normalize("NFKC").toLowerCase();
      if (!surfaceForm || /^[~～〜]/.test(surfaceForm) || seen.has(key)) {
        continue;
      }
      seen.add(key);
      requests.push({
        surfaceForm,
        sourceExcerpt: surfaceForm,
        meaningZh: meaningZh || "本轮明确询问的词汇",
      });
    }
  }
  return requests;
}

function findNaAdjectivePastCorrection(
  userTexts: string[],
  assistantTexts: string[]
) {
  const incorrectEnding = "かったです";
  for (const userText of userTexts) {
    let searchFrom = 0;
    while (searchFrom < userText.length) {
      const index = userText.indexOf(incorrectEnding, searchFrom);
      if (index < 0) break;
      const correctedText = `${userText.slice(0, index)}でした${userText.slice(
        index + incorrectEnding.length
      )}`;
      if (assistantTexts.some((content) => content.includes(correctedText))) {
        return userText
          .slice(Math.max(0, index - 80), index + incorrectEnding.length)
          .trim();
      }
      searchFrom = index + incorrectEnding.length;
    }
  }
  return null;
}

export function reconcileConversationGrammarLearningItems<
  T extends { learningItems: ConversationAnalysisLearningItem[] },
>(
  analysis: T,
  messages: ConversationMessage[]
): Omit<T, "learningItems"> & {
  learningItems: ConversationAnalysisLearningItem[];
} {
  const userTexts = messages
    .filter((message) => message.role === "user")
    .map((message) => message.content);
  const assistantTexts = messages
    .filter((message) => message.role === "assistant")
    .map((message) => message.content);
  let learningItems = [...analysis.learningItems];
  let changed = false;

  const filteredLearningItems = learningItems.filter(
    (item) =>
      item.kind !== "grammar" ||
      !isLowValueConversationGrammar(item.surfaceForm)
  );
  if (filteredLearningItems.length !== learningItems.length) {
    learningItems = filteredLearningItems;
    changed = true;
  }

  for (const grammar of HIGH_CONFIDENCE_GRAMMAR_PATTERNS) {
    const sourceTexts = grammar.includeAssistantSource
      ? [...userTexts, ...assistantTexts]
      : userTexts;
    const sourceExcerpt = sourceTexts
      .map((content) => content.match(grammar.pattern)?.[0] ?? "")
      .find(Boolean);
    if (!sourceExcerpt) continue;
    if (
      grammar.assistantPattern &&
      !assistantTexts.some((content) => grammar.assistantPattern?.test(content))
    ) {
      continue;
    }

    const normalizedGrammar = normalizeConversationGrammarForm(
      grammar.surfaceForm
    );
    learningItems = learningItems.filter((item) => {
      if (
        item.kind === "grammar" &&
        (normalizeConversationGrammarForm(item.surfaceForm) ===
          normalizedGrammar ||
          [item.surfaceForm, item.sourceExcerpt, item.explanationZh].some(
            (value) => grammar.coveredPattern.test(value)
          ))
      ) {
        return false;
      }
      if (item.kind !== "expression" && item.kind !== "vocabulary") return true;
      return ![item.surfaceForm, item.sourceExcerpt].some((value) =>
        grammar.coveredPattern.test(value)
      );
    });
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: grammar.surfaceForm,
      reading: null,
      meaningZh: grammar.meaningZh,
      explanationZh: grammar.explanationZh,
      sourceExcerpt,
    });
    changed = true;
  }

  const naAdjectivePastSource = findNaAdjectivePastCorrection(
    userTexts,
    assistantTexts
  );
  if (naAdjectivePastSource) {
    learningItems = learningItems.filter((item) => {
      const values = [item.surfaceForm, item.sourceExcerpt, item.explanationZh];
      return !values.some(
        (value) =>
          /な形容[詞词].*过去/.test(value) ||
          (value.includes("かった") && value.includes("でした"))
      );
    });
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: "な形容词过去形",
      reading: null,
      meaningZh: "表示な形容词的过去状态",
      explanationZh: "词干后接「でした」；不能像い形容词一样变成「かったです」。",
      sourceExcerpt: naAdjectivePastSource,
    });
    changed = true;
  }

  for (const request of extractExplicitGrammarRequests(userTexts)) {
    const normalizedGrammar = normalizeConversationGrammarForm(
      request.surfaceForm
    );
    const matchingItems = learningItems.filter(
      (item) =>
        item.kind === "grammar" &&
        normalizeConversationGrammarForm(item.surfaceForm) === normalizedGrammar
    );
    if (matchingItems.length > 0) {
      const preferred = matchingItems[0];
      learningItems = learningItems.filter(
        (item) =>
          item.kind !== "grammar" ||
          normalizeConversationGrammarForm(item.surfaceForm) !== normalizedGrammar
      );
      learningItems.unshift({
        ...preferred,
        surfaceForm: request.surfaceForm,
        reading: null,
        sourceExcerpt: request.sourceExcerpt,
      });
      changed =
        changed ||
        matchingItems.length > 1 ||
        preferred.surfaceForm !== request.surfaceForm ||
        preferred.reading !== null ||
        preferred.sourceExcerpt !== request.sourceExcerpt;
      continue;
    }
    learningItems.unshift({
      kind: "grammar",
      surfaceForm: request.surfaceForm,
      reading: null,
      meaningZh: "本轮明确询问的语法",
      explanationZh: "用户明确询问了该语法的用法，可绑定现有语法义项继续复习。",
      sourceExcerpt: request.sourceExcerpt,
    });
    changed = true;
  }

  const explicitVocabularyRequests = extractExplicitVocabularyRequests(
    userTexts,
    assistantTexts
  );
  if (explicitVocabularyRequests.length > 0) {
    const requestedSurfaces = new Set(
      explicitVocabularyRequests.map((request) =>
        request.surfaceForm.normalize("NFKC").toLowerCase()
      )
    );
    const requestedVocabularyOnly = learningItems.filter(
      (item) =>
        item.kind === "vocabulary" &&
        requestedSurfaces.has(item.surfaceForm.normalize("NFKC").toLowerCase())
    );
    if (requestedVocabularyOnly.length !== learningItems.length) {
      learningItems = requestedVocabularyOnly;
      changed = true;
    }
  }

  for (const request of explicitVocabularyRequests) {
    const normalizedSurface = request.surfaceForm
      .normalize("NFKC")
      .toLowerCase();
    if (
      learningItems.some(
        (item) =>
          item.kind === "vocabulary" &&
          item.surfaceForm.normalize("NFKC").toLowerCase() === normalizedSurface
      )
    ) {
      continue;
    }
    learningItems.unshift({
      kind: "vocabulary",
      surfaceForm: request.surfaceForm,
      reading: null,
      meaningZh: request.meaningZh,
      explanationZh: "用户在本轮明确询问了这个词的中文含义。",
      sourceExcerpt: request.sourceExcerpt,
    });
    changed = true;
  }

  if (!changed) return analysis;
  return {
    ...analysis,
    learningItems: learningItems.slice(0, MAX_ANALYSIS_ITEMS),
  };
}
