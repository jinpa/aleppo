/**
 * Import tests.
 *
 * The import tab is currently a placeholder in the native SPA. These tests
 * will be fleshed out once the import feature is ported. For now we just
 * verify the route is reachable and doesn't crash.
 */

import { test, expect } from "./fixtures";

test.describe("Import — placeholder", () => {
  test("import tab is reachable when signed in", async ({
    alicePage: page,
  }) => {
    await page.goto("/import");
    // The import tab is a placeholder — just confirm no redirect to login
    await expect(page).not.toHaveURL(/\/login/);
  });
});
