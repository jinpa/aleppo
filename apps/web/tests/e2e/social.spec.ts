/**
 * Social feature tests — follow/unfollow, profiles, and the following feed.
 *
 * Key notes:
 * - "Follow" text only appears in the follow button (no ambiguity with stats).
 * - "Following" appears in both the stats "Following" label AND the follow button.
 *   Use .last() to target the button when unfollowing via UI.
 * - Use page.evaluate() for API-based cleanup to avoid UI ambiguity.
 * - page.evaluate() requires the page to be on an http origin (not about:blank).
 */

import { test, expect } from "./fixtures";

const BASE = "http://localhost:3000";

async function createPublicRecipeAndLog(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  await page.goto("/new");
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

/** Unfollow targetId via API call (page must already be on an http origin). */
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

test.describe("Social — profiles", () => {
  test("Alice can view Bob's public profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    // "Follow" text only exists in the follow button (no stats labeled "Follow")
    await expect(page.getByText("Follow", { exact: true })).toBeVisible();
  });

  test("Alice sees Edit profile button on her own profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.alice.id}`);
    await expect(page.getByText("Edit profile")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Follow", { exact: true })).not.toBeVisible();
  });

  test("profile shows a recipe from its owner", async ({
    bobPage: page,
    testUsers,
  }) => {
    await createPublicRecipeAndLog(page, "Bob Public Count Recipe");
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText("Bob Public Count Recipe")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Social — follow / unfollow", () => {
  test("Alice follows Bob — button changes to Following", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Follow", { exact: true })).toBeVisible();

    await page.getByText("Follow", { exact: true }).click();
    // count=2 means both stats label AND button show "Following" → POST completed
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Cleanup via API (avoid UI ambiguity with the stats "Following" label)
    await unfollowViaAPI(page, testUsers.bob.id);
  });

  test("Alice unfollows Bob — button reverts to Follow", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });

    // Ensure following first (handle case where previous test cleanup left Alice following)
    if (await page.getByText("Follow", { exact: true }).isVisible()) {
      await page.getByText("Follow", { exact: true }).click();
      await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Now unfollow
    await page.getByText("Following", { exact: true }).last().click();
    await expect(page.getByText("Follow", { exact: true })).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Social — feed", () => {
  test("feed page loads", async ({ alicePage: page }) => {
    await page.goto("/feed");
    await expect(page.getByText("Following Feed")).toBeVisible({ timeout: 15_000 });
  });

  test("feed shows Bob's cook logs after Alice follows him", async ({
    alicePage: alicePage,
    bobPage: bobPage,
    testUsers,
  }) => {
    const recipeTitle = `Feed Test Recipe ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    await expect(alicePage.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    if (await alicePage.getByText("Follow", { exact: true }).isVisible()) {
      await alicePage.getByText("Follow", { exact: true }).click();
      // Wait for count=2 ("Following" in stats label + button) to confirm POST completed
      await expect(alicePage.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Alice checks her feed
    await alicePage.goto("/feed");
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

    // Alice follows Bob
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    await expect(alicePage.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    await alicePage.getByText("Follow", { exact: true }).click();
    // Wait for count=2 ("Following" in stats label + button) to confirm POST completed
    await expect(alicePage.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    await alicePage.goto("/feed");
    await expect(alicePage.getByText(recipeTitle)).toBeVisible({ timeout: 15_000 });

    // Unfollow via UI
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    await alicePage.getByText("Following", { exact: true }).last().click();
    await expect(alicePage.getByText("Follow", { exact: true })).toBeVisible({ timeout: 10_000 });

    // Feed no longer shows the recipe
    await alicePage.goto("/feed");
    await expect(alicePage.getByText(recipeTitle)).not.toBeVisible({ timeout: 15_000 });
  });
});

test.describe("Social — follow persistence", () => {
  test("follow persists after navigating away and back to profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    // Alice follows Bob
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    if (await page.getByText("Follow", { exact: true }).isVisible()) {
      await page.getByText("Follow", { exact: true }).click();
      await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Navigate away to recipes page
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    // Navigate back to Bob's profile
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });

    // Should still show "Following" (count=2: stats label + button)
    await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });

  test("searching for a followed user shows 'Following' button on feed", async ({
    alicePage: page,
    bobPage,
    testUsers,
  }) => {
    // Bob creates a recipe and logs a cook so there's feed content
    const recipeTitle = `Follow Persist Feed ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob via profile
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    if (await page.getByText("Follow", { exact: true }).isVisible()) {
      await page.getByText("Follow", { exact: true }).click();
      await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Go to feed — should show Bob's cook log
    await page.goto("/feed");
    await expect(page.getByText("Following Feed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(recipeTitle)).toBeVisible({ timeout: 15_000 });

    // Search for Bob in the people search — should show "Following" not "Follow"
    await page.getByPlaceholder("Find people to follow").fill(testUsers.bob.name);
    await expect(page.getByText("Following", { exact: true })).toBeVisible({ timeout: 10_000 });

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

    // Alice follows Bob
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    if (await page.getByText("Follow", { exact: true }).isVisible()) {
      await page.getByText("Follow", { exact: true }).click();
      await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Navigate through several pages to verify follow persists
    await page.goto("/recipes");
    await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 10_000 });

    await page.goto("/queue");
    await expect(page.getByText("Want to Cook")).toBeVisible({ timeout: 10_000 });

    // Navigate to feed — should still show Bob's content
    await page.goto("/feed");
    await expect(page.getByText("Following Feed")).toBeVisible({ timeout: 15_000 });
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
    // Alice follows Bob via profile
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible({ timeout: 10_000 });
    if (await page.getByText("Follow", { exact: true }).isVisible()) {
      await page.getByText("Follow", { exact: true }).click();
      await expect(page.getByText("Following", { exact: true })).toHaveCount(2, { timeout: 10_000 });
    }

    // Go to feed — Bob's name should appear somewhere (in feed cards or following list)
    await page.goto("/feed");
    await expect(page.getByText("Following Feed")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(testUsers.bob.name).first()).toBeVisible({ timeout: 10_000 });

    // Cleanup
    await unfollowViaAPI(page, testUsers.bob.id);
  });
});

test.describe("Social — settings", () => {
  test("settings page renders profile toggle", async ({
    alicePage: page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByText("Settings", { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("switch").first()).toBeVisible();
  });
});
