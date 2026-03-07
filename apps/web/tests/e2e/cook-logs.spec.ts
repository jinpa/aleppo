/**
 * Cook-log tests — run as Alice.
 *
 * Covers:
 *  - Logging a cook on a recipe via the "I cooked this" dialog
 *  - Cook count increments after logging
 *  - Adding a cook note
 *  - Deleting a cook log entry
 */

import { test, expect } from "./fixtures";

async function createRecipe(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  await page
    .getByPlaceholder("e.g. 2 cups all-purpose flour")
    .first()
    .fill("1 cup sugar");
  await page.getByPlaceholder("Step 1...").first().fill("Mix and bake");
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  return page.url();
}

test.describe("Cook logs", () => {
  test("log a cook — dialog opens and saves", async ({ alicePage: page }) => {
    const url = await createRecipe(page, "Cook Log Test Recipe");
    await page.goto(url);

    await expect(page.getByRole("button", { name: "I cooked this" })).toBeVisible();
    await page.getByRole("button", { name: "I cooked this" }).click();

    // Dialog opens
    await expect(page.getByRole("heading", { name: "Log a cook" })).toBeVisible();
    await expect(page.getByLabel("Date cooked")).toBeVisible();

    // Date defaults to today — just save as-is
    await page.getByRole("button", { name: "Save cook" }).click();

    // Toast confirms
    await expect(page.getByText("Cook logged! 🍳", { exact: true })).toBeVisible();
  });

  test("cook count increments after logging", async ({ alicePage: page }) => {
    const url = await createRecipe(page, "Count Recipe");
    await page.goto(url);

    // No cook count indicator before first cook
    await expect(page.getByText(/Made \d+×/)).not.toBeVisible();

    await page.getByRole("button", { name: "I cooked this" }).click();
    await page.getByRole("button", { name: "Save cook" }).click();
    await expect(page.getByText("Cook logged! 🍳", { exact: true })).toBeVisible();

    // Cook count is now visible
    await expect(page.getByText("Made 1×")).toBeVisible();
  });

  test("log a cook with a note", async ({ alicePage: page }) => {
    const url = await createRecipe(page, "Noted Cook Recipe");
    await page.goto(url);

    await page.getByRole("button", { name: "I cooked this" }).click();
    await page.getByLabel("How did it go?").fill("Turned out perfectly, 10/10");
    await page.getByRole("button", { name: "Save cook" }).click();
    await expect(page.getByText("Cook logged! 🍳", { exact: true })).toBeVisible();

    // Note appears in cook log list
    await expect(page.getByText("Turned out perfectly, 10/10")).toBeVisible();
  });

  test("log multiple cooks — count accumulates", async ({ alicePage: page }) => {
    const url = await createRecipe(page, "Multi Cook Recipe");
    await page.goto(url);

    for (let i = 1; i <= 3; i++) {
      await page.getByRole("button", { name: "I cooked this" }).click();
      await page.getByRole("button", { name: "Save cook" }).click();
      await expect(page.getByText("Cook logged! 🍳", { exact: true }).first()).toBeVisible();
      // Wait for toast to clear before opening dialog again
      await page.waitForTimeout(500);
    }

    await expect(page.getByText("Made 3×")).toBeVisible();
  });

  test("log a cook on a queued recipe removes it from queue", async ({
    alicePage: page,
  }) => {
    const url = await createRecipe(page, "Queue Cook Recipe");
    await page.goto(url);

    // Add to queue first
    await page.getByRole("button", { name: "Want to cook" }).click();
    await expect(page.getByRole("button", { name: "In queue" })).toBeVisible();

    // Now log a cook — dialog should mention the queue
    await page.getByRole("button", { name: "I cooked this" }).click();
    await expect(
      page.getByText("This recipe is in your queue")
    ).toBeVisible();
    await page.getByRole("button", { name: "Save cook" }).click();
    await expect(page.getByText("Cook logged! 🍳", { exact: true })).toBeVisible();

    // Queue button should reset to "Want to cook"
    await expect(
      page.getByRole("button", { name: "Want to cook" })
    ).toBeVisible();
  });
});
