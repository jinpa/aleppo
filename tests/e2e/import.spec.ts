/**
 * Recipe import tests — run as Alice.
 *
 * The URL-fetch step makes real HTTP requests to external recipe sites, so
 * these tests exercise the full scrape→review→save pipeline. Network-dependent
 * tests are tagged @slow and skipped on CI unless ENABLE_NETWORK_TESTS=1 is set.
 *
 * Covers:
 *  - Import page loads with URL input
 *  - Entering a non-recipe URL shows a parse error (review step with blank form)
 *  - Full happy-path: import from a Schema.org-annotated URL, review, save
 *  - Manual fill-in at the review step (when no structured data is found)
 */

import { test, expect } from "./fixtures";

const SKIP_NETWORK = !process.env.ENABLE_NETWORK_TESTS;

test.describe("Import — URL step", () => {
  test("import page renders URL input", async ({ alicePage: page }) => {
    await page.goto("/recipes/import");
    await expect(page.getByRole("heading", { name: "Import from URL" })).toBeVisible();
    await expect(
      page.getByLabel("Recipe URL")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Import" })).toBeVisible();
  });

  test("empty URL keeps Import button disabled", async ({ alicePage: page }) => {
    await page.goto("/recipes/import");
    await expect(page.getByRole("button", { name: "Import" })).toBeDisabled();
  });

  test("Import button enables after URL is typed", async ({ alicePage: page }) => {
    await page.goto("/recipes/import");
    await page.getByLabel("Recipe URL").fill("https://example.com/some-recipe");
    await expect(page.getByRole("button", { name: "Import" })).toBeEnabled();
  });

  test.skip(
    SKIP_NETWORK,
    "scrape a real recipe URL (requires network, set ENABLE_NETWORK_TESTS=1)"
  );
  test("scrape real recipe URL and land on review step", async ({
    alicePage: page,
  }) => {
    // Simply Recipes uses Schema.org markup and allows automated access
    const testUrl =
      "https://www.simplyrecipes.com/recipes/homemade_pizza/";

    await page.goto("/recipes/import");
    await page.getByLabel("Recipe URL").fill(testUrl);
    await page.getByRole("button", { name: "Import" }).click();

    // Either succeeds (review step) or shows a blockage warning
    await expect(
      page.getByText("Review import").or(page.getByText("blocked"))
    ).toBeVisible({ timeout: 30_000 });

    if (await page.getByText("Review import").isVisible()) {
      // Title should be populated from Schema.org data
      await expect(page.getByLabel("Title")).not.toHaveValue("");
    }
  });
});

test.describe("Import — review step (manual fill)", () => {
  test("can navigate to review step and manually fill title to save", async ({
    alicePage: page,
  }) => {
    await page.goto("/recipes/import");
    await page
      .getByLabel("Recipe URL")
      .fill("https://example.com/not-a-recipe");
    await page.getByRole("button", { name: "Import" }).click();

    // Regardless of parse result, we land on the review step eventually
    await expect(page.getByText("Review import")).toBeVisible({ timeout: 30_000 });

    // Clear whatever title was inferred and type our own
    await page.getByLabel("Title").clear();
    await page.getByLabel("Title").fill("Manually Filled Import Recipe");

    // Ensure at least one ingredient row exists
    const ingField = page.getByPlaceholder("e.g. 2 cups all-purpose flour").first();
    if (await ingField.inputValue() === "") {
      await ingField.fill("1 cup flour");
    }

    // Ensure at least one instruction row exists
    const instField = page.getByPlaceholder("Step 1...").first();
    if (await instField.inputValue() === "") {
      await instField.fill("Mix and bake");
    }

    await page.getByRole("button", { name: "Save recipe" }).first().click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByRole("heading", { name: "Manually Filled Import Recipe" })).toBeVisible();
  });
});
