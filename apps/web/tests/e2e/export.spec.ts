/**
 * Export tests — covers the export functionality in Settings.
 *
 * Alice creates a recipe + logs a cook, then tests export from Settings.
 * On web, the export downloads a JSON file via blob URL.
 */

import { test, expect } from "./fixtures";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

async function createRecipe(
  page: import("@playwright/test").Page,
  title: string
) {
  await page.goto("/new");
  await expect(page.getByText("New Recipe")).toBeVisible();
  await page.getByPlaceholder("Recipe title").fill(title);
  await page.getByPlaceholder("Ingredient 1").fill("1 cup test ingredient");
  await page.getByPlaceholder("Step 1").fill("Test step one");
  await page.getByText("Save", { exact: true }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
}

async function logCook(page: import("@playwright/test").Page) {
  await page.getByText("Log a cook").first().click();
  await page.getByText("Log cook").click();
  await expect(page.getByText(/Made \d+×/)).toBeVisible({ timeout: 10_000 });
}

async function navigateToSettings(page: import("@playwright/test").Page) {
  await page.goto("/settings");
  await expect(page.getByText("Settings", { exact: true })).toBeVisible({ timeout: 10_000 });
  // Wait for the page to fully load including the Data section
  await expect(page.getByText("Download backup")).toBeVisible({ timeout: 10_000 });
}

function getAliceToken(): string {
  const fs = require("fs");
  const path = require("path");
  const usersPath = path.join(process.cwd(), ".auth/test-users.json");
  const users = JSON.parse(fs.readFileSync(usersPath, "utf-8"));
  const storagePath = users.alice.storageStatePath;
  const storage = JSON.parse(fs.readFileSync(storagePath, "utf-8"));
  return storage.origins?.[0]?.localStorage?.find(
    (e: { name: string }) => e.name === "auth_token"
  )?.value;
}

test.describe("Export", () => {
  test.beforeAll(async ({ browser }) => {
    const { getTestUsers } = await import("./fixtures");
    const users = getTestUsers();
    const ctx = await browser.newContext({
      storageState: users.alice.storageStatePath,
    });
    const page = await ctx.newPage();

    await createRecipe(page, "Export Test Recipe");
    await logCook(page);

    await ctx.close();
  });

  test("export section is visible in settings", async ({
    alicePage: page,
  }) => {
    await navigateToSettings(page);
    await expect(page.getByText("Include cook logs")).toBeVisible();
    await expect(page.getByText("Include images")).toBeVisible();
    await expect(page.getByText("Download backup")).toBeVisible();
  });

  test("export API returns valid JSON with recipes and cook logs", async () => {
    const token = getAliceToken();
    const res = await fetch(
      `${BASE}/api/export?includeCookLogs=true&includeImages=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.ok).toBeTruthy();

    const data = await res.json();
    expect(data.version).toBe(1);
    expect(data.app).toBe("aleppo");
    expect(data.exportedAt).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(Array.isArray(data.recipes)).toBe(true);
    expect(data.recipes.length).toBeGreaterThan(0);
    expect(Array.isArray(data.cookLogs)).toBe(true);
    expect(data.cookLogs.length).toBeGreaterThan(0);
  });

  test("export shows success message in UI", async ({ alicePage: page }) => {
    await navigateToSettings(page);
    await page.getByText("Download backup").click();
    await expect(page.getByText(/Exported \d+ recipes/)).toBeVisible({ timeout: 15_000 });
  });

  test("export API without cook logs omits them", async () => {
    const token = getAliceToken();
    const res = await fetch(
      `${BASE}/api/export?includeCookLogs=false&includeImages=false`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    expect(res.ok).toBeTruthy();

    const data = await res.json();
    expect(data.version).toBe(1);
    expect(Array.isArray(data.cookLogs)).toBe(true);
    expect(data.cookLogs.length).toBe(0);
  });
});
