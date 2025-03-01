import React from "react";
import { useAuth } from "react-oidc-context";
import { Link } from "react-router-dom";
import "../styles.css"; // Import global CSS
import { FaSignInAlt, FaSignOutAlt, FaUserCircle } from "react-icons/fa"; // Import icons

const Header = () => {
  const auth = useAuth();

  const signoutRedirect = async () => {
    const clientId = "2fpemjqos4302bfaf65g06l8g0"; // Cognito App Client ID
    const logoutUri = "https://sessions.red"; // Post-logout redirect URI
    const cognitoDomain = "https://auth.sessions.red"; // Cognito domain
  
    // Construct the logout URL with the post-logout redirect URI
    const logoutURL = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}&post_logout_redirect_uri=${encodeURIComponent(logoutUri)}`;
  
    console.log("Logout URL:", logoutURL); // Log for debugging
  
    try {
      // Clear local auth state
      await auth.removeUser(); // Removes the user session from oidc-context
  
      // Redirect to Cognito logout endpoint
      window.location.href = logoutURL;
    } catch (error) {
      console.error("Error during signout:", error);
    }
  };

  return (
    <header className="header">
      {/* Logo */}
      <Link to="/" className="header-logo">
        <img
          src="/logo.jpeg" // Replace with your logo path
          alt="Expert Sessions Logo"
          className="header-logo-image"
        />
        <span className="header-title">Expert Sessions</span>
      </Link>

      {/* Navigation Links */}
      <nav className="header-nav">
        {!auth.isAuthenticated ? (
          <button className="header-link" onClick={() => auth.signinRedirect()}>
            <FaSignInAlt className="header-icon" /> Sign In
          </button>
        ) : (
          <>
            <Link to="/profile" className="header-link">
              <FaUserCircle className="header-icon" /> Profile
            </Link>
            <button className="header-link" onClick={signoutRedirect}>
              <FaSignOutAlt className="header-icon" /> Sign Out
            </button>
          </>
        )}
      </nav>
    </header>
  );
};

export default Header;