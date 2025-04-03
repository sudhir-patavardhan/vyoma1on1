/**
 * Authentication Test Script
 * 
 * This script helps verify the authentication fixes by:
 * 1. Testing storage implementations (localStorage, sessionStorage)
 * 2. Verifying proper key prefixing and retrieval
 * 3. Confirming the getAllKeys function works correctly
 * 4. Testing cleanup operations for stale state
 */

// Mock the auth state store to test functionality
const testStateStore = {
  set: (key, value) => {
    try {
      const storageKey = `oidc.${key}`;
      console.log(`Storing state: ${storageKey}`);
      sessionStorage.setItem(storageKey, value);
      localStorage.setItem(storageKey, value); // Backup in localStorage
      return Promise.resolve();
    } catch (e) {
      console.error('Error storing state:', e);
      return Promise.reject(e);
    }
  },
  get: (key) => {
    try {
      const storageKey = `oidc.${key}`;
      // Try sessionStorage first, then localStorage as fallback
      const sessionValue = sessionStorage.getItem(storageKey);
      const localValue = localStorage.getItem(storageKey);
      const value = sessionValue || localValue;
      
      console.log(`Retrieved state: ${storageKey} = ${value ? 'found' : 'not found'}`);
      
      return Promise.resolve(value);
    } catch (e) {
      console.error('Error retrieving state:', e);
      return Promise.reject(e);
    }
  },
  remove: (key) => {
    try {
      const storageKey = `oidc.${key}`;
      console.log(`Removing state: ${storageKey}`);
      sessionStorage.removeItem(storageKey);
      localStorage.removeItem(storageKey);
      return Promise.resolve();
    } catch (e) {
      console.error('Error removing state:', e);
      return Promise.reject(e);
    }
  },
  // This critical function needs to be implemented for clearing stale state
  getAllKeys: () => {
    try {
      console.log('Getting all keys for state cleanup');
      const sessionKeys = Object.keys(sessionStorage)
        .filter(key => key.startsWith('oidc.'))
        .map(key => key.replace('oidc.', ''));
      
      const localKeys = Object.keys(localStorage)
        .filter(key => key.startsWith('oidc.'))
        .map(key => key.replace('oidc.', ''));
      
      // Combine keys from both storage types, ensuring uniqueness
      const allKeys = [...new Set([...sessionKeys, ...localKeys])];
      console.log(`Found ${allKeys.length} state keys`);
      
      return Promise.resolve(allKeys);
    } catch (e) {
      console.error('Error getting all keys:', e);
      return Promise.reject(e);
    }
  }
};

// Clear all existing auth-related storage to start fresh
const clearAllAuthState = () => {
  console.log('Clearing all auth state for testing');
  
  // Clear localStorage
  Object.keys(localStorage)
    .filter(key => key.startsWith('oidc.'))
    .forEach(key => {
      console.log(`Clearing localStorage: ${key}`);
      localStorage.removeItem(key);
    });
  
  // Clear sessionStorage
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('oidc.'))
    .forEach(key => {
      console.log(`Clearing sessionStorage: ${key}`);
      sessionStorage.removeItem(key);
    });
};

// Test the set/get functionality
const testSetGet = async () => {
  console.log('TESTING SET/GET FUNCTIONS');
  try {
    // Create test data
    await testStateStore.set('testKey1', 'testValue1');
    await testStateStore.set('testKey2', 'testValue2');
    
    // Retrieve and verify
    const value1 = await testStateStore.get('testKey1');
    const value2 = await testStateStore.get('testKey2');
    
    console.log('Test results:');
    console.log(`testKey1: ${value1 === 'testValue1' ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`testKey2: ${value2 === 'testValue2' ? 'PASS ✅' : 'FAIL ❌'}`);
    
    return value1 === 'testValue1' && value2 === 'testValue2';
  } catch (e) {
    console.error('Error in set/get test:', e);
    return false;
  }
};

// Test the remove functionality
const testRemove = async () => {
  console.log('TESTING REMOVE FUNCTION');
  try {
    // Create test data
    await testStateStore.set('removeTest', 'valueToRemove');
    
    // Verify it was created
    const initialValue = await testStateStore.get('removeTest');
    console.log(`Initial value: ${initialValue}`);
    
    // Remove it
    await testStateStore.remove('removeTest');
    
    // Verify it was removed
    const afterValue = await testStateStore.get('removeTest');
    
    console.log('Test results:');
    console.log(`removeTest - Initial: ${initialValue === 'valueToRemove' ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`removeTest - After: ${afterValue === null ? 'PASS ✅' : 'FAIL ❌'}`);
    
    return initialValue === 'valueToRemove' && afterValue === null;
  } catch (e) {
    console.error('Error in remove test:', e);
    return false;
  }
};

// Test the getAllKeys functionality
const testGetAllKeys = async () => {
  console.log('TESTING GETALLKEYS FUNCTION');
  try {
    clearAllAuthState();
    
    // Create multiple test entries
    await testStateStore.set('key1', 'value1');
    await testStateStore.set('key2', 'value2');
    await testStateStore.set('key3', 'value3');
    
    // Get all keys
    const keys = await testStateStore.getAllKeys();
    console.log('Retrieved keys:', keys);
    
    // Verify expected keys are present
    const hasKey1 = keys.includes('key1');
    const hasKey2 = keys.includes('key2');
    const hasKey3 = keys.includes('key3');
    
    console.log('Test results:');
    console.log(`Contains key1: ${hasKey1 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Contains key2: ${hasKey2 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Contains key3: ${hasKey3 ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Expected 3 keys, got ${keys.length}: ${keys.length === 3 ? 'PASS ✅' : 'FAIL ❌'}`);
    
    return hasKey1 && hasKey2 && hasKey3 && keys.length === 3;
  } catch (e) {
    console.error('Error in getAllKeys test:', e);
    return false;
  }
};

// Test storage fallback mechanism
const testStorageFallback = async () => {
  console.log('TESTING STORAGE FALLBACK');
  try {
    clearAllAuthState();
    
    // Set value in both storages
    await testStateStore.set('fallbackTest', 'original');
    
    // Manually clear sessionStorage only
    sessionStorage.removeItem('oidc.fallbackTest');
    
    // Value should be retrieved from localStorage
    const fallbackValue = await testStateStore.get('fallbackTest');
    
    console.log('Test results:');
    console.log(`Fallback from localStorage: ${fallbackValue === 'original' ? 'PASS ✅' : 'FAIL ❌'}`);
    
    return fallbackValue === 'original';
  } catch (e) {
    console.error('Error in storage fallback test:', e);
    return false;
  }
};

// Test stale state cleanup
const testStaleStateCleanup = async () => {
  console.log('TESTING STALE STATE CLEANUP');
  try {
    clearAllAuthState();
    
    // Create some test state entries
    localStorage.setItem('oidc.state.123', 'test_state_data');
    localStorage.setItem('oidc.state.456', 'old_state_data');
    localStorage.setItem('oidc.some_other_key', 'other_data');
    
    // Also in sessionStorage
    sessionStorage.setItem('oidc.state.789', 'session_state_data');
    
    // Simulate the onSigninStart cleanup function
    const clearStaleState = () => {
      try {
        // We'll keep the prefix consistent with our stateStore implementation
        const oldKeys = Object.keys(localStorage)
          .filter(key => key.startsWith('oidc.') && key.includes('state'));
          
        console.log(`Found ${oldKeys.length} old state keys to clear`);
        
        // Remove old state entries
        oldKeys.forEach(key => {
          console.log(`Removing old state: ${key}`);
          localStorage.removeItem(key);
          sessionStorage.removeItem(key);
        });
      } catch (e) {
        console.error("Error clearing stale state:", e);
      }
    };
    
    // Run the cleanup
    clearStaleState();
    
    // Verify state entries were removed but non-state entries remain
    const stateKey1Exists = localStorage.getItem('oidc.state.123') !== null;
    const stateKey2Exists = localStorage.getItem('oidc.state.456') !== null;
    const stateKey3Exists = sessionStorage.getItem('oidc.state.789') !== null;
    const otherKeyExists = localStorage.getItem('oidc.some_other_key') !== null;
    
    console.log('Test results:');
    console.log(`State key1 removed: ${!stateKey1Exists ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`State key2 removed: ${!stateKey2Exists ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`State key3 removed: ${!stateKey3Exists ? 'PASS ✅' : 'FAIL ❌'}`);
    console.log(`Non-state key preserved: ${otherKeyExists ? 'PASS ✅' : 'FAIL ❌'}`);
    
    return !stateKey1Exists && !stateKey2Exists && !stateKey3Exists && otherKeyExists;
  } catch (e) {
    console.error('Error in stale state cleanup test:', e);
    return false;
  }
};

// Run all tests
const runAllTests = async () => {
  console.log('RUNNING AUTHENTICATION STATE STORE TESTS');
  console.log('=======================================');
  
  const setGetPassed = await testSetGet();
  const removePassed = await testRemove();
  const getAllKeysPassed = await testGetAllKeys();
  const fallbackPassed = await testStorageFallback();
  const cleanupPassed = await testStaleStateCleanup();
  
  // Overall results
  console.log('');
  console.log('TEST SUMMARY');
  console.log('===========');
  console.log(`Set/Get: ${setGetPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Remove: ${removePassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`GetAllKeys: ${getAllKeysPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Storage Fallback: ${fallbackPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  console.log(`Stale State Cleanup: ${cleanupPassed ? 'PASS ✅' : 'FAIL ❌'}`);
  
  const allPassed = setGetPassed && removePassed && getAllKeysPassed && fallbackPassed && cleanupPassed;
  console.log('');
  console.log(`OVERALL RESULT: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  
  return allPassed;
};

// Auto-run tests when script is loaded
window.runAuthTests = runAllTests;
console.log('Auth tests ready. Run tests by calling window.runAuthTests() in the console.');