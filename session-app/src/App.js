import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import ProfileForm from "./components/ProfileForm";
import TeacherSearch from "./components/TeacherSearch";
import TeacherSchedule from "./components/TeacherSchedule";
import TeacherCalendarSchedule from "./components/TeacherCalendarSchedule";
import VirtualSession from "./components/VirtualSession";
import Bookings from "./components/Bookings";
import Dashboard from "./components/Dashboard";
import AdminPanel from "./components/admin/AdminPanel";
import { API_BASE_URL } from "./config";
import VERSION from "./version";
import "./styles.css";
import "./premium-styles.css"; // Import premium styles
import {
  FaSearch,
  FaSignInAlt,
  FaSignOutAlt,
  FaUserCircle,
  FaBookOpen,
  FaCalendarAlt,
  FaVideo,
  FaHome,
  FaLock,
  FaExchangeAlt,
  FaUserPlus,
  FaUser,
  FaGraduationCap,
  FaPlus,
  FaClipboardList,
  FaMoon,
  FaSun,
  FaChevronLeft,
  FaChevronRight,
  FaBars,
  FaTimes,
  FaCog,
  FaChalkboardTeacher,
  FaRegCalendarCheck,
  FaRegCalendarPlus,
} from "react-icons/fa"; // Import icons

// Add some custom styles for new elements
const injectCustomStyles = () => {
  const styles = `
  .teacher-link {
    margin-top: 15px;
    text-align: center;
    color: #666;
  }

  .teacher-link a {
    color: #1565C0; /* Vyoma dark blue */
    text-decoration: underline;
  }

  .profile-prompt {
    margin-bottom: 20px;
    border-radius: 8px;
    background-color: rgba(30, 136, 229, 0.1); /* Vyoma blue with transparency */
    border-color: #1E88E5; /* Vyoma blue */
  }

  .profile-prompt h4 {
    color: #0D47A1; /* Vyoma navy */
    margin-bottom: 10px;
  }

  .profile-prompt a {
    color: #1E88E5; /* Vyoma blue */
    font-weight: bold;
    text-decoration: underline;
  }

  .text-link {
    background: none;
    border: none;
    color: #1565C0; /* Vyoma dark blue */
    text-decoration: underline;
    cursor: pointer;
    padding: 0;
    font: inherit;
  }

  .icon-small {
    margin-right: 5px;
    font-size: 14px;
  }

  .alert-info {
    padding: 10px 15px;
  }

  /* Theme Toggle Button */
  .theme-toggle {
    position: fixed;
    bottom: 70px;
    right: 20px;
    background-color: var(--vyoma-blue);
    color: white;
    border: none;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
    transition: all 0.3s ease;
    z-index: 1000;
  }

  .theme-toggle:hover {
    background-color: var(--vyoma-blue-dark);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .theme-toggle .icon {
    font-size: 20px;
  }

  /* New Navigation Styles */
  .main-nav {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    height: 60px;
    background-color: var(--vyoma-blue);
    color: white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 1.2rem;
    font-weight: bold;
    cursor: pointer;
  }

  .nav-brand img {
    height: 32px;
  }

  .nav-links {
    display: flex;
    list-style: none;
    margin: 0;
    padding: 0;
    gap: 5px;
  }

  .nav-item {
    position: relative;
  }

  .nav-link {
    display: flex;
    align-items: center;
    padding: 8px 16px;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    transition: background-color 0.2s;
    font-weight: 500;
    gap: 8px;
    cursor: pointer;
    border: none;
    background: none;
    font-size: 1rem;
  }

  .nav-link:hover, .nav-link.active {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .nav-link.active {
    font-weight: bold;
    background-color: rgba(255, 255, 255, 0.15);
  }

  .nav-icon {
    font-size: 1.1rem;
  }

  /* Mobile Navigation */
  .mobile-nav-toggle {
    display: none;
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
  }

  .session-join-btn {
    background-color: #e53935;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: bold;
    border: none;
    cursor: pointer;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(229, 57, 53, 0.4);
    }
    70% {
      box-shadow: 0 0 0 10px rgba(229, 57, 53, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(229, 57, 53, 0);
    }
  }

  /* Bottom Navigation for Mobile */
  .bottom-nav {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background-color: white;
    box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .bottom-nav-links {
    display: flex;
    justify-content: space-around;
    list-style: none;
    margin: 0;
    padding: 8px 0;
  }

  .bottom-nav-item {
    flex: 1;
    text-align: center;
  }

  .bottom-nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--text-dark);
    text-decoration: none;
    padding: 8px 0;
    font-size: 0.75rem;
    gap: 4px;
    border: none;
    background: none;
    cursor: pointer;
    width: 100%;
  }

  .bottom-nav-link.active {
    color: var(--vyoma-blue);
    font-weight: 500;
  }

  .bottom-nav-icon {
    font-size: 1.25rem;
  }

  /* User Menu */
  .user-menu {
    position: relative;
  }

  .user-menu-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    color: white;
    border: none;
    background: none;
    cursor: pointer;
    border-radius: 4px;
  }

  .user-menu-toggle:hover {
    background-color: rgba(255, 255, 255, 0.1);
  }

  .user-menu-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    width: 240px;
    background-color: white;
    border-radius: 4px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    padding: 8px 0;
    z-index: 1010;
    margin-top: 8px;
    overflow: hidden;
  }

  .user-menu-header {
    padding: 12px 16px;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }

  .user-menu-name {
    font-weight: bold;
    color: var(--text-dark);
    margin-bottom: 4px;
  }

  .user-menu-role {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .user-menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
    color: var(--text-dark);
    text-decoration: none;
    cursor: pointer;
    transition: background-color 0.2s;
    border: none;
    background: none;
    width: 100%;
    text-align: left;
  }

  .user-menu-item:hover {
    background-color: var(--gray-100);
  }

  .user-menu-icon {
    font-size: 1rem;
    color: var(--gray-600);
  }

  .user-menu-divider {
    height: 1px;
    background-color: var(--gray-200);
    margin: 8px 0;
  }

  .role-switch-section {
    padding: 8px 16px;
    background-color: var(--gray-100);
  }

  .role-switch-title {
    font-size: 0.75rem;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .role-switch-options {
    display: flex;
    gap: 8px;
  }

  .role-switch-btn {
    padding: 4px 12px;
    border-radius: 16px;
    border: 1px solid var(--gray-300);
    background-color: white;
    color: var(--text-dark);
    font-size: 0.8rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .role-switch-btn.active {
    background-color: var(--vyoma-blue);
    color: white;
    border-color: var(--vyoma-blue);
  }

  /* Responsive styles */
  @media (max-width: 992px) {
    .main-nav {
      padding: 0 16px;
    }

    .nav-links {
      display: none;
    }

    .mobile-nav-toggle {
      display: block;
    }

    .nav-links.mobile-visible {
      display: flex;
      flex-direction: column;
      position: fixed;
      top: 60px;
      left: 0;
      right: 0;
      background-color: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      padding: 16px;
      z-index: 1000;
    }

    .nav-links.mobile-visible .nav-link {
      color: var(--text-dark);
      padding: 12px 16px;
    }

    .nav-links.mobile-visible .nav-link:hover,
    .nav-links.mobile-visible .nav-link.active {
      background-color: var(--gray-100);
    }

    .bottom-nav {
      display: block;
    }
  }
  `;

  // Only add the styles once
  if (!document.getElementById("sanskrit-teacher-custom-styles")) {
    const styleElement = document.createElement("style");
    styleElement.id = "sanskrit-teacher-custom-styles";
    styleElement.innerHTML = styles;
    document.head.appendChild(styleElement);
  }
};

function App() {
  // State for theme toggling with persistence
  const [darkMode, setDarkMode] = useState(() => {
    // Check localStorage for saved preference, default to light mode
    const savedTheme = localStorage.getItem("sanskritTeacherTheme");
    return savedTheme === "dark";
  });

  // State for mobile navigation
  const [mobileNavVisible, setMobileNavVisible] = useState(false);
  const [userMenuVisible, setUserMenuVisible] = useState(false);
  
  // Effect to apply theme to document
  useEffect(() => {
    const theme = darkMode ? "dark" : "light";

    // Apply theme to multiple elements to ensure complete coverage
    document.documentElement.setAttribute("data-theme", theme);
    document.body.setAttribute("data-theme", theme);

    // Also set a class on body for additional styling options
    if (darkMode) {
      document.body.classList.add("dark-mode");
      document.documentElement.classList.add("dark-mode");
    } else {
      document.body.classList.remove("dark-mode");
      document.documentElement.classList.remove("dark-mode");
    }

    // Directly apply background color to ensure it takes effect
    if (darkMode) {
      document.body.style.backgroundColor = "#0A1929"; // Vyoma dark navy
      document.documentElement.style.backgroundColor = "#0A1929";
    } else {
      document.body.style.backgroundColor = "#E3F2FD"; // Vyoma light blue
      document.documentElement.style.backgroundColor = "#E3F2FD";
    }

    // Apply to root element if it exists
    const rootElement = document.getElementById("root");
    if (rootElement) {
      rootElement.setAttribute("data-theme", theme);
      if (darkMode) {
        rootElement.style.backgroundColor = "#0A1929"; // Vyoma dark navy
        rootElement.style.minHeight = "100vh";
      } else {
        rootElement.style.backgroundColor = "#E3F2FD"; // Vyoma light blue
        rootElement.style.minHeight = "100vh";
      }
    }

    // Set meta theme-color for mobile browsers
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute("content", darkMode ? "#0A1929" : "#E3F2FD");
    } else {
      const metaTag = document.createElement("meta");
      metaTag.name = "theme-color";
      metaTag.content = darkMode ? "#0A1929" : "#E3F2FD";
      document.head.appendChild(metaTag);
    }
  }, [darkMode]);

  // Toggle theme function with localStorage persistence
  const toggleTheme = () => {
    const newTheme = !darkMode;
    setDarkMode(newTheme);
    localStorage.setItem("sanskritTeacherTheme", newTheme ? "dark" : "light");
  };

  // Close mobile navigation when a link is clicked
  const handleNavLinkClick = (tab) => {
    setActiveTab(tab);
    setMobileNavVisible(false);
    setUserMenuVisible(false);
  };

  // Toggle user menu visibility
  const toggleUserMenu = () => {
    setUserMenuVisible(!userMenuVisible);
    if (mobileNavVisible) setMobileNavVisible(false);
  };

  // Inject custom styles on component mount
  React.useEffect(() => {
    injectCustomStyles();
  }, []);
  const auth = useAuth();

  // Initialize with loading state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState("dashboard");
  const [activeSession, setActiveSession] = useState(null);
  const [upcomingSession, setUpcomingSession] = useState(null);
  
  // Don't try to handle auth callbacks manually - let the library do it
  // Our attempts to manipulate state storage are causing JSON parsing errors

  // Simple effect to handle auth state changes
  useEffect(() => {
    // Basic authentication status logging
    if (auth.isAuthenticated && !auth.isLoading) {
      console.log("User is authenticated");
      // Set dashboard as active tab when authenticated
      setActiveTab("dashboard");
    } else if (!auth.isAuthenticated && !auth.isLoading) {
      console.log("User is not authenticated");
    }
    
    // Log any authentication errors
    if (auth.error) {
      console.error("Authentication error:", auth.error.message);
    }
  }, [
    auth.isAuthenticated,
    auth.isLoading,
    auth.error,
    setActiveTab,
  ]);

  // For users with multiple roles
  const [activeRole, setActiveRole] = useState(null);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Cognito configuration
  const clientId = "12s8brrk9144uq23g3951mfvhl";
  const redirectUri = "https://yoursanskritteacher.com";
  const cognitoDomain = "https://auth.yoursanskritteacher.com";

  const signOutRedirect = () => {
    // Use the library's built-in signoutRedirect method
    auth.signoutRedirect();
  };

  // Function to redirect users to the signup page
  const signupRedirect = () => {
    // Use the library's built-in signinRedirect method with a signup hint
    auth.signinRedirect({
      prompt: 'login',
      login_hint: 'signup'
    });
  };

  const renderHeader = () => {
    // Determine if user is a student, teacher, or admin based on roles
    const isStudent = profile && 
      (activeRole === "student" || 
      (!activeRole && 
        ((profile.roles && profile.roles.includes("student")) || 
          profile.role === "student")));
    
    const isTeacher = profile && 
      (activeRole === "teacher" || 
      (!activeRole && 
        ((profile.roles && profile.roles.includes("teacher")) || 
          profile.role === "teacher")));
    
    const isAdmin = profile && 
      (activeRole === "admin" || 
      (!activeRole && 
        ((profile.roles && profile.roles.includes("admin")) || 
          profile.role === "admin")));

    return (
      <header>
        {/* Main Navigation */}
        <nav className="main-nav">
          {/* Brand/Logo */}
          <div 
            className="nav-brand"
            onClick={() => auth.isAuthenticated ? handleNavLinkClick("dashboard") : null}
          >
            <span>संस्कृत Teacher</span>
          </div>

          {/* Desktop Navigation Links */}
          <ul className={`nav-links ${mobileNavVisible ? 'mobile-visible' : ''}`}>
            {!auth.isAuthenticated ? (
              <>
                {/* Public Navigation (Not Logged In) */}
                <li className="nav-item">
                  <button
                    className="nav-link"
                    onClick={() => auth.signinRedirect()}
                  >
                    <FaSignInAlt className="nav-icon" /> Sign In
                  </button>
                </li>
                <li className="nav-item">
                  <button 
                    className="nav-link"
                    onClick={signupRedirect}
                  >
                    <FaUserPlus className="nav-icon" /> Sign Up
                  </button>
                </li>
              </>
            ) : (
              <>
                {/* Authenticated User Navigation */}
                <li className="nav-item">
                  <button
                    className={`nav-link ${activeTab === "dashboard" ? "active" : ""}`}
                    onClick={() => handleNavLinkClick("dashboard")}
                  >
                    <FaHome className="nav-icon" /> Dashboard
                  </button>
                </li>

                {/* Student-specific Navigation */}
                {isStudent && (
                  <>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === "search" ? "active" : ""}`}
                        onClick={() => handleNavLinkClick("search")}
                      >
                        <FaSearch className="nav-icon" /> Find Teachers
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === "bookings" ? "active" : ""}`}
                        onClick={() => handleNavLinkClick("bookings")}
                      >
                        <FaBookOpen className="nav-icon" /> My Classes
                      </button>
                    </li>
                  </>
                )}

                {/* Teacher-specific Navigation */}
                {isTeacher && (
                  <>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === "schedule" ? "active" : ""}`}
                        onClick={() => handleNavLinkClick("schedule")}
                      >
                        <FaCalendarAlt className="nav-icon" /> My Classes
                      </button>
                    </li>
                    <li className="nav-item">
                      <button
                        className={`nav-link ${activeTab === "create-slots" ? "active" : ""}`}
                        onClick={() => handleNavLinkClick("create-slots")}
                      >
                        <FaRegCalendarPlus className="nav-icon" /> Add Slots
                      </button>
                    </li>
                  </>
                )}

                {/* Admin-specific Navigation */}
                {isAdmin && (
                  <li className="nav-item">
                    <button
                      className={`nav-link ${activeTab === "admin" ? "active" : ""}`}
                      onClick={() => handleNavLinkClick("admin")}
                    >
                      <FaLock className="nav-icon" /> Admin
                    </button>
                  </li>
                )}

                {/* Join Session Button (Prominent) */}
                {profile && upcomingSession && (
                  <li className="nav-item">
                    <button
                      className="session-join-btn"
                      onClick={() => setActiveSession(upcomingSession)}
                    >
                      <FaVideo /> Join Live Session
                    </button>
                  </li>
                )}
              </>
            )}
          </ul>

          {/* Right Side Controls */}
          {auth.isAuthenticated && (
            <div className="user-menu">
              <button 
                className="user-menu-toggle"
                onClick={toggleUserMenu}
              >
                <FaUserCircle className="nav-icon" />
                <span className="d-none d-md-inline">{profile?.name?.split(' ')[0] || "Account"}</span>
              </button>

              {/* User Menu Dropdown */}
              {userMenuVisible && (
                <div className="user-menu-dropdown">
                  {/* User Info Header */}
                  <div className="user-menu-header">
                    <div className="user-menu-name">{profile?.name || "Profile"}</div>
                    <div className="user-menu-role">
                      {activeRole 
                        ? `${activeRole.charAt(0).toUpperCase()}${activeRole.slice(1)}`
                        : profile?.role?.charAt(0).toUpperCase() + profile?.role?.slice(1) || "User"}
                    </div>
                  </div>

                  {/* Role Switcher (only for users with multiple roles) */}
                  {profile && profile.roles && profile.roles.length > 1 && (
                    <div className="role-switch-section">
                      <div className="role-switch-title">Switch View</div>
                      <div className="role-switch-options">
                        {profile.roles.map((role) => (
                          <button
                            key={role}
                            className={`role-switch-btn ${activeRole === role ? "active" : ""}`}
                            onClick={() => {
                              setActiveRole(role);
                              handleNavLinkClick("dashboard");
                            }}
                          >
                            {role === "student" && <FaUser />}
                            {role === "teacher" && <FaGraduationCap />}
                            {role === "admin" && <FaLock />}
                            {role.charAt(0).toUpperCase() + role.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* User Menu Items */}
                  <button 
                    className="user-menu-item"
                    onClick={() => handleNavLinkClick("profile")}
                  >
                    <FaUserCircle className="user-menu-icon" />
                    Edit Profile
                  </button>
                  <button 
                    className="user-menu-item"
                    onClick={toggleTheme}
                  >
                    {darkMode 
                      ? <><FaSun className="user-menu-icon" /> Light Mode</>
                      : <><FaMoon className="user-menu-icon" /> Dark Mode</>
                    }
                  </button>
                  <div className="user-menu-divider"></div>
                  <button 
                    className="user-menu-item"
                    onClick={signOutRedirect}
                  >
                    <FaSignOutAlt className="user-menu-icon" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <button 
            className="mobile-nav-toggle"
            onClick={() => {
              setMobileNavVisible(!mobileNavVisible);
              if (userMenuVisible) setUserMenuVisible(false);
            }}
          >
            {mobileNavVisible ? <FaTimes /> : <FaBars />}
          </button>
        </nav>

        {/* Bottom Navigation for Mobile */}
        {auth.isAuthenticated && (
          <nav className="bottom-nav">
            <ul className="bottom-nav-links">
              <li className="bottom-nav-item">
                <button 
                  className={`bottom-nav-link ${activeTab === "dashboard" ? "active" : ""}`}
                  onClick={() => handleNavLinkClick("dashboard")}
                >
                  <FaHome className="bottom-nav-icon" />
                  <span>Home</span>
                </button>
              </li>

              {isStudent && (
                <>
                  <li className="bottom-nav-item">
                    <button 
                      className={`bottom-nav-link ${activeTab === "search" ? "active" : ""}`}
                      onClick={() => handleNavLinkClick("search")}
                    >
                      <FaSearch className="bottom-nav-icon" />
                      <span>Find</span>
                    </button>
                  </li>
                  <li className="bottom-nav-item">
                    <button 
                      className={`bottom-nav-link ${activeTab === "bookings" ? "active" : ""}`}
                      onClick={() => handleNavLinkClick("bookings")}
                    >
                      <FaBookOpen className="bottom-nav-icon" />
                      <span>Classes</span>
                    </button>
                  </li>
                </>
              )}

              {isTeacher && (
                <>
                  <li className="bottom-nav-item">
                    <button 
                      className={`bottom-nav-link ${activeTab === "schedule" ? "active" : ""}`}
                      onClick={() => handleNavLinkClick("schedule")}
                    >
                      <FaCalendarAlt className="bottom-nav-icon" />
                      <span>Schedule</span>
                    </button>
                  </li>
                  <li className="bottom-nav-item">
                    <button 
                      className={`bottom-nav-link ${activeTab === "create-slots" ? "active" : ""}`}
                      onClick={() => handleNavLinkClick("create-slots")}
                    >
                      <FaRegCalendarPlus className="bottom-nav-icon" />
                      <span>Add Slots</span>
                    </button>
                  </li>
                </>
              )}

              <li className="bottom-nav-item">
                <button 
                  className={`bottom-nav-link ${activeTab === "profile" ? "active" : ""}`}
                  onClick={() => handleNavLinkClick("profile")}
                >
                  <FaUserCircle className="bottom-nav-icon" />
                  <span>Profile</span>
                </button>
              </li>
            </ul>
          </nav>
        )}
      </header>
    );
  };

  const renderContent = () => {
    // If a session is active, show the virtual session component instead of normal content
    if (activeSession) {
      return (
        <div className="app-layout">
          {renderHeader()}
          <div className="main-content">
            <div className="content-area full-width">
              <VirtualSession
                sessionId={activeSession}
                onEndSession={() => setActiveSession(null)}
              />
            </div>
          </div>
        </div>
      );
    }

    // Normal content based on active tab
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body">
                  {/* Show dashboard as default for authenticated users, with profile completion prompt if needed */}
                  {(activeTab === "dashboard" || !activeTab) && (
                    <>
                      {!profile && (
                        <div className="alert alert-info profile-prompt">
                          <h4>Welcome to Sanskrit Teacher!</h4>
                          <p>
                            Please{" "}
                            <a
                              href="#"
                              onClick={(e) => {
                                e.preventDefault();
                                setActiveTab("profile");
                              }}
                            >
                              complete your profile
                            </a>{" "}
                            to get the most out of your Sanskrit learning
                            experience.
                          </p>
                        </div>
                      )}
                      <Dashboard
                        profile={profile || { role: "student" }} // Provide minimal profile if none exists
                        onTabChange={setActiveTab}
                        onJoinSession={setActiveSession}
                        upcomingSession={upcomingSession}
                      />
                    </>
                  )}

                  {activeTab === "profile" && (
                    <ProfileForm
                      saveUserProfile={saveUserProfile}
                      profile={profile}
                    />
                  )}

                  {/* Show teacher search for students */}
                  {profile &&
                    (activeRole === "student" ||
                      (!activeRole &&
                        ((profile.roles && profile.roles.includes("student")) ||
                          profile.role === "student"))) &&
                    activeTab === "search" && <TeacherSearch />}

                  {/* Show bookings for students */}
                  {profile &&
                    (activeRole === "student" ||
                      (!activeRole &&
                        ((profile.roles && profile.roles.includes("student")) ||
                          profile.role === "student"))) &&
                    activeTab === "bookings" && (
                      <Bookings
                        userId={auth.user?.profile.sub}
                        userRole="student"
                        onJoinSession={setActiveSession}
                        onUpcomingSession={setUpcomingSession}
                      />
                    )}

                  {/* Show schedule for teachers */}
                  {profile &&
                    (activeRole === "teacher" ||
                      (!activeRole &&
                        ((profile.roles && profile.roles.includes("teacher")) ||
                          profile.role === "teacher"))) &&
                    activeTab === "schedule" && <TeacherCalendarSchedule />}

                  {/* Admin Panel */}
                  {profile &&
                    (activeRole === "admin" ||
                      (!activeRole &&
                        ((profile.roles && profile.roles.includes("admin")) ||
                          profile.role === "admin"))) &&
                    activeTab === "admin" && <AdminPanel profile={profile} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      // Reset states when authentication changes
      setLoadingProfile(true);
      setProfileError(null);

      // Set dashboard as the default tab for authenticated users
      if (auth.isAuthenticated) {
        setActiveTab("dashboard");
      }

      if (auth.isAuthenticated && auth.user && auth.user.profile) {
        console.log("Auth authenticated, fetching profile");
        try {
          const userId = auth.user.profile.sub;
          if (!userId) {
            throw new Error("User ID not found in authentication data");
          }

          console.log("Fetching profile for user:", userId);
          const response = await fetch(
            `${API_BASE_URL}/profiles?user_id=${userId}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${auth.user.access_token}`,
              },
            }
          );

          // Special handling for 404 status (profile not found)
          // This is not an error for new users, just means they need to create a profile
          if (response.status === 404) {
            console.log(
              "Profile not found for new user (404), showing profile form"
            );
            setProfile(null);
            setActiveRole(null);
            setLoadingProfile(false);
            return; // Exit early, no need to process further
          }

          // Handle other error statuses
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Profile error response:", errorText);
            throw new Error(
              `Profile fetch failed with status: ${response.status}`
            );
          }

          let data;
          try {
            const responseText = await response.text();
            console.log("Raw response:", responseText);

            // Check if response starts with HTML doctype
            if (responseText.trim().toLowerCase().startsWith("<!doctype")) {
              console.error("Received HTML instead of JSON");
              throw new Error(
                "API returned HTML instead of JSON. The server might be down or misconfigured."
              );
            }

            // Try to parse JSON
            data = JSON.parse(responseText);
            console.log("Profile response:", data);
          } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error(
              `Failed to parse profile data: ${parseError.message}`
            );
          }

          if (data && data.profile) {
            console.log("Profile data loaded successfully:", data.profile);
            setProfile(data.profile);

            // Set the active role based on the profile
            // Use the role field for backward compatibility, or the first role in the roles array
            // If both exist, prioritize the role field as it's the primary role
            if (data.profile.role) {
              setActiveRole(data.profile.role);
            } else if (data.profile.roles && data.profile.roles.length > 0) {
              setActiveRole(data.profile.roles[0]);
            }

            // Check for upcoming sessions
            // Still use profile.role for backward compatibility, but could be extended
            // to check sessions for all roles a user has in the future
            checkUpcomingSessions(userId, data.profile.role);
          } else {
            console.log("No profile found, showing profile form");
            setProfile(null); // No profile found, trigger profile form
            setActiveRole(null);
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
          setProfileError(error.message || "Failed to load your profile");
          // Still set profile to null so the profile form shows
          setProfile(null);
        } finally {
          setLoadingProfile(false);
        }
      } else {
        console.log(
          "Not authenticated or missing user data, skipping profile fetch"
        );
        setLoadingProfile(false);
      }
    };

    fetchUserProfile();
  }, [auth.isAuthenticated, auth.user]);

  const checkUpcomingSessions = async (userId, role) => {
    if (!auth.isAuthenticated || !auth.user || !auth.user.access_token) {
      console.log("Skipping upcoming sessions check - not authenticated");
      return;
    }

    try {
      // Fetch bookings for the user
      const userType = role === "student" ? "student_id" : "teacher_id";
      console.log(`Checking upcoming sessions for ${userType}=${userId}`);

      const response = await fetch(
        `${API_BASE_URL}/bookings?${userType}=${userId}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Bookings error response:", errorText);
        throw new Error(
          `Failed to fetch bookings: ${response.status} ${response.statusText}`
        );
      }

      let bookings;
      try {
        const responseText = await response.text();
        console.log("Raw bookings response:", responseText);

        // Check for HTML response
        if (responseText.trim().toLowerCase().startsWith("<!doctype")) {
          console.error("Received HTML instead of JSON in bookings");
          throw new Error("API returned HTML instead of JSON for bookings");
        }

        // Only try to parse if we have content
        if (responseText.trim()) {
          bookings = JSON.parse(responseText);
        } else {
          bookings = []; // Empty response
        }
      } catch (parseError) {
        console.error("JSON parse error in bookings:", parseError);
        throw new Error(`Failed to parse bookings data: ${parseError.message}`);
      }
      console.log("Bookings fetched:", bookings);

      if (!Array.isArray(bookings)) {
        console.warn("Unexpected bookings response format:", bookings);
        return;
      }

      // Check for upcoming sessions (within 15 minutes from now)
      const now = new Date();
      const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

      const upcoming = bookings.find((booking) => {
        if (!booking || !booking.start_time) return false;

        const startTime = new Date(booking.start_time);
        return startTime > now && startTime < fifteenMinutesFromNow;
      });

      if (upcoming && upcoming.session_id) {
        console.log("Found upcoming session:", upcoming.session_id);
        setUpcomingSession(upcoming.session_id);
      } else {
        setUpcomingSession(null);
      }
    } catch (error) {
      console.error("Error checking upcoming sessions:", error);
      // Don't set error state as this is not a critical function
    }
  };

  const saveUserProfile = async (profileData) => {
    if (
      !auth.isAuthenticated ||
      !auth.user ||
      !auth.user.profile ||
      !auth.user.profile.sub
    ) {
      const error = new Error("You must be signed in to save a profile");
      console.error(error);
      throw error;
    }

    try {
      console.log("Saving profile for user:", auth.user.profile.sub);

      const response = await fetch(`${API_BASE_URL}/profiles`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${auth.user.access_token}`,
        },
        body: JSON.stringify({
          user_id: auth.user.profile.sub,
          role: profileData.role,
          profile_data: profileData,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(
          `Failed to save profile: ${response.status} ${response.statusText}`
        );
      }

      let result;
      try {
        const responseText = await response.text();
        console.log("Raw save profile response:", responseText);

        // Check if response starts with HTML doctype
        if (responseText.trim().toLowerCase().startsWith("<!doctype")) {
          console.error("Received HTML instead of JSON in profile save");
          throw new Error(
            "API returned HTML instead of JSON. The server might be down or misconfigured."
          );
        }

        // Try to parse JSON
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error in profile save:", parseError);
        throw new Error(
          `Failed to parse profile save response: ${parseError.message}`
        );
      }
      console.log("Profile successfully created:", result);

      // Update the profile state
      setProfile(profileData);

      // Set to dashboard after creating profile
      setActiveTab("dashboard");

      return result;
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error; // Re-throw to allow the ProfileForm to handle it
    }
  };

  // Theme toggle button component
  const renderThemeToggle = () => {
    return (
      <button
        className="theme-toggle"
        onClick={toggleTheme}
        aria-label={darkMode ? "Switch to light mode" : "Switch to dark mode"}
      >
        {darkMode ? <FaSun className="icon" /> : <FaMoon className="icon" />}
      </button>
    );
  };

  // Define the footer render function early
  const renderFooter = () => {
    // Format the build date in a user-friendly format
    const formatDate = (dateString) => {
      if (!dateString) return "Unknown";
      const options = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      };
      return new Date(dateString).toLocaleDateString(undefined, options);
    };

    const buildDate = formatDate(VERSION.buildDate);

    return (
      <footer className="footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              <span>संस्कृत Teacher</span>
            </div>
            <div className="footer-links">
              <a href="#">Terms of Service</a>
              <a href="#">Privacy Policy</a>
              <a href="#">Contact Us</a>
            </div>
            <div className="footer-copyright">
              © {new Date().getFullYear()} संस्कृत Teacher. All rights
              reserved.
              <div className="version-info">
                Last updated: {buildDate}
                {VERSION.buildId !== "local" && (
                  <span className="build-id"> • Build: {VERSION.buildId}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </footer>
    );
  };

  // Check for authentication state and update UI accordingly
  if (!auth.isAuthenticated) {
    // After login, there might be a brief moment when isAuthenticated is still false but we have user details
    // This additional check helps prevent showing the landing page incorrectly after login
    if (auth.user) {
      console.log(
        "User data detected but isAuthenticated is false - treating as authenticated"
      );
      // If we have user data, treat as authenticated and continue to the dashboard
    } else {
      return (
        <div className="app-layout">
          {renderHeader()}
          <div className="main-content">
            <div className="content-area">
              <div className="container">
                <div className="card">
                  <div className="card-body">
                    {/* Render theme toggle on landing page too */}
                    {renderThemeToggle()}
                    <div className="sanskrit-hero">
                      <div className="vyoma-logo-container">
                        <img
                          src="/vyoma/Vyoma_Logo_Blue_500x243.png"
                          alt="Vyoma Sanskrit"
                          className="vyoma-logo"
                        />
                      </div>
                      <h1 className="landing-heading">
                        Experience Sanskrit Excellence
                      </h1>
                      <h2 className="landing-subheading">
                        Learn from Renowned Sanskrit Scholars in Personalized
                        1:1 Sessions
                      </h2>
                      <p className="landing-text">
                        Connect with expert Sanskrit instructors specializing in
                        Vedic literature, classical texts, grammar, philosophy,
                        and more. Our platform brings together PhD-holding
                        scholars offering premium instruction for students at
                        all levels—from beginners to advanced practitioners.
                      </p>
                    </div>

                    <div className="sanskrit-categories">
                      <h3 className="categories-title">
                        Explore Sanskrit Domains
                      </h3>
                      <div className="carousel-container">
                        <button className="carousel-nav prev" onClick={() => document.querySelector('.category-grid').scrollBy({left: -300, behavior: 'smooth'})}>
                          <FaChevronLeft className="carousel-nav-icon" />
                        </button>
                        <button className="carousel-nav next" onClick={() => document.querySelector('.category-grid').scrollBy({left: 300, behavior: 'smooth'})}>
                          <FaChevronRight className="carousel-nav-icon" />
                        </button>
                        <div className="category-grid">
                        <div className="category-card">
                          <div className="category-icon vedic"></div>
                          <h4>Vedic Literature</h4>
                          <p>
                            Study Rigveda, Samaveda, Yajurveda, Atharvaveda,
                            Upanishads and related texts
                          </p>
                        </div>
                        <div className="category-card">
                          <div className="category-icon grammar"></div>
                          <h4>Sanskrit Grammar</h4>
                          <p>
                            Master Panini's Ashtadhyayi, syntax, verb forms, and
                            composition rules
                          </p>
                        </div>
                        <div className="category-card">
                          <div className="category-icon literature"></div>
                          <h4>Classical Literature</h4>
                          <p>
                            Explore Kavya, Nataka, Ramayana, Mahabharata, and
                            great poetic works
                          </p>
                        </div>
                        <div className="category-card">
                          <div className="category-icon philosophy"></div>
                          <h4>Darshana Philosophy</h4>
                          <p>
                            Delve into Vedanta, Samkhya, Yoga, Nyaya, and
                            philosophical systems
                          </p>
                        </div>
                        <div className="category-card">
                          <div className="category-icon science"></div>
                          <h4>Scientific Texts</h4>
                          <p>
                            Discover Ayurveda, Jyotisha, mathematics, and
                            ancient sciences
                          </p>
                        </div>
                        <div className="category-card">
                          <div className="category-icon modern"></div>
                          <h4>Conversational Sanskrit</h4>
                          <p>
                            Practice spoken Sanskrit and modern usage with
                            fluent speakers
                          </p>
                        </div>
                      </div>
                      <div className="carousel-indicators">
                        <div className="carousel-indicator active" onClick={() => document.querySelector('.category-grid').scrollTo({left: 0, behavior: 'smooth'})}></div>
                        <div className="carousel-indicator" onClick={() => document.querySelector('.category-grid').scrollTo({left: 300, behavior: 'smooth'})}></div>
                        <div className="carousel-indicator" onClick={() => document.querySelector('.category-grid').scrollTo({left: 600, behavior: 'smooth'})}></div>
                      </div>
                      </div>
                    </div>

                    <div className="carousel-container">
                      <button className="carousel-nav prev" onClick={() => document.querySelector('.landing-features').scrollBy({left: -300, behavior: 'smooth'})}>
                        <FaChevronLeft className="carousel-nav-icon" />
                      </button>
                      <button className="carousel-nav next" onClick={() => document.querySelector('.landing-features').scrollBy({left: 300, behavior: 'smooth'})}>
                        <FaChevronRight className="carousel-nav-icon" />
                      </button>
                      <div className="landing-features">
                      <div className="feature">
                        <FaGraduationCap className="feature-icon" />
                        <h3>Expert Sanskrit Scholars</h3>
                        <p>
                          Learn with verified scholars holding advanced degrees
                          in traditional and modern Sanskrit studies
                        </p>
                      </div>
                      <div className="feature">
                        <FaVideo className="feature-icon" />
                        <h3>Interactive Sessions</h3>
                        <p>
                          Engage in immersive video lessons with pronunciation
                          guidance, text analysis, and discussion
                        </p>
                      </div>
                      <div className="feature">
                        <FaCalendarAlt className="feature-icon" />
                        <h3>Flexible Learning</h3>
                        <p>
                          Schedule sessions at your convenience across
                          international time zones
                        </p>
                      </div>
                      <div className="feature">
                        <FaSearch className="feature-icon" />
                        <h3>Personalized Instruction</h3>
                        <p>
                          Receive tailored teaching focused on your specific
                          interests and learning goals
                        </p>
                      </div>
                      <div className="carousel-indicators">
                        <div className="carousel-indicator active" onClick={() => document.querySelector('.landing-features').scrollTo({left: 0, behavior: 'smooth'})}></div>
                        <div className="carousel-indicator" onClick={() => document.querySelector('.landing-features').scrollTo({left: 300, behavior: 'smooth'})}></div>
                      </div>
                    </div>
                    </div>

                    <div className="testimonials-section">
                      <h3>Student Experiences</h3>
                      <div className="carousel-container">
                        <button className="carousel-nav prev" onClick={() => document.querySelector('.testimonials-container').scrollBy({left: -350, behavior: 'smooth'})}>
                          <FaChevronLeft className="carousel-nav-icon" />
                        </button>
                        <button className="carousel-nav next" onClick={() => document.querySelector('.testimonials-container').scrollBy({left: 350, behavior: 'smooth'})}>
                          <FaChevronRight className="carousel-nav-icon" />
                        </button>
                        <div className="testimonials-container">
                        <div className="testimonial">
                          <p>
                            "The personalized approach to learning Vedic texts
                            has transformed my understanding of Sanskrit. My
                            teacher provides context I couldn't find in any
                            textbook."
                          </p>
                          <div className="testimonial-author">
                            — Michael R., USA
                          </div>
                        </div>
                        <div className="testimonial">
                          <p>
                            "As a philosophy researcher, the specialized
                            instruction in Advaita Vedanta texts has been
                            invaluable. The one-on-one format allows us to
                            explore nuances of the language in depth."
                          </p>
                          <div className="testimonial-author">
                            — Aruna S., India
                          </div>
                        </div>
                        <div className="carousel-indicators">
                          <div className="carousel-indicator active" onClick={() => document.querySelector('.testimonials-container').scrollTo({left: 0, behavior: 'smooth'})}></div>
                          <div className="carousel-indicator" onClick={() => document.querySelector('.testimonials-container').scrollTo({left: 350, behavior: 'smooth'})}></div>
                        </div>
                      </div>
                      </div>
                    </div>

                    <div className="text-center landing-buttons">
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={() => auth.signinRedirect()}
                      >
                        <span className="btn-icon">॥</span>
                        Begin Your Sanskrit Journey
                      </button>
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={signupRedirect}
                      >
                        <span className="btn-icon">ॐ</span>
                        Create Student Account
                      </button>
                    </div>

                    <div className="teacher-invitation">
                      <h3>Are You a Sanskrit Scholar?</h3>
                      <p>
                        Join our community of distinguished teachers and share
                        your expertise with dedicated students from around the
                        world.
                      </p>
                      <button
                        className="btn btn-outlined"
                        onClick={signupRedirect}
                      >
                        Register as a Teacher
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          {renderFooter()}
        </div>
      );
    }
  }

  // Both auth.isLoading and loadingProfile can be true even if auth.isAuthenticated
  // So we need to handle the case where we're authenticated but still loading the profile
  if (auth.isLoading || (loadingProfile && auth.isAuthenticated)) {
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body text-center">
                  <div className="loading">
                    <div className="loading-spinner"></div>
                    <h2>Loading...</h2>
                    <p className="text-muted">
                      {loadingProfile && auth.isAuthenticated
                        ? "Loading your profile..."
                        : "Authenticating..."}
                    </p>
                    <p className="text-muted small">
                      This may take a few moments. Please wait...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {renderThemeToggle()}
        {renderFooter()}
      </div>
    );
  }

  if (auth.error) {
    console.error("Authentication error:", auth.error.message);
    
    // Simple error UI with minimal recovery options
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body text-center">
                  <h2 className="text-danger mb-4">Authentication Error</h2>
                  
                  <div className="error-message mb-4">
                    <p>We encountered an error during sign-in:</p>
                    <p className="text-danger mt-2 mb-3">
                      <strong>{auth.error.message || "Unknown error"}</strong>
                    </p>
                  </div>
                  
                  <div className="mt-4">
                    <button
                      className="btn btn-primary btn-lg"
                      onClick={() => {
                        // Reload the page to restart the authentication flow
                        window.location.href = "/";
                      }}
                    >
                      Return to Home
                    </button>
                    
                    <button
                      className="btn btn-outline-primary ms-3"
                      onClick={() => {
                        // Try sign-in again
                        auth.signinRedirect();
                      }}
                    >
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        {renderThemeToggle()}
        {renderFooter()}
      </div>
    );
  }

  if (profileError) {
    console.error("Profile error:", profileError);

    // Check error type to give appropriate user feedback
    const isServerDown =
      profileError.includes("HTML instead of JSON") ||
      profileError.includes("Failed to parse profile data");

    // If this is a new user with no profile, we shouldn't see this error anymore
    // But if we do, we'll handle it gracefully
    const isProfileNotFound = profileError.includes("404");

    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body text-center">
                  {isProfileNotFound ? (
                    // User just needs to create a profile - show the form without error messaging
                    <>
                      <h2 className="mb-4">Complete Your Profile</h2>
                      <p className="mb-4">
                        Welcome to Vyoma 1:1! Please complete your profile to
                        get started.
                      </p>
                      <div className="mt-4">
                        <ProfileForm
                          saveUserProfile={saveUserProfile}
                          profile={null}
                        />
                      </div>
                    </>
                  ) : (
                    // Other types of errors
                    <>
                      <h2 className="text-warning mb-4">
                        {isServerDown ? "API Server Error" : "Profile Error"}
                      </h2>
                      <div className="error-message mb-4">
                        {isServerDown ? (
                          <>
                            <p>
                              <strong>
                                Our API server appears to be down or
                                misconfigured.
                              </strong>
                            </p>
                            <p>
                              We're experiencing technical difficulties
                              connecting to our servers. Please try again later.
                            </p>
                            <p className="text-muted small">
                              Technical details: {profileError}
                            </p>
                          </>
                        ) : (
                          <>
                            <p>We encountered an error loading your profile.</p>
                            <p className="text-muted small">
                              Technical details: {profileError}
                            </p>
                          </>
                        )}
                      </div>

                      {isServerDown ? (
                        <button
                          className="btn btn-primary"
                          onClick={() => window.location.reload()}
                        >
                          Refresh Page
                        </button>
                      ) : (
                        <>
                          <p>
                            You can continue by creating or updating your
                            profile
                          </p>
                          <div className="mt-4">
                            <ProfileForm
                              saveUserProfile={saveUserProfile}
                              profile={null}
                            />
                          </div>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
        {renderThemeToggle()}
        {renderFooter()}
      </div>
    );
  }

  // For virtual session, we don't want to show footer
  // If active session, return the original rendering (without footer)
  if (activeSession) {
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area full-width">
            <VirtualSession
              sessionId={activeSession}
              onEndSession={() => setActiveSession(null)}
            />
            {renderThemeToggle()}
          </div>
        </div>
      </div>
    );
  }

  // For regular authenticated state with profile loaded
  return (
    <div className="app-layout">
      {renderHeader()}
      <div className="main-content">
        <div className="content-area">
          <div className="container">
            <div className="card">
              <div className="card-body">
                {(!profile || activeTab === "profile") && (
                  <ProfileForm
                    saveUserProfile={saveUserProfile}
                    profile={profile}
                  />
                )}

                {renderThemeToggle()}

                {profile && activeTab === "dashboard" && (
                  <Dashboard
                    profile={profile}
                    onTabChange={setActiveTab}
                    onJoinSession={setActiveSession}
                    upcomingSession={upcomingSession}
                  />
                )}

                {/* Show teacher search for students */}
                {profile &&
                  (activeRole === "student" ||
                    (!activeRole &&
                      ((profile.roles && profile.roles.includes("student")) ||
                        profile.role === "student"))) &&
                  activeTab === "search" && <TeacherSearch />}

                {/* Show bookings for students */}
                {profile &&
                  (activeRole === "student" ||
                    (!activeRole &&
                      ((profile.roles && profile.roles.includes("student")) ||
                        profile.role === "student"))) &&
                  activeTab === "bookings" && (
                    <Bookings
                      userId={auth.user?.profile.sub}
                      userRole="student"
                      onJoinSession={setActiveSession}
                      onUpcomingSession={setUpcomingSession}
                    />
                  )}

                {/* Show schedule for teachers */}
                {profile &&
                  (activeRole === "teacher" ||
                    (!activeRole &&
                      ((profile.roles && profile.roles.includes("teacher")) ||
                        profile.role === "teacher"))) &&
                  activeTab === "schedule" && <TeacherCalendarSchedule />}

                {/* Show slot creation interface for teachers */}
                {profile &&
                  (activeRole === "teacher" ||
                    (!activeRole &&
                      ((profile.roles && profile.roles.includes("teacher")) ||
                        profile.role === "teacher"))) &&
                  activeTab === "create-slots" && <TeacherSchedule />}

                {/* Admin Panel */}
                {profile &&
                  (activeRole === "admin" ||
                    (!activeRole &&
                      ((profile.roles && profile.roles.includes("admin")) ||
                        profile.role === "admin"))) &&
                  activeTab === "admin" && <AdminPanel profile={profile} />}
              </div>
            </div>
          </div>
        </div>
      </div>
      {renderFooter()}
    </div>
  );
}

export default App;
