import { test, expect } from "./fixtures";

const BASE = process.env.PLAYWRIGHT_BASE_URL || "http://localhost:3000";

test.describe("Admin", () => {
  test("Admin link visible on profile for admin user", async ({ carolPage }) => {
    await carolPage.goto(`${BASE}/recipes`);
    await expect(carolPage.getByText("My Recipes")).toBeVisible({ timeout: 15_000 });

    // Navigate to profile via the avatar/profile link
    await carolPage.goto(`${BASE}/profile`);
    await expect(carolPage.getByText("Profile")).toBeVisible({ timeout: 10_000 });
    await expect(carolPage.getByText("Admin")).toBeVisible();
  });

  test("Admin link NOT visible for non-admin user", async ({ alicePage }) => {
    await alicePage.goto(`${BASE}/profile`);
    await expect(alicePage.getByText("Profile")).toBeVisible({ timeout: 10_000 });
    await expect(alicePage.getByText("Admin")).not.toBeVisible();
  });

  test("Admin screen shows stats and user list", async ({ carolPage }) => {
    await carolPage.goto(`${BASE}/profile`);
    await expect(carolPage.getByText("Profile")).toBeVisible({ timeout: 10_000 });
    await carolPage.getByText("Admin").click();

    // Verify stats cards are visible
    await expect(carolPage.getByText("Users")).toBeVisible({ timeout: 10_000 });
    await expect(carolPage.getByText("Recipes")).toBeVisible();
    await expect(carolPage.getByText("Cook Logs")).toBeVisible();
    await expect(carolPage.getByText("Follows")).toBeVisible();

    // Verify user list section heading
    await expect(carolPage.getByText("Users").first()).toBeVisible();
  });

  test("Admin can search users", async ({ carolPage, testUsers }) => {
    await carolPage.goto(`${BASE}/admin`);
    await expect(carolPage.getByText("Users")).toBeVisible({ timeout: 10_000 });

    await carolPage.getByPlaceholder("Search users by name or email...").fill(testUsers.alice.email);

    // Wait for search results to update
    await expect(carolPage.getByText(testUsers.alice.email)).toBeVisible({ timeout: 5_000 });
    // Bob should not be visible
    await expect(carolPage.getByText(testUsers.bob.email)).not.toBeVisible();
  });

  test("Admin can suspend and unsuspend a user", async ({ carolPage, testUsers }) => {
    await carolPage.goto(`${BASE}/admin`);
    await expect(carolPage.getByText("Users")).toBeVisible({ timeout: 10_000 });

    // Search for Alice
    await carolPage.getByPlaceholder("Search users by name or email...").fill(testUsers.alice.email);
    await expect(carolPage.getByText(testUsers.alice.email)).toBeVisible({ timeout: 5_000 });

    // Expand Alice's row
    await carolPage.getByText(testUsers.alice.name).click();
    await expect(carolPage.getByText("Suspend")).toBeVisible({ timeout: 3_000 });

    // Mock window.confirm for web
    await carolPage.evaluate(() => {
      window.confirm = () => true;
    });

    // Suspend Alice
    await carolPage.getByText("Suspend").click();
    await expect(carolPage.getByText("Suspended")).toBeVisible({ timeout: 5_000 });

    // Verify suspended user cannot login
    const loginRes = await carolPage.evaluate(
      async ({ email, password, base }) => {
        const res = await fetch(`${base}/api/auth/mobile/credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        return res.status;
      },
      { email: testUsers.alice.email, password: testUsers.alice.password, base: BASE }
    );
    expect(loginRes).toBe(403);

    // Expand and unsuspend
    await carolPage.getByText(testUsers.alice.name).click();
    await expect(carolPage.getByText("Unsuspend")).toBeVisible({ timeout: 3_000 });
    await carolPage.getByText("Unsuspend").click();

    // Wait for badge to disappear - verify user can login again
    await carolPage.waitForTimeout(1000);
    const loginRes2 = await carolPage.evaluate(
      async ({ email, password, base }) => {
        const res = await fetch(`${base}/api/auth/mobile/credentials`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        return res.status;
      },
      { email: testUsers.alice.email, password: testUsers.alice.password, base: BASE }
    );
    expect(loginRes2).toBe(200);
  });

  test("Non-admin cannot access admin API", async ({ alicePage }) => {
    const status = await alicePage.evaluate(async (base) => {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${base}/api/admin/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      return res.status;
    }, BASE);

    expect(status).toBe(401);
  });
});
