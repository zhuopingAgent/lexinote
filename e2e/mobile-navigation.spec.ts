import { expect, test } from "@playwright/test";
import {
  createBrowserErrorCollector,
  expectNoBrowserErrors,
  expectNoHorizontalOverflow,
  gotoDictionary,
} from "./helpers";

test.use({
  viewport: {
    width: 390,
    height: 844,
  },
});

test("mobile navigation keeps core views usable without horizontal overflow", async ({
  page,
}) => {
  const browserErrors = createBrowserErrorCollector(page);

  await gotoDictionary(page);
  await expect(page.getByRole("button", { name: "辞書" })).toBeVisible();
  await expect(page.getByRole("button", { name: "全览" })).toBeVisible();
  await expect(page.getByRole("button", { name: "履歴" })).toBeVisible();
  await expect(page.getByRole("button", { name: "コレクション" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("日语词").fill("食べる");
  await page.getByLabel("日语词").press("Enter");
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("たべる", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "全览" }).click();
  await expect(page.getByText("已打开全览")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "履歴" }).click();
  await expect(page.getByText("検索履歴")).toBeVisible();
  await expect(page.getByRole("button").filter({ hasText: "食べる" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "コレクション" }).click();
  await expect(page.getByLabel("新建 collection")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expectNoBrowserErrors(browserErrors);
});
