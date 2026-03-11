/**
 * Cook-log tests — run as Alice.
 *
 * After createRecipe(), we're already on the detail page via in-app navigation.
 * No need for page.goto(url) — staying on the page avoids the auth race.
 */

import { test, expect } from "./fixtures";

async function createRecipe(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  await page.goto("/new");
  await page.getByPlaceholder("Recipe title").fill(title);
  await page.getByPlaceholder("Ingredient 1").fill("1 cup sugar");
  await page.getByPlaceholder("Step 1").fill("Mix and bake");
  await page.getByText("Save", { exact: true }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return page.url();
}

test.describe("Cook logs", () => {
  test("log a cook — modal opens and saves", async ({ alicePage: page }) => {
    await createRecipe(page, "Cook Log Test Recipe");
    // Already on detail page via in-app navigation

    await expect(page.getByText("Log a cook")).toBeVisible();
    await page.getByText("Log a cook").click();

    await expect(page.getByPlaceholder("YYYY-MM-DD")).toBeVisible();
    await page.getByText("Log cook").click();

    await expect(page.getByText("Made 1×")).toBeVisible({ timeout: 10_000 });
  });

  test("cook count increments after logging", async ({ alicePage: page }) => {
    await createRecipe(page, "Count Recipe");

    await expect(page.getByText(/Made \d+×/)).not.toBeVisible();

    await page.getByText("Log a cook").click();
    await page.getByText("Log cook").click();

    await expect(page.getByText("Made 1×")).toBeVisible({ timeout: 10_000 });
  });

  test("log a cook with a note", async ({ alicePage: page }) => {
    await createRecipe(page, "Noted Cook Recipe");

    await page.getByText("Log a cook").click();
    await page.getByPlaceholder("How did it go?").fill("Turned out perfectly, 10/10");
    await page.getByText("Log cook").click();

    await expect(
      page.getByText("Turned out perfectly, 10/10")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("log multiple cooks — count accumulates", async ({
    alicePage: page,
  }) => {
    await createRecipe(page, "Multi Cook Recipe");

    for (let i = 1; i <= 3; i++) {
      // Use .first() because the modal title also contains "Log a cook"
      await page.getByText("Log a cook").first().click();
      await page.getByText("Log cook").click();
      await expect(page.getByText(`Made ${i}×`)).toBeVisible({
        timeout: 10_000,
      });
    }

    await expect(page.getByText("Made 3×")).toBeVisible();
  });

  test("log a cook on a queued recipe", async ({
    alicePage: page,
  }) => {
    await createRecipe(page, "Queue Cook Recipe");

    // Add to queue
    await page.getByText("Want to cook").click();
    await expect(page.getByText("In queue")).toBeVisible();

    // Log a cook — modal title also contains "Log a cook" so use .first()
    await page.getByText("Log a cook").first().click();
    await page.getByText("Log cook").click();
    await expect(page.getByText("Made 1×")).toBeVisible({ timeout: 10_000 });
  });
});
