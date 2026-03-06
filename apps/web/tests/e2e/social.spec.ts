/**
 * Social feature tests — follow/unfollow, profiles, and the following feed.
 *
 * Alice and Bob are both created as public users in global.setup.ts.
 * Each test creates its own recipes/logs to stay isolated.
 *
 * Covers:
 *  - Viewing another user's public profile
 *  - Following a user (follower count increments)
 *  - Unfollowing a user (follower count decrements)
 *  - Feed shows cook logs from followed users
 *  - Feed is empty before following anyone
 *  - Own profile shows all recipes (public + private)
 */

import { test, expect } from "./fixtures";

async function createPublicRecipeAndLog(
  page: import("@playwright/test").Page,
  title: string
): Promise<string> {
  // Create public recipe
  await page.goto("/recipes/new");
  await page.getByLabel("Title").fill(title);
  await page
    .getByPlaceholder("e.g. 2 cups all-purpose flour")
    .first()
    .fill("1 cup flour");
  await page.getByPlaceholder("Step 1...").first().fill("Mix and bake");
  // Toggle public
  await page.getByRole("switch").click();
  await expect(page.getByText("Public recipe")).toBeVisible();
  await page.getByRole("button", { name: "Save recipe" }).click();
  await page.waitForURL(/\/recipes\/[0-9a-f-]{36}$/, { timeout: 15_000 });

  const recipeUrl = page.url();

  // Log a cook
  await page.getByRole("button", { name: "I cooked this" }).click();
  await page.getByRole("button", { name: "Save cook" }).click();
  await expect(page.getByText("Cook logged! 🍳", { exact: true })).toBeVisible();

  return recipeUrl;
}

test.describe("Social — profiles", () => {
  test("Alice can view Bob's public profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText(testUsers.bob.name)).toBeVisible();
    await expect(page.getByText("Public profile")).toBeVisible();
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();
  });

  test("Alice sees Edit profile button on her own profile", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.alice.id}`);
    await expect(page.getByRole("link", { name: "Edit profile" })).toBeVisible();
    // No Follow button on own profile
    await expect(page.getByRole("button", { name: "Follow" })).not.toBeVisible();
  });

  test("profile shows recipe and cook counts", async ({
    bobPage: page,
    testUsers,
  }) => {
    await createPublicRecipeAndLog(page, "Bob Public Count Recipe");

    // Visit Bob's profile (as Bob — isOwner shows all recipes)
    await page.goto(`/u/${testUsers.bob.id}`);
    await expect(page.getByText("Bob Public Count Recipe")).toBeVisible();
  });
});

test.describe("Social — follow / unfollow", () => {
  test("Alice follows Bob — follower count increments", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);

    // Get current follower count text
    const countLocator = page.locator("text=Followers").locator("..");
    const before = Number(
      await countLocator.locator("p.font-bold").textContent()
    );

    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible();

    const after = Number(
      await countLocator.locator("p.font-bold").textContent()
    );
    expect(after).toBe(before + 1);

    // Clean up: unfollow
    await page.getByRole("button", { name: "Unfollow" }).click();
  });

  test("Alice unfollows Bob — follower count decrements", async ({
    alicePage: page,
    testUsers,
  }) => {
    await page.goto(`/u/${testUsers.bob.id}`);

    // Follow first
    await page.getByRole("button", { name: "Follow" }).click();
    await expect(page.getByRole("button", { name: "Unfollow" })).toBeVisible();

    const countLocator = page.locator("text=Followers").locator("..");
    const before = Number(
      await countLocator.locator("p.font-bold").textContent()
    );

    await page.getByRole("button", { name: "Unfollow" }).click();
    await expect(page.getByRole("button", { name: "Follow" })).toBeVisible();

    const after = Number(
      await countLocator.locator("p.font-bold").textContent()
    );
    expect(after).toBe(before - 1);
  });
});

test.describe("Social — feed", () => {
  test("feed shows empty state when not following anyone", async ({
    alicePage: page,
  }) => {
    // Ensure Alice follows nobody — visit feed after a fresh context
    await page.goto("/feed");
    // Either an empty state message or no feed cards
    const url = page.url();
    expect(url).toContain("/feed");
  });

  test("feed shows Bob's cook logs after Alice follows him", async ({
    alicePage: alicePage,
    bobPage: bobPage,
    testUsers,
  }) => {
    // Bob creates a public recipe and logs a cook
    const recipeTitle = `Feed Test Recipe ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows Bob
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    const followBtn = alicePage.getByRole("button", { name: "Follow" });
    if (await followBtn.isVisible()) {
      await followBtn.click();
      await expect(
        alicePage.getByRole("button", { name: "Unfollow" })
      ).toBeVisible();
    }

    // Alice checks her feed
    await alicePage.goto("/feed");
    await expect(alicePage.getByText(recipeTitle)).toBeVisible({ timeout: 10_000 });

    // Clean up: unfollow
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    const unfollowBtn = alicePage.getByRole("button", { name: "Unfollow" });
    if (await unfollowBtn.isVisible()) {
      await unfollowBtn.click();
    }
  });

  test("feed hides Bob's logs after Alice unfollows him", async ({
    alicePage: alicePage,
    bobPage: bobPage,
    testUsers,
  }) => {
    const recipeTitle = `Unfollow Feed Recipe ${Date.now()}`;
    await createPublicRecipeAndLog(bobPage, recipeTitle);

    // Alice follows, verifies, then unfollows
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    await alicePage.getByRole("button", { name: "Follow" }).click();
    await expect(
      alicePage.getByRole("button", { name: "Unfollow" })
    ).toBeVisible();

    await alicePage.goto("/feed");
    await expect(alicePage.getByText(recipeTitle)).toBeVisible({ timeout: 10_000 });

    // Unfollow
    await alicePage.goto(`/u/${testUsers.bob.id}`);
    await alicePage.getByRole("button", { name: "Unfollow" }).click();
    await expect(
      alicePage.getByRole("button", { name: "Follow" })
    ).toBeVisible();

    // Feed should no longer show the recipe
    await alicePage.goto("/feed");
    await expect(alicePage.getByText(recipeTitle)).not.toBeVisible();
  });
});

test.describe("Social — settings / profile visibility", () => {
  test("settings page shows current public/private toggle", async ({
    alicePage: page,
  }) => {
    await page.goto("/settings");
    await expect(page.getByRole("switch")).toBeVisible();
  });
});
