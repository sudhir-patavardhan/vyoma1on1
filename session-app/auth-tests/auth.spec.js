/**
 * Authentication Test Script
 * 
 * This script tests the sign-in flow for the Sanskrit Teacher application
 * using Playwright.
 * 
 * Run with: npm run test:auth
 */

// @ts-check
const { test, expect } = require('@playwright/test');

// Test credentials
const TEST_EMAIL = 'patavardhan@gmail.com';
const TEST_PASSWORD = 'W1234ard@';

// Test the sign-in flow
test('Sign-in flow works correctly', async ({ page }) => {
  // Start with a clean session
  await page.context().clearCookies();
  
  console.log('Starting authentication test...');
  
  // Navigate to the application
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  
  console.log('Page loaded, looking for sign-in button...');
  
  // Click the sign-in button (adjust selector if needed)
  await page.getByText('Sign In').first().click();
  
  // Wait for redirect to auth page
  console.log('Waiting for redirect to auth page...');
  await page.waitForURL(/.*auth\.yoursanskritteacher\.com.*/);
  
  console.log('On auth page, entering credentials...');
  
  // Enter credentials
  // Note: Selectors may need adjustment based on the actual auth page structure
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_EMAIL);
  
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', TEST_PASSWORD);
  
  // Click sign-in button on auth page
  console.log('Clicking sign-in button...');
  await page.getByRole('button', { name: /sign in/i }).click();
  
  // Wait for redirect back to the application
  console.log('Waiting for redirect back to app...');
  await page.waitForURL(/.*localhost:3000.*/);
  
  // Verify successful sign-in (dashboard should be displayed)
  console.log('Checking for successful sign-in...');
  await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10000 });
  
  // Verify user profile is loaded
  console.log('Checking user profile...');
  await expect(page.getByText(TEST_EMAIL.split('@')[0])).toBeVisible({ timeout: 5000 });
  
  // Check storage for auth tokens
  const localStorageItems = await page.evaluate(() => {
    return Object.keys(localStorage)
      .filter(key => key.startsWith('oidc.'))
      .map(key => ({ key, value: localStorage.getItem(key) }));
  });
  
  console.log('Auth-related localStorage items:', localStorageItems.length);
  expect(localStorageItems.length).toBeGreaterThan(0);
  
  // Verify no error messages are displayed
  const hasErrorMessage = await page.evaluate(() => {
    return document.body.innerText.includes('Authentication Error') || 
           document.body.innerText.includes('getAllKeys is not a function');
  });
  
  expect(hasErrorMessage).toBe(false);
  
  console.log('Sign-in test completed successfully');
});

// Test the sign-out flow
test('Sign-out flow works correctly', async ({ page }) => {
  // First sign in
  await page.goto('http://localhost:3000/');
  await page.waitForLoadState('networkidle');
  
  await page.getByText('Sign In').first().click();
  await page.waitForURL(/.*auth\.yoursanskritteacher\.com.*/);
  
  await page.waitForSelector('input[type="email"]');
  await page.fill('input[type="email"]', TEST_EMAIL);
  
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', TEST_PASSWORD);
  
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL(/.*localhost:3000.*/);
  
  // Wait for user menu to be visible
  await page.waitForSelector('button:has-text("Account")', { timeout: 10000 });
  
  // Click on the user menu
  console.log('Opening user menu...');
  await page.click('button:has-text("Account")');
  
  // Click sign out
  console.log('Clicking sign out...');
  await page.getByText('Sign Out').click();
  
  // Wait for redirect back to login page
  console.log('Waiting for sign-out redirect...');
  await page.waitForLoadState('networkidle');
  
  // Verify we're back at the landing page
  console.log('Checking for landing page...');
  await expect(page.getByText('Sign In')).toBeVisible({ timeout: 10000 });
  
  // Check that auth tokens are removed
  const localStorageItems = await page.evaluate(() => {
    return Object.keys(localStorage)
      .filter(key => key.startsWith('oidc.'))
      .map(key => ({ key, value: localStorage.getItem(key) }));
  });
  
  console.log('Auth-related localStorage items after sign-out:', localStorageItems.length);
  expect(localStorageItems.length).toBe(0);
  
  console.log('Sign-out test completed successfully');
});

// Test error recovery for state errors
test('Authentication error recovery works', async ({ page }) => {
  // Inject a bad state to simulate the error
  await page.goto('http://localhost:3000/');
  await page.evaluate(() => {
    // Create an incomplete/invalid state
    localStorage.setItem('oidc.state.invalid', 'invalid-state');
    sessionStorage.setItem('oidc.state.invalid', 'invalid-state');
    // But don't set the other required state items
  });
  
  // Reload the page to trigger auth processing
  await page.reload();
  await page.waitForLoadState('networkidle');
  
  // Try to sign in
  await page.getByText('Sign In').first().click();
  
  // Check if we see the error recovery UI
  const errorVisible = await page.evaluate(() => {
    // Give it a moment to show up
    return new Promise(resolve => {
      setTimeout(() => {
        const hasError = document.body.innerText.includes('Authentication Error');
        resolve(hasError);
      }, 5000);
    });
  });
  
  // We should either see error recovery UI or be redirected to sign in
  if (errorVisible) {
    console.log('Error recovery UI displayed as expected');
    
    // Verify the Reset & Try Again button is available
    await expect(page.getByText('Reset & Try Again')).toBeVisible();
    
    // Click the reset button
    await page.getByText('Reset & Try Again').click();
    
    // Wait for redirect to auth page
    await page.waitForURL(/.*auth\.yoursanskritteacher\.com.*/);
  } else {
    console.log('No error recovery UI shown - likely redirected directly to sign in');
    // Check if we're at the sign-in page
    expect(page.url()).toContain('auth.yoursanskritteacher.com');
  }
  
  console.log('Error recovery test completed');
});