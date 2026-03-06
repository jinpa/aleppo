import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Auth — sign-up", () => {
  test("sign-up page renders", async ({ page }) => {
    await page.goto("/auth/signup");
    await expect(page.getByText("Start your cooking diary")).toBeVisible();
    await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();
  });

  test("successful sign-up lands on home", async ({ page }) => {
    const email = `signup.${Date.now()}@test.aleppo`;
    await page.goto("/auth/signup");
    await page.getByLabel("Name").fill("Fresh Tester");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPass123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL("/");
  });

  test("duplicate email shows error", async ({ page }) => {
    const email = `dup.${Date.now()}@test.aleppo`;
    await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "First", email, password: "TestPass123!" }),
    });

    await page.goto("/auth/signup");
    await page.getByLabel("Name").fill("Second");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPass123!");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(
      page.getByText("An account with this email already exists")
    ).toBeVisible();
  });

  test("short password shows client-side validation", async ({ page }) => {
    await page.goto("/auth/signup");
    await page.getByLabel("Name").fill("Test User");
    await page.getByLabel("Email").fill(`v.${Date.now()}@test.aleppo`);
    await page.getByLabel("Password").fill("short");
    await page.getByRole("button", { name: "Create account" }).click();
    await expect(page.getByText(/at least 8 characters/i)).toBeVisible();
  });
});

test.describe("Auth — sign-in", () => {
  test("sign-in page renders", async ({ page }) => {
    await page.goto("/auth/signin");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/auth/signin");
    await page.getByLabel("Email").fill("nobody@test.aleppo");
    await page.getByLabel("Password").fill("wrongpassword");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Invalid email or password")).toBeVisible();
  });

  test("valid credentials redirect to home", async ({ page }) => {
    const email = `signin.${Date.now()}@test.aleppo`;
    await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sign-in Test", email, password: "TestPass123!" }),
    });

    await page.goto("/auth/signin");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Password").fill("TestPass123!");
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.waitForURL("/", { timeout: 15_000 });
    await expect(page).toHaveURL("/");
  });
});

test.describe("Auth — route protection", () => {
  test("unauthenticated visit to /recipes/new redirects to sign-in", async ({ page }) => {
    await page.goto("/recipes/new");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("unauthenticated visit to /settings redirects to sign-in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });

  test("unauthenticated visit to /queue redirects to sign-in", async ({ page }) => {
    await page.goto("/queue");
    await expect(page).toHaveURL(/\/auth\/signin/);
  });
});
