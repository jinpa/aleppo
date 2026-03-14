/**
 * Social feature tests — follow/unfollow, profiles, and the following feed.
 *
 * Key notes:
 * - "Follow" text only appears in the follow button (no ambiguity with stats).
 * - "Following" appears in both the stats "Following" label AND the follow button.
 *   Use .last() to target the button when unfollowing via UI.
 * - Use API helpers for follow/unfollow setup/cleanup to avoid UI timing issues.
 * - Every page.goto() to a protected route must wait for content to render
 *   (auth race: localStorage may not be read before the SPA renders).
 */

import { test, expect } from "./fixtures";

const BASE = "http://localhost:3000";

// Social tests do many page.goto() navigations which can be slow under dev server load.
// Set a generous test timeout to avoid premature context teardown.
test.setTimeout(60_000);

async function createPublicRecipeAndLog(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  await page.goto("/new");
  await expect(page.getByPlaceholder("Recipe title")).toBeVisible({ timeout: 20_000 });
  await page.getByPlaceholder("Recipe title").fill(title);
  await page.getByPlaceholder("Ingredient 1").fill("1 cup flour");
  await page.getByPlaceholder("Step 1").fill("Mix and bake");

  await page.getByRole("switch").click();
  await expect(page.getByText("Anyone can view this recipe")).toBeVisible();

  await page.getByText("Save", { exact: true }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  const recipeUrl = page.url();

  await page.getByText("Log a cook").first().click();
  await page.getByText("Log cook").click();
  await expect(page.getByText("Made 1×")).toBeVisible({ timeout: 10_000 });

  return recipeUrl;
}

/** Follow targetId via direct API call. Page must be on an http origin. */
async function followViaAPI(
  page: import("@playwright/test").Page,
  targetId: string
) {
  await page.evaluate(async (id) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    await fetch("/api/follows", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ followingId: id }),
    });
  }, targetId);
}

/** Unfollow targetId via direct API call. Page must be on an http origin. */
async function unfollowViaAPI(
  page: import("@playwright/test").Page,
  targetId: string
) {
  await page.evaluate(async (id) => {
    const token = localStorage.getItem("auth_token");
    if (!token) return;
    await fetch("/api/follows", {
      method: "DELETE",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ followingId: id }),
    });
  }, targetId);
}

/**
 * Navigate to a protected route and wait for the SPA to render.
 * Avoids auth race where localStorage isn't read before first render.
 * Uses a longer default timeout because the dev server can be slow under load.
 */
async function gotoAndWait(
  page: import("@playwright/test").Page,
  path: string,
  waitForText: string,
  timeout = 20_000
) {
  await page.goto(path, { timeout: 30_000 });
  await expect(page.getByText(waitForText).first()).toBeVisible({ timeout });
}

test.describe("Social — profiles", () => {
  test("Alice can view Bob's public profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await gotoAndWait(page, `/u/${testUsers.bob.id}`, testUsers.bob.name);
    // "Follow" text only exists in the follow button (no stats labeled "Follow")
    await expect(page.getByText("Follow", { exact: true })).toBeVisible();
  });

  test("Alice sees Edit profile button on her own profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await gotoAndWait(page, `/u/${testUsers.alice.id}`, "Edit profile");
    await expect(page.getByText("Follow", { exact: true })).not.toBeVisible();
  });

  test("profile shows a recipe from its owner", async ({
    bobPage: page,
    testUsers,
  }) => {
    await createPublicRecipeAndLog(page, "Bob Public Count Recipe");
    await gotoAndWait(page, `/u/${testUsers.bob.id}`, "Bob Public Count Recipe");
  });
});

test.describe("Social — follow / unfollow", () => {
  test("Alice follows Bob — button changes to Following", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Ensure clean state
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await unfollowViaAPI(page, testUsers.bob.id);

    await gotoAndWait(page, `/u/${testUsers.bob.id}`, testUsers.bob.name);
    await expect(page.getByText("Follow", { exact: true })).toBeVisible();

    await page.getByText("Follow", { exact: true }).click();
    // count=2 means both stats label AND button show "Following" → POST completed
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });

  test("Alice unfollows Bob — button reverts to Follow", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Set up follow state via API
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(page, testUsers.bob.id);

    await gotoAndWait(page, `/u/${testUsers.bob.id}`, testUsers.bob.name);

    // Should show "Following" (count=2: stats label + button)
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Now unfollow via UI
    await page.getByText("Following", { exact: true }).last().click();
    await expect(page.getByText("Follow", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Social — feed", () => {
  test("feed page loads", async ({ alicePage: page }) => {
    await gotoAndWait(page, "/feed", "Following Feed");
  });

  test("feed shows Bob's cook logs after Alice follows him", async ({
    alicePage: alicePage,
    bobPage: bobPage,
    testUsers,
  }) => {
    const recipeTitle = `Feed Test Recipe ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob via API
    await alicePage.goto("/recipes");
    await expect(alicePage.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(alicePage, testUsers.bob.id);

    // Alice checks her feed
    await gotoAndWait(alicePage, "/feed", "Following Feed");
    await expect(alicePage.getByText(recipeTitle)).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await unfollowViaAPI(alicePage, testUsers.bob.id);
  });

  test("feed hides Bob's logs after Alice unfollows him", async ({
    alicePage: alicePage,
    bobPage: bobPage,
    testUsers,
  }) => {
    const recipeTitle = `Unfollow Feed Recipe ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob via API
    await alicePage.goto("/recipes");
    await expect(alicePage.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(alicePage, testUsers.bob.id);

    await gotoAndWait(alicePage, "/feed", "Following Feed");
    await expect(alicePage.getByText(recipeTitle)).toBeVisible({ timeout: 15_000 });

    // Unfollow via API
    await unfollowViaAPI(alicePage, testUsers.bob.id);

    // Reload feed — recipe should be gone
    await gotoAndWait(alicePage, "/feed", "Following Feed");
    await expect(alicePage.getByText(recipeTitle)).not.toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Social — follow persistence", () => {
  test("follow persists after navigating away and back to profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Alice follows Bob via API
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(page, testUsers.bob.id);

    // Navigate to Bob's profile
    await gotoAndWait(page, `/u/${testUsers.bob.id}`, testUsers.bob.name);
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Navigate away
    await gotoAndWait(page, "/recipes", "My Recipes");

    // Navigate back to Bob's profile
    await gotoAndWait(page, `/u/${testUsers.bob.id}`, testUsers.bob.name);

    // Should still show "Following" (count=2: stats label + button)
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });

  test("searching for a followed user shows 'Following' button on feed", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Alice follows Bob via API
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(page, testUsers.bob.id);

    // Go to feed
    await gotoAndWait(page, "/feed", "Following Feed");

    // Search for Bob by unique name (includes RUN_ID, avoids duplicate matches from old runs)
    await page.getByPlaceholder("Find people to follow").fill(testUsers.bob.name);

    // Wait for search results to load — the spinner disappears and results appear
    await expect(page.getByText(testUsers.bob.name).first()).toBeVisible({ timeout: 10_000 });

    // The "Following" button should appear in search results (not "Follow")
    await expect(page.getByText("Following", { exact: true }).first()).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });

  test("feed shows content after follow + navigation to other screens and back", async ({
    alicePage: page,
    bobPage,
    testUsers,
  }) => {
    const recipeTitle = `Sticky Follow Feed ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob via API
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(page, testUsers.bob.id);

    // Navigate through several pages to verify follow persists
    await gotoAndWait(page, "/recipes", "My Recipes");
    await gotoAndWait(page, "/queue", "Want to Cook");

    // Navigate to feed — should still show Bob's content
    await gotoAndWait(page, "/feed", "Following Feed");
    await expect(page.getByText(recipeTitle)).toBeVisible({ timeout: 15_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });
});

test.describe("Social — feed shows followed user", () => {
  test("feed page shows followed user's name after following", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Alice follows Bob via API
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });
    await followViaAPI(page, testUsers.bob.id);

    // Go to feed — Bob's name should appear somewhere (in feed cards or following list)
    await gotoAndWait(page, "/feed", "Following Feed");
    await expect(page.getByText(testUsers.bob.name).first()).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });
});

test.describe("Social — settings", () => {
  test("settings page renders profile toggle", async ({
    alicePage: page,
  }) => {
    await gotoAndWait(page, "/settings", "Settings");
    await expect(page.getByRole("switch").first()).toBeVisible();
  });
});
