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
  
  // Storage settings (using sessionStorage fixes issues with persistence)
  stateStore: {
    set: (key, value) => {
      try {
        console.log(`Storing state: ${key}`);
        sessionStorage.setItem(key, value);
        localStorage.setItem(key, value); // Backup in localStorage
        return Promise.resolve();
      } catch (e) {
        console.error('Error storing state:', e);
        return Promise.reject(e);
      }
    },
    get: (key) => {
      try {
        // Try sessionStorage first, then localStorage as fallback
        const sessionValue = sessionStorage.getItem(key);
        const localValue = localStorage.getItem(key);
        const value = sessionValue || localValue;
        
        console.log(`Retrieved state: ${key} = ${value ? 'found' : 'not found'}`);
        
        return Promise.resolve(value);
      } catch (e) {
        console.error('Error retrieving state:', e);
        return Promise.reject(e);
      }
    },
    remove: (key) => {
      try {
        console.log(`Removing state: ${key}`);
        sessionStorage.removeItem(key);
        localStorage.removeItem(key);
        return Promise.resolve();
      } catch (e) {
        console.error('Error removing state:', e);
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
  
  // Don't clear storage on signin start, this is causing issues with state storage
  onSigninStart: () => {
    console.log("Starting sign-in process");
    // We'll keep existing storage to prevent state validation issues
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