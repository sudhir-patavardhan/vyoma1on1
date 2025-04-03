#!/bin/bash
# Setup script for Playwright authentication testing

echo "Setting up Playwright for authentication testing..."

# Install Playwright and its dependencies
npm install -D @playwright/test

# Install browser binaries
npx playwright install

echo "Installation complete! You can now run the tests with:"
echo "npx playwright test auth-tests/auth-test.js --headed"