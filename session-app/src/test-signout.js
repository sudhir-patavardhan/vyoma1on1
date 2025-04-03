/**
 * Sign-out Test Script
 * 
 * This script tests the sign-out functionality to ensure proper cleanup of auth state.
 */

// Simulate the sign-out process
const testSignOut = () => {
  console.log('Testing sign-out cleanup functionality');
  
  // First, populate storage with some auth data
  setupMockAuthData();
  
  // Display initial state
  console.log('Initial auth storage state:');
  displayStorageState();
  
  // Execute the sign-out cleanup
  executeSignOutCleanup();
  
  // Check if cleanup was successful
  console.log('Auth storage state after sign-out:');
  displayStorageState();
  
  // Verify results
  const remainingAuthItems = [...getAuthItemsFromStorage('localStorage'), ...getAuthItemsFromStorage('sessionStorage')];
  
  console.log('Sign-out cleanup test results:');
  console.log(`Remaining auth items: ${remainingAuthItems.length} (should be 0)`);
  console.log(`Test result: ${remainingAuthItems.length === 0 ? 'PASS ✅' : 'FAIL ❌'}`);
  
  return remainingAuthItems.length === 0;
};

// Set up mock authentication data for testing
const setupMockAuthData = () => {
  console.log('Setting up mock auth data for testing');
  
  // Clear existing auth data
  clearAuthStorage();
  
  // Add various types of auth-related items
  localStorage.setItem('oidc.user:test', '{"access_token":"mock_token","expires_at":123456789}');
  localStorage.setItem('oidc.state.test123', 'mock_state_value');
  localStorage.setItem('oidc.nonce.test456', 'mock_nonce_value');
  localStorage.setItem('user.settings', 'some_user_settings');
  localStorage.setItem('oidc.clientId', 'test_client_id');
  
  sessionStorage.setItem('oidc.user:test', '{"access_token":"mock_session_token","expires_at":123456789}');
  sessionStorage.setItem('oidc.state.session123', 'mock_session_state');
  sessionStorage.setItem('user.session', 'active');
  
  // Add some non-auth data that should not be touched
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('preferences', 'some_preferences');
  sessionStorage.setItem('recent_activity', 'viewed_page_1');
};

// Execute the sign-out cleanup process from App.js
const executeSignOutCleanup = () => {
  console.log('Executing sign-out cleanup');
  
  try {
    // Clear all auth-related storage to prevent issues on next login
    Object.keys(localStorage)
      .filter(key => key.startsWith('oidc.') || key.startsWith('user.'))
      .forEach(key => {
        console.log(`Removing localStorage item: ${key}`);
        localStorage.removeItem(key);
      });
    
    Object.keys(sessionStorage)
      .filter(key => key.startsWith('oidc.') || key.startsWith('user.'))
      .forEach(key => {
        console.log(`Removing sessionStorage item: ${key}`);
        sessionStorage.removeItem(key);
      });
      
    console.log('Sign-out cleanup completed');
  } catch (error) {
    console.error("Error during signout cleanup:", error);
  }
};

// Display current auth-related storage state
const displayStorageState = () => {
  const localItems = getAuthItemsFromStorage('localStorage');
  const sessionItems = getAuthItemsFromStorage('sessionStorage');
  
  console.log(`localStorage auth items (${localItems.length}):`);
  localItems.forEach(item => console.log(`- ${item.key} = ${truncateValue(item.value)}`));
  
  console.log(`sessionStorage auth items (${sessionItems.length}):`);
  sessionItems.forEach(item => console.log(`- ${item.key} = ${truncateValue(item.value)}`));
};

// Get auth-related items from specified storage
const getAuthItemsFromStorage = (storageType) => {
  const storage = storageType === 'localStorage' ? localStorage : sessionStorage;
  
  return Object.keys(storage)
    .filter(key => key.startsWith('oidc.') || key.startsWith('user.'))
    .map(key => ({ 
      key, 
      value: storage.getItem(key)
    }));
};

// Clear all auth-related storage
const clearAuthStorage = () => {
  // Clear localStorage
  Object.keys(localStorage)
    .filter(key => key.startsWith('oidc.') || key.startsWith('user.'))
    .forEach(key => localStorage.removeItem(key));
  
  // Clear sessionStorage
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('oidc.') || key.startsWith('user.'))
    .forEach(key => sessionStorage.removeItem(key));
};

// Truncate long values for display
const truncateValue = (value, maxLength = 30) => {
  if (!value) return 'null';
  return value.length > maxLength ? value.substring(0, maxLength) + '...' : value;
};

// Add the test to the window object
window.testSignOut = testSignOut;
window.setupMockAuthData = setupMockAuthData;
window.clearAuthStorage = clearAuthStorage;

console.log('Sign-out test ready. Call window.testSignOut() to run the test.');