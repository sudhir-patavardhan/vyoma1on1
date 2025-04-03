import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

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
  
  // Storage settings (with complete implementation including getAllKeys)
  stateStore: {
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
  },
  
  // Auth lifecycle settings
  automaticSilentRenew: false,
  monitorSession: true,
  revokeTokensOnSignout: true,
  
  // Do NOT clear state on signin
  skipUserInfo: false,
  
  // Enhanced logging for debugging
  onSigninCallback: (user) => {
    console.log("Authentication completed successfully:", user ? "User authenticated" : "No user data");
    
    // Additional logging for debugging
    if (user) {
      console.log("User ID:", user.profile?.sub);
      console.log("Access token expires at:", new Date(user.expires_at * 1000).toLocaleString());
    }
    
    // Save successful auth state to localStorage for recovery if needed
    if (user) {
      try {
        localStorage.setItem('auth_last_success', new Date().toISOString());
      } catch (e) {
        console.error("Error saving auth success state:", e);
      }
    }
    
    // Clear URL parameters from the address bar
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  
  // Only call signinStart once
  onSigninStart: () => {
    console.log("Starting sign-in process");
    
    // Don't clear state as it could be causing the issue
    // Instead, ensure we have storage permissions and consistent state
    try {
      // Test storage
      localStorage.setItem('auth_test', 'test');
      sessionStorage.setItem('auth_test', 'test');
      
      // Success if we got here
      console.log("Storage check successful");
      
      // Check for potential state parameter in URL
      const urlParams = new URLSearchParams(window.location.search);
      const stateParam = urlParams.get('state');
      
      if (stateParam) {
        console.log("State parameter found in URL:", stateParam);
        
        // Ensure state is stored in both storages
        const storageKey = `oidc.state.${stateParam}`;
        
        // Check if state exists in storage
        const existsInSession = sessionStorage.getItem(storageKey);
        const existsInLocal = localStorage.getItem(storageKey);
        
        if (!existsInSession && !existsInLocal) {
          console.log("State not found in storage, preserving URL parameters");
          // Don't modify anything, let the library handle it
        } else {
          console.log("State exists in storage, ensuring consistency");
          
          // If state exists in either storage, ensure it's in both
          if (existsInSession) {
            localStorage.setItem(storageKey, existsInSession);
          } else if (existsInLocal) {
            sessionStorage.setItem(storageKey, existsInLocal);
          }
        }
      }
    } catch (e) {
      console.error("Error during sign-in start:", e);
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