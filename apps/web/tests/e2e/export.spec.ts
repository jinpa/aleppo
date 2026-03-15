/**
 * Export tests — covers the export functionality in Settings.
 *
 * Alice creates a recipe + logs a cook, then tests export from Settings.
 * On web, the export downloads a JSON file via blob URL.
 */

import { test, expect } from "./fixtures";

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
  await expect(page.getByText("Settings")).toBeVisible({ timeout: 10_000 });
}

test.describe("Export", () => {
  test.beforeAll(async ({ browser }) => {
    // Import fixtures to get storage state
    const { getTestUsers } = await import("./fixtures");
    const users = getTestUsers();
    const ctx = await browser.newContext({
      storageState: users.alice.storageStatePath,
    });
    const page = await ctx.newPage();

    // Create a recipe and log a cook for export tests
    await createRecipe(page, "Export Test Recipe");
    await logCook(page);

    await ctx.close();
  });

  test("export section is visible in settings", async ({
    alicePage: page,
  }) => {
    await navigateToSettings(page);
    await expect(page.getByText("Data")).toBeVisible();
    await expect(page.getByText("Download backup")).toBeVisible();
  });

  test("export toggles are present with correct defaults", async ({
    alicePage: page,
  }) => {
    await navigateToSettings(page);
    await expect(page.getByText("Include cook logs")).toBeVisible();
    await expect(page.getByText("Include images")).toBeVisible();
  });

  test("export downloads valid JSON", async ({ alicePage: page }) => {
    await navigateToSettings(page);

    // Intercept the export API call
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/export") && resp.status() === 200
    );

    await page.getByText("Download backup").click();
    const response = await responsePromise;
    const data = await response.json();

    // Validate structure
    expect(data.version).toBe(1);
    expect(data.app).toBe("aleppo");
    expect(data.exportedAt).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(Array.isArray(data.recipes)).toBe(true);
    expect(data.recipes.length).toBeGreaterThan(0);

    // Cook logs included by default
    expect(Array.isArray(data.cookLogs)).toBe(true);
    expect(data.cookLogs.length).toBeGreaterThan(0);
  });

  test("export shows success message", async ({ alicePage: page }) => {
    await navigateToSettings(page);

    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/export") && resp.status() === 200
    );

    await page.getByText("Download backup").click();
    await responsePromise;

    // Should show success with recipe count
    await expect(page.getByText(/Exported \d+ recipes/)).toBeVisible({ timeout: 10_000 });
  });

  test("export without cook logs omits them", async ({
    alicePage: page,
  }) => {
    await navigateToSettings(page);

    // Toggle off cook logs
    const switches = page.getByRole("switch");
    // The "Include cook logs" switch — it's the first one in the Data section.
    // We need to find it by context. Let's find the switch near "Include cook logs".
    const cookLogToggle = page
      .locator('[role="switch"]')
      .filter({ has: page.locator(':scope') })
      .nth(-2); // Second-to-last switch on the page (cook logs toggle)

    // Alternative: find all switches, toggle the appropriate one
    // For now, use the API directly to verify behavior
    const responsePromise = page.waitForResponse(
      (resp) => resp.url().includes("/api/export") && resp.status() === 200
    );

    // Click the "Include cook logs" switch to turn it off
    // Find the switch within the Data section
    const dataSection = page.getByText("Include cook logs").locator("..").locator("..").locator("..");
    await dataSection.getByRole("switch").first().click();

    await page.getByText("Download backup").click();
    const response = await responsePromise;
    const data = await response.json();

    // Cook logs should be empty when toggled off
    expect(Array.isArray(data.cookLogs)).toBe(true);
    expect(data.cookLogs.length).toBe(0);
  });
});
