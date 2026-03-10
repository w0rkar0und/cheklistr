import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '..', 'test-results', '.auth');
const authFile = path.join(authDir, 'super-admin.json');

/**
 * Authenticates as the super_admin user and saves browser state.
 *
 * Requires SUPER_ADMIN_USER_ID and SUPER_ADMIN_USER_PASSWORD env vars.
 * Falls back to ADMIN_* credentials if super_admin vars aren't set
 * (allows gradual rollout — tests that hard-require super_admin will
 * detect the actual role at runtime and skip if needed).
 */
setup('authenticate as super admin user', async ({ page }) => {
  const orgSlug = process.env.TEST_ORG_SLUG ?? 'greythorn';
  const userId = process.env.SUPER_ADMIN_USER_ID ?? process.env.ADMIN_USER_ID;
  const password = process.env.SUPER_ADMIN_USER_PASSWORD ?? process.env.ADMIN_USER_PASSWORD;

  if (!userId || !password) {
    throw new Error(
      'Missing SUPER_ADMIN_USER_ID/SUPER_ADMIN_USER_PASSWORD (or ADMIN fallbacks) in .env — cannot authenticate as super admin.'
    );
  }

  // Navigate to login page and wait for React to fully hydrate
  await page.goto('/login', { waitUntil: 'networkidle' });

  // Debug: log what the page actually rendered (visible in CI logs on failure)
  const pageTitle = await page.title();
  const bodyText = await page.locator('body').innerText().catch(() => '(empty)');
  console.log(`[super-admin-auth-setup] Page title: "${pageTitle}"`);
  console.log(`[super-admin-auth-setup] Body text preview: "${bodyText.substring(0, 200)}"`);

  // Wait for the React app to mount — the org slug field is the first input
  await expect(page.locator('#org-slug')).toBeVisible({ timeout: 15_000 });

  // Fill three-field login form
  await page.fill('#org-slug', orgSlug);
  await page.fill('#login-id', userId);
  await page.fill('#password', password);

  // Submit and wait for navigation — admin/super_admin users redirect to /admin
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/admin', { timeout: 15_000 });

  // Confirm we landed on the admin dashboard
  await expect(page.locator('.admin-layout')).toBeVisible({
    timeout: 10_000,
  });

  // Ensure auth directory exists and save state
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
