import { afterEach, describe, expect, it, vi } from "vitest";
import { GrammarAiClient } from "@/features/grammar-learning/infrastructure/GrammarAiClient";
import { buildLocalFallbackV2, fallbackSupportFor, PRACTICE_FALLBACK_SUPPORT_MATRIX } from "@/features/grammar-learning/infrastructure/PracticeFallbackV2";
import { buildPracticeSessionPlan } from "@/features/grammar-learning/domain/practiceSessionPlanner";
import {
  buildAnswerContract,
  buildEmptyGenerationMetadata,
  parsePracticeItemV2,
  validatePracticeItemV2,
} from "@/features/grammar-learning/domain/practiceGenerationV2";
import {
  CONSTRAINED_TRANSLATION_PROMPT,
  CONTRAST_CHOICE_PROMPT,
  FORM_REPAIR_PROMPT,
  MEANING_CHOICE_PROMPT,
  REGISTER_REWRITE_PROMPT,
  REPAIR_EXERCISE_PROMPT,
  REVIEW_GENERATED_EXERCISE_PROMPT,
  SCENARIO_RESPONSE_PROMPT,
  SHARED_GENERATION_PROMPT,
  buildPracticeGenerationPromptV2,
} from "@/features/grammar-learning/prompts/practiceV2";
import type { GrammarPointDetail } from "@/shared/types/grammar";
import type { PracticeContext } from "@/shared/types/practice";

const originalKey = process.env.AI_GATEWAY_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.AI_GATEWAY_API_KEY;
  else process.env.AI_GATEWAY_API_KEY = originalKey;
});

const grammarPoint = {
  id: "11111111-1111-4111-8111-111111111111",
  grammarPoint: "Aがあります",
  canonicalForm: "Aがあります",
  senseKey: "aru_inanimate_existence",
  pointType: "sentence_pattern",
  coreMeaning: "某处有无生命的事物",
  naturalTranslation: "有……",
  usage: "表示无生命事物的存在。",
  structure: "地点に 事物が あります",
  practicality: "S",
  connections: [{ baseType: "clause", requiredForm: "existence", pattern: "地点に 事物が あります", notes: "存在地点用に", sortOrder: 1 }],
  commonMistakes: ["把存在地点误用为で"],
  examples: [
    { id: "e1", jp: "駅の近くにコンビニがあります。", zh: "车站附近有便利店。", notes: "地点使用に。" },
    { id: "e2", jp: "今日は会議があります。", zh: "今天有会议。", notes: "表示安排。" },
  ],
  formSiblings: [],
  comparisonSets: [],
} as unknown as GrammarPointDetail;

const context: PracticeContext = {
  sceneSlug: "daily_life",
  sceneLabel: "日常生活",
  speakerRole: "学习者",
  listenerRole: "不熟悉的人",
  socialDistance: "unfamiliar",
  hierarchy: "equal",
  requestBurden: "low",
  medium: "spoken",
  communicativeGoal: "说明本周安排",
  knownContext: "双方正在确认本周安排",
  requiredDetail: "两次",
  registerPreset: "polite",
  registerLabel: "一般礼貌",
};

function translationIntent() {
  const [base] = buildPracticeSessionPlan({
    grammarPoint,
    context,
    skillStates: [],
    history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
    source: { now: () => new Date("2026-07-11T00:00:00Z"), next: () => 0.1 },
  });
  return {
    ...base,
    blueprintId: "guided_translation",
    exerciseType: "guided_translation" as const,
    cognitiveOperation: "constrained_produce" as const,
    scaffoldLevel: "semantic_hint" as const,
    answerPolicy: { ...base.answerPolicy, responseMode: "text" as const, requireExactChoice: false, allowEquivalentAnswers: true },
  };
}

describe("practice V2 prompt contracts", () => {
  it("gives every prompt a stable version and structured JSON input", () => {
    const prompts = [SHARED_GENERATION_PROMPT, MEANING_CHOICE_PROMPT, FORM_REPAIR_PROMPT, CONTRAST_CHOICE_PROMPT, REGISTER_REWRITE_PROMPT, CONSTRAINED_TRANSLATION_PROMPT, SCENARIO_RESPONSE_PROMPT, REPAIR_EXERCISE_PROMPT, REVIEW_GENERATED_EXERCISE_PROMPT];
    expect(prompts.every((prompt) => prompt.id && prompt.version >= 2)).toBe(true);
    const intent = translationIntent();
    const built = buildPracticeGenerationPromptV2({
      intent,
      answerContract: buildLocalFallbackV2({ intent, grammarPoint, fallbackReason: "TEST" }).answerContract,
      grammarPoint,
      generationSeed: "seed",
    });
    expect(built.userPrompt).toContain("PRACTICE_INTENT_JSON:");
    expect(built.userPrompt).not.toMatch(/分析过程|思维链|chain of thought/i);
  });

  it("strictly parses all six discriminated item schemas", () => {
    const rootIntent = translationIntent();
    const common = {
      instruction_zh: "完成练习。",
      prompt: "请根据要求作答。",
      reference_answers: [{ jp: "今日は会議があります。", zh: "今天有会议。", note_zh: "使用存在句。" }],
      hints: [{ level: "semantic_hint", content: "先确认存在关系。", reveals_form: false, reveals_answer: false }],
    };
    const raws = [
      { ...common, exercise_type: "meaning_choice", choices: [{ id: "a", label: "存在" }, { id: "b", label: "变化" }, { id: "c", label: "引用" }], correct_choice_id: "a", distractor_reasons: { b: "不是变化。", c: "不是引用。" } },
      { ...common, exercise_type: "form_repair", incorrect_sentence: "駅でコンビニがあります。", target_error_type: "particle_error", error_span: "で", corrected_sentence: "駅にコンビニがあります。" },
      { ...common, exercise_type: "contrast_choice", choices: [{ id: "a", label: "に" }, { id: "b", label: "で" }, { id: "c", label: "を" }], correct_choice_id: "a", distractor_reasons: { b: "动作地点。", c: "宾语。" } },
      { ...common, exercise_type: "register_rewrite", source_sentence: "会議ある？", target_register: "polite" },
      { ...common, exercise_type: "guided_translation", chinese_sentence: "今天有一场会议。" },
      { ...common, exercise_type: "contextual_response", previous_turn: "今天还有安排吗？", speaker_relationship: "同事之间", communicative_goal: "说明安排", required_information: ["今天有会议"] },
    ] as const;
    for (const raw of raws) {
      const intent = {
        ...rootIntent,
        exerciseType: raw.exercise_type,
        answerPolicy: {
          ...rootIntent.answerPolicy,
          responseMode: raw.exercise_type === "meaning_choice" || raw.exercise_type === "contrast_choice" ? "choice" as const : "text" as const,
        },
      };
      expect(parsePracticeItemV2(raw, {
        intent,
        grammarPoint,
        answerContract: buildAnswerContract({ intent, grammarPoint }),
        metadata: buildEmptyGenerationMetadata(),
      })?.exerciseType).toBe(raw.exercise_type);
    }
  });

  it("uses the generated references as the item answer contract", () => {
    const intent = translationIntent();
    const item = parsePracticeItemV2({
      exercise_type: "guided_translation",
      instruction_zh: "请翻译完整句子。",
      prompt: "请翻译：这周还有两次会议。",
      chinese_sentence: "这周还有两次会议。",
      reference_answers: [{
        jp: "今週は会議があと二回あります。",
        zh: "这周还有两次会议。",
        note_zh: "使用存在句。",
      }],
      hints: [],
    }, {
      intent,
      grammarPoint,
      answerContract: buildAnswerContract({ intent, grammarPoint }),
      metadata: buildEmptyGenerationMetadata(),
    });
    expect(item?.answerContract.allowedVariants).toEqual([
      "今週は会議があと二回あります。",
    ]);
  });
});

describe("practice V2 validators and fallback", () => {
  it("produces a complete Chinese fallback without leaking the answer", () => {
    const intent = translationIntent();
    const item = buildLocalFallbackV2({ intent, grammarPoint, fallbackReason: "TEST" });
    expect(item.exerciseType).toBe("guided_translation");
    if (item.exerciseType !== "guided_translation") throw new Error("unexpected type");
    expect(item.chineseSentence).toBe("这周还有两次会议。");
    expect(item.prompt).not.toContain(item.referenceAnswers[0].jp);
    expect(validatePracticeItemV2(item, grammarPoint).valid).toBe(true);
  });

  it("detects answer leaks, Markdown, incomplete Chinese, ambiguous and duplicate choices", () => {
    const intent = translationIntent();
    const item = buildLocalFallbackV2({ intent, grammarPoint, fallbackReason: "TEST" });
    item.prompt = `**${item.referenceAnswers[0].jp}**`;
    if (item.exerciseType === "guided_translation") item.chineseSentence = "表达计划，并提到两次";
    const result = validatePracticeItemV2(item, grammarPoint);
    expect(result.errorCodes).toEqual(expect.arrayContaining(["ANSWER_LEAK", "MARKDOWN_NOT_ALLOWED", "INCOMPLETE_CHINESE_PROMPT"]));

    const choiceIntent = { ...intent, exerciseType: "meaning_choice" as const, answerPolicy: { ...intent.answerPolicy, responseMode: "choice" as const, requireExactChoice: true } };
    const choice = buildLocalFallbackV2({ intent: choiceIntent, grammarPoint, fallbackReason: "TEST" });
    if (choice.exerciseType !== "meaning_choice") throw new Error("unexpected type");
    choice.choices[1].label = choice.choices[0].label;
    delete choice.distractorReasons[choice.choices[1].id];
    expect(validatePracticeItemV2(choice, grammarPoint).errorCodes).toEqual(expect.arrayContaining(["DUPLICATE_CHOICES", "AMBIGUOUS_CHOICES"]));
  });

  it("declares golden-case fallback coverage", () => {
    const forms = PRACTICE_FALLBACK_SUPPORT_MATRIX.flatMap((entry) => entry.canonicalForms);
    for (const form of ["AはBです", "Aがあります", "Aがいます", "は", "が", "に", "で", "て形", "〜ている", "〜たら", "〜ば", "〜と", "〜なら", "〜から", "〜ので", "〜そうだ", "〜らしい", "〜てもらえますか", "〜ていただけますか", "〜てくれる", "〜てもらう", "〜てあげる", "〜ております", "不安を抱く", "そのため", "一方で"]) {
      expect(forms).toContain(form);
    }
    expect(fallbackSupportFor(grammarPoint).id).toBe("existence");
  });

  it("validates closed fallback items across the golden grammar families", () => {
    const cases = [
      ["AはBです", "私は学生です。"],
      ["Aがあります", "駅の近くに店があります。"],
      ["Aがいます", "教室に学生がいます。"],
      ["は", "私は学生です。"],
      ["が", "雨が降っています。"],
      ["に", "学校に行きます。"],
      ["で", "図書館で勉強します。"],
      ["て形", "本を読んでください。"],
      ["〜ている", "今、本を読んでいます。"],
      ["〜たら", "駅に着いたら連絡してください。"],
      ["〜ば", "時間があれば行きます。"],
      ["〜と", "春になると暖かくなります。"],
      ["〜なら", "行くなら早く出ましょう。"],
      ["〜から", "雨だから行きません。"],
      ["〜ので", "雨なので行きません。"],
      ["〜そうだ", "雨が降りそうです。"],
      ["〜らしい", "明日は雨らしいです。"],
      ["〜てくれる", "友達が手伝ってくれました。"],
      ["〜てもらう", "友達に手伝ってもらいました。"],
      ["〜てあげる", "友達を手伝ってあげました。"],
      ["〜ております", "ただいま確認しております。"],
      ["不安を抱く", "将来に不安を抱いています。"],
      ["そのため", "電車が遅れました。そのため、会議に遅刻しました。"],
      ["一方で", "便利な一方で、費用がかかります。"],
    ] as const;
    for (const [form, example] of cases) {
      const point = {
        ...grammarPoint,
        grammarPoint: form,
        canonicalForm: form,
        senseKey: `golden_${form}`,
        examples: [{ id: `example_${form}`, jp: example, zh: "金标准例句。", notes: "已验证内容。" }],
      } as unknown as GrammarPointDetail;
      const [intent] = buildPracticeSessionPlan({
        grammarPoint: point,
        context,
        skillStates: [],
        history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
        source: { now: () => new Date("2026-07-11T00:00:00Z"), next: () => 0.1 },
      });
      const item = buildLocalFallbackV2({ intent, grammarPoint: point, fallbackReason: "GOLDEN_TEST" });
      expect(validatePracticeItemV2(item, point).valid, form).toBe(true);
    }
  });

  it("builds a normalized comparison fallback from member IDs and minimal pairs", () => {
    const targetId = "22222222-2222-4222-8222-222222222222";
    const siblingId = "33333333-3333-4333-8333-333333333333";
    const point = {
      ...grammarPoint,
      id: targetId,
      grammarPoint: "に",
      canonicalForm: "に",
      senseKey: "ni_location",
      examples: [{ id: "ni1", jp: "駅に着きます。", zh: "到达车站。", notes: "到达点。" }],
      comparisonSets: [{
        id: "44444444-4444-4444-8444-444444444444",
        slug: "ni_vs_de",
        nameZh: "に与で",
        summary: "地点助词选择",
        commonMeaning: "都和地点有关",
        decisionRules: [{ conditionZh: "表示动作发生的地点时，", preferredMemberPosition: 2, explanationZh: "动作地点使用で。" }],
        connectionDifferences: [],
        registerDifferences: [],
        interchangeableCases: [],
        nonInterchangeableCases: [],
        minimalPairExamples: [{ contextZh: "在图书馆学习", sentences: [{ memberPosition: 1, jp: "図書館に行きます。", zh: "去图书馆。" }, { memberPosition: 2, jp: "図書館で勉強します。", zh: "在图书馆学习。" }], explanationZh: "动作地点使用で。" }],
        learnerMistakes: [],
        status: "active",
        members: [{ grammarPointId: targetId, grammarPoint: "に", canonicalForm: "に", senseKey: "ni_location", sortOrder: 1 }, { grammarPointId: siblingId, grammarPoint: "で", canonicalForm: "で", senseKey: "de_action_location", sortOrder: 2 }],
      }],
    } as unknown as GrammarPointDetail;
    const [baseIntent] = buildPracticeSessionPlan({
      grammarPoint: point,
      context,
      skillStates: [],
      history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
      source: { now: () => new Date("2026-07-11T00:00:00Z"), next: () => 0.1 },
    });
    const intent = {
      ...baseIntent,
      blueprintId: "contrast_choice",
      exerciseType: "contrast_choice" as const,
      learningObjective: "grammar_selection" as const,
      cognitiveOperation: "select" as const,
      scaffoldLevel: "options" as const,
      comparisonGrammarPointIds: [siblingId],
      answerPolicy: { ...baseIntent.answerPolicy, responseMode: "choice" as const, requireExactChoice: true, allowEquivalentAnswers: false },
    };
    const item = buildLocalFallbackV2({ intent, grammarPoint: point, fallbackReason: "GOLDEN_TEST" });
    expect(item.exerciseType).toBe("contrast_choice");
    expect(validatePracticeItemV2(item, point).valid).toBe(true);
  });

  it("caps content repair and falls back without returning invalid AI output", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const requester = vi.fn(async () => "{\"exercise_type\":\"guided_translation\",\"prompt\":\"**坏题**\"}");
    const client = new GrammarAiClient(requester as never);
    const item = await client.generatePracticeItemV2({ grammarPoint, intent: translationIntent(), generationSeed: "fixed" });
    expect(requester).toHaveBeenCalledTimes(3);
    expect(item.generationMetadata.generationSource).toBe("fallback");
    expect(item.generationMetadata.fallbackReason).toContain("CONTENT_REPAIR_EXHAUSTED");
    expect(item.generationMetadata.generationRetryCount).toBe(2);
    expect(item.generationMetadata.validationResults.some((result) =>
      result.errorCodes.includes("SCHEMA_INVALID")
    )).toBe(true);
    expect(item.prompt).not.toContain("**");
  });

  it("rejects Markdown-wrapped JSON instead of extracting it permissively", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const requester = vi.fn(async () => "```json\n{\"exercise_type\":\"guided_translation\"}\n```");
    const client = new GrammarAiClient(requester as never);
    const item = await client.generatePracticeItemV2({ grammarPoint, intent: translationIntent(), generationSeed: "fixed" });
    expect(item.generationMetadata.generationSource).toBe("fallback");
    expect(item.generationMetadata.validationResults.some((result) =>
      result.errorCodes.includes("SCHEMA_INVALID")
    )).toBe(true);
  });

  it("retries thrown network failures once and then uses validated fallback", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const requester = vi.fn(async () => {
      throw new Error("network unavailable");
    });
    const client = new GrammarAiClient(requester as never);
    const item = await client.generatePracticeItemV2({ grammarPoint, intent: translationIntent(), generationSeed: "fixed" });
    expect(requester).toHaveBeenCalledTimes(2);
    expect(item.generationMetadata.generationSource).toBe("fallback");
    expect(item.generationMetadata.networkRetryCount).toBe(1);
    expect(item.generationMetadata.fallbackReason).toBe("NETWORK_RETRY_EXHAUSTED");
  });

  it("keeps the hospital polite-request acceptance flow contract-aware", async () => {
    delete process.env.AI_GATEWAY_API_KEY;
    const requestPoint = {
      ...grammarPoint,
      grammarPoint: "〜てもらえますか",
      canonicalForm: "〜てもらえますか",
      senseKey: "te_moraemasu_polite_request",
      coreMeaning: "礼貌请求对方为自己做某事",
      structure: "Vて + もらえますか",
      connections: [{ baseType: "verb", requiredForm: "te_form", pattern: "Vて + もらえますか", notes: "使用て形", sortOrder: 1 }],
      examples: [{ id: "r1", jp: "もう一度説明してもらえますか。", zh: "可以请您再说明一次吗？", notes: "一般礼貌请求。" }],
    } as unknown as GrammarPointDetail;
    const plan = buildPracticeSessionPlan({
      grammarPoint: requestPoint,
      context: { ...context, sceneSlug: "hospital", sceneLabel: "医院", speakerRole: "患者", listenerRole: "医生", hierarchy: "listener_higher", communicativeGoal: "请求再次说明", requiredDetail: "再说明一次" },
      skillStates: [],
      history: { consecutiveFailures: 0, recentErrorCodes: [], prerequisiteReady: true },
      source: { now: () => new Date("2026-07-11T00:00:00Z"), next: () => 0.1 },
    });
    const intent = plan[1];
    const item = buildLocalFallbackV2({ intent, grammarPoint: requestPoint, fallbackReason: "TEST" });
    const client = new GrammarAiClient();
    const wrong = await client.evaluateSentence({ grammarPoint: requestPoint, sentence: "先生、もう一度説明してもらえる？", sceneTag: "hospital", registerTag: "polite", answerContract: item.answerContract });
    expect(wrong.issues.map((issue) => issue.errorTypeCode)).toContain("register_mismatch");
    expect(wrong.grammarScore).toBeGreaterThan(wrong.registerScore);
    expect(wrong.correctedSentence).toBe("すみません、もう一度説明していただけますか。");
    const accepted = await client.evaluateSentence({ grammarPoint: requestPoint, sentence: "すみません、もう一度説明していただけますか。", sceneTag: "hospital", registerTag: "polite", answerContract: item.answerContract });
    expect(accepted.isCorrect).toBe(true);
  });

  it("accepts a validated natural equivalent even when AI feedback is overly strict", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key";
    const requester = vi.fn(async () => JSON.stringify({
      is_correct: false,
      grammar_score: 2,
      meaning_score: 3,
      naturalness_score: 3,
      register_score: 3,
      scene_fit_score: 3,
      issues: [{
        error_type_code: "unnatural_expression",
        severity: "low",
        explanation: "模型误判。",
        correction: "",
      }],
      explanation_zh: "模型误判。",
      next_hint_zh: "重写。",
    }));
    const client = new GrammarAiClient(requester as never);
    const intent = translationIntent();
    const item = buildLocalFallbackV2({ intent, grammarPoint, fallbackReason: "TEST" });
    const sentence = item.answerContract.allowedVariants[0];
    const feedback = await client.evaluateSentence({
      grammarPoint,
      sentence,
      sceneTag: "daily_life",
      registerTag: "polite",
      answerContract: item.answerContract,
    });
    expect(feedback.isCorrect).toBe(true);
    expect(feedback.issues).toEqual([]);
    expect(feedback.explanation).toContain("这句可以");
  });
});
