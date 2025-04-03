/**
 * Authentication Error Test Script
 * 
 * This script helps test the error handling UI for authentication errors by:
 * 1. Simulating different types of authentication errors
 * 2. Verifying error recovery options are presented to the user
 * 3. Testing specific handling for "No matching state found" errors
 */

// Simulate an authentication error
const simulateAuthError = (errorType) => {
  console.log(`Simulating auth error: ${errorType}`);
  
  // Clear any existing error indicators
  document.querySelectorAll('.test-error-indicator').forEach(el => el.remove());
  
  // Generate appropriate error based on type
  let errorMessage;
  
  switch(errorType) {
    case 'state':
      errorMessage = 'No matching state found in storage';
      break;
    case 'getAllKeys':
      errorMessage = 'TypeError: t.getAllKeys is not a function';
      break;
    case 'storage':
      errorMessage = 'Failed to read state from storage';
      break;
    case 'network':
      errorMessage = 'Network error communicating with authentication server';
      break;
    case 'expired':
      errorMessage = 'JWT token has expired';
      break;
    default:
      errorMessage = 'Unknown authentication error';
  }
  
  // Create a mock error in localStorage to simulate the error state
  localStorage.setItem('auth_test_error', errorType);
  localStorage.setItem('auth_test_error_message', errorMessage);
  
  // Add an indicator to the page
  const errorIndicator = document.createElement('div');
  errorIndicator.className = 'test-error-indicator';
  errorIndicator.style.position = 'fixed';
  errorIndicator.style.top = '10px';
  errorIndicator.style.right = '10px';
  errorIndicator.style.padding = '10px 15px';
  errorIndicator.style.backgroundColor = '#ffebee';
  errorIndicator.style.color = '#c62828';
  errorIndicator.style.borderRadius = '4px';
  errorIndicator.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
  errorIndicator.style.zIndex = '9999';
  errorIndicator.innerHTML = `<strong>Simulated Error:</strong> ${errorMessage}`;
  
  document.body.appendChild(errorIndicator);
  
  // Force page reload to see the error handling
  setTimeout(() => {
    window.location.reload();
  }, 1500);
};

// Test function to check for error UI elements
const verifyErrorUI = () => {
  // Check if we have a simulated error
  const errorType = localStorage.getItem('auth_test_error');
  const errorMessage = localStorage.getItem('auth_test_error_message');
  
  if (!errorType || !errorMessage) {
    console.log('No simulated error detected');
    return false;
  }
  
  console.log(`Checking for error UI. Error type: ${errorType}`);
  
  // Wait for the error UI to render
  setTimeout(() => {
    // Look for error indicators
    const errorHeading = document.querySelector('h2.text-danger');
    const errorMessageEl = document.querySelector('.error-message');
    const resetButton = document.querySelector('button.btn-outline-primary');
    const homeButton = document.querySelector('button.btn-primary');
    
    // Log findings
    console.log('Error UI check results:');
    console.log(`Error heading found: ${errorHeading ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Error message found: ${errorMessageEl ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Reset button found: ${resetButton ? 'Yes ✅' : 'No ❌'}`);
    console.log(`Home button found: ${homeButton ? 'Yes ✅' : 'No ❌'}`);
    
    // For state errors, verify specific guidance
    if (errorType === 'state' || errorType === 'getAllKeys') {
      const privateGuidance = document.querySelector('.error-message li');
      console.log(`State error guidance found: ${privateGuidance ? 'Yes ✅' : 'No ❌'}`);
    }
    
    // Clean up test
    localStorage.removeItem('auth_test_error');
    localStorage.removeItem('auth_test_error_message');
    
    // Add test control UI back
    showTestControls();
  }, 2000);
};

// Create a UI to trigger the tests
const showTestControls = () => {
  // Remove any existing controls
  const existingControls = document.getElementById('auth-error-test-controls');
  if (existingControls) {
    existingControls.remove();
  }
  
  // Create test controls container
  const controls = document.createElement('div');
  controls.id = 'auth-error-test-controls';
  controls.style.position = 'fixed';
  controls.style.bottom = '20px';
  controls.style.right = '20px';
  controls.style.padding = '15px';
  controls.style.backgroundColor = 'white';
  controls.style.boxShadow = '0 2px 10px rgba(0,0,0,0.2)';
  controls.style.borderRadius = '8px';
  controls.style.zIndex = '9999';
  controls.style.width = '280px';
  
  // Add heading
  const heading = document.createElement('h4');
  heading.textContent = 'Test Auth Error Recovery';
  heading.style.margin = '0 0 10px 0';
  heading.style.fontSize = '16px';
  controls.appendChild(heading);
  
  // Add description
  const description = document.createElement('p');
  description.textContent = 'Simulate different authentication errors to test the error handling UI';
  description.style.fontSize = '12px';
  description.style.margin = '0 0 10px 0';
  controls.appendChild(description);
  
  // Add buttons for different error types
  const errorTypes = [
    { type: 'state', label: 'State Error' },
    { type: 'getAllKeys', label: 'getAllKeys Error' },
    { type: 'storage', label: 'Storage Error' },
    { type: 'network', label: 'Network Error' },
    { type: 'expired', label: 'Token Expired' }
  ];
  
  errorTypes.forEach(error => {
    const button = document.createElement('button');
    button.textContent = error.label;
    button.style.display = 'block';
    button.style.width = '100%';
    button.style.padding = '8px';
    button.style.margin = '5px 0';
    button.style.backgroundColor = '#e3f2fd';
    button.style.border = '1px solid #bbdefb';
    button.style.borderRadius = '4px';
    button.style.cursor = 'pointer';
    
    button.addEventListener('click', () => simulateAuthError(error.type));
    controls.appendChild(button);
  });
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'Close';
  closeButton.style.display = 'block';
  closeButton.style.width = '100%';
  closeButton.style.padding = '8px';
  closeButton.style.margin = '10px 0 0 0';
  closeButton.style.backgroundColor = '#f5f5f5';
  closeButton.style.border = '1px solid #e0e0e0';
  closeButton.style.borderRadius = '4px';
  closeButton.style.cursor = 'pointer';
  
  closeButton.addEventListener('click', () => controls.remove());
  controls.appendChild(closeButton);
  
  // Add to document
  document.body.appendChild(controls);
};

// Initialize when script is loaded
window.showAuthErrorTester = showTestControls;
window.runAuthErrorTest = simulateAuthError;

// Check for error UI if we're in a test run
verifyErrorUI();

console.log('Auth error test ready. Call window.showAuthErrorTester() to show test controls.');