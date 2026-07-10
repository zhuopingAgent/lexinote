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

  await page.getByRole("button", { name: "加入 collection 食べる たべる" }).click();
  await page.getByRole("button", { name: collectionName }).click();
  await expect(page.getByText("已加入所选 collection。")).toBeVisible();

  await page.getByRole("button", { name: "加入 collection 食べる たべる" }).click();
  await page.getByRole("button", { name: collectionName }).click();
  await expect(page.getByText("这个词条已经在所选 collection 中。")).toBeVisible();

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

  expectNoBrowserErrors(browserErrors);
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
