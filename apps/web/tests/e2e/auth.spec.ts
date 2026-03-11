/**
 * Auth tests for the React Native SPA.
 *
 * The SPA handles auth client-side via localStorage. Login POSTs to
 * /api/auth/mobile/credentials. Route protection is handled by the root
 * index.tsx which redirects unauthenticated users to /login.
 */

import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Auth — sign-in", () => {
  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByText("Welcome back")).toBeVisible();
    await expect(page.getByText("Sign in", { exact: true })).toBeVisible();
  });

  test("wrong password shows error", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill("nobody@test.aleppo");
    await page.getByPlaceholder("••••••••").fill("wrongpassword");
    await page.getByText("Sign in", { exact: true }).click();
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test("valid credentials redirect to recipes", async ({ page }) => {
    const email = `signin.${Date.now()}@test.aleppo`;
    await fetch(`${BASE}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Sign-in Test", email, password: "TestPass123!" }),
    });

    await page.goto("/login");
    await page.getByPlaceholder("you@example.com").fill(email);
    await page.getByPlaceholder("••••••••").fill("TestPass123!");
    await page.getByText("Sign in", { exact: true }).click();
    await page.waitForURL(/\/recipes/, { timeout: 15_000 });
  });
});

test.describe("Auth — route protection", () => {
  test("unauthenticated visit to / redirects to login", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL(/\/login/, { timeout: 10_000 });
  });
});
