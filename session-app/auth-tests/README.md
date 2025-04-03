# Authentication Tests

This directory contains automated tests for the Sanskrit Teacher authentication system.

## Prerequisites

1. Node.js 14 or higher
2. Playwright installed: `npm install -D @playwright/test`
3. Browsers installed: `npx playwright install`

## Running the Tests

### Install Playwright

First, make sure Playwright is installed:

```bash
cd session-app
npm install -D @playwright/test
npx playwright install
```

### Start the Application

The tests are configured to automatically start the application. If you want to run the application manually:

```bash
npm start
```

### Run the Authentication Tests

You can use the npm scripts that are set up for convenience:

```bash
# Run all auth tests
npm run test:auth

# Run tests with visible browser
npm run test:auth:headed

# Debug tests with Playwright Inspector
npm run test:auth:debug
```

Or use the Playwright commands directly:

```bash
# Run all tests
npx playwright test

# Run in headed mode (with visible browser)
npx playwright test --headed

# Run a specific test
npx playwright test -g "Sign-in flow"
```

### Debug the Tests

To debug the tests with the Playwright Inspector:

```bash
npx playwright test --debug
```

## Test Cases

The test suite includes the following test cases:

1. **Sign-in Flow**: Tests that a user can successfully sign in with valid credentials.
2. **Sign-out Flow**: Tests that sign-out properly removes authentication state.
3. **Error Recovery**: Tests the recovery UI for authentication errors.

## Test Credentials

The tests use the following credentials:

- Email: patavardhan@gmail.com  
- Password: W1234ard@

> **Note**: These credentials are only used for testing purposes.

## Viewing Test Results

After running the tests, Playwright generates a report that you can view:

```bash
npx playwright show-report
```

## Troubleshooting

If you encounter issues with the tests:

1. Make sure the application is running locally
2. Check that the test credentials are valid
3. Verify that the selectors in the test match your actual UI
4. Try running the tests in headed mode for better visibility

For authentication errors, look at the error recovery UI in the application to understand the specific issue.