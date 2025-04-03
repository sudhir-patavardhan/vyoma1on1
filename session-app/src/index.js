import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

// First, check if we're in a callback from auth with state parameter
const checkForStateInURL = () => {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const stateParam = urlParams.get('state');
    
    if (stateParam) {
      console.log("State parameter found in URL:", stateParam);
      
      // Try to preserve the state value regardless of where it should be stored
      // This provides a fallback for the OIDC client
      localStorage.setItem(`oidc.state.${stateParam}`, stateParam);
      sessionStorage.setItem(`oidc.state.${stateParam}`, stateParam);
      
      // Also try with different prefixes to catch all possibilities
      localStorage.setItem(`state.${stateParam}`, stateParam);
      sessionStorage.setItem(`state.${stateParam}`, stateParam);
      localStorage.setItem(`${stateParam}`, stateParam);
      sessionStorage.setItem(`${stateParam}`, stateParam);
      
      console.log("State preserved from URL parameter");
    }
  } catch (e) {
    console.error("Error checking for state in URL:", e);
  }
};

// Run immediately to catch auth callbacks
checkForStateInURL();

// Cognito authentication configuration
const cognitoAuthConfig = {
  // Authority & client details
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
  client_id: "12s8brrk9144uq23g3951mfvhl",
  redirect_uri: window.location.origin, // Dynamically set the origin
  post_logout_redirect_uri: window.location.origin, // Explicitly set logout redirect
  response_type: "code",
  scope: "phone openid email",
  loadUserInfo: true,
  
  // Add more forgiving configuration
  userStore: "local", // Use localStorage for user data
  stateStorageType: "localStorage", // Explicitly prefer localStorage
  
  // Manually specify metadata endpoints (fixes CORS issues)
  metadata: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
    authorization_endpoint: "https://auth.yoursanskritteacher.com/oauth2/authorize",
    token_endpoint: "https://auth.yoursanskritteacher.com/oauth2/token",
    end_session_endpoint: "https://auth.yoursanskritteacher.com/logout",
    userinfo_endpoint: "https://auth.yoursanskritteacher.com/oauth2/userInfo"
  },
  
  // Simplified state store that uses plain keys (no prefix) to avoid discrepancies
  stateStore: {
    set: (key, value) => {
      try {
        console.log(`Storing state: ${key}`);
        // Store with multiple formats to ensure at least one works
        sessionStorage.setItem(key, value);
        localStorage.setItem(key, value);
        sessionStorage.setItem(`oidc.${key}`, value);
        localStorage.setItem(`oidc.${key}`, value);
        return Promise.resolve();
      } catch (e) {
        console.error('Error storing state:', e);
        return Promise.reject(e);
      }
    },
    get: (key) => {
      try {
        // Try all possible formats
        const value = sessionStorage.getItem(key) || 
                     localStorage.getItem(key) ||
                     sessionStorage.getItem(`oidc.${key}`) ||
                     localStorage.getItem(`oidc.${key}`);
        
        console.log(`Retrieved state: ${key} = ${value ? 'found' : 'not found'}`);
        
        if (!value && key.startsWith('state.')) {
          // If the key is a state key and not found, check URL parameters as a last resort
          const urlParams = new URLSearchParams(window.location.search);
          const stateParam = urlParams.get('state');
          
          if (stateParam && key === `state.${stateParam}`) {
            console.log("Using state from URL parameter as fallback");
            return Promise.resolve(stateParam);
          }
        }
        
        return Promise.resolve(value);
      } catch (e) {
        console.error('Error retrieving state:', e);
        return Promise.reject(e);
      }
    },
    remove: (key) => {
      try {
        console.log(`Removing state: ${key}`);
        // Remove from all possible storage locations
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        sessionStorage.removeItem(`oidc.${key}`);
        localStorage.removeItem(`oidc.${key}`);
        return Promise.resolve();
      } catch (e) {
        console.error('Error removing state:', e);
        return Promise.reject(e);
      }
    },
    getAllKeys: () => {
      try {
        console.log('Getting all keys for state cleanup');
        const sessionKeys = Object.keys(sessionStorage);
        const localKeys = Object.keys(localStorage);
        
        // Combine keys from both storage types, ensuring uniqueness
        const allKeys = [...new Set([...sessionKeys, ...localKeys])];
        
        // Handle both prefixed and unprefixed keys
        const normalizedKeys = allKeys.map(key => {
          if (key.startsWith('oidc.')) {
            return key.replace('oidc.', '');
          }
          return key;
        });
        
        console.log(`Found ${normalizedKeys.length} state keys`);
        
        return Promise.resolve(normalizedKeys);
      } catch (e) {
        console.error('Error getting all keys:', e);
        return Promise.reject(e);
      }
    }
  },
  
  // Auth lifecycle settings
  automaticSilentRenew: false,
  monitorSession: true,
  revokeTokensOnSignout: true,
  
  // Use a more lenient approach
  clockSkew: 300, // 5 minute tolerance for clock skew
  
  // Enhanced logging for debugging
  onSigninCallback: (user) => {
    console.log("Authentication callback received");
    console.log("User authenticated:", !!user);
    
    // Additional logging
    if (user) {
      console.log("User ID:", user.profile?.sub);
      console.log("Token type:", user.token_type);
      console.log("Scope:", user.scope);
      
      if (user.expires_at) {
        const expiresAt = new Date(user.expires_at * 1000);
        console.log("Token expires:", expiresAt.toLocaleString());
        console.log("Expires in:", Math.round((expiresAt - new Date()) / 60000), "minutes");
      }
    }
    
    // Capture successful auth in localStorage
    if (user) {
      try {
        localStorage.setItem('auth_last_success', new Date().toISOString());
        localStorage.setItem('auth_user_id', user.profile?.sub || 'unknown');
      } catch (e) {
        console.error("Error recording auth success:", e);
      }
    }
    
    // Take a snapshot of the URL before cleaning up
    try {
      const url = window.location.href;
      localStorage.setItem('auth_last_redirect_url', url);
      
      // Preserve state parameter if present
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get('state');
      if (stateParam) {
        localStorage.setItem('auth_last_state', stateParam);
      }
    } catch (e) {
      console.error("Error capturing redirect URL:", e);
    }
    
    // Clear URL parameters from the address bar
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  
  // Only check for storage permissions, don't attempt to modify state
  onSigninStart: () => {
    console.log("Sign-in process starting...");
    
    // Check if we can use storage
    try {
      // Basic storage test
      const testValue = "test_" + new Date().getTime();
      localStorage.setItem('auth_storage_test', testValue);
      sessionStorage.setItem('auth_storage_test', testValue);
      
      // Verify we can read what we wrote
      const localValue = localStorage.getItem('auth_storage_test');
      const sessionValue = sessionStorage.getItem('auth_storage_test');
      
      if (localValue === testValue && sessionValue === testValue) {
        console.log("Storage test successful - read/write working correctly");
      } else {
        console.warn("Storage test partially successful - read/write may be inconsistent");
      }
      
      // Check for any existing state params directly from URL
      checkForStateInURL();
    } catch (e) {
      console.error("Storage permissions check failed:", e);
      console.warn("Authentication may fail due to browser storage restrictions");
    }
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));

// Wrap the application with AuthProvider and BrowserRouter
root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
);