import { test, expect } from '@playwright/test';

// ─── VRM Lookup — Button & UI ───────────────────────────────────
test.describe('VRM Lookup — UI', () => {
  test('lookup button is disabled when VRM is empty', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    const lookupBtn = page.locator('.btn-lookup');
    await expect(lookupBtn).toBeVisible();
    await expect(lookupBtn).toBeDisabled();
  });

  test('lookup button is disabled when VRM is only 1 character', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', 'A');
    const lookupBtn = page.locator('.btn-lookup');
    await expect(lookupBtn).toBeDisabled();
  });

  test('lookup button is enabled when VRM has 2+ characters', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', 'AB');
    const lookupBtn = page.locator('.btn-lookup');
    await expect(lookupBtn).toBeEnabled();
  });

  test('lookup button text shows "Look up" by default', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    const lookupBtn = page.locator('.btn-lookup');
    await expect(lookupBtn).toContainText('Look up');
  });
});

// ─── VRM Lookup — Real VRM ("1MP") ──────────────────────────────
test.describe('VRM Lookup — Real VRM', () => {
  test('looking up real VRM "1MP" populates make/model and colour', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    // Enter real VRM
    await page.fill('#vehicle-reg', '1MP');

    // Click lookup
    const lookupBtn = page.locator('.btn-lookup');
    await expect(lookupBtn).toBeEnabled();
    await lookupBtn.click();

    // Button should show "Looking up…" while in progress
    await expect(lookupBtn).toContainText('Looking up', { timeout: 5_000 });

    // Wait for lookup to complete — success message should appear
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.lookup-success')).toContainText(
      'Vehicle details found and populated below'
    );

    // Make & Model field should be auto-filled (non-empty)
    const makeModel = await page.inputValue('#make-model');
    expect(makeModel.trim().length).toBeGreaterThan(0);

    // Colour field should be auto-filled (non-empty)
    const colour = await page.inputValue('#colour');
    expect(colour.trim().length).toBeGreaterThan(0);
  });

  test('auto-filled fields have input-autofilled class', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', '1MP');
    await page.click('.btn-lookup');

    // Wait for success
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });

    // Make & Model should have autofilled class
    await expect(page.locator('#make-model')).toHaveClass(/input-autofilled/);

    // Colour should have autofilled class
    await expect(page.locator('#colour')).toHaveClass(/input-autofilled/);
  });

  test('auto-filled fields are read-only after lookup', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', '1MP');
    await page.click('.btn-lookup');
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });

    // Make & Model should be readOnly
    await expect(page.locator('#make-model')).toHaveAttribute('readonly', '');

    // Colour should be readOnly
    await expect(page.locator('#colour')).toHaveAttribute('readonly', '');
  });

  test('labels show "(auto-filled)" after successful lookup', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', '1MP');
    await page.click('.btn-lookup');
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });

    // Labels should contain "(auto-filled)"
    await expect(page.locator('label[for="make-model"]')).toContainText('(auto-filled)');
    await expect(page.locator('label[for="colour"]')).toContainText('(auto-filled)');
  });

  test('changing VRM after lookup clears success message', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', '1MP');
    await page.click('.btn-lookup');
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });

    // Change the VRM
    await page.fill('#vehicle-reg', 'CHANGED');

    // Success message should disappear
    await expect(page.locator('.lookup-success')).not.toBeVisible();
  });
});

// ─── VRM Lookup — Invalid/Not Found ─────────────────────────────
test.describe('VRM Lookup — Invalid VRM', () => {
  test('looking up a bogus VRM shows warning message', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    // Enter a VRM that won't be found
    await page.fill('#vehicle-reg', 'ZZZZNOTREAL99');

    const lookupBtn = page.locator('.btn-lookup');
    await lookupBtn.click();

    // Should show warning/error message
    await expect(page.locator('.lookup-warning')).toBeVisible({ timeout: 30_000 });
  });

  test('warning message disappears when VRM is changed', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    await page.fill('#vehicle-reg', 'ZZZZNOTREAL99');
    await page.click('.btn-lookup');
    await expect(page.locator('.lookup-warning')).toBeVisible({ timeout: 30_000 });

    // Change VRM — warning should clear
    await page.fill('#vehicle-reg', 'SOMETHING');
    await expect(page.locator('.lookup-warning')).not.toBeVisible();
  });
});

// ─── VRM Lookup — Full Flow ─────────────────────────────────────
test.describe('VRM Lookup — Full Flow', () => {
  test('form can proceed after successful VRM lookup', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    // Fill required fields
    await page.fill('#driver-hrcode', 'X123456');
    await page.fill('#driver-name', 'VRM Test Driver');
    await page.fill('#vehicle-reg', '1MP');
    await page.fill('#mileage', '10000');

    // Do the lookup
    await page.click('.btn-lookup');
    await expect(page.locator('.lookup-success')).toBeVisible({ timeout: 30_000 });

    // Continue button should be enabled (all required fields filled + lookup populated make/model)
    const continueBtn = page.locator('button:has-text("Continue to Photos")');
    await expect(continueBtn).toBeEnabled();

    // Click continue — should proceed to step 2
    await continueBtn.click();
    await expect(page.locator('.form-progress-label')).toContainText('Step 2 of 5', {
      timeout: 5_000,
    });
  });
});
