import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

// Load .env from the e2e directory
dotenv.config({ path: path.resolve(__dirname, '.env') });

const authStatePath = path.join(__dirname, 'test-results', '.auth', 'user.json');

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
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
      testMatch: /auth\.setup\.ts/,
    },

    // Desktop Chrome tests (use saved auth state)
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: authStatePath,
      },
      dependencies: ['auth-setup'],
    },

    // Mobile viewport (uses Chromium engine, avoids needing WebKit install)
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
        storageState: authStatePath,
      },
      dependencies: ['auth-setup'],
    },
  ],
});
