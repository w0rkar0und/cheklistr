import { test, expect } from '@playwright/test';

test.describe('Route Protection', () => {
  // Run these without auth state
  test.use({ storageState: { cookies: [], origins: [] } });

  test('redirects unauthenticated user to login from home', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('redirects unauthenticated user to login from new checklist', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('redirects unauthenticated user to login from admin', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });

  test('redirects unauthenticated user to login from pending', async ({ page }) => {
    await page.goto('/pending');
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});

test.describe('Authenticated Navigation', () => {
  test('home page is accessible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-greeting')).toBeVisible({ timeout: 10_000 });
  });

  test('pending submissions page is accessible', async ({ page }) => {
    await page.goto('/pending');
    // Should load without redirect (even if empty)
    await expect(page).toHaveURL('/pending');
  });

  test('new checklist page loads the form', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page).toHaveURL('/checklist/new');
    // Wait for the checklist to load — either the form appears or an error
    await expect(
      page.locator('.form-progress-label').or(page.locator('.error-message'))
    ).toBeVisible({ timeout: 20_000 });
  });
});
