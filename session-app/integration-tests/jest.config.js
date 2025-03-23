/**
 * Jest configuration for integration tests
 */

module.exports = {
  // Use node environment for API testing
  testEnvironment: 'node',
  
  // Where to find tests
  roots: ['<rootDir>'],
  
  // Test file pattern
  testMatch: ['**/*.test.js'],
  
  // Don't transform node_modules except for the specified modules that might use ESM
  transformIgnorePatterns: [
    '/node_modules/(?!axios|oidc-client-ts)'
  ],
  
  // Test timeout - increase for slow API calls
  testTimeout: 20000,
  
  // Use a setup file for all tests
  setupFilesAfterEnv: ['./setupTests.js'],
  
  // Verbose output for test results
  verbose: true,
  
  // Only run integration tests
  testPathIgnorePatterns: [
    '/node_modules/',
    '/build/',
    '/public/'
  ]
};