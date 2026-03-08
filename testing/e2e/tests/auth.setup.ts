import { test as setup, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const authDir = path.join(__dirname, '..', 'test-results', '.auth');
const authFile = path.join(authDir, 'user.json');

/**
 * Authenticates as the test user and saves browser state (cookies, localStorage)
 * so all subsequent tests skip the login flow.
 */
setup('authenticate as test user', async ({ page }) => {
  const userId = process.env.TEST_USER_ID;
  const password = process.env.TEST_USER_PASSWORD;

  if (!userId || !password) {
    throw new Error(
      'Missing TEST_USER_ID or TEST_USER_PASSWORD in .env — cannot authenticate.'
    );
  }

  // Navigate to login page
  await page.goto('/login');
  await expect(page.locator('h1')).toContainText('Cheklistr');

  // Fill login form
  await page.fill('#login-id', userId);
  await page.fill('#password', password);

  // Submit and wait for navigation to home page
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL('/', { timeout: 15_000 });

  // Confirm we landed on the home page (greeting visible)
  await expect(page.locator('.home-greeting h2')).toContainText('Welcome');

  // Ensure auth directory exists and save state
  fs.mkdirSync(authDir, { recursive: true });
  await page.context().storageState({ path: authFile });
});
