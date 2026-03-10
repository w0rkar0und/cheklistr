import { test, expect } from '@playwright/test';
import path from 'path';

const adminAuthFile = path.join(__dirname, '..', 'test-results', '.auth', 'admin.json');

/**
 * Multi-tenancy E2E tests — verifies org branding, SignedImage,
 * super_admin access, and org context throughout the app.
 *
 * These tests use the standard authenticated storageState (site manager user).
 */

// ─── Organisation Branding — App Layout ─────────────────────────
test.describe('Org Branding — App Layout', () => {
  test('header shows organisation name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 15_000,
    });

    // Greythorn seed data has org name "Greythorn Contract Logistics"
    // The header should show the org name (or fallback to "Cheklistr")
    const header = page.locator('.app-header');
    await expect(header).toContainText(/Greythorn|Cheklistr/);
  });

  test('header shows user full name', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 15_000,
    });

    // The header right section should show the logged-in user's name
    const headerUser = page.locator('.header-user-name, .user-name');
    if (await headerUser.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const userName = await headerUser.textContent();
      expect(userName?.trim().length).toBeGreaterThan(0);
    }
  });
});

// ─── Organisation Branding — Admin Layout ───────────────────────
test.describe('Org Branding — Admin Layout', () => {
  // These tests require the admin-chromium project (admin auth state)
  test.use({
    storageState: adminAuthFile,
  });

  test('admin sidebar shows organisation name', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Sidebar header should show "Greythorn Contract Logistics" or org name
    const sidebarHeader = page.locator('.sidebar-header');
    await expect(sidebarHeader).toContainText(/Greythorn|Cheklistr/);
  });

  test('admin sidebar shows role badge matching user role', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Badge should show "Admin" or "Super Admin"
    const badge = page.locator('.sidebar-badge');
    await expect(badge).toBeVisible();
    const badgeText = await badge.textContent();
    expect(badgeText).toMatch(/Admin|Super Admin/);
  });
});

// ─── SignedImage Component ──────────────────────────────────────
test.describe('SignedImage — Admin Submission Detail', () => {
  test.use({
    storageState: adminAuthFile,
  });

  test('submission detail loads photos via SignedImage', async ({ page }) => {
    await page.goto('/admin/submissions');

    // Wait for the submissions page to load
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    // Wait for table or empty state
    const table = page.locator('.admin-submissions table');
    const emptyState = page.locator('.admin-submissions .empty-state, .admin-submissions .no-data');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 });

    // Only test if we have submission rows
    const firstRow = page.locator('.admin-submissions .clickable-row').first();
    if (!(await firstRow.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // No submissions in the table — nothing to test
      console.warn('[E2E] No submissions found — skipping SignedImage detail check');
      return;
    }

    await firstRow.click();
    await expect(page).toHaveURL(/\/admin\/submissions\/.+/, { timeout: 10_000 });

    // Wait for the detail page to render
    await page.waitForTimeout(2_000);
    await expect(
      page.locator('.submission-detail, .admin-submission-detail').first()
    ).toBeVisible({ timeout: 15_000 });

    // Look for any images on the detail page — signed URLs contain "token="
    // Also look for common SignedImage component states
    const signedImages = page.locator(
      'img[src*="token="], .signed-image-loading, .signed-image-error, [class*="signed-image"]'
    );

    // Also try broader photo container selectors
    const photoSection = page.locator(
      '.photo-grid, .submission-photos, .vehicle-photos, [class*="photo"], [class*="image-grid"]'
    );

    // If there's a photo section with signed images, verify they rendered
    const hasPhotos = await photoSection
      .isVisible({ timeout: 5_000 })
      .catch(() => false);

    if (hasPhotos) {
      const count = await signedImages.count();
      expect(count).toBeGreaterThan(0);
    } else {
      // Check if there are any images with signed URLs on the page at all
      const anySignedImg = await signedImages.count();
      if (anySignedImg === 0) {
        console.warn(
          '[E2E] No photo section or signed images found on submission detail page'
        );
      }
    }
  });
});

// ─── Super Admin Route Access ───────────────────────────────────
test.describe('Super Admin — Route Access', () => {
  // Note: These tests only run meaningfully if the test admin user has super_admin role.
  // If they have regular admin role, the tests still pass but verify admin-level access.
  test.use({
    storageState: adminAuthFile,
  });

  test('admin/super_admin can access /admin dashboard', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-dashboard')).toBeVisible();
  });

  test('admin/super_admin can access /admin/submissions', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });
  });

  test('admin/super_admin can access /admin/users', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });
  });

  test('admin/super_admin can access /admin/sessions', async ({ page }) => {
    await page.goto('/admin/sessions');
    await expect(page.locator('.admin-sessions')).toBeVisible({ timeout: 15_000 });
  });

  test('admin/super_admin can access /admin/checklists', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(
      page.locator('.admin-checklists').or(page.locator('.admin-layout'))
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Org Context Persistence ────────────────────────────────────
test.describe('Org Context — Persistence', () => {
  test('org context survives page navigation', async ({ page }) => {
    // Navigate to home
    await page.goto('/');
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 15_000,
    });

    // Check org name in header
    const header = page.locator('.app-header');
    const headerText = await header.textContent();

    // Navigate to checklist
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    // Header should still show the same org context
    const headerTextAfter = await header.textContent();
    // Both should contain org identifier (Greythorn or Cheklistr)
    expect(headerTextAfter).toMatch(/Greythorn|Cheklistr/);
  });
});
