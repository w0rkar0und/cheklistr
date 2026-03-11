import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the e2e directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const authStatePath = path.join(__dirname, 'test-results', '.auth', 'user.json');
const adminAuthStatePath = path.join(__dirname, 'test-results', '.auth', 'admin.json');
const superAdminAuthStatePath = path.join(__dirname, 'test-results', '.auth', 'super-admin.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.E2E_RETRIES
    ? parseInt(process.env.E2E_RETRIES, 10)
    : process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  outputDir: './test-results',
  reporter: [
    ['html', { outputFolder: './playwright-report' }],
    ['list'],
  ],
  timeout: 60_000,

  use: {
    baseURL: process.env.BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Auth setup — runs first and saves session state for other tests
    {
      name: 'auth-setup',
      testMatch: /\/auth\.setup\.ts$/,
    },

    // Admin auth setup — separate login for admin-only tests
    {
      name: 'admin-auth-setup',
      testMatch: /admin-auth\.setup\.ts$/,
    },

    // Super admin auth setup — separate login for super_admin-only tests
    {
      name: 'super-admin-auth-setup',
      testMatch: /super-admin-auth\.setup\.ts$/,
    },

    // Desktop Chrome tests (use saved auth state)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePath,
      },
      testIgnore: /(admin|super-admin|api-).*\.spec\.ts/,
      dependencies: ['auth-setup', 'admin-auth-setup'],
    },

    // Mobile viewport (uses Chromium engine, avoids needing WebKit install)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: authStatePath,
      },
      testIgnore: /(admin|super-admin|api-).*\.spec\.ts/,
      dependencies: ['auth-setup', 'admin-auth-setup'],
    },

    // Admin tests — Desktop Chrome with admin session state
    {
      name: 'admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: adminAuthStatePath,
      },
      testMatch: /admin(-\w+)?\.spec\.ts/,
      testIgnore: /super-admin/,
      dependencies: ['admin-auth-setup'],
    },

    // Super admin tests — Desktop Chrome with super_admin session state
    // Tests use test.use({ storageState }) per-describe to switch between
    // super-admin and regular-admin auth as needed.
    {
      name: 'super-admin-chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: superAdminAuthStatePath,
      },
      testMatch: /super-admin\.spec\.ts/,
      dependencies: ['super-admin-auth-setup', 'admin-auth-setup'],
    },

    // API tests — no browser needed, authenticate via Supabase REST API directly
    {
      name: 'api',
      testMatch: /api-.*\.spec\.ts/,
      use: {
        // No browser context needed for pure API tests
        storageState: { cookies: [], origins: [] },
      },
    },
  ],
});
