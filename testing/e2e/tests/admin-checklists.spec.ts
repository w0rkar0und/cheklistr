import { test, expect } from '@playwright/test';

// ─── Checklist Management — Checklist List View ────────────────
test.describe('Admin Checklist Management — Checklist List', () => {
  test('checklist management page loads with list view', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.admin-page-header h2')).toContainText('Checklist Management');
  });

  test('shows at least one checklist card', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    // Wait for loading to complete
    await expect(
      page.locator('.checklist-list').or(page.locator('.empty-state'))
    ).toBeVisible({ timeout: 15_000 });

    const cards = page.locator('.checklist-card');
    await expect(cards.first()).toBeVisible();
  });

  test('active checklist has Active badge', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.checklist-card--active');
    await expect(activeCard.first()).toBeVisible();
    await expect(activeCard.first().locator('.version-badge--active')).toContainText('Active');
  });

  test('checklist cards show name, version count, and date', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    const firstCard = page.locator('.checklist-card').first();
    await expect(firstCard.locator('.checklist-card-name')).toBeVisible();
    await expect(firstCard.locator('.checklist-card-meta')).toContainText(/\d+ version/);
    await expect(firstCard.locator('.checklist-card-meta')).toContainText(/Created/);
  });

  test('active checklist card has Manage Versions button', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.checklist-card--active').first();
    await expect(activeCard.locator('.btn-primary.btn-small:has-text("Manage Versions")')).toBeVisible();
  });

  test('inactive checklist card has Activate and Delete buttons', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    // Only run if there's an inactive checklist
    const inactiveCard = page.locator('.checklist-card:not(.checklist-card--active)');
    if (await inactiveCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(inactiveCard.first().locator('.btn-secondary.btn-small:has-text("Activate")')).toBeVisible();
      await expect(inactiveCard.first().locator('.btn-danger.btn-small:has-text("Delete")')).toBeVisible();
    }
  });

  test('New Checklist button is present', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    const createBtn = page.locator('.admin-page-header .btn-primary:has-text("+ New Checklist")');
    await expect(createBtn).toBeVisible();
  });

  test('clicking New Checklist shows create form', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.admin-checklists')).toBeVisible({ timeout: 15_000 });

    await page.locator('.admin-page-header .btn-primary:has-text("+ New Checklist")').click();
    await expect(page.locator('.admin-card h3')).toContainText('Create New Checklist');
    await expect(page.locator('#checklist-name')).toBeVisible();
  });
});

// ─── Checklist Management — Create & Delete Checklist ──────────
test.describe('Admin Checklist Management — Create & Delete', () => {
  test('can create and delete a test checklist', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    const cardCountBefore = await page.locator('.checklist-card').count();

    // Open create form
    await page.locator('.admin-page-header .btn-primary:has-text("+ New Checklist")').click();
    await expect(page.locator('#checklist-name')).toBeVisible();

    // Fill and submit
    await page.locator('#checklist-name').fill('E2E Test Checklist');
    await page.locator('button[type="submit"]:has-text("Create Checklist")').click();

    // Wait for list to reload with new card
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.checklist-card')).toHaveCount(cardCountBefore + 1, { timeout: 10_000 });

    // Find the new card by name
    const newCard = page.locator('.checklist-card', { has: page.locator('.checklist-card-name:has-text("E2E Test Checklist")') });
    await expect(newCard).toBeVisible();
    await expect(newCard.locator('.checklist-card-meta')).toContainText('1 version');

    // Delete it (should not be active, so Delete button exists)
    let dialogHandled = false;
    page.once('dialog', async (dialog) => {
      dialogHandled = true;
      await dialog.accept();
    });
    await newCard.locator('.btn-danger.btn-small:has-text("Delete")').click();
    expect(dialogHandled).toBe(true);

    // Wait for reload
    await page.waitForTimeout(2_000);
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.checklist-card')).toHaveCount(cardCountBefore, { timeout: 10_000 });
  });
});

// ─── Checklist Management — Navigate to Versions ───────────────
test.describe('Admin Checklist Management — Versions List', () => {
  test('clicking Manage Versions shows version list with back button', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.checklist-card--active').first();
    await activeCard.locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    // Should see versions list with back navigation
    await expect(page.locator('.btn-back:has-text("Back to Checklists")')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.version-list').or(page.locator('.empty-state'))).toBeVisible({ timeout: 15_000 });
  });

  test('shows at least one version card', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const cards = page.locator('.version-card');
    await expect(cards.first()).toBeVisible();
  });

  test('active version has correct badge', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeBadge = page.locator('.version-badge--active');
    await expect(activeBadge.first()).toBeVisible();
    await expect(activeBadge.first()).toContainText('Active');
  });

  test('active version card has View button', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await expect(activeCard).toBeVisible();

    const viewBtn = activeCard.locator('.btn-secondary.btn-small:has-text("View")');
    await expect(viewBtn).toBeVisible();
  });

  test('version cards show version number and date', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const versionNumber = page.locator('.version-number').first();
    await expect(versionNumber).toBeVisible();
    await expect(versionNumber).toContainText(/Version \d+/);

    const meta = page.locator('.version-card-meta').first();
    await expect(meta).toContainText(/Published|Created/);
  });

  test('Create New Draft button is present', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.admin-toolbar')).toBeVisible({ timeout: 15_000 });

    const createBtn = page.locator('.admin-toolbar .btn-primary');
    await expect(createBtn).toBeVisible();
  });

  test('Back to Checklists returns to list view', async ({ page }) => {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.btn-back:has-text("Back to Checklists")')).toBeVisible({ timeout: 10_000 });

    await page.locator('.btn-back:has-text("Back to Checklists")').click();
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Checklist Management — Version Editor (Read-Only) ──────────
test.describe('Admin Checklist Management — View Active Version', () => {
  // Helper: navigate from list → versions → editor for active version
  async function navigateToActiveEditor(page: import('@playwright/test').Page) {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });

    const activeCard = page.locator('.version-card--active').first();
    await activeCard.locator('.btn-secondary.btn-small:has-text("View")').click();

    await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
  }

  test('clicking View opens the version editor', async ({ page }) => {
    await navigateToActiveEditor(page);
  });

  test('editor shows version number and Active badge', async ({ page }) => {
    await navigateToActiveEditor(page);
    await expect(page.locator('.editor-title h2')).toContainText(/Version \d+/);
    await expect(page.locator('.version-badge--active')).toBeVisible();
  });

  test('editor shows section and item counts', async ({ page }) => {
    await navigateToActiveEditor(page);
    await expect(page.locator('.editor-stats')).toContainText(/\d+ section/);
    await expect(page.locator('.editor-stats')).toContainText(/\d+ item/);
  });

  test('editor shows all 5 sections', async ({ page }) => {
    await navigateToActiveEditor(page);
    await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.section-editor')).toHaveCount(5);
  });

  test('sections have names and item counts', async ({ page }) => {
    await navigateToActiveEditor(page);
    const firstSection = page.locator('.section-editor').first();
    await expect(firstSection.locator('.section-name-display')).toBeVisible();
    await expect(firstSection.locator('.section-item-count')).toContainText(/\d+ items?/);
  });

  test('section expand/collapse toggle works', async ({ page }) => {
    await navigateToActiveEditor(page);
    const firstSection = page.locator('.section-editor').first();
    const toggleBtn = firstSection.locator('.section-expand-btn');

    // Sections start collapsed
    await expect(firstSection.locator('.section-items')).not.toBeVisible();

    // Expand
    await toggleBtn.click();
    await expect(firstSection.locator('.section-items')).toBeVisible();

    // Collapse
    await toggleBtn.click();
    await expect(firstSection.locator('.section-items')).not.toBeVisible();
  });

  test('items show labels and field type badges', async ({ page }) => {
    await navigateToActiveEditor(page);
    const firstSection = page.locator('.section-editor').first();
    await firstSection.locator('.section-expand-btn').click();
    await expect(firstSection.locator('.section-items')).toBeVisible({ timeout: 5_000 });

    const firstItem = page.locator('.item-row').first();
    await expect(firstItem.locator('.item-label')).toBeVisible();
    await expect(firstItem.locator('.field-type-badge')).toBeVisible();
  });

  test('items show required badges where applicable', async ({ page }) => {
    await navigateToActiveEditor(page);

    // Expand all sections
    const sections = page.locator('.section-editor');
    const count = await sections.count();
    for (let i = 0; i < count; i++) {
      await sections.nth(i).locator('.section-expand-btn').click();
    }

    await expect(page.locator('.item-row').first()).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('.item-badge--required').first()).toBeVisible();
  });

  test('read-only mode hides edit controls', async ({ page }) => {
    await navigateToActiveEditor(page);
    await expect(page.locator('button:has-text("+ Add Section")')).not.toBeVisible();
    await expect(page.locator('.btn-add-item')).not.toBeVisible();
    await expect(page.locator('.btn-publish')).not.toBeVisible();
  });

  test('Back button returns to versions list', async ({ page }) => {
    await navigateToActiveEditor(page);
    await page.locator('.btn-back').click();
    await expect(page.locator('.version-list')).toBeVisible({ timeout: 10_000 });
  });
});

// ─── Checklist Management — Draft Workflow ──────────────────────
test.describe('Admin Checklist Management — Draft Workflow', () => {
  // Helper: navigate to versions view for the active checklist
  async function navigateToVersions(page: import('@playwright/test').Page) {
    await page.goto('/admin/checklists');
    await expect(page.locator('.checklist-list')).toBeVisible({ timeout: 15_000 });

    await page.locator('.checklist-card--active').first()
      .locator('.btn-primary.btn-small:has-text("Manage Versions")').click();

    await expect(page.locator('.version-list').or(page.locator('.empty-state'))).toBeVisible({ timeout: 15_000 });
  }

  test('can create a new draft version', async ({ page }) => {
    await navigateToVersions(page);

    const createBtn = page.locator('.admin-toolbar .btn-primary');
    await expect(createBtn).toBeVisible();

    const isDisabled = await createBtn.isDisabled();

    if (!isDisabled) {
      await createBtn.click();
      await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.version-badge--draft')).toBeVisible();
    } else {
      await expect(createBtn).toContainText('Draft exists');
    }
  });

  test('draft version has Edit, Publish, and Delete buttons', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await expect(draftCard.locator('.btn-primary.btn-small:has-text("Edit")')).toBeVisible();
      await expect(draftCard.locator('.btn-publish.btn-small:has-text("Publish")')).toBeVisible();
      await expect(draftCard.locator('.btn-danger.btn-small:has-text("Delete")')).toBeVisible();
    }
  });

  test('editing a draft opens editor in editable mode', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();

      await expect(page.locator('.editor-top-bar')).toBeVisible({ timeout: 10_000 });
      await expect(page.locator('.version-badge--draft')).toBeVisible();

      await expect(page.locator('button:has-text("+ Add Section")')).toBeVisible();

      const firstSection = page.locator('.section-editor').first();
      await firstSection.locator('.section-expand-btn').click();
      await expect(firstSection.locator('.section-items')).toBeVisible({ timeout: 5_000 });
      await expect(firstSection.locator('.btn-add-item')).toBeVisible();

      await expect(page.locator('.editor-top-bar .btn-publish')).toBeVisible();
    }
  });

  test('draft editor allows adding a new section', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const sectionCountBefore = await page.locator('.section-editor').count();
      await page.locator('button:has-text("+ Add Section")').click();
      await expect(page.locator('.section-editor')).toHaveCount(sectionCountBefore + 1);
    }
  });

  test('draft editor allows adding a new item to a section', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const firstSection = page.locator('.section-editor').first();
      await firstSection.locator('.section-expand-btn').click();
      await expect(firstSection.locator('.section-items')).toBeVisible({ timeout: 5_000 });

      const itemCountBefore = await firstSection.locator('.item-row').count();
      await firstSection.locator('.btn-add-item').click();

      await expect(firstSection.locator('.item-row')).toHaveCount(itemCountBefore + 1, { timeout: 5_000 });
      await expect(firstSection.locator('.item-row').last().locator('.item-label')).toHaveText('New Item');
    }
  });

  test('item editor form has all fields', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const firstSection = page.locator('.section-editor').first();
      await firstSection.locator('.section-expand-btn').click();
      await expect(firstSection.locator('.section-items')).toBeVisible({ timeout: 5_000 });

      const firstItem = page.locator('.item-row').first();
      await firstItem.locator('.btn-secondary.btn-small:has-text("Edit")').click();

      const editor = page.locator('.item-editor-form');
      await expect(editor).toBeVisible({ timeout: 5_000 });
      await expect(editor.locator('.item-editor-input').first()).toBeVisible();
      await expect(editor.locator('.item-editor-select').first()).toBeVisible();

      const checkboxes = editor.locator('.item-editor-checkbox');
      await expect(checkboxes.first()).toBeVisible();
      expect(await checkboxes.count()).toBeGreaterThanOrEqual(2);

      await expect(editor.locator('.btn-primary.btn-small:has-text("Save")')).toBeVisible();
      await expect(editor.locator('.btn-secondary.btn-small:has-text("Cancel")')).toBeVisible();
    }
  });

  test('item editor Cancel discards changes', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const firstSection = page.locator('.section-editor').first();
      await firstSection.locator('.section-expand-btn').click();
      await expect(firstSection.locator('.section-items')).toBeVisible({ timeout: 5_000 });

      const firstItem = page.locator('.item-row').first();
      await firstItem.locator('.btn-secondary.btn-small:has-text("Edit")').click();

      const editor = page.locator('.item-editor-form');
      await expect(editor).toBeVisible({ timeout: 5_000 });

      await editor.locator('.btn-secondary.btn-small:has-text("Cancel")').click();
      await expect(editor).not.toBeVisible();
    }
  });

  test('section reorder buttons are visible in draft mode', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await draftCard.locator('.btn-primary.btn-small:has-text("Edit")').click();
      await expect(page.locator('.sections-list')).toBeVisible({ timeout: 10_000 });

      const reorderBtns = page.locator('.section-header-actions .reorder-btn');
      await expect(reorderBtns.first()).toBeVisible();

      const firstSection = page.locator('.section-editor').first();
      const upBtn = firstSection.locator('.reorder-btn:has-text("↑")');
      await expect(upBtn).toBeDisabled();
    }
  });

  // MUST remain the LAST test in this block — it deletes the draft version
  test('deleting a draft version removes it from the list', async ({ page }) => {
    await navigateToVersions(page);

    const draftCard = page.locator('.version-card--draft');

    if (await draftCard.isVisible({ timeout: 3_000 }).catch(() => false)) {
      const versionCountBefore = await page.locator('.version-card').count();

      let dialogHandled = false;
      page.once('dialog', async (dialog) => {
        dialogHandled = true;
        await dialog.accept();
      });
      await draftCard.locator('.btn-danger.btn-small:has-text("Delete")').click();

      expect(dialogHandled).toBe(true);

      await page.waitForTimeout(2_000);

      const errorMsg = page.locator('.error-message');
      const hasError = await errorMsg.isVisible().catch(() => false);
      if (hasError) {
        const errorText = await errorMsg.textContent();
        throw new Error(`Delete failed with DB error: ${errorText}`);
      }

      await expect(page.locator('.version-list')).toBeVisible({ timeout: 15_000 });
      await expect(page.locator('.version-card--draft')).toHaveCount(0, { timeout: 5_000 });
      await expect(page.locator('.btn-primary:has-text("Create New Draft")')).toBeEnabled();
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
