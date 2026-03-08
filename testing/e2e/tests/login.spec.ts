import { test, expect } from '@playwright/test';

// These tests run WITHOUT saved auth state — they test the login page itself.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Login Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('displays the login form with correct elements', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Cheklistr');
    await expect(page.locator('.login-subtitle')).toContainText('Vehicle Inspection System');
    await expect(page.locator('#login-id')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.locator('button[type="submit"]')).toContainText('Sign In');
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.fill('#login-id', 'INVALIDUSER');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.error-message')).toContainText('Invalid');
  });

  test('disables submit button while loading', async ({ page }) => {
    await page.fill('#login-id', 'ANYUSER');
    await page.fill('#password', 'anypass');
    await page.click('button[type="submit"]');

    // Button should show loading state briefly
    await expect(page.locator('button[type="submit"]')).toContainText('Signing in');
  });

  test('uppercases User ID input automatically', async ({ page }) => {
    await page.fill('#login-id', 'abc123');
    await expect(page.locator('#login-id')).toHaveValue('ABC123');
  });

  test('successful login redirects to home page', async ({ page }) => {
    const userId = process.env.TEST_USER_ID;
    const password = process.env.TEST_USER_PASSWORD;
    if (!userId || !password) {
      test.skip(!userId || !password, 'Test credentials not configured');
      return;
    }

    await page.fill('#login-id', userId);
    await page.fill('#password', password);
    await page.click('button[type="submit"]');

    await expect(page).toHaveURL('/', { timeout: 15_000 });
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome');
  });
});
