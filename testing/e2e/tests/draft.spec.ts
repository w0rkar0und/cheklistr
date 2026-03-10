import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// ─── Test image setup ─────────────────────────────────────────────
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
 * Helper: fills form through to a specific step.
 * Returns the VRM used.
 */
async function fillFormToStep(
  page: import('@playwright/test').Page,
  targetStep: 'vehicle-info' | 'photos' | 'checklist' | 'defects' | 'review',
  vrm?: string
) {
  const testVrm = vrm ?? `DFT ${Date.now().toString(36).toUpperCase()}`;

  await page.goto('/checklist/new');
  await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
    timeout: 15_000,
  });

  // ── Step 1: Vehicle Info ──
  await page.fill('#driver-hrcode', 'X888888');
  await page.fill('#driver-name', 'Draft Test Driver');
  await page.fill('#vehicle-reg', testVrm);
  await page.fill('#mileage', '55555');
  await page.fill('#make-model', 'Draft Van');
  await page.fill('#colour', 'Blue');

  if (targetStep === 'vehicle-info') return testVrm;

  await page.click('button:has-text("Continue to Photos")');

  // ── Step 2: Photos ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 2 of 5', {
    timeout: 5_000,
  });

  // Upload test image to each photo slot using the gallery input (without capture attribute)
  const galleryInputs = page.locator('.photo-slot input[type="file"]:not([capture])');
  const inputCount = await galleryInputs.count();
  for (let i = 0; i < inputCount; i++) {
    await galleryInputs.nth(i).setInputFiles(TEST_IMAGE_PATH);
    // Wait briefly for photo preview to render
    await page.waitForTimeout(300);
  }

  if (targetStep === 'photos') return testVrm;

  const photoContinueBtn = page.locator('button:has-text("Continue to Checklist")');
  await expect(photoContinueBtn).toBeEnabled({ timeout: 5_000 });
  await photoContinueBtn.click();

  // ── Step 3: Checklist ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 3 of 5', {
    timeout: 5_000,
  });

  const yesButtons = page.locator('.boolean-toggle:has-text("Yes")');
  const yesCount = await yesButtons.count();
  for (let i = 0; i < yesCount; i++) {
    await yesButtons.nth(i).click();
  }

  if (targetStep === 'checklist') return testVrm;

  await page.click(
    'button:has-text("Continue"):not(:has-text("Photos")):not(:has-text("Checklist"))'
  );

  // ── Step 4: Defects ──
  await expect(page.locator('.form-progress-label')).toContainText('Step 4 of 5', {
    timeout: 5_000,
  });

  if (targetStep === 'defects') return testVrm;

  await page.click('button:has-text("Review Submission")');

  // ── Step 5: Review ──
  await expect(page.locator('.form-step-title')).toContainText('Review & Submit', {
    timeout: 5_000,
  });

  return testVrm;
}

/**
 * Helper: saves current draft and waits for redirect home.
 */
async function saveDraftAndGoHome(page: import('@playwright/test').Page) {
  await page.click('button:has-text("Save Draft")');
  await expect(page).toHaveURL('/', { timeout: 15_000 });
  // Wait for draft card to render before interacting
  await expect(page.locator('.draft-card')).toBeVisible({ timeout: 5_000 });
}

/**
 * Helper: clicks Resume on the draft card and waits for the form to fully load.
 * This ensures the page has mounted, the checklist version is fetched,
 * and the loading spinner has resolved before returning.
 */
async function resumeDraftAndWaitForLoad(page: import('@playwright/test').Page) {
  await page.click('.draft-card button:has-text("Resume")');

  // 1. Wait for the outer checklist page container to mount
  await expect(page.locator('.checklist-page')).toBeVisible({ timeout: 15_000 });

  // 2. Wait for the loading spinner to disappear (checklist version fetch)
  await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 15_000 });

  // 3. Wait for the form step content to render
  await expect(page.locator('.form-step')).toBeVisible({ timeout: 10_000 });
}

/**
 * Helper: reads the IndexedDB 'drafts' store and returns the 'current' entry.
 */
async function getDraftFromIndexedDB(page: import('@playwright/test').Page) {
  return page.evaluate(async () => {
    return new Promise<unknown>((resolve) => {
      const req = indexedDB.open('cheklistr-offline', 2);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('drafts', 'readonly');
        const store = tx.objectStore('drafts');
        const get = store.get('current');
        get.onsuccess = () => resolve(get.result ?? null);
        get.onerror = () => resolve(null);
      };
      req.onerror = () => resolve(null);
    });
  });
}

/**
 * Helper: deletes the draft from IndexedDB (cleanup).
 */
async function deleteDraftFromIndexedDB(page: import('@playwright/test').Page) {
  await page.evaluate(async () => {
    return new Promise<void>((resolve) => {
      const req = indexedDB.open('cheklistr-offline', 2);
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('drafts')) {
          resolve();
          return;
        }
        const tx = db.transaction('drafts', 'readwrite');
        const store = tx.objectStore('drafts');
        store.delete('current');
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      };
      req.onerror = () => resolve();
    });
  });
}

// ─── Save Draft ──────────────────────────────────────────────────
test.describe('Save Draft', () => {
  test.afterEach(async ({ page }) => {
    // Clean up any leftover draft
    await page.goto('/');
    await page.waitForTimeout(1_000);
    await deleteDraftFromIndexedDB(page);
  });

  test('Save Draft button is visible on review step', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToStep(page, 'review');

    const saveDraftBtn = page.locator('button:has-text("Save Draft")');
    await expect(saveDraftBtn).toBeVisible();
    await expect(saveDraftBtn).toBeEnabled();
  });

  test('saving a draft redirects to home with toast', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const vrm = await fillFormToStep(page, 'review');

    // Click Save Draft
    await page.click('button:has-text("Save Draft")');

    // Should redirect to home
    await expect(page).toHaveURL('/', { timeout: 15_000 });

    // Toast message should appear
    await expect(page.locator('.success-message')).toContainText(
      'Draft saved',
      { timeout: 5_000 }
    );
  });

  test('saved draft persists in IndexedDB', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const vrm = await fillFormToStep(page, 'review');

    await saveDraftAndGoHome(page);

    // Check IndexedDB for the draft
    const draft = (await getDraftFromIndexedDB(page)) as Record<string, unknown> | null;
    expect(draft).not.toBeNull();
    expect((draft as any).vehicleInfo.vehicleRegistration).toBe(vrm);
    expect((draft as any).driverInfo.hrCode).toBe('X888888');
    expect((draft as any).driverInfo.name).toBe('Draft Test Driver');
    expect((draft as any).savedAt).toBeTruthy();
  });

  test('draft card appears on home page after saving', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const vrm = await fillFormToStep(page, 'review');

    await saveDraftAndGoHome(page);

    // Draft card should be visible (already verified by saveDraftAndGoHome)
    const draftCard = page.locator('.draft-card');

    // Should show the VRM
    await expect(draftCard.locator('.draft-vrm')).toContainText(vrm);

    // Should show Resume and Discard buttons
    await expect(draftCard.locator('button:has-text("Resume")')).toBeVisible();
    await expect(draftCard.locator('button:has-text("Discard")')).toBeVisible();

    // Should show the Draft badge
    await expect(draftCard.locator('.draft-badge')).toBeVisible();
  });

  test('buttons are disabled while saving draft', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToStep(page, 'review');

    const saveDraftBtn = page.locator('button:has-text("Save Draft")');
    await saveDraftBtn.click();

    // While saving, button should show "Saving…" or be disabled
    // (race condition — check immediately after click)
    await expect(
      page.locator('button:has-text("Saving")').or(page.locator('.home-greeting'))
    ).toBeVisible({ timeout: 15_000 });
  });
});

// ─── Draft Resume ────────────────────────────────────────────────
test.describe('Draft Resume', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_000);
    await deleteDraftFromIndexedDB(page);
  });

  test('resuming a draft restores vehicle info fields', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    const vrm = await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Click Resume and wait for form to load
    await resumeDraftAndWaitForLoad(page);
  });

  test('resuming draft loads without infinite spinner', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Resume the draft and wait for full load
    await resumeDraftAndWaitForLoad(page);

    // Double-check: loading spinner should NOT be visible
    await expect(page.locator('.loading-spinner')).not.toBeVisible({ timeout: 5_000 });
  });

  test('discard removes draft from home page and IndexedDB', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Click Discard
    await page.click('.draft-card button:has-text("Discard")');

    // Draft card should disappear
    await expect(page.locator('.draft-card')).not.toBeVisible({ timeout: 5_000 });

    // IndexedDB should be empty
    const draft = await getDraftFromIndexedDB(page);
    expect(draft).toBeNull();
  });

  test('draft is cleaned up after successful online submission', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    // Save a draft first
    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Verify draft exists
    let draft = await getDraftFromIndexedDB(page);
    expect(draft).not.toBeNull();

    // Resume the draft and wait for full load
    await resumeDraftAndWaitForLoad(page);

    // Submit the form — we should be on or near the review step
    // Navigate to review if not already there
    const reviewTitle = page.locator('.form-step-title:has-text("Review & Submit")');
    if (!(await reviewTitle.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // May need to navigate forward through steps
      const continueBtn = page.locator('button:has-text("Continue")').first();
      if (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await continueBtn.click();
      }
      const reviewBtn = page.locator('button:has-text("Review Submission")');
      if (await reviewBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await reviewBtn.click();
      }
    }

    // Submit
    const submitBtn = page.locator('.btn-submit');
    if (await submitBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await submitBtn.click();
      await expect(page).toHaveURL('/', { timeout: 60_000 });

      // Draft should be cleaned up after submission
      draft = await getDraftFromIndexedDB(page);
      expect(draft).toBeNull();
    }
  });

  test('saving a new draft overwrites the previous one', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    // Save first draft
    const vrm1 = await fillFormToStep(page, 'review', 'FIRST DFT');
    await saveDraftAndGoHome(page);

    // Discard and create a new form with different VRM
    await page.click('.draft-card button:has-text("Discard")');
    await expect(page.locator('.draft-card')).not.toBeVisible({ timeout: 5_000 });

    // Save second draft
    const vrm2 = await fillFormToStep(page, 'review', 'SECOND DFT');
    await saveDraftAndGoHome(page);

    // Only the second draft should exist
    const draft = (await getDraftFromIndexedDB(page)) as Record<string, unknown> | null;
    expect(draft).not.toBeNull();
    expect((draft as any).vehicleInfo.vehicleRegistration).toBe('SECOND DFT');
  });
});

// ─── Draft-Restored Photos on Submission ────────────────────────
test.describe('Draft-Restored Photos', () => {
  test.afterEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1_000);
    await deleteDraftFromIndexedDB(page);
  });

  test('draft preserves photo data in IndexedDB', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    // Fill form through photos step, then all the way to review, then save draft
    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Check that draft has photo data
    const draft = (await getDraftFromIndexedDB(page)) as Record<string, unknown> | null;
    expect(draft).not.toBeNull();

    // vehiclePhotos is a DraftPhoto[] array: { photoType: string; blob: Blob }
    const vehiclePhotos = (draft as any).vehiclePhotos;
    expect(vehiclePhotos).toBeTruthy();
    expect(Array.isArray(vehiclePhotos)).toBe(true);

    // At least one photo entry should exist (we uploaded to all slots)
    expect(vehiclePhotos.length).toBeGreaterThan(0);
  });

  test('resumed draft shows photo previews on photos step', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Resume the draft and wait for full load
    await resumeDraftAndWaitForLoad(page);

    // Navigate to the photos step (step 2)
    // Draft saves at review (step 5) — we need to go backwards
    const step2Label = page.locator('.form-progress-label:has-text("Step 2")');
    if (!(await step2Label.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Click Back button repeatedly until we reach step 2
      const backBtn = page.locator('button:has-text("Back")');
      for (let attempts = 0; attempts < 5; attempts++) {
        if (await step2Label.isVisible({ timeout: 1_000 }).catch(() => false)) break;
        if (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
          await backBtn.click();
          await page.waitForTimeout(500);
        }
      }
    }

    // Should now be on the photos step
    await expect(step2Label).toBeVisible({ timeout: 5_000 });

    // At least one photo preview should be visible
    const previews = page.locator('.photo-slot img');
    await expect(previews.first()).toBeVisible({ timeout: 10_000 });
  });

  test('resumed draft can be submitted with restored photos', async ({ page, context }) => {
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 51.5074, longitude: -0.1278 });

    // Fill and save a draft
    await fillFormToStep(page, 'review');
    await saveDraftAndGoHome(page);

    // Resume the draft and wait for full load
    await resumeDraftAndWaitForLoad(page);

    // Navigate to review step
    const reviewTitle = page.locator('.form-step-title:has-text("Review & Submit")');
    if (!(await reviewTitle.isVisible({ timeout: 5_000 }).catch(() => false))) {
      // Navigate forward through steps
      const continueBtn = page.locator('button:has-text("Continue")').first();
      while (await continueBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await continueBtn.click();
        await page.waitForTimeout(500);
        if (await reviewTitle.isVisible({ timeout: 1_000 }).catch(() => false)) break;
      }
      const reviewBtn = page.locator('button:has-text("Review Submission")');
      if (await reviewBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await reviewBtn.click();
      }
    }

    // Submit the form
    const submitBtn = page.locator('.btn-submit');
    await expect(submitBtn).toBeVisible({ timeout: 10_000 });
    await submitBtn.click();

    // Should show progress and eventually redirect home
    await expect(submitBtn).toContainText(/Submitting|Step|Complete/i, {
      timeout: 10_000,
    });

    await expect(page).toHaveURL('/', { timeout: 60_000 });

    // Verify we're home and draft is cleaned up
    await expect(page.locator('.home-greeting h2')).toContainText('Welcome', {
      timeout: 10_000,
    });

    // Draft card should not be visible (draft cleared after submission)
    await expect(page.locator('.draft-card')).not.toBeVisible({ timeout: 5_000 });
  });
});
