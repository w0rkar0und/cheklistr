import { test, expect } from '@playwright/test';

/**
 * PDF Photo Aspect Ratio Tests
 *
 * These tests verify that the fitImage() logic in generateSubmissionPdf.ts
 * correctly preserves aspect ratios for different image orientations.
 *
 * Since fitImage() is an internal function, we inject and evaluate
 * the same algorithm in the browser context.
 */

// The fitImage function from generateSubmissionPdf.ts (reproduced for in-page evaluation)
const FIT_IMAGE_FN = `
  function fitImage(img, maxW, maxH) {
    const ratio = img.width / img.height;
    let w = maxW;
    let h = w / ratio;
    if (h > maxH) {
      h = maxH;
      w = h * ratio;
    }
    return { w, h };
  }
`;

test.describe('PDF fitImage — Aspect Ratio Preservation', () => {
  test('landscape image fits within bounds preserving ratio', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1920, height: 1080 }, 80, 60);
    `);

    const { w, h } = result as { w: number; h: number };

    // Landscape 16:9 — width constrained first, then check height
    expect(w).toBeCloseTo(80, 1);
    expect(h).toBeCloseTo(80 / (1920 / 1080), 1); // ~45mm
    expect(h).toBeLessThanOrEqual(60);

    // Aspect ratio should be preserved
    const originalRatio = 1920 / 1080;
    const resultRatio = w / h;
    expect(resultRatio).toBeCloseTo(originalRatio, 2);
  });

  test('portrait image fits within bounds preserving ratio', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1080, height: 1920 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };

    // Portrait 9:16 — width 80 would give h = 80 / (9/16) = 142.2, exceeds maxH 100
    // So height constrained to 100, width = 100 * (9/16) = 56.25
    expect(h).toBeCloseTo(100, 1);
    expect(w).toBeCloseTo(100 * (1080 / 1920), 1); // ~56.25mm
    expect(w).toBeLessThanOrEqual(80);

    // Aspect ratio preserved
    const originalRatio = 1080 / 1920;
    const resultRatio = w / h;
    expect(resultRatio).toBeCloseTo(originalRatio, 2);
  });

  test('square image fits correctly', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1000, height: 1000 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };

    // Square — width constrained to 80, height = 80 (within maxH 100)
    expect(w).toBeCloseTo(80, 1);
    expect(h).toBeCloseTo(80, 1);
  });

  test('square image with smaller maxH constrains by height', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1000, height: 1000 }, 80, 60);
    `);

    const { w, h } = result as { w: number; h: number };

    // Square with maxH 60 — width 80 gives h=80, exceeds 60 → h=60, w=60
    expect(h).toBeCloseTo(60, 1);
    expect(w).toBeCloseTo(60, 1);
  });

  test('image already smaller than max dimensions uses maxW', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 200, height: 100 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };

    // 2:1 ratio — w=80, h=40 (both within bounds)
    expect(w).toBeCloseTo(80, 1);
    expect(h).toBeCloseTo(40, 1);
  });

  test('very wide panoramic image respects width constraint', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 4000, height: 500 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };

    // 8:1 ratio — w=80, h=10
    expect(w).toBeCloseTo(80, 1);
    expect(h).toBeCloseTo(10, 1);
    expect(h).toBeLessThanOrEqual(100);
  });

  test('very tall image respects height constraint', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 500, height: 4000 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };

    // 1:8 ratio — w=80 gives h=640, exceeds 100 → h=100, w=12.5
    expect(h).toBeCloseTo(100, 1);
    expect(w).toBeCloseTo(12.5, 1);
    expect(w).toBeLessThanOrEqual(80);
  });

  test('defect photo dimensions (60×80 max) work correctly for portrait', async ({ page }) => {
    await page.goto('/');

    // Defect photos use fitImage(imgData, 60, 80)
    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1080, height: 1920 }, 60, 80);
    `);

    const { w, h } = result as { w: number; h: number };

    // Portrait phone photo (9:16): w=60 gives h=106.67, exceeds 80
    // → h=80, w=80*(9/16) = 45
    expect(h).toBeCloseTo(80, 1);
    expect(w).toBeCloseTo(45, 0);
    expect(w).toBeLessThanOrEqual(60);

    // Ratio preserved
    expect(w / h).toBeCloseTo(1080 / 1920, 2);
  });

  test('vehicle photo dimensions (cellW×100 max) work correctly for landscape', async ({
    page,
  }) => {
    await page.goto('/');

    // Vehicle photos: cellW = (contentWidth - 6) / 2 ≈ 82mm, maxCellH = 100mm
    // contentWidth = 210 - 15*2 = 180, cellW = (180-6)/2 = 87
    const cellW = 87;
    const result = await page.evaluate(
      `
      ${FIT_IMAGE_FN}
      fitImage({ width: 1920, height: 1080 }, ${cellW}, 100);
    `
    );

    const { w, h } = result as { w: number; h: number };

    // 16:9 landscape: w=87, h=87/(16/9) = 48.9 — within 100
    expect(w).toBeCloseTo(87, 1);
    expect(h).toBeCloseTo(87 / (1920 / 1080), 0);
    expect(h).toBeLessThanOrEqual(100);

    // Ratio preserved
    expect(w / h).toBeCloseTo(1920 / 1080, 2);
  });

  test('width and height are always positive', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(`
      ${FIT_IMAGE_FN}
      fitImage({ width: 1, height: 1 }, 80, 100);
    `);

    const { w, h } = result as { w: number; h: number };
    expect(w).toBeGreaterThan(0);
    expect(h).toBeGreaterThan(0);
  });

  test('result dimensions never exceed max bounds', async ({ page }) => {
    await page.goto('/');

    // Test a range of ratios
    const results = await page.evaluate(`
      ${FIT_IMAGE_FN}
      const ratios = [
        { width: 100, height: 100 },    // 1:1
        { width: 1920, height: 1080 },   // 16:9
        { width: 1080, height: 1920 },   // 9:16
        { width: 4000, height: 500 },    // 8:1
        { width: 500, height: 4000 },    // 1:8
        { width: 3000, height: 2000 },   // 3:2
        { width: 2000, height: 3000 },   // 2:3
      ];
      ratios.map(r => fitImage(r, 80, 100));
    `);

    for (const r of results as { w: number; h: number }[]) {
      expect(r.w).toBeLessThanOrEqual(80 + 0.001);
      expect(r.h).toBeLessThanOrEqual(100 + 0.001);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });
});
