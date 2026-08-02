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
  await expect(page.getByRole("button", { name: "全覧" })).toBeVisible();
  await expect(page.getByRole("button", { name: "履歴" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Collection" })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByLabel("日语词").fill("食べる");
  await page.getByLabel("日语词").press("Enter");
  await expect(page.getByText("食べる", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("たべる", { exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "全覧" }).click();
  await expect(page.getByLabel("搜索全覧词条")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "履歴" }).click();
  await expect(page.getByText("検索履歴")).toBeVisible();
  await expect(page.getByRole("button").filter({ hasText: "食べる" }).first()).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("button", { name: "Collection" }).click();
  await expect(page.getByLabel("新建 collection")).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "文法" }).click();
  await expect(page).toHaveURL(/\/grammar$/);
  await expect(page.getByRole("link", { name: "辞書" })).toBeVisible();
  await expect(page.getByRole("link", { name: "文法" })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "搜索语法" })).toBeVisible();
  await expect(page.getByRole("link", { name: "易混对比", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  await page.getByRole("link", { name: "待完成 2", exact: true }).click();
  await expect(page).toHaveURL(/\/review#pending$/);
  await expect(page.getByText("筛选复习记录", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "待完成", exact: true })).toBeVisible();
  await expectNoHorizontalOverflow(page);

  expectNoBrowserErrors(browserErrors);
});
