import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { AnswerContract } from "@/features/grammar-learning/domain/practiceV2";

export type AnswerEquivalenceResult = {
  equivalent: boolean;
  confidence: number;
  matchedVariant: string | null;
  grammarFeatureSatisfied: boolean;
  failedGrammarFeatures: string[];
  registerSatisfied: boolean;
  matchedContentAnchors: string[];
  reasonZh: string;
};

const CONTENT_STOP_WORDS = new Set([
  "今日", "明日", "昨日", "今回", "現在", "本当", "一度", "もう一度",
  "します", "しました", "できます", "あります", "います", "ください",
]);

function normalizeJapanese(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\s。、，：；！？!?「」『』（）()]/g, "")
    .replace(/^(?:すみません|申し訳ありません|恐れ入りますが)/, "")
    .trim();
}

function formFragments(grammarPoint: GrammarPointDetail) {
  const canonical = grammarPoint.canonicalForm ?? grammarPoint.grammarPoint;
  const fragments = canonical
    .replace(/[〜~]/g, "")
    .split(/[A-ZＡ-Ｚ]+/)
    .flatMap((fragment) => [
      fragment,
      fragment.replace(/^[はがをにへでとからまでより]+/, ""),
    ])
    .map(normalizeJapanese)
    .filter((fragment) => fragment.length >= 2);
  const connectionFragments = (grammarPoint.connections ?? [])
    .flatMap((connection) => connection.pattern.split(/[+＋/]/))
    .map((fragment) =>
      normalizeJapanese(
        fragment.replace(/^(?:V|A|N|动词|名词|普通形|て形|た形|ない形)+/i, "")
      )
    )
    .filter((fragment) => fragment.length >= 2 && /[ぁ-んァ-ン一-龯]/.test(fragment));
  return Array.from(new Set([...fragments, ...connectionFragments]));
}

function contentAnchors(variants: string[], grammarPoint: GrammarPointDetail) {
  const formTokens = new Set(formFragments(grammarPoint));
  const counts = new Map<string, number>();
  for (const variant of variants) {
    const tokens = variant.match(/[一-龯々]{2,}|[ァ-ヶー]{3,}/g) ?? [];
    for (const token of new Set(tokens)) {
      if (!CONTENT_STOP_WORDS.has(token) && !formTokens.has(normalizeJapanese(token))) {
        counts.set(token, (counts.get(token) ?? 0) + 1);
      }
    }
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1] || right[0].length - left[0].length)
    .slice(0, 4)
    .map(([token]) => token);
}

function detectRegister(sentence: string) {
  if (/(?:いただけます|いただけません|ございます|おります|申し上げます|いたします)/.test(sentence)) {
    return "business" as const;
  }
  if (/(?:です|ます|ません|ください|でしょう)(?:か)?[。？！!?]?$/.test(sentence)) {
    return "polite" as const;
  }
  return "casual" as const;
}

function registerIsAllowed(
  detected: ReturnType<typeof detectRegister>,
  allowed: AnswerContract["allowedRegisterRange"]
) {
  if (allowed.includes(detected)) return true;
  return detected === "business" && allowed.includes("polite");
}

function targetFormSatisfied(
  sentence: string,
  grammarPoint: GrammarPointDetail
) {
  const canonical = (grammarPoint.canonicalForm ?? grammarPoint.grammarPoint)
    .replace(/[〜~]/g, "")
    .trim();

  if (canonical === "Aがあります") {
    return /(?:が|は)[^。？！!?]*あります/.test(sentence);
  }
  if (canonical === "Aがいます") {
    return /(?:が|は)[^。？！!?]*います/.test(sentence);
  }
  if (canonical === "AはBです") {
    return /は[^。？！!?]+です(?:[。？！!?]|$)/.test(sentence);
  }
  if (canonical === "てもらえますか") {
    return /(?:て|で)もらえますか(?:[。？！!?]|$)/.test(sentence);
  }
  if (canonical === "ていただけますか") {
    return /(?:て|で)いただけますか(?:[。？！!?]|$)/.test(sentence);
  }
  if (/^[はがをにへでとも]$/.test(canonical)) {
    return sentence.includes(canonical);
  }

  const fragments = formFragments(grammarPoint);
  return fragments.length === 0 || fragments.some((fragment) => sentence.includes(fragment));
}

function requiredFeatureSatisfied(input: {
  feature: string;
  sentence: string;
  grammarPoint: GrammarPointDetail;
}) {
  const { feature, sentence, grammarPoint } = input;
  if (feature.startsWith("grammar_point:")) return true;
  if (feature.startsWith("sense:") || feature === "target-sense") {
    return targetFormSatisfied(sentence, grammarPoint);
  }
  if (feature.startsWith("connection:")) {
    return targetFormSatisfied(sentence, grammarPoint);
  }

  switch (feature) {
    case "location-ni":
      return /に[^。？！!?]*(?:が|は)[^。？！!?]*(?:あります|います)/.test(sentence);
    case "subject-ga":
      return /が[^。？！!?]*(?:あります|います)/.test(sentence);
    case "existence-predicate":
      return /(?:あります|います)(?:[。？！!?]|$)/.test(sentence);
    case "te-form-request":
    case "listener-benefit-direction":
      return /(?:て|で)(?:もらえますか|いただけますか)(?:[。？！!?]|$)/.test(sentence);
    case "structured-connection":
      return targetFormSatisfied(sentence, grammarPoint);
    default:
      return true;
  }
}

export function evaluateAnswerEquivalence(input: {
  sentence: string;
  answerContract: AnswerContract;
  grammarPoint: GrammarPointDetail;
}): AnswerEquivalenceResult {
  const sentence = normalizeJapanese(input.sentence);
  const exactVariant = input.answerContract.allowedVariants.find(
    (variant) => normalizeJapanese(variant) === sentence
  );
  const detectedRegister = detectRegister(input.sentence);
  const registerSatisfied = registerIsAllowed(
    detectedRegister,
    input.answerContract.allowedRegisterRange
  );
  const targetSatisfied = targetFormSatisfied(input.sentence, input.grammarPoint);
  const failedGrammarFeatures = input.answerContract.requiredGrammarFeatures.filter(
    (feature) =>
      !requiredFeatureSatisfied({
        feature,
        sentence: input.sentence,
        grammarPoint: input.grammarPoint,
      })
  );
  const grammarFeatureSatisfied = targetSatisfied && failedGrammarFeatures.length === 0;

  if (exactVariant && grammarFeatureSatisfied) {
    return {
      equivalent: registerSatisfied,
      confidence: registerSatisfied ? 1 : 0.7,
      matchedVariant: exactVariant,
      grammarFeatureSatisfied: true,
      failedGrammarFeatures: [],
      registerSatisfied,
      matchedContentAnchors: [],
      reasonZh: registerSatisfied
        ? "与经过验证的自然答案等价。"
        : "内容成立，但语体不在本题允许范围内。",
    };
  }

  const anchors = contentAnchors(
    input.answerContract.allowedVariants,
    input.grammarPoint
  );
  const matchedContentAnchors = anchors.filter((anchor) => sentence.includes(anchor));
  const requiredAnchorCount = anchors.length === 0
    ? 0
    : Math.min(2, Math.max(1, Math.ceil(anchors.length / 2)));
  const meaningSatisfied = matchedContentAnchors.length >= requiredAnchorCount;
  const equivalent = grammarFeatureSatisfied && meaningSatisfied && registerSatisfied;

  return {
    equivalent,
    confidence: equivalent ? (requiredAnchorCount > 0 ? 0.9 : 0.82) : 0.45,
    matchedVariant: null,
    grammarFeatureSatisfied,
    failedGrammarFeatures,
    registerSatisfied,
    matchedContentAnchors,
    reasonZh: !grammarFeatureSatisfied
      ? failedGrammarFeatures.includes("location-ni")
        ? "存在地点需要使用「に」，不能用动作地点的「で」。"
        : failedGrammarFeatures.includes("subject-ga")
          ? "存在对象需要用「が」标记。"
          : "没有确认到目标语法形式或所需接续。"
      : !meaningSatisfied
        ? "目标形式存在，但关键信息还不足。"
        : !registerSatisfied
          ? "语法和意思基本成立，但语体不符合当前场景。"
          : "目标形式、关键信息和语体均满足答案契约。",
  };
}
