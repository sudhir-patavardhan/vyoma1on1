import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

// Cognito authentication configuration
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
  client_id: "12s8brrk9144uq23g3951mfvhl",
  redirect_uri: "https://yoursanskritteacher.com", // Ensure this matches the callback URL in Cognito
  response_type: "code",
  scope: "phone openid email", // Scopes from AWS-suggested configuration
  metadataUrl: "https://auth.yoursanskritteacher.com/.well-known/openid-configuration", // Using custom domain for metadata
  
  // Force clear any cached OIDC settings to prevent 404 errors with old configuration
  automaticSilentRenew: false,
  monitorSession: true,
  loadUserInfo: true,
  onSigninCallback: () => {
    // When sign-in completes, clean up URL and set a flag to indicate successful auth
    window.history.replaceState({}, document.title, window.location.pathname);
    // Store a flag that we can check to force dashboard redirect
    sessionStorage.setItem('auth_completed', 'true');
    // Reload the app to ensure we pick up the authenticated state properly
    window.location.reload();
  },
  // Add browser storage configuration to clear old data
  userStore: {
    store: {
      clear: () => {
        // Clear any existing OIDC storage that might contain old configuration
        // This makes sure we don't keep trying to use the old User Pool ID
        Object.keys(localStorage)
          .filter(key => key.startsWith('oidc.'))
          .forEach(key => localStorage.removeItem(key));
      }
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