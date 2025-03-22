import React from "react";
import ReactDOM from "react-dom/client"; // Correct ReactDOM import for React 18
import { BrowserRouter as Router } from "react-router-dom"; // Import BrowserRouter
import { AuthProvider } from "react-oidc-context"; // Import AuthProvider
import App from "./App"; // Import your main App component

// Cognito authentication configuration
const cognitoAuthConfig = {
  authority: "https://cognito-idp.ap-south-1.amazonaws.com/ap-south-1_ghMdyIY2D",
  client_id: "4rkke6o1h98p3judjga7m34lrn",
  redirect_uri: "https://yoursanskritteacher.com", // Ensure this matches the callback URL in Cognito
  response_type: "code",
  scope: "phone openid email", // Scopes from AWS-suggested configuration
  
  // Force clear any cached OIDC settings to prevent 404 errors with old configuration
  automaticSilentRenew: false,
  monitorSession: true,
  loadUserInfo: true,
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
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