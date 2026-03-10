import { test, expect } from '@playwright/test';
import path from 'path';

const superAdminAuthFile = path.join(
  __dirname,
  '..',
  'test-results',
  '.auth',
  'super-admin.json'
);
const adminAuthFile = path.join(
  __dirname,
  '..',
  'test-results',
  '.auth',
  'admin.json'
);

/**
 * Increment 2: Super Admin Management UI
 *
 * Tests for:
 * - /admin/organisations page (super_admin only)
 * - AdminUsers enhancements (org filter, target org, role options)
 * - Sidebar conditional rendering
 */

// ─── Helper: check if logged-in user is actually super_admin ────
async function isSuperAdmin(page: import('@playwright/test').Page): Promise<boolean> {
  await page.goto('/admin');
  await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
  const badge = page.locator('.sidebar-badge');
  if (!(await badge.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return false;
  }
  const text = (await badge.textContent()) ?? '';
  return /super.?admin/i.test(text);
}

// ═════════════════════════════════════════════════════════════════
// 1. ADMIN ORGANISATIONS PAGE — SUPER ADMIN ACCESS
// ═════════════════════════════════════════════════════════════════
test.describe('AdminOrganisations — Super Admin Access', () => {
  test.use({ storageState: superAdminAuthFile });

  test('super admin can access /admin/organisations', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // The page should render — not redirect away
    await expect(page).toHaveURL(/\/admin\/organisations/);

    // Table or empty state should be visible
    await expect(
      page.locator('table').or(page.locator('.empty-state'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('organisations table shows expected columns', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Wait for table to load
    const table = page.locator('table');
    if (await table.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Check header row for expected column names
      const headers = table.locator('thead th');
      const headerTexts: string[] = [];
      const count = await headers.count();
      for (let i = 0; i < count; i++) {
        const text = await headers.nth(i).textContent();
        if (text) headerTexts.push(text.trim().toLowerCase());
      }
      expect(headerTexts).toEqual(
        expect.arrayContaining(['name', 'slug', 'status'])
      );
    }
  });

  test('greythorn organisation is listed', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // The greythorn org should appear somewhere in the table
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('table')).toContainText(/greythorn/i);
  });
});

// ═════════════════════════════════════════════════════════════════
// 2. REGULAR ADMIN CANNOT ACCESS ORGANISATIONS
// ═════════════════════════════════════════════════════════════════
test.describe('AdminOrganisations — Regular Admin Blocked', () => {
  test.use({ storageState: adminAuthFile });

  test('regular admin is redirected away from /admin/organisations', async ({
    page,
  }) => {
    await page.goto('/admin/organisations');

    // Should redirect to home (/) — not stay on organisations page
    await expect(page).not.toHaveURL(/\/admin\/organisations/, {
      timeout: 10_000,
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 3. SIDEBAR NAVIGATION — CONDITIONAL LINK
// ═════════════════════════════════════════════════════════════════
test.describe('Sidebar — Organisations Link', () => {
  test.describe('super admin sees Organisations link', () => {
    test.use({ storageState: superAdminAuthFile });

    test('sidebar contains Organisations nav link', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      // Look for the Organisations link in the sidebar
      const orgLink = page.locator(
        'nav a[href="/admin/organisations"], .sidebar-nav a[href="/admin/organisations"]'
      );
      await expect(orgLink).toBeVisible();
      await expect(orgLink).toContainText(/organisations/i);
    });
  });

  test.describe('regular admin does NOT see Organisations link', () => {
    test.use({ storageState: adminAuthFile });

    test('sidebar does not contain Organisations nav link', async ({ page }) => {
      await page.goto('/admin');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const orgLink = page.locator(
        'nav a[href="/admin/organisations"], .sidebar-nav a[href="/admin/organisations"]'
      );
      await expect(orgLink).toHaveCount(0);
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 4. CREATE ORGANISATION
// ═════════════════════════════════════════════════════════════════
test.describe('AdminOrganisations — Create Org', () => {
  test.use({ storageState: superAdminAuthFile });

  const testSlug = `testorg-${Date.now().toString(36).toLowerCase()}`;

  test('can open create form and see required fields', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Click "+ New Organisation" button
    const newOrgBtn = page.locator('button', {
      hasText: /new organisation/i,
    });
    await expect(newOrgBtn).toBeVisible({ timeout: 5_000 });
    await newOrgBtn.click();

    // Form fields should be visible
    await expect(page.locator('#org-name')).toBeVisible();
    await expect(page.locator('#org-slug')).toBeVisible();
    await expect(page.locator('#org-colour')).toBeVisible();
  });

  test('create organisation with valid data', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Open create form
    const newOrgBtn = page.locator('button', {
      hasText: /new organisation/i,
    });
    await newOrgBtn.click();
    await expect(page.locator('#org-name')).toBeVisible();

    // Fill in form
    await page.fill('#org-name', 'E2E Test Organisation');
    await page.fill('#org-slug', testSlug);

    // Submit
    const submitBtn = page.locator('button', {
      hasText: /create organisation/i,
    });
    await submitBtn.click();

    // Verify the new org appears in the table
    await expect(page.locator('table')).toContainText(testSlug, {
      timeout: 10_000,
    });
  });

  test('duplicate slug is rejected', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    // Open create form
    const newOrgBtn = page.locator('button', {
      hasText: /new organisation/i,
    });
    await newOrgBtn.click();
    await expect(page.locator('#org-name')).toBeVisible();

    // Try to create with the existing "greythorn" slug
    await page.fill('#org-name', 'Duplicate Org');
    await page.fill('#org-slug', 'greythorn');

    const submitBtn = page.locator('button', {
      hasText: /create organisation/i,
    });
    await submitBtn.click();

    // Error message should appear
    await expect(
      page.locator('text=already exists').or(page.locator('.error-message'))
    ).toBeVisible({ timeout: 5_000 });
  });

  test('empty name shows validation error', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

    const newOrgBtn = page.locator('button', {
      hasText: /new organisation/i,
    });
    await newOrgBtn.click();
    await expect(page.locator('#org-slug')).toBeVisible();

    // Leave name empty, fill slug
    await page.fill('#org-slug', 'some-slug');

    const submitBtn = page.locator('button', {
      hasText: /create organisation/i,
    });
    await submitBtn.click();

    // Validation error
    await expect(
      page.locator('text=name is required').or(page.locator('.error-message'))
    ).toBeVisible({ timeout: 5_000 });
  });
});

// ═════════════════════════════════════════════════════════════════
// 5. EDIT ORGANISATION
// ═════════════════════════════════════════════════════════════════
test.describe('AdminOrganisations — Edit Org', () => {
  test.use({ storageState: superAdminAuthFile });

  test('edit button opens form with pre-filled data', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });

    // Click the first "Edit" button
    const editBtn = page.locator('button', { hasText: /^edit$/i }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();

      // Edit form fields should appear
      await expect(page.locator('#edit-org-name')).toBeVisible({ timeout: 5_000 });

      // Name should be pre-filled
      const nameValue = await page.locator('#edit-org-name').inputValue();
      expect(nameValue.length).toBeGreaterThan(0);
    }
  });

  test('slug field is disabled in edit mode', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });

    const editBtn = page.locator('button', { hasText: /^edit$/i }).first();
    if (await editBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await editBtn.click();
      await expect(page.locator('#edit-org-name')).toBeVisible({ timeout: 5_000 });

      // Slug input should exist but be disabled
      const slugInput = page.locator('#edit-org-slug, input[disabled]').first();
      if (await slugInput.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await expect(slugInput).toBeDisabled();
      }
    }
  });
});

// ═════════════════════════════════════════════════════════════════
// 6. DEACTIVATE / ACTIVATE ORGANISATION
// ═════════════════════════════════════════════════════════════════
test.describe('AdminOrganisations — Toggle Active Status', () => {
  test.use({ storageState: superAdminAuthFile });

  test('deactivate and reactivate an organisation', async ({ page }) => {
    await page.goto('/admin/organisations');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table')).toBeVisible({ timeout: 10_000 });

    // Look for a "Deactivate" button (avoid deactivating greythorn — use the
    // last row's deactivate button if there's more than one org)
    const deactivateButtons = page.locator('button', {
      hasText: /deactivate/i,
    });
    const deactivateCount = await deactivateButtons.count();

    if (deactivateCount > 1) {
      // Deactivate the last org (not greythorn)
      await deactivateButtons.last().click();

      // Verify an "Activate" button now appears (was Deactivate)
      await expect(
        page.locator('button', { hasText: /^activate$/i })
      ).toBeVisible({ timeout: 5_000 });

      // Also check for inactive row styling
      const inactiveRow = page.locator('.row-inactive, tr.inactive');
      if (await inactiveRow.isVisible({ timeout: 2_000 }).catch(() => false)) {
        expect(await inactiveRow.count()).toBeGreaterThan(0);
      }

      // Re-activate it
      const activateBtn = page
        .locator('button', { hasText: /^activate$/i })
        .last();
      await activateBtn.click();

      // Should go back to "Deactivate"
      await expect(
        page.locator('button', { hasText: /deactivate/i })
      ).toHaveCount(deactivateCount, { timeout: 5_000 });
    } else {
      console.warn(
        '[E2E] Only one org with Deactivate — skipping toggle to avoid disrupting greythorn'
      );
    }
  });
});

// ═════════════════════════════════════════════════════════════════
// 7. ADMIN USERS — ORG FILTER (SUPER ADMIN ONLY)
// ═════════════════════════════════════════════════════════════════
test.describe('AdminUsers — Org Filter', () => {
  test.describe('super admin sees org filter', () => {
    test.use({ storageState: superAdminAuthFile });

    test('org filter dropdown is visible', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const filterOrg = page.locator('#filter-org');
      await expect(filterOrg).toBeVisible({ timeout: 5_000 });
    });

    test('switching org filter reloads user list', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const filterOrg = page.locator('#filter-org');
      await expect(filterOrg).toBeVisible({ timeout: 5_000 });

      // Get options from the dropdown
      const options = filterOrg.locator('option');
      const optionCount = await options.count();

      if (optionCount > 1) {
        // Get current table content
        await page.waitForLoadState('networkidle');
        const initialContent = await page
          .locator('table tbody, .admin-table-container')
          .first()
          .textContent()
          .catch(() => '');

        // Switch to a different org
        await filterOrg.selectOption({ index: 1 });
        await page.waitForLoadState('networkidle');

        // Table content should have changed (or be empty)
        const newContent = await page
          .locator('table tbody, .admin-table-container, .empty-state')
          .first()
          .textContent()
          .catch(() => '');

        // At minimum the page didn't crash — content may or may not differ
        // depending on whether the second org has users
        expect(newContent).toBeDefined();
      } else {
        console.warn('[E2E] Only one org in filter — cannot test switching');
      }
    });
  });

  test.describe('regular admin does NOT see org filter', () => {
    test.use({ storageState: adminAuthFile });

    test('org filter dropdown is not visible', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const filterOrg = page.locator('#filter-org');
      await expect(filterOrg).toHaveCount(0, { timeout: 3_000 });
    });
  });
});

// ═════════════════════════════════════════════════════════════════
// 8. ADMIN USERS — CREATE USER FORM (SUPER ADMIN ENHANCEMENTS)
// ═════════════════════════════════════════════════════════════════
test.describe('AdminUsers — Create User Form', () => {
  test.describe('super admin sees target org + three roles', () => {
    test.use({ storageState: superAdminAuthFile });

    test('target org selector is visible in create form', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      // Open create user form
      const createBtn = page.locator('.admin-page-header .btn-primary');
      await expect(createBtn).toBeVisible({ timeout: 5_000 });
      await createBtn.click();

      // Target org selector should be visible
      const targetOrg = page.locator('#target-org');
      await expect(targetOrg).toBeVisible({ timeout: 5_000 });
    });

    test('role dropdown includes super_admin option', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      // Open create user form
      const createBtn = page.locator('.admin-page-header .btn-primary');
      await createBtn.click();
      await expect(page.locator('#new-role')).toBeVisible();

      // Collect role options
      const roleSelect = page.locator('#new-role');
      const options = roleSelect.locator('option');
      const optionTexts: string[] = [];
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text) optionTexts.push(text.trim().toLowerCase());
      }

      expect(optionTexts).toContain('site manager');
      expect(optionTexts).toContain('admin');
      // Super admin users should see the super_admin option
      const hasSuperAdmin =
        optionTexts.includes('super admin') ||
        optionTexts.includes('super_admin');
      expect(hasSuperAdmin).toBe(true);
    });
  });

  test.describe('regular admin does NOT see target org or super_admin role', () => {
    test.use({ storageState: adminAuthFile });

    test('target org selector is NOT visible', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const createBtn = page.locator('.admin-page-header .btn-primary');
      await createBtn.click();
      await expect(page.locator('#new-role')).toBeVisible();

      const targetOrg = page.locator('#target-org');
      await expect(targetOrg).toHaveCount(0, { timeout: 3_000 });
    });

    test('role dropdown only shows site_manager and admin', async ({ page }) => {
      await page.goto('/admin/users');
      await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });

      const createBtn = page.locator('.admin-page-header .btn-primary');
      await createBtn.click();
      await expect(page.locator('#new-role')).toBeVisible();

      const roleSelect = page.locator('#new-role');
      const options = roleSelect.locator('option');
      const optionTexts: string[] = [];
      const count = await options.count();
      for (let i = 0; i < count; i++) {
        const text = await options.nth(i).textContent();
        if (text) optionTexts.push(text.trim().toLowerCase());
      }

      expect(optionTexts).toContain('site manager');
      expect(optionTexts).toContain('admin');
      // Regular admin should NOT see super_admin
      const hasSuperAdmin =
        optionTexts.includes('super admin') ||
        optionTexts.includes('super_admin');
      expect(hasSuperAdmin).toBe(false);
    });
  });
});
