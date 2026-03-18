import { expect, test } from "@playwright/test";

async function expectExplanationBody(
  page: Parameters<
    Parameters<typeof test>[1]
  >[0]["page"],
  sectionTitle: string
) {
  const body = page
    .getByRole("heading", { level: 3, name: sectionTitle })
    .locator("xpath=..")
    .locator("p");

  await expect(body).toHaveText(/\S+/);
}

test("user can look up a Japanese word and see AI explanation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("还没有结果。输入一个日语词后点击 Search。")).toBeVisible();

  await page.getByLabel("Japanese word").fill("食べる");
  await page.getByRole("button", { name: "Search" }).click();

  await expect(
    page.getByRole("heading", { level: 2, name: "食べる" })
  ).toBeVisible();
  await expect(page.getByText("吃；进食")).toBeVisible();
  await expectExplanationBody(page, "实际用法");
  await expectExplanationBody(page, "常见场景");
  await expectExplanationBody(page, "语感与近义差别");
  await expectExplanationBody(page, "中文母语者常犯错误");
});
