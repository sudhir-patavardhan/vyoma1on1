/**
 * Setup for Jest integration tests
 */

// Increase timeout for all tests since we're making real API calls
jest.setTimeout(20000);

// Add custom matchers if needed
// expect.extend({...})

// Global setup
beforeAll(() => {
  // Log the start of test suite
  console.log('Starting integration test suite');
  console.log(`Environment: ${process.env.TEST_ENV || 'production'}`);
  console.log(`Debug mode: ${process.env.DEBUG ? 'enabled' : 'disabled'}`);
  console.log('----------------------------------------');
});