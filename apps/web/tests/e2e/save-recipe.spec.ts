/**
 * "Save to My Recipes" (fork) tests.
 *
 * Bob creates a public recipe, Alice saves a copy to her own collection.
 * Tests cover:
 * - "Save to mine" button visibility (shown on others' recipes, hidden on own)
 * - Save without modifications → "from" attribution
 * - Save with modifications → "adapted from" attribution
 * - Editing a saved copy sets isAdapted
 * - Source attribution when recipe has an external sourceUrl
 */

import { test, expect } from "./fixtures";

const BASE = "http://localhost:3000";

/** Bob creates a public recipe via the New form. Returns the recipe URL. */
async function bobCreatesPublicRecipe(
  bobPage: import("@playwright/test").Page,
  opts: {
    title: string;
    ingredient?: string;
    instruction?: string;
    description?: string;
    sourceUrl?: string;
    sourceName?: string;
  }
): Promise<string> {
  const {
    title,
    ingredient = "1 cup flour",
    instruction = "Mix everything together",
    description,
    sourceUrl,
    sourceName,
  } = opts;

  await bobPage.goto("/new");
  await expect(bobPage.getByText("New Recipe")).toBeVisible();

  await bobPage.getByPlaceholder("Recipe title").fill(title);

  if (description) {
    await bobPage.getByPlaceholder("Brief description").fill(description);
  }

  await bobPage.getByPlaceholder("Ingredient 1").fill(ingredient);
  await bobPage.getByPlaceholder("Step 1").fill(instruction);

  // Set source if provided
  if (sourceUrl) {
    await bobPage.getByPlaceholder("Source URL (optional)").fill(sourceUrl);
  }
  if (sourceName) {
    await bobPage.getByPlaceholder("Source name (optional)").fill(sourceName);
  }

  // Make it public
  await bobPage.getByRole("switch").click();
  await expect(bobPage.getByText("Anyone can view this recipe")).toBeVisible();

  await bobPage.getByText("Save", { exact: true }).click();
  await bobPage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  return bobPage.url();
}

/** Extract recipe ID from a recipe URL like /recipes/<uuid> */
function recipeIdFromUrl(url: string): string {
  return new URL(url).pathname.split("/").pop()!;
}

test.describe("Save to mine — button visibility", () => {
  test("'Save to mine' button is visible on another user's recipe", async ({
    alicePage,
    bobPage,
  }) => {
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, {
      title: `Bob Visibility Recipe ${Date.now()}`,
    });
    const recipeId = recipeIdFromUrl(recipeUrl);

    await alicePage.goto(`/recipes/${recipeId}`);
    await expect(alicePage.getByText("Save to mine")).toBeVisible({ timeout: 10_000 });
  });

  test("'Save to mine' button is NOT visible on own recipe", async ({
    alicePage,
  }) => {
    await alicePage.goto("/new");
    await alicePage.getByPlaceholder("Recipe title").fill("Alice Own Recipe");
    await alicePage.getByPlaceholder("Ingredient 1").fill("1 egg");
    await alicePage.getByPlaceholder("Step 1").fill("Crack egg");
    await alicePage.getByText("Save", { exact: true }).click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await expect(alicePage.getByText("Save to mine")).not.toBeVisible();
    // Owner should see "Log a cook" instead
    await expect(alicePage.getByText("Log a cook")).toBeVisible();
  });
});

test.describe("Save to mine — no modifications (from)", () => {
  test("saving without changes shows 'from' attribution with author name", async ({
    alicePage,
    bobPage,
    testUsers,
  }) => {
    const title = `Bob No-Mod Recipe ${Date.now()}`;
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, { title });
    const recipeId = recipeIdFromUrl(recipeUrl);

    // Alice views Bob's recipe and taps "Save to mine"
    await alicePage.goto(`/recipes/${recipeId}`);
    await expect(alicePage.getByText("Save to mine")).toBeVisible({ timeout: 10_000 });
    await alicePage.getByText("Save to mine").click();

    // Should be on the save/review form
    await expect(alicePage.getByText("Save to My Recipes", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Title should be pre-filled
    const titleInput = alicePage.getByPlaceholder("Recipe title");
    await expect(titleInput).toHaveValue(title);

    // Save without changes — use the bottom "Save to my recipes" button
    await alicePage.getByText("Save", { exact: true }).click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // New recipe detail page — should NOT be the original recipe
    const newUrl = alicePage.url();
    expect(recipeIdFromUrl(newUrl)).not.toBe(recipeId);

    // Should show "from <author name>" (not adapted)
    // The original detail page may still be in the nav stack (hidden), so use .last()
    await expect(alicePage.getByText(title).last()).toBeVisible();
    await expect(
      alicePage.getByText(`from ${testUsers.bob.name}`, { exact: false }).last()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Save to mine — with modifications (adapted from)", () => {
  test("saving with changes shows 'adapted from' attribution", async ({
    alicePage,
    bobPage,
    testUsers,
  }) => {
    const title = `Bob Adapt Recipe ${Date.now()}`;
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, { title });
    const recipeId = recipeIdFromUrl(recipeUrl);

    await alicePage.goto(`/recipes/${recipeId}`);
    await expect(alicePage.getByText("Save to mine")).toBeVisible({ timeout: 10_000 });
    await alicePage.getByText("Save to mine").click();

    await expect(alicePage.getByText("Save to My Recipes", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Modify the title
    const titleInput = alicePage.getByPlaceholder("Recipe title");
    await titleInput.clear();
    const modifiedTitle = `My Version of ${title}`;
    await titleInput.fill(modifiedTitle);

    await alicePage.getByText("Save", { exact: true }).click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Should show "adapted from <author name>"
    await expect(alicePage.getByText(modifiedTitle)).toBeVisible();
    await expect(
      alicePage.getByText(`adapted from ${testUsers.bob.name}`, { exact: false })
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Save to mine — external source attribution", () => {
  test("saved recipe preserves external sourceUrl and sourceName", async ({
    alicePage,
    bobPage,
  }) => {
    const title = `Bob External Source ${Date.now()}`;
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, {
      title,
      sourceUrl: "https://www.seriouseats.com/example",
      sourceName: "Serious Eats",
    });
    const recipeId = recipeIdFromUrl(recipeUrl);

    await alicePage.goto(`/recipes/${recipeId}`);
    await expect(alicePage.getByText("Save to mine")).toBeVisible({ timeout: 10_000 });
    await alicePage.getByText("Save to mine").click();

    await expect(alicePage.getByText("Save to My Recipes", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Save without changes
    await alicePage.getByText("Save", { exact: true }).click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Should show "from Serious Eats" (external source preserved)
    // The original detail page may still be in the nav stack, so use .last()
    await expect(
      alicePage.getByText("from Serious Eats", { exact: false }).last()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Save to mine — edit marks as adapted", () => {
  test("editing a saved copy sets isAdapted to true", async ({
    alicePage,
    bobPage,
    testUsers,
  }) => {
    const title = `Bob Edit-After-Save ${Date.now()}`;
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, { title });
    const recipeId = recipeIdFromUrl(recipeUrl);

    // Alice saves without modifications (shows "from")
    await alicePage.goto(`/recipes/${recipeId}`);
    await alicePage.getByText("Save to mine").click();
    await expect(alicePage.getByText("Save to My Recipes", { exact: true })).toBeVisible({ timeout: 10_000 });
    await alicePage.getByText("Save", { exact: true }).click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // Confirm "from" (not adapted yet)
    await expect(
      alicePage.getByText(`from ${testUsers.bob.name}`, { exact: false })
    ).toBeVisible({ timeout: 5_000 });

    // Now edit the copy
    await alicePage.locator('[data-testid="recipe-edit-btn"]').click();
    await expect(alicePage.getByText("Edit Recipe")).toBeVisible({ timeout: 10_000 });

    // Change the title
    const titleInput = alicePage.getByPlaceholder("Recipe title");
    await titleInput.clear();
    await titleInput.fill(`Edited ${title}`);

    await alicePage.getByText("Save changes").click();
    await alicePage.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // After editing, should show "adapted from"
    await expect(
      alicePage.getByText(`adapted from ${testUsers.bob.name}`, { exact: false })
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Save to mine — notes and privacy defaults", () => {
  test("notes are empty and privacy defaults to private on save form", async ({
    alicePage,
    bobPage,
  }) => {
    const title = `Bob Defaults Recipe ${Date.now()}`;
    const recipeUrl = await bobCreatesPublicRecipe(bobPage, { title });
    const recipeId = recipeIdFromUrl(recipeUrl);

    await alicePage.goto(`/recipes/${recipeId}`);
    await alicePage.getByText("Save to mine").click();
    await expect(alicePage.getByText("Save to My Recipes", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Notes should be empty
    const notesInput = alicePage.getByPlaceholder("Personal notes");
    await expect(notesInput).toHaveValue("");

    // Privacy should default to private
    await expect(alicePage.getByText("Private", { exact: true })).toBeVisible();
    await expect(alicePage.getByText("Only you can see this recipe")).toBeVisible();
  });
});
