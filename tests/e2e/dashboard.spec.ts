import { test, expect } from "@playwright/test";
test("dashboard supports inline URL state and browser history", async ({
  page,
}) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: /The pulse/ })).toBeVisible();
  const rows = page.locator(".topic-row");
  await expect(rows.first()).toBeVisible();
  await rows.first().click();
  await expect(page).toHaveURL(/topic=/);
  await expect(page.locator(".topic-detail")).toBeVisible();
  const url = page.url();
  await page.reload();
  await expect(page.locator(".topic-detail")).toBeVisible();
  await page.getByRole("button", { name: "Close topic" }).click();
  await expect(page).not.toHaveURL(/topic=/);
  await page.goBack();
  await expect(page.locator(".topic-detail")).toBeVisible();
  await page.goto(url.replace(/topic=[^&]+/, "topic=unknown"));
  await expect(page.locator(".topic-detail")).toHaveCount(0);
});
test("range, search, source dialog and responsive layout", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("button", { name: "30D", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "30D", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("textbox", { name: "Search topics" }).fill("zzzz");
  await expect(page.getByText("No topics match")).toBeVisible();
  await page.getByRole("textbox", { name: "Search topics" }).fill("");
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(await page.locator("nav").count()).toBe(0);
});
test("all public evidence links use HTTPS and page has no runtime errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./?topic=mcp-tool-integration");
  await expect(page.locator(".topic-detail")).toBeVisible();
  const links = await page
    .locator(".evidence h5 a")
    .evaluateAll((els) => els.map((a) => (a as HTMLAnchorElement).href));
  expect(links.length).toBeGreaterThan(0);
  expect(links.every((u) => u.startsWith("https://"))).toBe(true);
  expect(errors).toEqual([]);
});
