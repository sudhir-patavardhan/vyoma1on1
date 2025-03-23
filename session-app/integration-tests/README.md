# Integration Tests for Sanskrit Teacher Platform

This directory contains integration tests for testing the Sanskrit Teacher platform's API endpoints against production or local environments.

## Overview

These tests allow you to validate the functionality of your production APIs from a local development setup, ensuring that:

1. All API endpoints are functioning correctly
2. Authentication flows work as expected
3. Data flows seamlessly between different services
4. Core business logic operates correctly end-to-end

## Test Structure

The integration tests are organized by feature area:

- **profile.test.js**: Tests for user profile creation and retrieval
- **teacher-search.test.js**: Tests for searching teachers by topic and name
- **availability-booking.test.js**: Tests for teacher availability and student booking flows
- **session.test.js**: Tests for session management and video meeting functionality

## Setup

### Prerequisites

- Node.js v14+
- npm or yarn
- Access to test user accounts (for authentication)

### Configuration

The tests use a configuration system defined in `setup.js` that allows testing against different environments:

- **Production**: Tests run against the live APIs at `api.yoursanskritteacher.com`
- **Local**: Tests run against a local API server, with authentication still pointing to production

### Test Users

For proper integration testing, you need test user accounts with specific roles:

1. **Teacher Account**: For testing teacher-specific features
2. **Student Account**: For testing student-specific features
3. **Admin Account**: For testing administrative features (optional)

> **IMPORTANT**: Never use production user credentials directly in tests. Either:
>
> - Use environment variables to inject credentials
> - Create dedicated test accounts that are only used for automated testing

## Running Tests

The simplest way to run all integration tests against production:

```bash
npm run test:integration
```

### Available Commands

- **Test against production**: `npm run test:integration:prod`
- **Test against local dev server**: `npm run test:integration:local`
- **Run with debug output**: `npm run test:integration:debug`
- **Run a specific test file**: `npm run test:integration -- --test=profile.test.js`

### Environment Variables

The following environment variables can be set to configure test execution:

```bash
# Test user credentials
TEST_USERNAME=patavardhan@gmail.com
TEST_PASSWORD=W1234ard@

# Teacher-specific test account
TEST_TEACHER_USERNAME=vimal.nagata@gmail.com
TEST_TEACHER_PASSWORD=W1234ard@

# Student-specific test account
TEST_STUDENT_USERNAME=patavardhan@gmail.com
TEST_STUDENT_PASSWORD=W1234ard@

# Pre-configured tokens (to skip authentication)
TEST_ACCESS_TOKEN=eyJhbGciOi...
TEST_USER_ID=user123

# Test data references
TEST_BOOKING_ID=booking-1234
TEST_TEACHER_ID=teacher123
TEST_STUDENT_ID=student123
```

## Best Practices

1. **Isolation**: Each test file should be able to run independently
2. **Cleanup**: Tests should clean up any data they create (when practical)
3. **Performance**: Keep tests focused and efficient
4. **Idempotency**: Tests should be able to run multiple times without side effects
5. **Security**: Never store production credentials in test files

## Troubleshooting

### Authentication Issues

If tests fail with 401 Unauthorized errors:

- Verify test user credentials are correct
- Ensure test users have necessary permissions
- Check token expiration

### Data Not Found

If tests can't find expected data:

- Check if IDs are correct
- Verify that required test data exists in the environment
- Check if earlier tests that create dependent data are passing

### Timeout Errors

If tests timeout:

- Check API server health
- Increase timeout thresholds for slow operations
- Consider whether the API is rate-limiting test requests

## Extending the Tests

When adding new tests:

1. Follow the existing patterns and organization
2. Add new test files for new feature areas
3. Update setup.js if new configuration is needed
4. Update this README if the testing approach changes significantly

## CI/CD Integration

These tests can be integrated into a CI/CD pipeline for pre-deployment validation:

```yaml
# Example GitHub Actions workflow step
- name: Run Integration Tests
  run: |
    npm ci
    npm run test:integration
  env:
    TEST_USERNAME: ${{ secrets.TEST_USERNAME }}
    TEST_PASSWORD: ${{ secrets.TEST_PASSWORD }}
    # Add other required environment variables
```
