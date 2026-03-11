import { test, expect } from '@playwright/test';

test.describe('Home Page (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays welcome greeting with user name', async ({ page }) => {
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome');
  });

  test('shows the New Vehicle Inspection button', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'New Vehicle Inspection' });
    await expect(btn).toBeVisible();
  });

  test('shows recent submissions section', async ({ page }) => {
    await expect(page.locator('.home-section h3')).toContainText('Recent Submissions');
  });

  test('header shows organisation name or logo', async ({ page }) => {
    // Wait for the page to fully load before checking the header
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', { timeout: 15_000 });

    // Multi-tenancy: header displays org name as text, or a logo <img> with alt text
    const header = page.locator('.app-header');
    const orgText = header.getByText(/Greythorn|Cheklistr/i);
    const orgLogo = header.locator('img.header-logo');
    await expect(orgText.or(orgLogo)).toBeVisible({ timeout: 5_000 });
  });

  test('shows Sign Out button', async ({ page }) => {
    const btn = page.locator('button', { hasText: 'Sign Out' });
    await expect(btn).toBeVisible();
  });

  test('navigates to new checklist page', async ({ page }) => {
    await page.click('button:has-text("New Vehicle Inspection")');
    await expect(page).toHaveURL('/checklist/new');
  });

  test('sign out returns to login page', async ({ page }) => {
    await page.click('button:has-text("Sign Out")');
    await expect(page).toHaveURL('/login', { timeout: 10_000 });
  });
});
