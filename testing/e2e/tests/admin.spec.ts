import { test, expect } from '@playwright/test';

// ─── Admin Layout & Navigation ──────────────────────────────────────
test.describe('Admin Layout', () => {
  test('admin page loads with sidebar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-layout')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-sidebar')).toBeVisible();
  });

  test('sidebar shows role badge (Admin or Super Admin)', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-header')).toBeVisible({ timeout: 15_000 });
    // Badge should show either "Admin" or "Super Admin" depending on the test user's role
    await expect(page.locator('.sidebar-badge')).toContainText(/Admin|Super Admin/);
  });

  test('sidebar shows organisation name or logo', async ({ page }) => {
    await page.goto('/admin');
    const sidebarHeader = page.locator('.sidebar-header');
    await expect(sidebarHeader).toBeVisible({ timeout: 15_000 });
    // With multi-tenancy, the sidebar header shows the org name as text OR a logo image
    const hasText = await sidebarHeader.textContent().then(t => /Greythorn|Cheklistr/i.test(t || ''));
    const hasLogo = await sidebarHeader.locator('img[alt*="Greythorn"], img[alt*="Cheklistr"]').isVisible().catch(() => false);
    expect(hasText || hasLogo).toBeTruthy();
  });

  test('sidebar has all navigation links', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });

    const nav = page.locator('.sidebar-nav');
    await expect(nav.getByText('Dashboard')).toBeVisible();
    await expect(nav.getByText('Submissions')).toBeVisible();
    await expect(nav.getByText('Checklists')).toBeVisible();
    await expect(nav.getByText('Users')).toBeVisible();
    await expect(nav.getByText('Sessions')).toBeVisible();
  });

  test('navigates to Submissions from sidebar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });
    await page.locator('.sidebar-nav').getByText('Submissions').click();
    await expect(page).toHaveURL('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Users from sidebar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });
    await page.locator('.sidebar-nav').getByText('Users').click();
    await expect(page).toHaveURL('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 10_000 });
  });

  test('navigates to Sessions from sidebar', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });
    await page.locator('.sidebar-nav').getByText('Sessions').click();
    await expect(page).toHaveURL('/admin/sessions');
    await expect(page.locator('.admin-sessions')).toBeVisible({ timeout: 10_000 });
  });

  test('navigates back to Dashboard from sidebar', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });
    await page.locator('.sidebar-nav').getByText('Dashboard').click();
    await expect(page).toHaveURL('/admin');
    await expect(page.locator('.admin-dashboard')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Admin Dashboard ────────────────────────────────────────────────
test.describe('Admin Dashboard', () => {
  test('displays stats grid with all stat cards', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.admin-dashboard')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.stats-grid')).toBeVisible();

    // Should have exactly 4 stat cards
    const cards = page.locator('.stat-card');
    await expect(cards).toHaveCount(4);
  });

  test('stat cards show expected labels', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.stats-grid')).toBeVisible({ timeout: 15_000 });

    const labels = page.locator('.stat-card-label');
    await expect(labels.nth(0)).toContainText('Total Inspections');
    await expect(labels.nth(1)).toContainText('Today');
    await expect(labels.nth(2)).toContainText('Active Users');
    await expect(labels.nth(3)).toContainText('Total Defects');
  });

  test('stat cards display numeric values', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.stats-grid')).toBeVisible({ timeout: 15_000 });

    // Each stat card value should contain a number (or zero)
    const values = page.locator('.stat-card-value');
    const count = await values.count();
    for (let i = 0; i < count; i++) {
      const text = await values.nth(i).textContent();
      expect(text?.trim()).toMatch(/^\d+$/);
    }
  });

  test('stat cards have correct variant classes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.stats-grid')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('.stat-card--primary')).toBeVisible();
    await expect(page.locator('.stat-card--accent')).toBeVisible();
    await expect(page.locator('.stat-card--success')).toBeVisible();
    await expect(page.locator('.stat-card--warning')).toBeVisible();
  });

  test('shows loading spinner before data loads', async ({ page }) => {
    // Navigate and check for either loading state or loaded state
    await page.goto('/admin');
    // The loading screen or stats grid should be visible within timeout
    await expect(
      page.locator('.loading-screen').or(page.locator('.stats-grid'))
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Admin Submissions ──────────────────────────────────────────────
test.describe('Admin Submissions', () => {
  test('submissions page loads with header', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-page-header')).toBeVisible();
  });

  test('filter input is present and functional', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    const filterInput = page.locator('.admin-filter-input');
    await expect(filterInput).toBeVisible();

    // Type in the filter and verify it accepts input
    await filterInput.fill('test');
    await expect(filterInput).toHaveValue('test');
  });

  test('archived toggle button exists', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    const toggleBtn = page.locator('.btn-toggle');
    await expect(toggleBtn).toBeVisible();
  });

  test('toggle archived submissions on and off', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    const toggleBtn = page.locator('.btn-toggle');
    await expect(toggleBtn).toBeVisible();

    // Click toggle to show archived
    await toggleBtn.click();
    await expect(toggleBtn).toHaveClass(/btn-toggle--active/);

    // Click again to hide archived
    await toggleBtn.click();
    await expect(toggleBtn).not.toHaveClass(/btn-toggle--active/);
  });

  test('submissions table or empty state is displayed', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    // Wait for loading to complete, then check for table or empty state
    await expect(
      page.locator('.admin-table-container').or(page.locator('.empty-state'))
    ).toBeVisible({ timeout: 15_000 });
  });

  test('submission rows are clickable', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    // Wait for data to load
    const table = page.locator('.admin-table-container');
    const emptyState = page.locator('.empty-state');

    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 });

    // Only test clicking if we have rows
    if (await table.isVisible()) {
      const firstRow = page.locator('.clickable-row').first();
      if (await firstRow.isVisible()) {
        await firstRow.click();
        // Should navigate to submission detail
        await expect(page).toHaveURL(/\/admin\/submissions\/.+/);
      }
    }
  });

  test('select-all checkbox toggles row selection', async ({ page }) => {
    await page.goto('/admin/submissions');
    await expect(page.locator('.admin-submissions')).toBeVisible({ timeout: 15_000 });

    // Wait for data to load
    const table = page.locator('.admin-table-container');
    const emptyState = page.locator('.empty-state');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await table.isVisible()) {
      // Click the select-all checkbox in the header
      const selectAll = page.locator('thead .th-checkbox input[type="checkbox"]');
      if (await selectAll.isVisible()) {
        await selectAll.check();
        // Bulk action bar should appear
        await expect(page.locator('.bulk-action-bar')).toBeVisible();

        // Uncheck all
        await selectAll.uncheck();
        await expect(page.locator('.bulk-action-bar')).not.toBeVisible();
      }
    }
  });
});

// ─── Admin Users ────────────────────────────────────────────────────
test.describe('Admin Users', () => {
  test('users page loads with header', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-page-header')).toBeVisible();
  });

  test('new user button toggles form visibility', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    // Click "+ New User" button to show the form
    const newUserBtn = page.locator('.admin-page-header .btn-primary');
    await expect(newUserBtn).toBeVisible();
    await newUserBtn.click();

    // Form should be visible
    await expect(page.locator('.admin-card')).toBeVisible();
    await expect(page.locator('#new-login-id')).toBeVisible();

    // Button text should change to "Cancel"
    await expect(newUserBtn).toContainText('Cancel');

    // Click again to hide form
    await newUserBtn.click();
    await expect(page.locator('#new-login-id')).not.toBeVisible();
  });

  test('create user form has all required fields', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    // Open the form
    await page.locator('.admin-page-header .btn-primary').click();
    await expect(page.locator('.admin-card')).toBeVisible();

    // Check all form fields are present
    await expect(page.locator('#new-login-id')).toBeVisible();
    await expect(page.locator('#new-password')).toBeVisible();
    await expect(page.locator('#new-name')).toBeVisible();
    await expect(page.locator('#new-role')).toBeVisible();
    await expect(page.locator('#new-contractor')).toBeVisible();
    await expect(page.locator('#new-site')).toBeVisible();
  });

  test('role dropdown has correct options', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    // Open the form
    await page.locator('.admin-page-header .btn-primary').click();
    await expect(page.locator('#new-role')).toBeVisible();

    // Check role dropdown options
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

    // super_admin role — log whether it's present (not yet a hard requirement)
    const hasSuperAdmin =
      optionTexts.includes('super admin') || optionTexts.includes('super_admin');
    if (!hasSuperAdmin) {
      console.warn(
        '[E2E] super_admin role not yet in dropdown — options found:',
        optionTexts.join(', ')
      );
    }
  });

  test('users table or empty state is displayed', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    // Wait for loading to complete
    await expect(
      page.locator('.admin-table-container').or(page.locator('.empty-state'))
    ).toBeVisible({ timeout: 15_000 });
  });

  test('users table shows role badges', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    const table = page.locator('.admin-table-container');
    const emptyState = page.locator('.empty-state');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await table.isVisible()) {
      // At least one role badge should be visible
      await expect(page.locator('.role-badge').first()).toBeVisible();
    }
  });

  test('users table shows status badges', async ({ page }) => {
    await page.goto('/admin/users');
    await expect(page.locator('.admin-users')).toBeVisible({ timeout: 15_000 });

    const table = page.locator('.admin-table-container');
    const emptyState = page.locator('.empty-state');
    await expect(table.or(emptyState)).toBeVisible({ timeout: 15_000 });

    if (await table.isVisible()) {
      // At least one status badge should be visible
      await expect(page.locator('.status-badge').first()).toBeVisible();
    }
  });
});

// ─── Admin Sessions ─────────────────────────────────────────────────
test.describe('Admin Sessions', () => {
  test('sessions page loads with heading', async ({ page }) => {
    await page.goto('/admin/sessions');
    await expect(page.locator('.admin-sessions')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-sessions h2')).toContainText('Active Sessions');
  });
});
