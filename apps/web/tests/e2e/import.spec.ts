/**
 * File import tests — covers the unified File import tab with Aleppo JSON,
 * Mela, and Paprika formats.
 *
 * Key notes:
 * - TouchableOpacity renders as <div> without role="button" — use getByText()
 * - File input is set via page.setInputFiles() since the SPA uses DocumentPicker
 *   which falls back to <input type="file"> on web
 * - Auth is injected via localStorage in the fixture
 */

import path from "path";
import { test, expect } from "./fixtures";

const FIXTURES_DIR = path.join(__dirname, "fixtures");

async function navigateToImport(page: import("@playwright/test").Page) {
  await page.goto("/import");
  await expect(page.getByText("File")).toBeVisible({ timeout: 10_000 });
}

async function selectFileTab(page: import("@playwright/test").Page) {
  await page.getByText("File").click();
  await expect(page.getByText("Import from file")).toBeVisible();
}

async function uploadFixture(
  page: import("@playwright/test").Page,
  filename: string
) {
  const filePath = path.join(FIXTURES_DIR, filename);
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(filePath);
}

test.describe("Import — File tab", () => {
  test("file tab is reachable when signed in", async ({
    alicePage: page,
  }) => {
    await navigateToImport(page);
    await expect(page).not.toHaveURL(/\/login/);
    await expect(page.getByText("File")).toBeVisible();
  });

  test("file tab shows upload prompt", async ({ alicePage: page }) => {
    await navigateToImport(page);
    await selectFileTab(page);
    await expect(page.getByText("Choose file")).toBeVisible();
  });
});

test.describe("Import — Aleppo JSON", () => {
  test("preview shows recipes from .aleppo.json file", async ({
    alicePage: page,
  }) => {
    await navigateToImport(page);
    await selectFileTab(page);
    await uploadFixture(page, "sample-export.aleppo.json");

    // Should detect format and show preview
    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Aleppo", { exact: false })).toBeVisible();
    await expect(page.getByText("E2E Import Test Pancakes")).toBeVisible();
    await expect(page.getByText("E2E Import Test Salad")).toBeVisible();
  });

  test("import saves recipes and navigates to library", async ({
    alicePage: page,
  }) => {
    await navigateToImport(page);
    await selectFileTab(page);
    await uploadFixture(page, "sample-export.aleppo.json");

    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });

    // Both should be pre-selected (no duplicates on first import)
    await page.getByText("Import 2 recipes").click();

    // Wait for import to complete
    await expect(page.getByText("Import complete")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("2 recipes imported")).toBeVisible();

    // Navigate to recipes and verify
    await page.getByText("Go to my recipes").click();
    await expect(page.getByText("E2E Import Test Pancakes")).toBeVisible({ timeout: 10_000 });
  });

  test("duplicate detection flags re-imported recipes", async ({
    alicePage: page,
  }) => {
    // First import
    await navigateToImport(page);
    await selectFileTab(page);
    await uploadFixture(page, "sample-export.aleppo.json");
    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Import 2 recipes").click();
    await expect(page.getByText("Import complete")).toBeVisible({ timeout: 30_000 });

    // Second import — should flag duplicates
    await page.getByText("Import another file").click();
    await uploadFixture(page, "sample-export.aleppo.json");
    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Possible duplicate", { exact: false })).toBeVisible();
  });
});

test.describe("Import — Mela", () => {
  test("preview shows recipes from .melarecipes file", async ({
    alicePage: page,
  }) => {
    await navigateToImport(page);
    await selectFileTab(page);
    await uploadFixture(page, "sample.melarecipes");

    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Mela", { exact: false })).toBeVisible();
    await expect(page.getByText("E2E Mela Pasta")).toBeVisible();
    await expect(page.getByText("E2E Mela Smoothie")).toBeVisible();
  });

  test("import mela recipes saves successfully", async ({
    alicePage: page,
  }) => {
    await navigateToImport(page);
    await selectFileTab(page);
    await uploadFixture(page, "sample.melarecipes");

    await expect(page.getByText("2 recipes found")).toBeVisible({ timeout: 15_000 });
    await page.getByText("Import 2 recipes").click();

    await expect(page.getByText("Import complete")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("2 recipes imported")).toBeVisible();
  });
});
