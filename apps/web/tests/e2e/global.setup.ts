/**
 * Global setup: creates two persistent test users (Alice and Bob), obtains
 * JWT tokens via the mobile credentials API, injects them into browser
 * localStorage (how the SPA stores auth state), and saves browser storage
 * states so individual test files can reuse authenticated sessions.
 *
 * User credentials and IDs are written to .auth/test-users.json so that test
 * files can reference them (e.g. to navigate to /u/{id}).
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

const BASE = "http://localhost:3000";
const RUN_ID = Date.now().toString().slice(-8);

export interface TestUser {
  name: string;
  email: string;
  password: string;
  storageStatePath: string;
  id: string;
}

export interface TestUsers {
  alice: TestUser;
  bob: TestUser;
}

function makeUser(handle: string): TestUser {
  return {
    name: `${handle.charAt(0).toUpperCase() + handle.slice(1)} Aleppo`,
    email: `${handle}.${RUN_ID}@test.aleppo`,
    password: "TestPass123!",
    storageStatePath: path.join(process.cwd(), `.auth/${handle}.json`),
    id: "",
  };
}

async function setupUser(
  browser: import("@playwright/test").Browser,
  user: TestUser
) {
  // 1. Register via API
  const regRes = await fetch(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: user.name, email: user.email, password: user.password }),
  });
  expect([201, 409]).toContain(regRes.status);

  // 2. Get a JWT token via the mobile credentials endpoint
  const loginRes = await fetch(`${BASE}/api/auth/mobile/credentials`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: user.email, password: user.password }),
  });
  expect(loginRes.ok).toBeTruthy();
  const { token, user: userData } = await loginRes.json();
  user.id = userData.id;

  // 3. Make profile public so social tests work
  await fetch(`${BASE}/api/users/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ name: user.name, isPublic: true }),
  });

  // 4. Inject token into browser localStorage (the SPA reads auth_token / auth_user)
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(BASE);
  await page.evaluate(
    ({ t, u }) => {
      localStorage.setItem("auth_token", t);
      localStorage.setItem("auth_user", JSON.stringify(u));
    },
    { t: token, u: userData }
  );

  // 5. Navigate to a protected route to verify auth loaded correctly
  await page.goto(`${BASE}/recipes`);
  await expect(page.getByText("My Recipes")).toBeVisible({ timeout: 15_000 });

  await context.storageState({ path: user.storageStatePath });
  await context.close();
}

setup("create test users", async ({ browser }) => {
  fs.mkdirSync(path.join(process.cwd(), ".auth"), { recursive: true });

  const alice = makeUser("alice");
  const bob = makeUser("bob");

  await setupUser(browser, alice);
  await setupUser(browser, bob);

  const testUsers: TestUsers = { alice, bob };
  fs.writeFileSync(
    path.join(process.cwd(), ".auth/test-users.json"),
    JSON.stringify(testUsers, null, 2)
  );

  console.log(`\nTest users created for run ${RUN_ID}:`);
  console.log(`  Alice: ${alice.email} (id: ${alice.id})`);
  console.log(`  Bob:   ${bob.email} (id: ${bob.id})`);
});
