import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHROME_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROME_PATH } }
          : {}),
      },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:4001/api/health',
      env: { PORT: '4001', CORS_ORIGIN: 'http://localhost:4173' },
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @sa-library/web dev --port 4173',
      url: 'http://localhost:4173',
      env: { API_PROXY_TARGET: 'http://localhost:4001', VITE_API_URL: '/api' },
      reuseExistingServer: false,
    },
  ],
});
