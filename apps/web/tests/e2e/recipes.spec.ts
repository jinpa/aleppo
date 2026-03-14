/**
 * Recipe CRUD tests — run as Alice (authenticated).
 *
 * Key notes:
 * - After createRecipe(), we're already on the detail page via in-app navigation.
 *   Avoid page.goto(recipeUrl) as it causes a full reload that races with auth.
 * - Use SPA tab navigation (e.g. click "Queue" tab) instead of page.goto("/queue").
 * - TouchableOpacity renders as <div> without role="button"; use getByText().
 */

import { test, expect } from "./fixtures";

async function createRecipe(
  page: import("@playwright/test").Page,
  opts: {
    title: string;
    ingredient?: string;
    instruction?: string;
    isPublic?: boolean;
    tags?: string[];
    description?: string;
    prepTime?: string;
    cookTime?: string;
    servings?: string;
  }
) {
  const {
    title,
    ingredient = "1 cup flour",
    instruction = "Mix everything together",
    isPublic = false,
    tags = [],
    description,
    prepTime,
    cookTime,
    servings,
  } = opts;

  await page.goto("/new");
  await expect(page.getByText("New Recipe")).toBeVisible();

  await page.getByPlaceholder("Recipe title").fill(title);

  if (description) {
    await page.getByPlaceholder("Brief description").fill(description);
  }

  // Times — all three inputs share placeholder "0"; target by position
  if (prepTime) {
    await page.locator('input[placeholder="0"]').nth(0).fill(prepTime);
  }
  if (cookTime) {
    await page.locator('input[placeholder="0"]').nth(1).fill(cookTime);
  }
  if (servings) {
    await page.locator('input[placeholder="0"]').nth(2).fill(servings);
  }

  await page.getByPlaceholder("Ingredient 1").fill(ingredient);
  await page.getByPlaceholder("Step 1").fill(instruction);

  for (const tag of tags) {
    await page.getByPlaceholder("Add a tag").fill(tag);
    await page.keyboard.press("Enter");
  }

  if (isPublic) {
    await page.getByRole("switch").click();
    await expect(page.getByText("Anyone can view this recipe")).toBeVisible();
  }

  // Use the always-visible header "Save" button
  await page.getByText("Save", { exact: true }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  return page.url();
}

test.describe("Recipes — create", () => {
  test("create a minimal private recipe", async ({ alicePage: page }) => {
    const url = await createRecipe(page, { title: "Minimal Test Recipe" });
    await expect(page.getByText("Minimal Test Recipe")).toBeVisible();
    await expect(page.getByText("Private")).toBeVisible();
    expect(url).toMatch(/\/recipes\/[^/]+$/);
  });

  test("create a detailed recipe with description, times, and tags", async ({
    alicePage: page,
  }) => {
    await createRecipe(page, {
      title: "Detailed Pasta Carbonara",
      description: "Classic Roman pasta dish",
      ingredient: "200g spaghetti",
      instruction: "Cook pasta al dente",
      prepTime: "10",
      cookTime: "20",
      servings: "2",
      tags: ["italian", "pasta"],
    });

    await expect(page.getByText("Detailed Pasta Carbonara")).toBeVisible();
    await expect(page.getByText("Classic Roman pasta dish")).toBeVisible();
    await expect(page.getByText("30m")).toBeVisible();
    await expect(page.getByText("2 servings")).toBeVisible();
    await expect(page.getByText("italian", { exact: true })).toBeVisible();
    await expect(page.getByText("pasta", { exact: true })).toBeVisible();
  });

  test("create a public recipe", async ({ alicePage: page }) => {
    await createRecipe(page, {
      title: "Public Chocolate Cake",
      isPublic: true,
    });
    await expect(page.getByText("Public Chocolate Cake")).toBeVisible();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
  });

  test("add multiple ingredients and instructions", async ({
    alicePage: page,
  }) => {
    await page.goto("/new");
    await page.getByPlaceholder("Recipe title").fill("Multi-Step Recipe");

    await page.getByPlaceholder("Ingredient 1").fill("2 cups flour");
    await page.getByText("Add ingredient").click();
    await page.getByPlaceholder("Ingredient 2").fill("1 tsp salt");
    await page.getByText("Add ingredient").click();
    await page.getByPlaceholder("Ingredient 3").fill("2 eggs");

    await page.getByPlaceholder("Step 1").fill("Combine dry ingredients");
    await page.getByText("Add step").click();
    await page.getByPlaceholder("Step 2").fill("Add eggs and mix");

    await page.getByText("Save", { exact: true }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await expect(page.getByText("Multi-Step Recipe")).toBeVisible();
    await expect(page.getByText("2 cups flour")).toBeVisible();
    await expect(page.getByText("1 tsp salt")).toBeVisible();
    await expect(page.getByText("2 eggs")).toBeVisible();
    await expect(page.getByText("Combine dry ingredients")).toBeVisible();
    await expect(page.getByText("Add eggs and mix")).toBeVisible();
  });

  test("title is required — shows validation error", async ({
    alicePage: page,
  }) => {
    await page.goto("/new");
    await page.getByText("Save", { exact: true }).click();
    await expect(page.getByText("Title is required")).toBeVisible();
  });
});

test.describe("Recipes — edit", () => {
  test("edit an existing recipe", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Recipe To Edit" });
    // Already on detail page — use testID for in-SPA navigation to edit
    await page.locator('[data-testid="recipe-edit-btn"]').click();
    await expect(page.getByText("Edit Recipe")).toBeVisible({ timeout: 10_000 });

    await page.getByPlaceholder("Recipe title").clear();
    await page.getByPlaceholder("Recipe title").fill("Recipe After Edit");
    await page.getByText("Save changes").click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    // edit.tsx uses router.replace — detail screen remounts with fresh data
    await expect(page.getByText("Recipe After Edit")).toBeVisible({ timeout: 10_000 });
  });

  test("edit: toggle privacy from private to public", async ({
    alicePage: page,
  }) => {
    await createRecipe(page, { title: "Privacy Toggle Recipe" });
    // Already on detail page
    await page.locator('[data-testid="recipe-edit-btn"]').click();
    await expect(page.getByText("Edit Recipe")).toBeVisible({ timeout: 10_000 });
    await page.getByRole("switch").click();
    await expect(page.getByText("Anyone can view this recipe")).toBeVisible();
    await page.getByText("Save changes").click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
  });
});

test.describe("Recipes — delete", () => {
  test("delete a recipe via the confirmation dialog", async ({
    alicePage: page,
  }) => {
    const recipeUrl = await createRecipe(page, { title: "Recipe To Delete" });
    // Already on detail page
    const recipeId = new URL(recipeUrl).pathname.split("/").pop()!;

    await page.locator('[data-testid="recipe-delete-btn"]').click();
    await expect(page.getByText("Delete recipe")).toBeVisible();
    await page.getByText("Delete", { exact: true }).click();

    // confirmDelete now routes to /(tabs)/recipes
    await page.waitForURL(/\/recipes$/, { timeout: 10_000 });
  });
});

test.describe("Recipes — want-to-cook queue", () => {
  test("add a recipe to the queue", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Queue Me Recipe" });
    // Already on detail page
    await page.getByText("Want to cook").click();
    await expect(page.getByText("In queue")).toBeVisible();
  });

  test("queued recipe appears on the /queue page", async ({
    alicePage: page,
  }) => {
    await createRecipe(page, { title: "Queue Page Recipe" });
    // Already on detail page
    await page.getByText("Want to cook").click();
    await expect(page.getByText("In queue")).toBeVisible();

    // Navigate to queue via tab bar (in-SPA navigation, no page reload)
    await page.getByText("Queue", { exact: true }).click();
    // Recipe title appears in nav stack (hidden) AND queue page (visible); .last() gets visible
    await expect(page.getByText("Queue Page Recipe").last()).toBeVisible({ timeout: 10_000 });
  });

  test("remove a recipe from the queue", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Dequeue Recipe" });
    // Already on detail page
    await page.getByText("Want to cook").click();
    await expect(page.getByText("In queue")).toBeVisible({ timeout: 10_000 });

    // Wait for the POST to finish (queueLoading guard prevents clicks while loading)
    await page.waitForTimeout(1_000);

    await page.getByText("In queue").click();
    await expect(page.getByText("Want to cook")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Recipes — list page", () => {
  test("recipes page is accessible when signed in", async ({
    alicePage: page,
  }) => {
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);
  });
});

test.describe("Recipes — sort", () => {
  test("sort by A-Z and reverse", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Xsort AAA" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    await createRecipe(page, { title: "Xsort ZZZ" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Filter to just our sort-test recipes
    await page.getByPlaceholder("Search recipes").fill("Xsort");
    await expect(page.getByText("Xsort AAA").last()).toBeVisible({ timeout: 10_000 });

    // Click A-Z sort pill
    await page.getByText("A-Z", { exact: true }).click();
    await expect(page.getByText("Xsort AAA").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Xsort ZZZ").last()).toBeVisible();

    // Click again to reverse direction
    await page.getByText("A-Z", { exact: true }).click();
    await expect(page.getByText("Xsort AAA").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Xsort ZZZ").last()).toBeVisible();
  });

  test("sort by total time", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Xtime Quick", prepTime: "5", cookTime: "5" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    await createRecipe(page, { title: "Xtime Slow", prepTime: "60", cookTime: "60" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Filter to just our time-test recipes
    await page.getByPlaceholder("Search recipes").fill("Xtime");
    await expect(page.getByText("Xtime Quick").last()).toBeVisible({ timeout: 10_000 });

    await page.getByText("Total time", { exact: true }).click();
    await expect(page.getByText("Xtime Quick").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Xtime Slow").last()).toBeVisible();
  });
});

test.describe("Recipes — bulk delete", () => {
  test("enter edit mode, select recipes, and bulk delete", async ({
    alicePage: page,
  }) => {
    // Create two recipes to delete
    await createRecipe(page, { title: "Xdel Alpha" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    await createRecipe(page, { title: "Xdel Beta" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Filter to just our test recipes
    await page.getByPlaceholder("Search recipes").fill("Xdel");
    await expect(page.getByText("Xdel Alpha").last()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Xdel Beta").last()).toBeVisible();

    // Enter edit mode
    await page.getByText("Edit", { exact: true }).click();
    await expect(page.getByText("0 selected")).toBeVisible();

    // Select both recipes by tapping them
    await page.getByText("Xdel Alpha").last().click();
    await expect(page.getByText("1 selected")).toBeVisible();

    await page.getByText("Xdel Beta").last().click();
    await expect(page.getByText("2 selected")).toBeVisible();

    // Bottom bar should show delete button
    await expect(page.getByText("Delete (2)")).toBeVisible();

    // Tap delete and confirm
    await page.getByText("Delete (2)").click();
    await expect(page.getByText("Delete 2 recipes")).toBeVisible();
    await page.getByText("Delete", { exact: true }).click();

    // Should exit edit mode and recipes should be gone
    await expect(page.getByText("Xdel Alpha")).not.toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Xdel Beta")).not.toBeVisible();
  });

  test("select all and deselect all", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Xsel Recipe A" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    await createRecipe(page, { title: "Xsel Recipe B" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Filter to just our test recipes
    await page.getByPlaceholder("Search recipes").fill("Xsel");
    await expect(page.getByText("Xsel Recipe A").last()).toBeVisible({ timeout: 10_000 });

    // Enter edit mode
    await page.getByText("Edit", { exact: true }).click();
    await expect(page.getByText("0 selected")).toBeVisible();

    // Select All
    await page.getByText("Select All", { exact: true }).click();
    await expect(page.getByText("2 selected")).toBeVisible();

    // Deselect All
    await page.getByText("Deselect All", { exact: true }).click();
    await expect(page.getByText("0 selected")).toBeVisible();

    // Cancel edit mode
    await page.getByText("Cancel", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible();
  });

  test("cancel edit mode clears selection", async ({ alicePage: page }) => {
    await createRecipe(page, { title: "Xcancel Recipe" });
    await page.getByText("Recipes", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Filter to isolate our test recipe
    await page.getByPlaceholder("Search recipes").fill("Xcancel");
    await expect(page.getByText("Xcancel Recipe").last()).toBeVisible({ timeout: 10_000 });

    await page.getByText("Edit", { exact: true }).click();
    await page.getByText("Xcancel Recipe").last().click();
    await expect(page.getByText("1 selected")).toBeVisible();

    await page.getByText("Cancel", { exact: true }).click();
    await expect(page.getByText("My Recipes")).toBeVisible();
    // Re-enter edit mode — selection should be cleared
    await page.getByText("Edit", { exact: true }).click();
    await expect(page.getByText("0 selected")).toBeVisible();
  });
});
