import { test, expect } from '@playwright/test';

// ─── Checklist Management — Versions List ───────────────────────
test.describe('Admin Checklist Management — Versions List', () => {
  test('checklist management page loads', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-page-header h2')).toContainText('Checklist Management');
  });

  test('displays checklist name in header', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-count')).toBeVisible();
  });

  test('shows at least one version card', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    // Wait for loading to complete
    await expect(
      page.locator('.version-list').or(page.locator('.empty-state'))
    ).toBeVisible({ timeout: 15_000 });

    // Should have at least the active version
    const cards = page.locator('.version-card');
    await expect(cards.first()).toBeVisible();
  });

  test('active version has correct badge', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeBadge = page.locator('.version-badge--active');
    await expect(activeBadge.first()).toBeVisible();
    await expect(activeBadge.first()).toContainText('Active');
  });

  test('active version card has View button', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await expect(activeCard).toBeVisible();

    const viewBtn = activeCard.locator('.btn-secondary.btn-small:has-text("View")');
    await expect(viewBtn).toBeVisible();
  });

  test('version cards show version number', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const versionNumber = page.locator('.version-number').first();
    await expect(versionNumber).toBeVisible();
    await expect(versionNumber).toContainText(/Version \d+/);
  });

  test('version cards show date metadata', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const meta = page.locator('.version-card-meta').first();
    await expect(meta).toBeVisible();
    // Should contain either "Published" or "Created"
    await expect(meta).toContainText(/Published|Created/);
  });

  test('Create New Draft button is present', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    const toolbar = page.locator('.admin-toolbar');
    await expect(toolbar).toBeVisible();

    const createBtn = toolbar.locator('.btn-primary');
    await expect(createBtn).toBeVisible();
  });
});

// ─── Checklist Management — Version Editor (Read-Only) ──────────
test.describe('Admin Checklist Management — View Active Version', () => {
  test('clicking View opens the version editor', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    const viewBtn = activeCard.locator('.btn-secondary.btn-small:has-text("View")');
    await viewBtn.click();

    // Editor should open
    await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
  });

  test('editor shows version number and Active badge', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.editor-title h2')).toContainText(/Version \d+/);
    await expect(page.locator('.version-badge--active')).toBeVisible();
  });

  test('editor shows section and item counts', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.editor-stats')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.editor-stats')).toContainText(/\d+ section/);
    await expect(page.locator('.editor-stats')).toContainText(/\d+ item/);
  });

  test('editor shows all 5 sections', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    const sections = page.locator('.section-editor');
    await expect(sections).toHaveCount(5);
  });

  test('sections have names and item counts', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    const firstSection = page.locator('.section-editor').first();
    await expect(firstSection.locator('.section-name-display')).toBeVisible();
    await expect(firstSection.locator('.section-item-count')).toContainText(/\d+ items?/);
  });

  test('section expand/collapse toggle works', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    const firstSection = page.locator('.section-editor').first();
    const toggleBtn = firstSection.locator('.section-expand-btn');

    // Should start expanded — items visible
    await expect(firstSection.locator('.section-items')).toBeVisible();

    // Collapse
    await toggleBtn.click();
    await expect(firstSection.locator('.section-items')).not.toBeVisible();

    // Expand again
    await toggleBtn.click();
    await expect(firstSection.locator('.section-items')).toBeVisible();
  });

  test('items show labels and field type badges', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    const firstItem = page.locator('.item-row').first();
    await expect(firstItem.locator('.item-label')).toBeVisible();
    await expect(firstItem.locator('.field-type-badge')).toBeVisible();
  });

  test('items show required and defect badges where applicable', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    // At least some items should have the Required badge
    const requiredBadges = page.locator('.item-badge--required');
    await expect(requiredBadges.first()).toBeVisible();
  });

  test('read-only mode hides edit controls', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

    // In read-only mode, these should NOT be visible
    await expect(page.locator('button:has-text("+ Add Section")')).not.toBeVisible();
    await expect(page.locator('.btn-add-item')).not.toBeVisible();
    await expect(page.locator('.btn-publish')).not.toBeVisible();
  });

  test('Back button returns to versions list', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });

    // Click back
    await page.locator('.btn-back').click();

    // Should return to versions list
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Checklist Management — Draft Workflow ──────────────────────
test.describe('Admin Checklist Management — Draft Workflow', () => {
  test('can create a new draft version', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    const createBtn = page.locator('.admin-toolbar .btn-primary');
    await expect(createBtn).toBeVisible();

    // If a draft already exists, the button is disabled
    const isDisabled = await createBtn.isDisabled();

    if (!isDisabled) {
      await createBtn.click();

      // Should transition to editor view with draft badge
      await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.version-badge--draft')).toBeVisible();
    } else {
      // Draft already exists — button text should indicate this
      await expect(createBtn).toContainText('Draft exists');
    }
  });

  test('draft version has Edit, Publish, and Delete buttons', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    // Only run this test if a draft exists
    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(draftCard.locator('.btn-primary.btn-small:has-text("Edit")')).toBeVisible();
      await expect(draftCard.locator('.btn-publish.btn-small:has-text("Publish")')).toBeVisible();
      await expect(draftCard.locator('.btn-danger.btn-small:has-text("Delete")')).toBeVisible();
    }
  });

  test('editing a draft opens editor in editable mode', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();

      await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.version-badge--draft')).toBeVisible();

      // Edit mode should show Add Section and Add Item buttons
      await expect(page.locator('button:has-text("+ Add Section")')).toBeVisible();
      await expect(page.locator('.btn-add-item').first()).toBeVisible();

      // Publish button should be visible in editor top bar
      await expect(page.locator('.editor-top-bar .btn-publish')).toBeVisible();
    }
  });

  test('draft editor allows adding a new section', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const sectionCountBefore = await page.locator('.section-editor').count();

      // Add a new section
      await page.locator('button:has-text("+ Add Section")').click();

      // Should have one more section
      await expect(page.locator('.section-editor')).toHaveCount(sectionCountBefore + 1);
    }
  });

  test('draft editor allows adding a new item to a section', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const firstSection = page.locator('.section-editor').first();
      const itemCountBefore = await firstSection.locator('.item-row').count();

      // Click Add Item in first section
      await firstSection.locator('.btn-add-item').click();

      // Should show item editor form
      await expect(firstSection.locator('.item-editor-form')).toBeVisible({ timeout: 5_000 });
    }
  });

  test('item editor form has all fields', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      // Click Edit on first item
      const firstItem = page.locator('.item-row').first();
      await firstItem.locator('.btn-secondary.btn-small:has-text("Edit")').click();

      // Item editor should appear with fields
      const editor = page.locator('.item-editor-form');
      await expect(editor).toBeVisible({ timeout: 5_000 });

      // Label input
      await expect(editor.locator('.item-editor-input').first()).toBeVisible();

      // Type select
      await expect(editor.locator('.item-editor-select').first()).toBeVisible();

      // Required and Triggers Defect checkboxes
      const checkboxes = editor.locator('.item-editor-checkbox');
      await expect(checkboxes).toHaveCount(2);

      // Save and Cancel buttons
      await expect(editor.locator('.btn-primary.btn-small:has-text("Save")')).toBeVisible();
      await expect(editor.locator('.btn-secondary.btn-small:has-text("Cancel")')).toBeVisible();
    }
  });

  test('item editor Cancel discards changes', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      // Click Edit on first item
      const firstItem = page.locator('.item-row').first();
      await firstItem.locator('.btn-secondary.btn-small:has-text("Edit")').click();

      const editor = page.locator('.item-editor-form');
      await expect(editor).toBeVisible({ timeout: 5_000 });

      // Click Cancel
      await editor.locator('.btn-secondary.btn-small:has-text("Cancel")').click();

      // Editor should close
      await expect(editor).not.toBeVisible();
    }
  });

  test('section reorder buttons are visible in draft mode', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      // Reorder buttons should be visible on sections
      const reorderBtns = page.locator('.section-header-actions .reorder-btn');
      await expect(reorderBtns.first()).toBeVisible();

      // First section's up button should be disabled
      const firstSection = page.locator('.section-editor').first();
      const upBtn = firstSection.locator('.reorder-btn:has-text("↑")');
      await expect(upBtn).toBeDisabled();
    }
  });
});

// ─── Checklist Management — Navigation ──────────────────────────
test.describe('Admin Checklist Management — Navigation', () => {
  test('sidebar Checklists link navigates to checklist management', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('.sidebar-nav')).toBeVisible({ timeout: 15_000 });

    await page.locator('.sidebar-nav').getByText('Checklists').click();
    await expect(page).toHaveURL('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 10_000 });
  });
});
