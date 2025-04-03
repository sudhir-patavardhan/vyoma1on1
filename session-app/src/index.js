import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router } from "react-router-dom";
import { AuthProvider } from "react-oidc-context";
import App from "./App";

// Minimal Cognito authentication configuration
const cognitoAuthConfig = {
  authority: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
  client_id: "12s8brrk9144uq23g3951mfvhl",
  redirect_uri: window.location.origin,
  response_type: "code",
  scope: "phone openid email",
  
  // Necessary metadata that shouldn't change
  metadata: {
    issuer: "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_US1m8498L",
    authorization_endpoint: "https://auth.yoursanskritteacher.com/oauth2/authorize",
    token_endpoint: "https://auth.yoursanskritteacher.com/oauth2/token",
    end_session_endpoint: "https://auth.yoursanskritteacher.com/logout",
    userinfo_endpoint: "https://auth.yoursanskritteacher.com/oauth2/userInfo"
  },
  
  // Standard URL cleanup after login
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

const root = ReactDOM.createRoot(document.getElementById("root"));

root.render(
  <React.StrictMode>
    <AuthProvider {...cognitoAuthConfig}>
      <Router>
        <App />
      </Router>
    </AuthProvider>
  </React.StrictMode>
);