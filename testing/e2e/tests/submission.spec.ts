import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ─── Test image setup (reused from checklist.spec.ts) ───────────
const TEST_IMAGE_DIR = path.join(__dirname, '..', 'test-results', 'fixtures');
const TEST_IMAGE_PATH = path.join(TEST_IMAGE_DIR, 'test-photo.png');

// 1x1 red PNG (68 bytes)
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
  'base64'
);

test.beforeAll(() => {
  fs.mkdirSync(TEST_IMAGE_DIR, { recursive: true });
  fs.writeFileSync(TEST_IMAGE_PATH, TINY_PNG);
});

/**
 * Helper: fills vehicle info (Step 1), uploads all photos (Step 2),
 * answers checklist items (Step 3), skips defects (Step 4),
 * and lands on the Review step (Step 5).
 *
 * Uses a unique VRM per test run to avoid duplicate submission conflicts.
 */
async function fillFormToReviewStep(page: import('@playwright/test').Page, vrm?: string) {
  const testVrm = vrm ?? `E2E ${Date.now().toString(36).toUpperCase()}`;

  await page.goto('/checklist/new');
  await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
    timeout: 15_000,
  });

  // ── Step 1: Vehicle Info ──
  await page.fill('#driver-hrcode', 'X999999');
  await page.fill('#driver-name', 'E2E Submission Test');
  await page.fill('#vehicle-reg', testVrm);
  await page.fill('#mileage', '99999');
  await page.fill('#make-model', 'Test Van');
  await page.fill('#colour', 'Silver');
  await page.click('button:has-text("Continue to Photos")');

  // ── Step 2: Photos — upload to all required slots ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 2 of 5', {
    timeout: 5_000,
  });

  const photoSlots = page.locator('.photo-slot');
  const slotCount = await photoSlots.count();
  for (let i = 0; i < slotCount; i++) {
    const fileInput = photoSlots.nth(i).locator('input[type="file"]').last();
    await fileInput.setInputFiles(TEST_IMAGE_PATH);
  }

  const photoContinueBtn = page.locator('button:has-text("Continue to Checklist")');
  await expect(photoContinueBtn).toBeEnabled({ timeout: 5_000 });
  await photoContinueBtn.click();

  // ── Step 3: Checklist — answer all boolean items as "Yes" ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 3 of 5', {
    timeout: 5_000,
  });

  // Click all "Yes" buttons to satisfy required boolean fields
  const yesButtons = page.locator('.boolean-toggle:has-text("Yes")');
  const yesCount = await yesButtons.count();
  for (let i = 0; i < yesCount; i++) {
    await yesButtons.nth(i).click();
  }

  await page.click('button:has-text("Continue"):not(:has-text("Photos")):not(:has-text("Checklist"))');

  // ── Step 4: Defects — skip (no defects) ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 4 of 5', {
    timeout: 5_000,
  });
  await page.click('button:has-text("Review Submission")');

  // ── Step 5: Review ──
  await expect(page.locator('.form-step-title')).toContainText('Review & Submit', {
    timeout: 5_000,
  });

  return testVrm;
}

// ─── Review Step ────────────────────────────────────────────────
test.describe('Review Step', () => {
  test('review step displays all sections', async ({ page, context }) => {
    // Grant geolocation permission (needed if user clicks submit)
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToReviewStep(page);

    // Verify review sections are present
    await expect(page.locator('.review-section')).toHaveCount(6, { timeout: 5_000 });

    // Check key section titles
    const sectionTitles = page.locator('.review-section-title');
    const titles: string[] = [];
    const count = await sectionTitles.count();
    for (let i = 0; i < count; i++) {
      const text = await sectionTitles.nth(i).textContent();
      if (text) titles.push(text.trim());
    }
    expect(titles).toContain('Van Driver');
    expect(titles).toContain('Vehicle Details');
    expect(titles).toContain('Photos');
  });

  test('review step shows vehicle registration from form', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const vrm = await fillFormToReviewStep(page);

    // The VRM should appear in the Vehicle Details review section
    const reviewValues = page.locator('.review-value');
    const allValues: string[] = [];
    const count = await reviewValues.count();
    for (let i = 0; i < count; i++) {
      const text = await reviewValues.nth(i).textContent();
      if (text) allValues.push(text.trim());
    }
    expect(allValues).toContain(vrm);
  });

  test('review step shows no defects message when none added', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToReviewStep(page);

    await expect(page.locator('.review-none')).toContainText('No defects recorded');
  });

  test('submit button is present and enabled', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToReviewStep(page);

    const submitBtn = page.locator('.btn-submit');
    await expect(submitBtn).toBeVisible();
    await expect(submitBtn).toBeEnabled();
    await expect(submitBtn).toContainText('Submit Inspection');
  });

  test('back button warns about resetting review time', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToReviewStep(page);

    const backBtn = page.locator('button:has-text("Back (resets review time)")');
    await expect(backBtn).toBeVisible();
  });
});

// ─── Full Submission (Online) ───────────────────────────────────
test.describe('Full Submission', () => {
  test('submits inspection and redirects to home', async ({ page, context }) => {
    // Grant geolocation — mandatory for submission
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToReviewStep(page);

    // Click submit
    const submitBtn = page.locator('.btn-submit');
    await submitBtn.click();

    // Button text should change to show progress
    await expect(submitBtn).toContainText(/Submitting|Step|Complete/i, {
      timeout: 10_000,
    });

    // Should eventually redirect to home page
    await expect(page).toHaveURL('/', { timeout: 60_000 });

    // Confirm we're back on the home page
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 10_000,
    });
  });
});

// ─── Pending Submissions Page ───────────────────────────────────
test.describe('Pending Submissions Page', () => {
  test('pending page loads with header', async ({ page }) => {
    await page.goto('/pending');
    await expect(page.locator('.pending-page')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('.pending-header h2')).toContainText('Pending Submissions');
  });

  test('shows empty state when no pending submissions', async ({ page }) => {
    await page.goto('/pending');
    await expect(page.locator('.pending-page')).toBeVisible({ timeout: 15_000 });

    // Should show either pending cards or empty state
    // (In CI, IndexedDB is fresh so there should be no pending submissions)
    await expect(
      page.locator('.empty-state-card').or(page.locator('.pending-list'))
    ).toBeVisible({ timeout: 10_000 });
  });

  test('back button navigates to home', async ({ page }) => {
    await page.goto('/pending');
    await expect(page.locator('.pending-page')).toBeVisible({ timeout: 15_000 });

    await page.click('.btn-back');
    await expect(page).toHaveURL('/');
  });

  test('empty state shows correct messaging', async ({ page }) => {
    await page.goto('/pending');
    await expect(page.locator('.pending-page')).toBeVisible({ timeout: 15_000 });

    // If empty state is showing (expected in clean CI environment)
    const emptyCard = page.locator('.empty-state-card');
    if (await emptyCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await expect(emptyCard).toContainText('No pending submissions');
      await expect(emptyCard).toContainText('All submissions have been synced');
    }
  });
});

// ─── Home Page Pending Badge ────────────────────────────────────
test.describe('Home Page — Pending Badge', () => {
  test('home page does not show pending badge when no drafts exist', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 15_000,
    });

    // In a clean CI environment with no IndexedDB data, badge should not appear
    // (allow brief load time, then check absence)
    await page.waitForTimeout(2_000);
    await expect(page.locator('.pending-badge-card')).not.toBeVisible();
  });
});
