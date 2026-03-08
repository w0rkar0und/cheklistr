import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Create a minimal 1x1 PNG test image for photo uploads
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

test.describe('New Checklist — Vehicle Info Step', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/checklist/new');
    // Wait for the checklist to load (Step 1 title appears)
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });
  });

  test('shows step 1 with correct form fields', async ({ page }) => {
    await expect(page.locator('#driver-hrcode')).toBeVisible();
    await expect(page.locator('#driver-name')).toBeVisible();
    await expect(page.locator('#vehicle-reg')).toBeVisible();
    await expect(page.locator('#mileage')).toBeVisible();
    await expect(page.locator('#make-model')).toBeVisible();
    await expect(page.locator('#colour')).toBeVisible();
  });

  test('shows inspector info from logged-in user', async ({ page }) => {
    await expect(page.locator('.inspector-info')).toBeVisible();
    await expect(page.locator('.inspector-info')).toContainText('Inspected by');
  });

  test('Continue button is disabled until required fields are filled', async ({ page }) => {
    const continueBtn = page.locator('button:has-text("Continue to Photos")');
    await expect(continueBtn).toBeDisabled();

    // Fill required fields
    await page.fill('#driver-hrcode', 'X999999');
    await page.fill('#driver-name', 'Test Driver');
    await page.fill('#vehicle-reg', 'AB12 CDE');
    await page.fill('#mileage', '50000');

    await expect(continueBtn).toBeEnabled();
  });

  test('uppercases VRM and HR code inputs', async ({ page }) => {
    await page.fill('#driver-hrcode', 'x999999');
    await expect(page.locator('#driver-hrcode')).toHaveValue('X999999');

    await page.fill('#vehicle-reg', 'ab12 cde');
    await expect(page.locator('#vehicle-reg')).toHaveValue('AB12 CDE');
  });

  test('advances to photos step when form is valid', async ({ page }) => {
    // Fill all required fields
    await page.fill('#driver-hrcode', 'X999999');
    await page.fill('#driver-name', 'Test Driver');
    await page.fill('#vehicle-reg', 'AB12 CDE');
    await page.fill('#mileage', '50000');
    await page.fill('#make-model', 'Ford Transit');
    await page.fill('#colour', 'White');

    await page.click('button:has-text("Continue to Photos")');

    // Step progress label shows "Step 2 of 5"
    await expect(page.locator('.form-progress-label')).toContainText('Step 2 of 5', {
      timeout: 5_000,
    });
  });
});

test.describe('New Checklist — Multi-Step Navigation', () => {
  test('can navigate through all steps with valid data', async ({ page }) => {
    await page.goto('/checklist/new');
    await expect(page.locator('.form-step-title')).toContainText('Vehicle Details', {
      timeout: 15_000,
    });

    // Step 1: Vehicle Info
    await page.fill('#driver-hrcode', 'X999999');
    await page.fill('#driver-name', 'E2E Test Driver');
    await page.fill('#vehicle-reg', 'TE57 E2E');
    await page.fill('#mileage', '12345');
    await page.fill('#make-model', 'Test Van');
    await page.fill('#colour', 'Blue');
    await page.click('button:has-text("Continue to Photos")');

    // Step 2: Photos — upload a test image to all 10 required photo slots
    await expect(page.locator('.form-progress-label')).toContainText('Step 2 of 5', {
      timeout: 5_000,
    });

    // Each photo slot has two hidden file inputs (camera + gallery).
    // We target the gallery input (second input) in each .photo-slot.
    const photoSlots = page.locator('.photo-slot');
    const slotCount = await photoSlots.count();

    for (let i = 0; i < slotCount; i++) {
      // Each slot has two <input type="file"> elements; use the second (gallery)
      const fileInput = photoSlots.nth(i).locator('input[type="file"]').last();
      await fileInput.setInputFiles(TEST_IMAGE_PATH);
    }

    // All photos uploaded — button should now be enabled
    const continueBtn = page.locator('button:has-text("Continue to Checklist")');
    await expect(continueBtn).toBeEnabled({ timeout: 5_000 });
    await continueBtn.click();

    // Step 3: Checklist responses
    await expect(page.locator('.form-progress-label')).toContainText('Step 3 of 5', {
      timeout: 5_000,
    });
  });
});
