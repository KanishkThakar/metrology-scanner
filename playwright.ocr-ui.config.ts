import { defineConfig } from '@playwright/test';
import sharedConfig from './playwright.config';

// A focused, backend-free UI suite. All API calls are intercepted by the tests.
export default defineConfig({
  ...sharedConfig,
  testMatch: 'ocr-engine-ui.spec.ts',
  use: {
    ...sharedConfig.use,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
      : undefined,
  },
  webServer: process.env.TEST_WEB_URL ? undefined : {
    command: 'npm run dev -- --port 3001',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
