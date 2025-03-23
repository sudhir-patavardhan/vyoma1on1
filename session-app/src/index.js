import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

// Cognito authentication configuration
const cognitoAuthConfig = {
  // Skip automatic authority discovery to avoid CORS issues
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
  client_id: "12s8brrk9144uq23g3951mfvhl",
  redirect_uri: "https://yoursanskritteacher.com", // Ensure this matches the callback URL in Cognito
  response_type: "code",
  scope: "phone openid email", // Keep the original scopes
  loadUserInfo: true,
  
  // Disable metadata URL to prevent CORS issues - we'll manually construct auth URLs
  metadata: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
    authorization_endpoint: "https://auth.yoursanskritteacher.com/oauth2/authorize",
    token_endpoint: "https://auth.yoursanskritteacher.com/oauth2/token",
    end_session_endpoint: "https://auth.yoursanskritteacher.com/logout"
  },
  
  // Simplified authentication settings
  automaticSilentRenew: false,
  monitorSession: true,
  
  // Simple callback that just cleans up the URL
  onSigninCallback: () => {
    // When sign-in completes, just clean up URL - no flags or reloads needed
    window.history.replaceState({}, document.title, window.location.pathname);
    console.log("Authentication callback executed - URL cleaned up");
  },
  
  // Clear storage before sign-in to prevent old data issues
  onSigninStart: () => {
    console.log("Starting sign-in process");
    // Clear any existing OIDC storage 
    Object.keys(localStorage)
      .filter(key => key.startsWith('oidc.'))
      .forEach(key => localStorage.removeItem(key));
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