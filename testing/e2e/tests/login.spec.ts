import { test, expect } from '@playwright/test';

// These tests run WITHOUT saved auth state — they test the login page itself.
test.use({ storageState: { cookies: [], origins: [] } });

// ─── Login Page — Form Elements ─────────────────────────────────
test.describe('Login Page — Form Elements', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    // Wait for React to hydrate — org slug field is the first input
    await expect(page.locator('#org-slug')).toBeVisible({ timeout: 15_000 });
  });

  test('displays the login form with all three fields', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Cheklistr');
    await expect(page.locator('.login-subtitle')).toContainText('Vehicle Inspection System');
    await expect(page.locator('#org-slug')).toBeVisible();
    await expect(page.locator('#login-id')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('org slug field has correct attributes', async ({ page }) => {
    const orgSlug = page.locator('#org-slug');
    await expect(orgSlug).toHaveAttribute('type', 'text');
    await expect(orgSlug).toHaveAttribute('placeholder', /greythorn/i);
    await expect(orgSlug).toHaveAttribute('autocomplete', 'organization');
  });

  test('user ID field has correct attributes', async ({ page }) => {
    const loginId = page.locator('#login-id');
    await expect(loginId).toHaveAttribute('type', 'text');
    await expect(loginId).toHaveAttribute('placeholder', /X123456/i);
    await expect(loginId).toHaveAttribute('autocomplete', 'username');
  });

  test('uppercases User ID input automatically', async ({ page }) => {
    await page.fill('#login-id', 'abc123');
    await expect(page.locator('#login-id')).toHaveValue('ABC123');
  });

  test('disables submit button while loading', async ({ page }) => {
    await page.fill('#org-slug', 'greythorn');
    await page.fill('#login-id', 'ANYUSER');
    await page.fill('#password', 'anypass');
    await page.click('button[type="submit"]');

    // Button should show loading state briefly
    await expect(page.locator('button[type="submit"]')).toContainText('Signing in');
  });
});

// ─── Login Page — Error Handling ────────────────────────────────
test.describe('Login Page — Error Handling', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#org-slug')).toBeVisible({ timeout: 15_000 });
  });

  test('invalid org slug shows "Organisation not found" error', async ({ page }) => {
    await page.fill('#org-slug', 'nonexistent-org-xyz');
    await page.fill('#login-id', 'ANYUSER');
    await page.fill('#password', 'anypassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.error-message')).toContainText('Organisation not found');
  });

  test('valid org but invalid credentials shows "Invalid" error', async ({ page }) => {
    await page.fill('#org-slug', 'greythorn');
    await page.fill('#login-id', 'INVALIDUSER');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.error-message')).toContainText('Invalid');
  });
});

// ─── Login Page — Successful Login ──────────────────────────────
test.describe('Login Page — Successful Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('#org-slug')).toBeVisible({ timeout: 15_000 });
  });

  test('site manager redirects to home page', async ({ page }) => {
    const orgSlug = process.env.TEST_ORG_SLUG ?? 'greythorn';
    const userId = process.env.TEST_USER_ID;
    const password = process.env.TEST_USER_PASSWORD;
    if (!userId || !password) {
      test.skip(true, 'Test credentials not configured');
      return;
    }

    await page.fill('#org-slug', orgSlug);
    await page.fill('#login-id', userId);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/', { timeout: 15_000 });
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome');
  });

  test('admin redirects to /admin', async ({ page }) => {
    const orgSlug = process.env.TEST_ORG_SLUG ?? 'greythorn';
    const userId = process.env.ADMIN_USER_ID;
    const password = process.env.ADMIN_USER_PASSWORD;
    if (!userId || !password) {
      test.skip(true, 'Admin credentials not configured');
      return;
    }

    await page.fill('#org-slug', orgSlug);
    await page.fill('#login-id', userId);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/admin', { timeout: 15_000 });
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 10_000 });
  });
});
