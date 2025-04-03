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
  response_type: "code",
  scope: "phone openid email",
  loadUserInfo: true,
  
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
  
  // Enhanced logging for debugging
  onSigninCallback: (user) => {
    console.log("Authentication completed successfully:", user ? "User authenticated" : "No user data");
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  
  // Clear stale state when starting sign-in
  onSigninStart: () => {
    console.log("Starting sign-in process");
    
    // Clear any old or stale state that might be causing conflicts
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
    
    clearStaleState();
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