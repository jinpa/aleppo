/**
 * Recipe CRUD tests — run as Alice (authenticated).
 *
 * Covers:
 *  - Creating a minimal private recipe
 *  - Creating a recipe with more detail (description, times, tags)
 *  - Making a recipe public via the privacy toggle
 *  - Viewing the recipe detail page
 *  - Editing a recipe
 *  - Deleting a recipe
 *  - Adding / removing from the want-to-cook queue
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

  await page.goto("/recipes/new");
  await expect(page.getByRole("heading", { name: "New recipe" })).toBeVisible();

  await page.getByLabel("Title").fill(title);

  if (description) {
    await page.getByLabel("Description").fill(description);
  }
  if (prepTime) {
    await page.getByLabel("Prep (min)").fill(prepTime);
  }
  if (cookTime) {
    await page.getByLabel("Cook (min)").fill(cookTime);
  }
  if (servings) {
    await page.getByLabel("Servings").fill(servings);
  }

  // Fill first ingredient (form starts with one empty row)
  await page
    .getByPlaceholder("e.g. 2 cups all-purpose flour")
    .first()
    .fill(ingredient);

  // Fill first instruction step
  await page.getByPlaceholder("Step 1...").first().fill(instruction);

  // Add tags
  for (const tag of tags) {
    await page.getByPlaceholder("Add a tag (e.g. Italian, weeknight)").fill(tag);
    await page.keyboard.press("Enter");
  }

  if (isPublic) {
    await page.getByRole("switch").click();
    await expect(page.getByText("Public recipe")).toBeVisible();
  }

  await page.getByRole("button", { name: "Save recipe" }).click();
  // Wait for navigation to the saved recipe's UUID-based URL (not /recipes/new or /recipes/import)
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  return page.url();
}

test.describe("Recipes — create", () => {
  test("create a minimal private recipe", async ({ alicePage: page }) => {
    const url = await createRecipe(page, { title: "Minimal Test Recipe" });
    await expect(page.getByRole("heading", { name: "Minimal Test Recipe" })).toBeVisible();
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

    await expect(page.getByRole("heading", { name: "Detailed Pasta Carbonara" })).toBeVisible();
    await expect(page.getByText("Classic Roman pasta dish")).toBeVisible();
    await expect(page.getByText("30 min")).toBeVisible(); // 10 + 20
    await expect(page.getByText("2 servings")).toBeVisible();
    await expect(page.getByText("italian", { exact: true })).toBeVisible();
    await expect(page.getByText("pasta", { exact: true })).toBeVisible();
  });

  test("create a public recipe", async ({ alicePage: page }) => {
    await createRecipe(page, {
      title: "Public Chocolate Cake",
      isPublic: true,
    });
    await expect(page.getByRole("heading", { name: "Public Chocolate Cake" })).toBeVisible();
    await expect(page.getByText("Public", { exact: true })).toBeVisible();
  });

  test("add multiple ingredients and instructions", async ({
    alicePage: page,
  }) => {
    await page.goto("/recipes/new");
    await page.getByLabel("Title").fill("Multi-Step Recipe");

    // First ingredient
    await page
      .getByPlaceholder("e.g. 2 cups all-purpose flour")
      .first()
      .fill("2 cups flour");

    // Add second ingredient
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    await page
      .getByPlaceholder("e.g. 2 cups all-purpose flour")
      .nth(1)
      .fill("1 tsp salt");

    // Add third ingredient
    await page.getByRole("button", { name: /^Add$/ }).first().click();
    await page
      .getByPlaceholder("e.g. 2 cups all-purpose flour")
      .nth(2)
      .fill("2 eggs");

    // First instruction
    await page.getByPlaceholder("Step 1...").first().fill("Combine dry ingredients");

    // Add second step
    await page.getByRole("button", { name: "Add step" }).click();
    await page.getByPlaceholder("Step 2...").fill("Add eggs and mix");

    await page.getByRole("button", { name: "Save recipe" }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await expect(page.getByRole("heading", { name: "Multi-Step Recipe" })).toBeVisible();
    await expect(page.getByText("2 cups flour")).toBeVisible();
    await expect(page.getByText("1 tsp salt")).toBeVisible();
    await expect(page.getByText("2 eggs")).toBeVisible();
    await expect(page.getByText("Combine dry ingredients")).toBeVisible();
    await expect(page.getByText("Add eggs and mix")).toBeVisible();
  });

  test("title is required — shows validation error", async ({
    alicePage: page,
  }) => {
    await page.goto("/recipes/new");
    await page.getByRole("button", { name: "Save recipe" }).click();
    await expect(page.getByText("Title is required")).toBeVisible();
  });
});

test.describe("Recipes — edit", () => {
  test("edit an existing recipe", async ({ alicePage: page }) => {
    const recipeUrl = await createRecipe(page, { title: "Recipe To Edit" });
    await page.goto(recipeUrl + "/edit");
    await expect(page.getByRole("heading", { name: "Edit recipe" })).toBeVisible();

    await page.getByLabel("Title").clear();
    await page.getByLabel("Title").fill("Recipe After Edit");
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

    await expect(page.getByRole("heading", { name: "Recipe After Edit" })).toBeVisible();
  });

  test("edit: toggle privacy from private to public", async ({
    alicePage: page,
  }) => {
    const recipeUrl = await createRecipe(page, { title: "Privacy Toggle Recipe" });
    await page.goto(recipeUrl + "/edit");
    await page.getByRole("switch").click();
    await expect(page.getByText("Public recipe")).toBeVisible();
    await page.getByRole("button", { name: "Save changes" }).click();
    await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });
    await expect(page.getByText("Public")).toBeVisible();
  });
});

test.describe("Recipes — delete", () => {
  test("delete a recipe via the confirmation dialog", async ({
    alicePage: page,
  }) => {
    const recipeUrl = await createRecipe(page, { title: "Recipe To Delete" });
    await page.goto(recipeUrl);

    // Open delete confirmation
    await page.getByRole("button", { name: "Delete recipe" }).click();
    await expect(page.getByText("Delete recipe?")).toBeVisible();
    await page.getByRole("button", { name: "Delete" }).click();

    // handleDelete calls router.push("/") after success
    await page.waitForURL("/", { timeout: 10_000 });
  });
});

test.describe("Recipes — want-to-cook queue", () => {
  test("add a recipe to the queue", async ({ alicePage: page }) => {
    const recipeUrl = await createRecipe(page, { title: "Queue Me Recipe" });
    await page.goto(recipeUrl);

    await page.getByRole("button", { name: "Want to cook" }).click();
    await expect(page.getByRole("button", { name: "In queue" })).toBeVisible();
  });

  test("queued recipe appears on the /queue page", async ({
    alicePage: page,
  }) => {
    const recipeUrl = await createRecipe(page, { title: "Queue Page Recipe" });
    await page.goto(recipeUrl);
    await page.getByRole("button", { name: "Want to cook" }).click();
    await expect(page.getByRole("button", { name: "In queue" })).toBeVisible();

    await page.goto("/queue");
    await expect(page.getByText("Queue Page Recipe")).toBeVisible();
  });

  test("remove a recipe from the queue", async ({ alicePage: page }) => {
    const recipeUrl = await createRecipe(page, { title: "Dequeue Recipe" });
    await page.goto(recipeUrl);

    await page.getByRole("button", { name: "Want to cook" }).click();
    await expect(page.getByRole("button", { name: "In queue" })).toBeVisible();

    await page.getByRole("button", { name: "In queue" }).click();
    await expect(page.getByRole("button", { name: "Want to cook" })).toBeVisible();
  });
});

test.describe("Recipes — list page", () => {
  test("recipes page is accessible when signed in", async ({
    alicePage: page,
  }) => {
    await page.goto("/recipes");
    await expect(page).toHaveURL("/recipes");
    // Page should not redirect to signin
    await expect(page).not.toHaveURL(/\/auth\/signin/);
  });
});
