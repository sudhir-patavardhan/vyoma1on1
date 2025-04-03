// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Playwright configuration for testing Sanskrit Teacher authentication
 * @see https://playwright.dev/docs/test-configuration
 */
module.exports = defineConfig({
  testDir: '/Users/vimalnagata/Projects/yoursanskritteacher/session-app',  // Use absolute path
  testMatch: /auth-tests\/.*\.js/,  // Match any .js file in the auth-tests directory
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    // Record video of tests
    video: 'on-first-retry',
    // Capture screenshots on failure
    screenshot: 'only-on-failure',
    // Slow down test execution for easier viewing
    launchOptions: {
      slowMo: 100,
    },
  },

  /* Configure projects for different browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'npm start',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});