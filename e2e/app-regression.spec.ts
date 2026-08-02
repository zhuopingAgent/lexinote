import { expect, test } from "@playwright/test";
import {
  acceptNextDialog,
  createBrowserErrorCollector,
  createCollection,
  createCollectionName,
  expectNoBrowserErrors,
  findCollectionCard,
  gotoCollections,
  gotoDictionary,
  gotoHistory,
  gotoOverview,
  openCollectionDetail,
  searchWord,
  waitForAutoFilterCompletion,
} from "./helpers";

function hasAiGatewayCredentials() {
  if (process.env.E2E_RUN_LIVE_AI !== "1") {
    return false;
  }

  return Boolean(
    process.env.AI_GATEWAY_API_KEY?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim()
  );
}

test("dictionary lookup, retry selection, and history recovery work end-to-end", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);

  await gotoDictionary(page);

  await searchWord(page, "食べる");
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("たべる", { exact: true })).toBeVisible();
  await expect(page.getByText("吃；进食", { exact: true })).toBeVisible();
  await expect(page.getByText("例文", { exact: true })).toBeVisible();
  await expect(page.getByText("毎朝パンを食べる。", { exact: true })).toBeVisible();

  await searchWord(page, "抱く");
  await expect(page.getByText("各结果之间的区别")).toBeVisible();
  await expect(page.getByText("だく", { exact: true })).toBeVisible();
  await expect(page.getByText("いだく", { exact: true })).toBeVisible();
  await expect(page.getByText("本地词库")).toBeVisible();
  await expect(page.getByRole("button", { name: "当前词条 抱く だく" })).toBeVisible();

  await page.getByRole("button", { name: "选择这个词条 抱く いだく" }).click();
  await expect(page.getByRole("button", { name: "当前词条 抱く いだく" })).toBeVisible();
  await page.getByRole("button", { name: "按此读音重查 抱く いだく" }).click();
  await expect(page.getByText("选择要重查的词条")).toBeVisible();
  await expect(
    page
      .locator("label")
      .filter({ hasText: "いだく" })
      .locator('input[type="radio"]')
  ).toBeChecked();
  await page.getByLabel("重新查询补充说明").fill("不安を抱く");
  await page.getByRole("button", { name: "按补充说明重新查询" }).click();
  await expect(page.getByText("已参考语境「不安を抱く」")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("查询会参考「不安を抱く」")).toBeVisible();
  await page.getByRole("button", { name: "清除语境" }).click();
  await expect(page.getByText("查询会参考「不安を抱く」")).toHaveCount(0);

  await searchWord(page, "食べました。");
  await expect(page.getByText("已按原形「食べる」查询")).toBeVisible();
  await expect(page.getByText(/已参考语境/)).toHaveCount(0);
  await expect(page.getByText("毎朝パンを食べる。", { exact: true })).toBeVisible();

  await gotoHistory(page);
  await expect(page.getByRole("button").filter({ hasText: "食べる" }).first()).toBeVisible();
  await expect(page.getByRole("button").filter({ hasText: "抱く" }).first()).toBeVisible();
  await page.getByRole("button").filter({ hasText: "食べる" }).first().click();
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("たべる", { exact: true })).toBeVisible();

  expectNoBrowserErrors(browserErrors);
});

test("dictionary result actions can add a word into a collection and prevent duplicates", async ({
  page,
}, testInfo) => {
  const browserErrors = createBrowserErrorCollector(page);
  const collectionName = createCollectionName("e2e-dictionary", testInfo);

  await gotoCollections(page);
  await createCollection(page, collectionName);

  await gotoDictionary(page);
  await searchWord(page, "食べる");
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("本地词库")).toBeVisible();

  await page.getByRole("button", { name: "加入单词本 食べる たべる" }).click();
  await page.getByRole("button", { name: collectionName }).click();
  await expect(page.getByText("已加入所选单词本。")).toBeVisible();

  await page.getByRole("button", { name: "加入单词本 食べる たべる" }).click();
  await page.getByRole("button", { name: collectionName }).click();
  await expect(page.getByText("这个词条已经在所选单词本中。")).toBeVisible();

  await gotoCollections(page);
  await openCollectionDetail(page, collectionName);
  await expect(page.getByText("1 个单词")).toBeVisible();
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("手动添加")).toBeVisible();

  expectNoBrowserErrors(browserErrors);
});

test("grammar taxonomy defaults to expression function and opens another dimension", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);

  await page.goto("/grammar");
  await expect(
    page
      .getByLabel("知识维度", { exact: true })
      .getByRole("button", { name: "表达功能" })
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "形态、活用与时间体" })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("expression_function");
  await expect(page.getByText("当前显示 36 个", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "待完成 2", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /^待复习/ })).toHaveCount(0);
  const masteredCard = page.locator("article").filter({
    has: page.getByRole("link", { name: "AはBです", exact: true }),
  });
  await expect(masteredCard.getByText("已掌握", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "加载更多", exact: true }).click();
  await expect(page.getByText("当前显示 72 个", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "形态、活用与时间体" }).click();
  await expect(page.getByText("组织词形变化、时态、否定、体和派生形。")).toBeVisible();
  await expect(page.getByRole("button", { name: "时态与否定" })).toBeVisible();

  await page.getByRole("button", { name: "时态与否定" }).click();
  await expect(page.getByText("非过去、过去、否定、过去否定及礼貌体对应关系。")).toBeVisible();
  await expect(page.getByRole("link", { name: "〜た形" })).toBeVisible();

  await page.getByRole("link", { name: "〜た形" }).click();
  await expect(page).toHaveURL(/\/grammar\/[0-9a-f-]+$/);
  await expect(page.getByRole("heading", { name: "〜た形" })).toBeVisible();
  await expect(page.getByText("形态、活用与时间体").first()).toBeVisible();
  await expect(page.getByText("时态与否定").first()).toBeVisible();
  await expect(page.getByText("常见误区")).toBeVisible();
  await expect(page.getByText("昨日、映画を見ました。")).toBeVisible();

  await page.goto("/grammar/gp_sou_da");
  await expect(page.getByRole("heading", { name: "〜そうだ（样态）" })).toBeVisible();
  await expect(page.getByText("同形不同用法")).toBeVisible();
  await page
    .getByTitle("转述从别人或媒体获得的信息，不表示说话人眼前的观察。")
    .click();
  await expect(page).toHaveURL(/\/grammar\/gp_sou_da_hearsay$/);
  await expect(page.getByRole("heading", { name: "〜そうだ（传闻）" })).toBeVisible();
  await expect(page.getByText("普通形 + そうだ", { exact: true })).toBeVisible();
  await expect(page.getByText("天気予報によると、明日は雨が降るそうです。")).toBeVisible();
  await expect(page.getByText("易混语法对比")).toBeVisible();
  await expect(page.getByRole("heading", { name: "そうだ（传闻）与らしい" })).toBeVisible();

  await page.goto("/grammar");
  await page.getByRole("link", { name: "易混对比", exact: true }).click();
  await expect(page).toHaveURL(/\/grammar\/comparisons$/);
  await expect(page.getByRole("heading", { name: "易混语法对比" })).toBeVisible();
  await page.getByRole("searchbox", { name: "搜索易混语法" }).fill("に与で");
  await page.getByText("に与で", { exact: true }).click();
  await expect(page.getByText("存在地点和动作地点不同。", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("comparison_set");

  await page.goto("/grammar");
  await page.getByRole("button", { name: "课程顺序", exact: true }).click();
  await expect(page.getByLabel("课程阶段", { exact: true })).toBeVisible();
  await expect(page.getByText("5 个阶段", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /自然综合表达/ }).click();
  await expect(page.getByRole("button", { name: "媒体与正式书面语" })).toBeVisible();
  await page.getByRole("button", { name: "媒体与正式书面语" }).click();
  await expect(
    page.getByText("新闻转述、长句结构、正式连接和数据表达。", { exact: true })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "〜とされる", exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("media_formal");

  await page.getByRole("link", { name: "〜とされる", exact: true }).click();
  await expect(page.getByRole("heading", { name: "〜とされる" })).toBeVisible();
  await expect(page.getByText("阶段 5：自然综合表达", { exact: true })).toBeVisible();
  await expect(page.getByText(/媒体与正式书面语 · 第 \d+ 项/)).toBeVisible();
  await expect(page.getByText("这处遗迹被认为建于一千多年前。")).toBeVisible();

  expectNoBrowserErrors(browserErrors);
});

test("review consolidates objective progress into one record per grammar point", async ({
  page,
}) => {
  const reviewResponse = await page.request.get("/api/review/today");
  expect(reviewResponse.ok()).toBe(true);
  const review = (await reviewResponse.json()) as {
    items: Array<{ grammarPoint: { id: string; grammarPoint: string } }>;
    objectiveRecommendations: Array<{
      grammarPointId: string;
      grammarPoint: string;
      overallEstimate: number;
      objectives: Array<{ learningObjective: string }>;
    }>;
  };
  const availabilityRecommendations = review.objectiveRecommendations.filter(
    (recommendation) => recommendation.grammarPoint === "Aがあります"
  );

  expect(availabilityRecommendations).toHaveLength(1);
  expect(availabilityRecommendations[0]?.objectives).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ learningObjective: "meaning" }),
      expect.objectContaining({ learningObjective: "form_connection" }),
    ])
  );
  expect(availabilityRecommendations[0]?.overallEstimate).toBeCloseTo(0.2585);

  const visibleGrammarPointIds = [
    ...review.items.map((item) => item.grammarPoint.id),
    ...review.objectiveRecommendations.map(
      (recommendation) => recommendation.grammarPointId
    ),
  ];
  expect(new Set(visibleGrammarPointIds).size).toBe(visibleGrammarPointIds.length);

  await page.goto("/review");
  await expect(
    page.getByRole("link", { name: "Aがあります", exact: true })
  ).toHaveCount(1);
  await expect(page.getByText("综合掌握 26%", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "之后复习", exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "之后复习", exact: true }).locator("..").getByRole(
      "link",
      { name: "AはBです", exact: true }
    )
  ).toBeVisible();
});

test("practice sessions hide prompts, support retry, and return direct recorded feedback", async ({
  page,
}) => {
  const grammarResponse = await page.request.get(
    `/api/grammar?${new URLSearchParams({ query: "〜てもらえますか", limit: "20" })}`
  );
  expect(grammarResponse.ok()).toBe(true);
  const grammarSearch = (await grammarResponse.json()) as {
    items: Array<{ id: string; grammarPoint: string; coreMeaning: string }>;
  };
  const grammarPoint = grammarSearch.items.find(
    (item) => item.grammarPoint === "〜てもらえますか"
  );
  expect(grammarPoint).toBeDefined();

  const createResponse = await page.request.post("/api/practice/sessions", {
    data: {
      clientSessionKey: `e2e-practice-${Date.now()}`,
      grammarPointId: grammarPoint?.id,
      entryMode: "focus",
      preferredScene: "hospital",
      preferredRegister: "polite",
      plannedExerciseCount: 5,
    },
  });
  expect(createResponse.status()).toBe(201);
  const first = (await createResponse.json()) as {
    session: { id: string; status: string };
    progress: { current: number; total: number };
    exercise: {
      id: string;
      sequenceNumber: number;
      responseMode: "choice" | "text";
      prompt: string;
      context: { sceneLabel: string; registerLabel: string };
      options: Array<{ id: string; label: string }>;
      selectionReasonZh?: string;
      grammarPoint: Record<string, unknown>;
    };
  };
  expect(first.progress).toEqual(expect.objectContaining({ current: 1, total: 5 }));
  expect(first.exercise.responseMode).toBe("choice");
  expect(first.exercise.context).toEqual(
    expect.objectContaining({ sceneLabel: "医院", registerLabel: "一般礼貌" })
  );
  expect(first.exercise.grammarPoint).not.toHaveProperty("examples");
  expect(first.exercise.selectionReasonZh).toBeTruthy();
  expect(first.exercise.selectionReasonZh).not.toMatch(/daily_life|polite|meaning_choice/);
  expect(first.exercise).not.toHaveProperty("referenceAnswers");
  expect(first.exercise).not.toHaveProperty("expectedFeatures");
  expect(first.exercise).not.toHaveProperty("hintLadder");

  const correctOption = first.exercise.options.find(
    (option) => option.label === grammarPoint?.coreMeaning
  );
  const wrongOption = first.exercise.options.find(
    (option) => option.id !== correctOption?.id
  );
  expect(correctOption).toBeDefined();
  expect(wrongOption).toBeDefined();

  const wrongResponse = await page.request.post(
    `/api/practice/exercises/${first.exercise.id}/attempts`,
    { data: { selectedOptionId: wrongOption?.id } }
  );
  expect(wrongResponse.ok()).toBe(true);
  const wrong = (await wrongResponse.json()) as {
    feedback: { correctedSentence: string | null; betterVersions: unknown[] };
    canRetry: boolean;
    referenceAnswers: unknown[];
  };
  expect(wrong.canRetry).toBe(true);
  expect(wrong.referenceAnswers).toEqual([]);
  expect(wrong.feedback.correctedSentence).toBeNull();
  expect(wrong.feedback.betterVersions).toEqual([]);

  const hintResponse = await page.request.post(
    `/api/practice/exercises/${first.exercise.id}/hints`,
    { data: {} }
  );
  expect(hintResponse.ok()).toBe(true);
  await expect(hintResponse.json()).resolves.toEqual(
    expect.objectContaining({ hintsRevealed: 1, hint: expect.any(String) })
  );

  const correctResponse = await page.request.post(
    `/api/practice/exercises/${first.exercise.id}/attempts`,
    { data: { selectedOptionId: correctOption?.id } }
  );
  expect(correctResponse.ok()).toBe(true);
  const correct = (await correctResponse.json()) as {
    exerciseCompleted: boolean;
    referenceAnswers: unknown[];
    evidence: { attemptNumber: number; independent: boolean };
  };
  expect(correct.exerciseCompleted).toBe(true);
  expect(correct.referenceAnswers.length).toBeGreaterThan(0);
  expect(correct.evidence).toEqual(
    expect.objectContaining({ attemptNumber: 2, independent: false })
  );

  const secondResponse = await page.request.post(
    `/api/practice/sessions/${first.session.id}/next`,
    { data: {} }
  );
  expect(secondResponse.ok()).toBe(true);
  const second = (await secondResponse.json()) as {
    exercise: {
      id: string;
      sequenceNumber: number;
      exerciseType: string;
      responseMode: "choice" | "text";
      prompt: string;
      learningObjective?: string;
    };
  };
  expect(second.exercise).toEqual(
    expect.objectContaining({
      sequenceNumber: 2,
      exerciseType: "guided_translation",
      learningObjective: "register_control",
    })
  );
  expect(second.exercise.prompt).toContain(
    "不好意思，我没听清楚，能请您再说明一遍吗？"
  );
  expect(second.exercise.prompt).not.toContain("説明してもらえる？");
  expect(second.exercise).not.toHaveProperty("referenceAnswers");

  const registerResponse = await page.request.post(
    `/api/practice/exercises/${second.exercise.id}/attempts`,
    { data: { answer: "先生、もう一度説明してもらえる？" } }
  );
  expect(registerResponse.ok()).toBe(true);
  const registerFeedback = (await registerResponse.json()) as {
    feedback: {
      issues: Array<{ errorTypeCode: string; correction: string }>;
      correctedSentence: string | null;
      explanation: string;
    };
    referenceAnswers: unknown[];
  };
  expect(registerFeedback.feedback.issues).toEqual([
    expect.objectContaining({
      errorTypeCode: "register_mismatch",
      correction: "すみません、もう一度説明してもらえますか。",
    }),
  ]);
  expect(registerFeedback.feedback.correctedSentence).toBe(
    "すみません、もう一度説明してもらえますか。"
  );
  expect(registerFeedback.feedback.explanation).toContain("太随便");
  expect(registerFeedback.referenceAnswers).toEqual([]);

  const reviewBeforeRevealResponse = await page.request.get("/api/review/today");
  expect(reviewBeforeRevealResponse.ok()).toBe(true);
  const reviewBeforeReveal = (await reviewBeforeRevealResponse.json()) as {
    items: Array<{
      grammarPoint: { id: string };
      mistakeCount: number;
      objectiveProgress: Array<{ learningObjective: string }>;
    }>;
    objectiveRecommendations?: Array<{ grammarPointId: string; reasonZh: string }>;
  };
  const targetReviewItems = reviewBeforeReveal.items.filter(
    (item) => item.grammarPoint.id === grammarPoint?.id
  );
  const mistakeCountBeforeReveal = targetReviewItems[0]?.mistakeCount;
  expect(targetReviewItems).toHaveLength(1);
  expect(targetReviewItems[0]?.objectiveProgress.length).toBeGreaterThanOrEqual(1);
  expect(
    reviewBeforeReveal.objectiveRecommendations?.filter(
      (recommendation) => recommendation.grammarPointId === grammarPoint?.id
    )
  ).toHaveLength(0);
  expect(mistakeCountBeforeReveal).toBeGreaterThanOrEqual(1);

  const revealResponse = await page.request.post(
    `/api/practice/exercises/${second.exercise.id}/reveal`,
    { data: {} }
  );
  expect(revealResponse.ok()).toBe(true);
  const reveal = (await revealResponse.json()) as {
    referenceAnswers: Array<{ jp: string }>;
    evidence: { score: number; independent: boolean; evidenceKind?: string };
  };
  expect(reveal.referenceAnswers[0]?.jp).toBe(
    "すみません、もう一度説明してもらえますか。"
  );
  expect(reveal.evidence).toEqual(
    expect.objectContaining({ score: 0.2, independent: false, evidenceKind: "exposure" })
  );

  const reviewAfterRevealResponse = await page.request.get("/api/review/today");
  expect(reviewAfterRevealResponse.ok()).toBe(true);
  const reviewAfterReveal = (await reviewAfterRevealResponse.json()) as {
    items: Array<{
      grammarPoint: { id: string };
      mistakeCount: number;
    }>;
  };
  expect(
    reviewAfterReveal.items.find(
      (item) => item.grammarPoint.id === grammarPoint?.id
    )?.mistakeCount
  ).toBe(mistakeCountBeforeReveal);

  for (let sequenceNumber = 3; sequenceNumber <= 5; sequenceNumber += 1) {
    const nextResponse = await page.request.post(
      `/api/practice/sessions/${first.session.id}/next`,
      { data: {} }
    );
    expect(nextResponse.ok()).toBe(true);
    const next = (await nextResponse.json()) as {
      exercise: {
        id: string;
        sequenceNumber: number;
        prompt: string;
        exerciseType: string;
        responseMode: string;
      };
    };
    expect(next.exercise.sequenceNumber).toBe(sequenceNumber);
    expect(["meaning_choice", "contrast_choice", "guided_translation"]).toContain(
      next.exercise.exerciseType
    );
    expect(["choice", "text"]).toContain(next.exercise.responseMode);
    expect(next.exercise).not.toHaveProperty("referenceAnswers");
    expect(next.exercise.prompt).not.toMatch(/\*\*|daily_life|register_rewrite/);
    const itemReveal = await page.request.post(
      `/api/practice/exercises/${next.exercise.id}/reveal`,
      { data: {} }
    );
    expect(itemReveal.ok()).toBe(true);
  }
  const completedResponse = await page.request.post(
    `/api/practice/sessions/${first.session.id}/next`,
    { data: {} }
  );
  expect(completedResponse.ok()).toBe(true);
  await expect(completedResponse.json()).resolves.toEqual(
    expect.objectContaining({
      session: expect.objectContaining({ status: "completed" }),
      exercise: null,
      summary: expect.objectContaining({ completedExerciseCount: 5 }),
    })
  );

  const metricsResponse = await page.request.get("/api/practice/metrics");
  expect(metricsResponse.ok()).toBe(true);
  await expect(metricsResponse.json()).resolves.toEqual(
    expect.objectContaining({
      generatedItemCount: expect.any(Number),
      aiGeneratedItemCount: expect.any(Number),
      answerLeakCount: 0,
      ambiguousChoiceCount: 0,
    })
  );

  await page.goto("/grammar/quality");
  await expect(page.getByRole("heading", { name: "练习生成质量" })).toBeVisible();
  await expect(page.getByText("答案泄露", { exact: true })).toBeVisible();
  await expect(page.locator("body")).not.toContainText("AI_GATEWAY_UNAVAILABLE");

  await page.goto(`/practice?grammarId=${grammarPoint?.id}`);
  await expect(page.getByText("第 1 / 5 题", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "〜てもらえますか", exact: true })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "提交答案" })).toBeVisible();
  await expect(page.getByText("安排原因", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^(选择题|中译日)$/).first()).toBeVisible();
  await expect(page.locator("body")).not.toContainText("练习设置");
  await expect(page.locator("body")).not.toContainText("需要表达");
  await expect(page.locator("body")).not.toContainText("daily_life");
  await expect(page.locator("body")).not.toContainText("polite");
  await expect(page.locator("body")).not.toContainText("形式修复");
  await expect(page.locator("body")).not.toContainText("语体转换");
  await expect(page.locator("body")).not.toContainText("场景回应");
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("button", { name: "提交答案" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("structured fallback feedback feeds multidimensional review", async ({ page }) => {
  const taxonomyResponse = await page.request.get("/api/grammar/taxonomy");
  expect(taxonomyResponse.ok()).toBe(true);
  const taxonomy = (await taxonomyResponse.json()) as {
    learningStages: Array<{ slug: string }>;
    learningModules: Array<{ slug: string; nameZh: string }>;
    comparisonSets: Array<{
      slug: string;
      commonMeaning: string;
      decisionRules: unknown[];
      members: Array<{ grammarPointId: string }>;
    }>;
    errorTypes: Array<{ code: string }>;
  };
  expect(taxonomy.learningStages).toHaveLength(5);
  expect(taxonomy.learningModules).toHaveLength(19);
  expect(taxonomy.learningModules).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        slug: "media_formal",
        nameZh: "媒体与正式书面语",
      }),
    ])
  );
  expect(taxonomy.comparisonSets).toHaveLength(27);
  const requestComparison = taxonomy.comparisonSets.find(
    (comparisonSet) =>
      comparisonSet.slug === "te_moraemasu_vs_te_itadakemasu"
  );
  expect(requestComparison).toBeDefined();
  expect(requestComparison?.commonMeaning).toContain("礼貌度");
  expect(requestComparison?.decisionRules.length).toBeGreaterThan(0);
  expect(requestComparison?.members).toHaveLength(2);
  for (const member of requestComparison?.members ?? []) {
    expect(member.grammarPointId).toMatch(/^[0-9a-f-]{36}$/);
  }
  expect(taxonomy.errorTypes.map((errorType) => errorType.code)).toEqual(
    expect.arrayContaining([
      "register_mismatch",
      "connection_error",
      "tense_aspect_error",
      "giving_receiving_direction_error",
    ])
  );

  const grammarResponse = await page.request.get(
    `/api/grammar?${new URLSearchParams({ query: "〜てもらえますか", limit: "20" })}`
  );
  expect(grammarResponse.ok()).toBe(true);
  const grammarSearch = (await grammarResponse.json()) as {
    items: Array<{ id: string; grammarPoint: string }>;
  };
  const grammarPoint = grammarSearch.items.find(
    (item) => item.grammarPoint === "〜てもらえますか"
  );
  expect(grammarPoint).toBeDefined();

  const submitResponse = await page.request.post("/api/practice/submit", {
    data: {
      grammarPointId: grammarPoint?.id,
      sentence: "先生、もう一度説明してもらえる？",
      sceneTag: "hospital",
      registerTag: "polite",
    },
  });
  expect(submitResponse.ok()).toBe(true);
  const feedback = (await submitResponse.json()) as {
    meaningScore: number;
    issues: Array<{ errorTypeCode: string }>;
    correctedSentence: string;
    explanation: string;
    nextHint: string;
  };
  expect(feedback.meaningScore).toBeGreaterThan(0);
  expect(feedback.issues).toEqual([
    expect.objectContaining({ errorTypeCode: "register_mismatch" }),
  ]);
  expect(feedback.correctedSentence).toBe(
    "すみません、もう一度説明してもらえますか。"
  );
  expect(feedback.explanation).toContain("太随便");
  expect(feedback.nextHint).toBeTruthy();

  const reviewResponse = await page.request.get("/api/review/today");
  expect(reviewResponse.ok()).toBe(true);
  const review = (await reviewResponse.json()) as {
    aggregations: {
      grammarPoints: Array<{ key: string }>;
      errorTypes: Array<{ key: string }>;
      scenarios: Array<{ key: string }>;
      registers: Array<{ key: string }>;
    };
  };
  expect(review.aggregations.grammarPoints).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: grammarPoint?.id })])
  );
  expect(review.aggregations.errorTypes).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: "register_mismatch" })])
  );
  expect(review.aggregations.scenarios).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: "hospital" })])
  );
  expect(review.aggregations.registers).toEqual(
    expect.arrayContaining([expect.objectContaining({ key: "polite" })])
  );

  await page.goto("/review");
  await page.getByText("筛选复习记录", { exact: true }).click();
  await expect(page.getByText("语体不匹配").first()).toBeVisible();
  await expect(page.getByText("医院").first()).toBeVisible();
  await expect(page.getByText("一般礼貌").first()).toBeVisible();
});

test("collection CRUD, add/remove word, and word detail navigation work end-to-end", async ({
  page,
}, testInfo) => {
  const browserErrors = createBrowserErrorCollector(page);
  const initialName = createCollectionName("e2e-collection", testInfo);
  const renamedName = `${initialName}-renamed`;

  await gotoCollections(page);
  await createCollection(page, initialName);

  const initialCard = findCollectionCard(page, initialName);
  await initialCard.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("编辑 collection 名称").fill(renamedName);
  await page.getByRole("button", { name: "保存" }).click();
  await expect(findCollectionCard(page, renamedName)).toBeVisible();

  await openCollectionDetail(page, renamedName);
  await expect(page.getByText("这个 collection 里还没有单词")).toBeVisible();

  await page.getByRole("link", { name: "添加单词" }).click();
  await expect(page.getByRole("heading", { name: renamedName })).toBeVisible();
  await page.getByLabel("搜索可添加词条").fill("静か");
  await expect(page.locator("label").filter({ hasText: "静か" }).first()).toBeVisible();
  await page
    .locator("label")
    .filter({ hasText: "静か" })
    .first()
    .locator('input[type="checkbox"]')
    .click();
  await page.getByRole("button", { name: "添加已选 1 个词条" }).click();

  await expect(page.getByText("已成功添加 1 个词条。")).toBeVisible();
  await expect(page.getByText("静か", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("手动添加")).toBeVisible();

  await page.getByRole("link", { name: "查看 静か 的详情" }).click();
  await expect(page.getByText("静か", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("安静；安稳", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: `返回 ${renamedName}` }).click();
  await expect(page.getByRole("heading", { name: renamedName })).toBeVisible();

  const removeDialog = await acceptNextDialog(page);
  await removeDialog.run(async () => {
    await page.getByRole("button", { name: "移除" }).click();
  });
  await expect(page.getByText("这个 collection 里还没有单词")).toBeVisible();

  await page.getByRole("link", { name: "返回 collections" }).click();
  const deleteDialog = await acceptNextDialog(page);
  await deleteDialog.run(async () => {
    await findCollectionCard(page, renamedName).getByRole("button", { name: "删除" }).click();
  });
  await expect(findCollectionCard(page, renamedName)).toHaveCount(0);

  expectNoBrowserErrors(browserErrors);
});

test("overview search can add a word into a collection and prevent duplicates", async ({
  page,
}, testInfo) => {
  const browserErrors = createBrowserErrorCollector(page);
  const collectionName = createCollectionName("e2e-overview", testInfo);

  await gotoCollections(page);
  await createCollection(page, collectionName);

  await gotoOverview(page);
  await page.getByLabel("搜索全覧词条").fill("大切");
  await expect(page.locator("article").filter({ hasText: "大切" }).first()).toBeVisible();
  await expect(page.getByText("静か")).toHaveCount(0);

  const card = page.locator("article").filter({ hasText: "大切" }).first();
  await card.getByRole("button", { name: "加入 collection" }).click();
  await card.getByRole("button", { name: collectionName }).click();
  await expect(card.getByText("已加入所选 collection。")).toBeVisible();

  await card.getByRole("button", { name: "加入 collection" }).click();
  await card.getByRole("button", { name: collectionName }).click();
  await expect(card.getByText("这个词条已经在所选 collection 中。")).toBeVisible();

  await gotoCollections(page);
  await openCollectionDetail(page, collectionName);
  await expect(page.getByText("1 个单词")).toBeVisible();
  await expect(page.getByText("大切", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("手动添加")).toBeVisible();

  expectNoBrowserErrors(browserErrors);
});

test("AI auto-filter can sync matching local words into a collection", async ({
  page,
}, testInfo) => {
  test.skip(
    !hasAiGatewayCredentials(),
    "AI Gateway credentials are required for the live auto-filter flow."
  );
  test.slow();

  const browserErrors = createBrowserErrorCollector(page);
  const collectionName = createCollectionName("e2e-autofilter", testInfo);

  await gotoCollections(page);
  await createCollection(page, collectionName);

  const card = findCollectionCard(page, collectionName);
  await card.getByRole("button", { name: "编辑" }).click();
  await page.getByLabel("编辑 collection 名称").fill(collectionName);
  await page.getByRole("checkbox").check();
  await page
    .getByLabel("AI 自动筛选条件")
    .fill("收录和食物或吃东西相关的词，尤其是食べる，不要收录无关词。");
  await page.getByRole("button", { name: "保存" }).click();
  await expect(card.getByText("未同步")).toBeVisible();
  await card.getByRole("button", { name: "重新同步 AI" }).click();

  const finalStatus = await waitForAutoFilterCompletion(page, collectionName);
  expect(finalStatus).toBe("completed");

  await openCollectionDetail(page, collectionName);
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("AI 筛选")).toBeVisible();

  expectNoBrowserErrors(browserErrors);
});
