/**
 * Global setup: creates two persistent test users (Alice and Bob), signs them
 * in, makes their profiles public, and saves their browser storage states so
 * individual test files can reuse authenticated sessions without signing in
 * every time.
 *
 * User credentials and IDs are written to .auth/test-users.json so that test
 * files can reference them (e.g. to navigate to /u/{id}).
 *
 * Uses a timestamp-based suffix to avoid email collisions across test runs.
 */

import { test as setup, expect } from "@playwright/test";
import path from "path";
import fs from "fs";

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
  browserType: Parameters<typeof setup>[1] extends { browser: infer B }
    ? B
    : never,
  user: TestUser
) {
  // Register via the API (idempotent: 409 = already exists, which is fine on reruns)
  const regRes = await fetch("http://localhost:3000/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: user.name,
      email: user.email,
      password: user.password,
    }),
  });
  expect([201, 409]).toContain(regRes.status);

  const context = await (browserType as import("@playwright/test").Browser).newContext();
  const page = await context.newPage();

  // Sign in via the UI so NextAuth sets session cookies in this context
  await page.goto("/auth/signin");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/"), {
    timeout: 15_000,
  });

  // Retrieve the user's ID
  const meRes = await page.request.get("/api/users/me");
  expect(meRes.ok()).toBeTruthy();
  const meData = await meRes.json();
  user.id = meData.id;

  // Make the profile public so social tests work
  const patchRes = await page.request.patch("/api/users/me", {
    data: { name: user.name, isPublic: true },
  });
  expect(patchRes.ok()).toBeTruthy();

  // Save the authenticated browser state
  await context.storageState({ path: user.storageStatePath });
  await context.close();
}

setup("create test users", async ({ browser }) => {
  fs.mkdirSync(path.join(process.cwd(), ".auth"), { recursive: true });

  const alice = makeUser("alice");
  const bob = makeUser("bob");

  await setupUser(browser as never, alice);
  await setupUser(browser as never, bob);

  const testUsers: TestUsers = { alice, bob };
  fs.writeFileSync(
    path.join(process.cwd(), ".auth/test-users.json"),
    JSON.stringify(testUsers, null, 2)
  );

  console.log(`\nTest users created for run ${RUN_ID}:`);
  console.log(`  Alice: ${alice.email} (id: ${alice.id})`);
  console.log(`  Bob:   ${bob.email} (id: ${bob.id})`);
});
