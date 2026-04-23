import { expect, type Locator, type Page, type TestInfo } from "@playwright/test";

export function createBrowserErrorCollector(page: Page) {
  const errors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(message.text());
    }
  });

  page.on("pageerror", (error) => {
    errors.push(error.message);
  });

  return errors;
}

export function expectNoBrowserErrors(errors: string[]) {
  expect(errors).toEqual([]);
}

export function createCollectionName(prefix: string, testInfo: TestInfo) {
  const normalizedTitle = testInfo.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);

  return `${prefix}-${normalizedTitle}-${Date.now()}`;
}

export async function gotoDictionary(page: Page) {
  await page.goto("/");
  await expect(page.getByLabel("日语词")).toBeVisible();
}

export async function gotoOverview(page: Page) {
  await page.goto("/?view=overview");
  await expect(page.getByText("已打开全览")).toBeVisible();
}

export async function gotoHistory(page: Page) {
  await page.goto("/?view=history");
  await expect(page.getByText("検索履歴")).toBeVisible();
}

export async function gotoCollections(page: Page) {
  await page.goto("/?view=collections");
  await expect(page.getByLabel("新建 collection")).toBeVisible();
}

export async function searchWord(page: Page, word: string, context?: string) {
  if (context !== undefined) {
    await page.getByLabel("查询语境").fill(context);
  }

  const input = page.getByLabel("日语词");
  await input.fill(word);
  await input.press("Enter");
}

export async function createCollection(page: Page, name: string) {
  await page.getByLabel("新建 collection").fill(name);
  await page.getByRole("button", { name: "新增コレクション" }).click();
  await expect(findCollectionCard(page, name)).toBeVisible();
}

export function findCollectionCard(page: Page, name: string): Locator {
  return page.getByRole("link").filter({ hasText: name }).first();
}

export async function openCollectionDetail(page: Page, name: string) {
  await findCollectionCard(page, name).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

export async function acceptNextDialog(page: Page) {
  const dialogPromise = page.waitForEvent("dialog").then(async (dialog) => {
    await dialog.accept();
  });

  return {
    async run(action: () => Promise<void>) {
      await Promise.all([dialogPromise, action()]);
    },
  };
}

export async function waitForAutoFilterCompletion(page: Page, collectionName: string) {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const card = findCollectionCard(page, collectionName);
    await expect(card).toBeVisible();

    const text = await card.innerText();
    if (text.includes("已同步")) {
      return "completed";
    }

    if (text.includes("同步失败")) {
      return "failed";
    }

    await page.waitForTimeout(1500);
    await page.reload();
  }

  return "timeout";
}

export async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBe(metrics.clientWidth);
}
