import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  reporter: 'list',
  use: { baseURL: process.env.FAMILY_TEST_BASE_URL || 'http://127.0.0.1:5179', channel: 'chrome', headless: true, reducedMotion: 'reduce', screenshot: 'only-on-failure' },
});
