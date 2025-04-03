import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

// DO NOT try to handle state manually - this causes JSON format issues
// The library expects state to be in a specific JSON format that we cannot replicate
// Attempting to store raw state values breaks the JSON parsing

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
  
  // Use browser's built-in sessionStorage WITHOUT ANY MODIFICATIONS
  // Let the library handle its own storage format to avoid JSON parsing errors
  stateStore: {
    set: (key, value) => {
      try {
        console.log(`Storing key: ${key}`);
        sessionStorage.setItem(key, value);
        return Promise.resolve();
      } catch (e) {
        console.error('Error storing state:', e);
        return Promise.reject(e);
      }
    },
    get: (key) => {
      try {
        const value = sessionStorage.getItem(key);
        console.log(`Retrieved key: ${key} = ${value ? 'found' : 'not found'}`);
        return Promise.resolve(value);
      } catch (e) {
        console.error('Error retrieving state:', e);
        return Promise.reject(e);
      }
    },
    remove: (key) => {
      try {
        console.log(`Removing key: ${key}`);
        sessionStorage.removeItem(key);
        return Promise.resolve();
      } catch (e) {
        console.error('Error removing state:', e);
        return Promise.reject(e);
      }
    },
    getAllKeys: () => {
      try {
        // Simple implementation that just returns all sessionStorage keys
        const keys = Object.keys(sessionStorage);
        console.log(`Found ${keys.length} keys`);
        return Promise.resolve(keys);
      } catch (e) {
        console.error('Error getting all keys:', e);
        return Promise.reject(e);
      }
    }
  },
  
  // Auth lifecycle settings - KEEP SIMPLE
  automaticSilentRenew: false,
  monitorSession: true,
  
  // Basic callback that just logs and cleans up the URL
  onSigninCallback: (user) => {
    console.log("Authentication callback received");
    if (user) {
      console.log("User authenticated successfully");
    } else {
      console.log("Authentication failed or user info not available");
    }
    
    // Clean up the URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);
  },
  
  // Do nothing on sign-in start to avoid interfering with the library's state handling
  onSigninStart: () => {
    console.log("Sign-in process starting...");
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