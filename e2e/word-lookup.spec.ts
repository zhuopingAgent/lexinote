import { expect, test } from "@playwright/test";

test("user can look up a Japanese word and see the basic entry", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("还没有结果")).toBeVisible();

  await page.getByLabel("日语词").fill("食べる");
  await page.getByRole("button", { name: "开始查询" }).click();

  await expect(page.getByText("词")).toBeVisible();
  await expect(page.getByText("食べる").first()).toBeVisible();
  await expect(page.getByText("たべる")).toBeVisible();
  await expect(page.getByText("动词")).toBeVisible();
  await expect(page.getByText("吃；进食")).toBeVisible();
});
