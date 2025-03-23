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
    color: #8a6d3b;
    text-decoration: underline;
  }

  .profile-prompt {
    margin-bottom: 20px;
    border-radius: 8px;
    background-color: rgba(198, 161, 71, 0.1);
    border-color: #c6a147;
  }

  .profile-prompt h4 {
    color: #8a6d3b;
    margin-bottom: 10px;
  }

  .profile-prompt a {
    color: #c6a147;
    font-weight: bold;
    text-decoration: underline;
  }

  .text-link {
    background: none;
    border: none;
    color: #8a6d3b;
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

  // Clear any old OIDC cache on app initialization and handle post-login redirect
  useEffect(() => {
    // Check if we've just completed authentication
    const authCompleted = sessionStorage.getItem("auth_completed");
    if (authCompleted === "true" && auth.isAuthenticated) {
      console.log("Auth completed, redirecting to dashboard");
      setActiveTab("dashboard");
      // Remove the flag so we don't keep redirecting
      sessionStorage.removeItem("auth_completed");
    }
  }, [auth.isAuthenticated]);

  // For users with multiple roles
  const [activeRole, setActiveRole] = useState(null);
  const [showRoleSwitcher, setShowRoleSwitcher] = useState(false);

  // Backward compatibility with existing code
  const clientId = "12s8brrk9144uq23g3951mfvhl";
  const redirectUri = "https://yoursanskritteacher.com";
  const cognitoDomain = "https://auth.yoursanskritteacher.com";

  const signOutRedirect = async () => {
    // Construct the logout URL with AWS Cognito format
    const logoutURL = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      redirectUri
    )}&post_logout_redirect_uri=${encodeURIComponent(redirectUri)}`;

    try {
      // Clear local auth state
      await auth.removeUser(); // Removes the user session from oidc-context

      // Redirect to Cognito logout endpoint
      window.location.href = logoutURL;
    } catch (error) {
      console.error("Error during signout:", error);
    }
  };

  // Function to redirect users directly to the signup page
  const signupRedirect = () => {
    // Construct the signup URL using the Cognito Hosted UI
    const signupURL = `${cognitoDomain}/signup?client_id=${clientId}&response_type=code&scope=email+openid+phone&redirect_uri=${encodeURIComponent(
      redirectUri
    )}`;

    // Log for debugging
    console.log("Signup URL:", signupURL);
    console.log("Cognito domain:", cognitoDomain);
    console.log("Client ID:", clientId);
    console.log("Redirect URI:", redirectUri);

    // Redirect directly to Cognito signup page
    window.location.href = signupURL;
  };

  const renderHeader = () => (
    <header className="header">
      <div
        className="header-logo"
        onClick={() =>
          auth.isAuthenticated ? setActiveTab("dashboard") : null
        }
        style={{ cursor: "pointer" }}
      >
        <img
          src="/vyoma/premium-logo.svg"
          alt="Sanskrit Teacher Logo"
          className="header-logo-full"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/vyoma/vyoma-logo.svg"; // Fallback to original SVG if new logo doesn't exist
          }}
        />
        <span className="app-name">Sanskrit Teacher</span>
      </div>
      <nav className="header-nav">
        {!auth.isAuthenticated ? (
          <>
            <button
              className="header-link"
              onClick={() => auth.signinRedirect()}
            >
              <FaSignInAlt className="header-icon" /> Sign In
            </button>
            <button className="header-link" onClick={signupRedirect}>
              <FaUserPlus className="header-icon" /> Sign Up
            </button>
          </>
        ) : (
          <>
            {/* Dashboard button */}
            <button
              className={`header-link ${
                activeTab === "dashboard" ? "active" : ""
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              <FaHome className="header-icon" /> Dashboard
            </button>

            {/* Profile button */}
            <button
              className={`header-link ${
                activeTab === "profile" ? "active" : ""
              }`}
              onClick={() => setActiveTab("profile")}
            >
              <FaUserCircle className="header-icon" />{" "}
              {profile?.name || "Profile"}
            </button>

            {/* Role Switcher for multi-role users */}
            {profile && profile.roles && profile.roles.length > 1 && (
              <div className="role-switcher-container">
                <button
                  className="header-link role-switcher-btn"
                  onClick={() => setShowRoleSwitcher(!showRoleSwitcher)}
                >
                  <FaExchangeAlt className="header-icon" />
                  {activeRole
                    ? `${activeRole.charAt(0).toUpperCase()}${activeRole.slice(
                        1
                      )} Mode`
                    : "Switch Role"}
                </button>

                {showRoleSwitcher && (
                  <div className="role-switcher-dropdown">
                    {profile.roles.map((role) => (
                      <button
                        key={role}
                        className={`role-option ${
                          activeRole === role ? "active" : ""
                        }`}
                        onClick={() => {
                          setActiveRole(role);
                          setShowRoleSwitcher(false);
                          // When switching roles, go to dashboard
                          setActiveTab("dashboard");
                        }}
                      >
                        {role === "student" && (
                          <FaUser className="role-icon-small" />
                        )}
                        {role === "teacher" && (
                          <FaGraduationCap className="role-icon-small" />
                        )}
                        {role === "admin" && (
                          <FaLock className="role-icon-small" />
                        )}
                        {role.charAt(0).toUpperCase() + role.slice(1)}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Only show these buttons if profile is loaded and has appropriate role */}
            {profile &&
              (activeRole === "student" ||
                (!activeRole &&
                  ((profile.roles && profile.roles.includes("student")) ||
                    profile.role === "student"))) && (
                <button
                  className={`header-link ${
                    activeTab === "search" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("search")}
                >
                  <FaSearch className="header-icon" /> Find Teachers
                </button>
              )}

            {profile &&
              (activeRole === "student" ||
                (!activeRole &&
                  ((profile.roles && profile.roles.includes("student")) ||
                    profile.role === "student"))) && (
                <button
                  className={`header-link ${
                    activeTab === "bookings" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("bookings")}
                >
                  <FaBookOpen className="header-icon" /> My Classes
                </button>
              )}

            {profile &&
              (activeRole === "teacher" ||
                (!activeRole &&
                  ((profile.roles && profile.roles.includes("teacher")) ||
                    profile.role === "teacher"))) && (
                <button
                  className={`header-link ${
                    activeTab === "schedule" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("schedule")}
                >
                  <FaCalendarAlt className="header-icon" /> My Schedule
                </button>
              )}

            {profile && upcomingSession && (
              <button
                className="header-link join-session"
                onClick={() => setActiveSession(upcomingSession)}
              >
                <FaVideo className="header-icon" /> Join Session
              </button>
            )}

            {/* Admin Panel button - visible to users with admin role */}
            {profile &&
              (activeRole === "admin" ||
                (!activeRole &&
                  ((profile.roles && profile.roles.includes("admin")) ||
                    profile.role === "admin"))) && (
                <button
                  className={`header-link ${
                    activeTab === "admin" ? "active" : ""
                  }`}
                  onClick={() => setActiveTab("admin")}
                >
                  <FaLock className="header-icon" /> Admin
                </button>
              )}

            <button className="header-link" onClick={signOutRedirect}>
              <FaSignOutAlt className="header-icon" /> Sign Out
            </button>
          </>
        )}
      </nav>
    </header>
  );

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

  // Define the footer render function early
  const renderFooter = () => (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <img
              src="/vyoma/premium-logo.svg"
              alt="Sanskrit Teacher"
              height="40"
              onError={(e) => {
                e.target.onerror = null;
                e.target.src = "/vyoma/vyoma-logo.svg";
              }}
            />
            <span>Sanskrit Teacher</span>
          </div>
          <div className="footer-links">
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact Us</a>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} Sanskrit Teacher. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );

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
                    <h1 className="landing-heading">
                      Welcome to Sanskrit Teacher
                    </h1>
                    <h2 className="landing-subheading">
                      Premium Sanskrit Instruction by PhD Scholars
                    </h2>
                    <p className="landing-text">
                      Connect with world-class Sanskrit scholars for exclusive,
                      personalized 1:1 learning experiences. Our platform
                      features PhD-holding experts specializing in rare and
                      advanced Sanskrit topics, offering premium instruction for
                      discerning international students and serious
                      practitioners.
                    </p>
                    <div className="landing-features">
                      <div className="feature">
                        <FaSearch className="feature-icon" />
                        <h3>Elite Instructors</h3>
                        <p>
                          Access PhD-level Sanskrit scholars specializing in
                          rare and advanced topics
                        </p>
                      </div>
                      <div className="feature">
                        <FaCalendarAlt className="feature-icon" />
                        <h3>Exclusive Sessions</h3>
                        <p>
                          Book personalized instruction tailored to your
                          specific scholarly interests
                        </p>
                      </div>
                      <div className="feature">
                        <FaVideo className="feature-icon" />
                        <h3>Premium Experience</h3>
                        <p>
                          Enjoy high-quality video sessions with advanced
                          learning tools and resources
                        </p>
                      </div>
                      <div className="feature">
                        <FaGraduationCap className="feature-icon" />
                        <h3>Academic Excellence</h3>
                        <p>
                          Achieve mastery through instruction aligned with
                          prestigious academic standards
                        </p>
                      </div>
                    </div>
                    <div className="text-center landing-buttons">
                      <button
                        className="btn btn-primary btn-lg"
                        onClick={() => auth.signinRedirect()}
                      >
                        Begin Your Sanskrit Journey
                      </button>
                      <button
                        className="btn btn-secondary btn-lg"
                        onClick={signupRedirect}
                      >
                        Create Student Account
                      </button>
                    </div>
                    <p className="premium-note">
                      Premium Sanskrit instruction with verified PhD scholars
                    </p>
                    <p className="teacher-link">
                      <small>
                        Are you a Sanskrit teacher?{" "}
                        <a
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            signupRedirect();
                          }}
                        >
                          Sign up
                        </a>{" "}
                        and select the teacher option in your profile.
                      </small>
                    </p>
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
        {renderFooter()}
      </div>
    );
  }

  if (auth.error) {
    console.error("Authentication error:", auth.error);
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
                    {auth.error.message ||
                      "There was a problem with your authentication"}
                  </div>
                  <button
                    className="btn btn-primary"
                    onClick={() => auth.signinRedirect()}
                  >
                    Try Signing In Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
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
