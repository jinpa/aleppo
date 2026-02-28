/**
 * Shared Playwright fixtures.
 *
 * `alicePage` / `bobPage` — pre-authenticated browser pages for each test
 * user created in global.setup.ts.
 *
 * `testUsers` — the parsed TestUsers object from .auth/test-users.json.
 */

import { test as base, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import type { TestUsers } from "./global.setup";

export function getTestUsers(): TestUsers {
  const filePath = path.join(process.cwd(), ".auth/test-users.json");
  return JSON.parse(fs.readFileSync(filePath, "utf-8")) as TestUsers;
}

type Fixtures = {
  testUsers: TestUsers;
  alicePage: Page;
  bobPage: Page;
};

export const test = base.extend<Fixtures>({
  testUsers: async ({}, use) => {
    await use(getTestUsers());
  },

  alicePage: async ({ browser }, use) => {
    const users = getTestUsers();
    const ctx = await browser.newContext({
      storageState: users.alice.storageStatePath,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },

  bobPage: async ({ browser }, use) => {
    const users = getTestUsers();
    const ctx = await browser.newContext({
      storageState: users.bob.storageStatePath,
    });
    const page = await ctx.newPage();
    await use(page);
    await ctx.close();
  },
});

export { expect } from "@playwright/test";
