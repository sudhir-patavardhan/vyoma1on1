import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import ProfileForm from "./components/ProfileForm";
import TeacherSearch from "./components/TeacherSearch";
import TeacherSchedule from "./components/TeacherSchedule";
import VirtualSession from "./components/VirtualSession";
import Bookings from "./components/Bookings";
import Dashboard from "./components/Dashboard";
import { API_BASE_URL } from "./config";
import "./styles.css";
import {
  FaSearch,
  FaSignInAlt,
  FaSignOutAlt,
  FaUserCircle,
  FaBookOpen,
  FaCalendarAlt,
  FaVideo,
  FaHome,
} from "react-icons/fa"; // Import icons

function App() {
  const auth = useAuth();

  // Initialize with loading state
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [activeSession, setActiveSession] = useState(null);
  const [upcomingSession, setUpcomingSession] = useState(null);

  const signoutRedirect = async () => {
    const clientId = "2fpemjqos4302bfaf65g06l8g0"; // Cognito App Client ID
    const logoutUri = "https://sessions.red"; // Post-logout redirect URI
    const cognitoDomain = "https://auth.sessions.red"; // Cognito domain

    // Construct the logout URL with the post-logout redirect URI
    const logoutURL = `${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(
      logoutUri
    )}&post_logout_redirect_uri=${encodeURIComponent(logoutUri)}`;

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

  const renderHeader = () => (
    <header className="header">
      <div 
        className="header-logo"
        onClick={() => auth.isAuthenticated ? setActiveTab('dashboard') : null}
        style={{ cursor: 'pointer' }}
      >
        <img
          src="/vyoma/Vyoma_Logo_Blue_500x243.png"
          alt="Vyoma 1:1 Logo"
          className="header-logo-full"
          onError={(e) => {
            e.target.onerror = null;
            e.target.src = "/logo.jpeg"; // Fallback if PNG doesn't exist
          }}
        />
        <span className="app-name">1:1</span>
      </div>
      <nav className="header-nav">
        {!auth.isAuthenticated ? (
          <button className="header-link" onClick={() => auth.signinRedirect()}>
            <FaSignInAlt className="header-icon" /> Sign In
          </button>
        ) : (
          <>
            {/* Dashboard button */}
            <button
              className={`header-link ${activeTab === 'dashboard' ? 'active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <FaHome className="header-icon" /> Dashboard
            </button>
            
            {/* Profile button */}
            <button
              className={`header-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <FaUserCircle className="header-icon" /> {profile?.name || 'Profile'}
            </button>
            
            {/* Only show these buttons if profile is loaded and has a role */}
            {profile && profile.role === "student" && (
              <button
                className={`header-link ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                <FaSearch className="header-icon" /> Find Teachers
              </button>
            )}
            
            {profile && profile.role === "student" && (
              <button
                className={`header-link ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                <FaBookOpen className="header-icon" /> My Classes
              </button>
            )}
            
            {profile && profile.role === "teacher" && (
              <button
                className={`header-link ${activeTab === 'schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedule')}
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
            
            <button className="header-link" onClick={signoutRedirect}>
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
                  {(!profile || activeTab === 'profile') && (
                    <ProfileForm
                      saveUserProfile={saveUserProfile}
                      profile={profile}
                    />
                  )}
                  
                  {profile && activeTab === 'dashboard' && (
                    <Dashboard
                      profile={profile}
                      onTabChange={setActiveTab}
                      onJoinSession={setActiveSession}
                      upcomingSession={upcomingSession}
                    />
                  )}
                  
                  {profile?.role === "student" && activeTab === 'search' && (
                    <TeacherSearch />
                  )}
                  
                  {profile?.role === "student" && activeTab === 'bookings' && (
                    <Bookings 
                      userId={auth.user?.profile.sub} 
                      userRole="student"
                      onJoinSession={setActiveSession}
                      onUpcomingSession={setUpcomingSession}
                    />
                  )}
                  
                  {profile?.role === "teacher" && activeTab === 'schedule' && (
                    <TeacherSchedule />
                  )}
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
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error("Profile error response:", errorText);
            throw new Error(`Profile fetch failed with status: ${response.status}`);
          }
          
          let data;
          try {
            const responseText = await response.text();
            console.log("Raw response:", responseText);
            
            // Check if response starts with HTML doctype
            if (responseText.trim().toLowerCase().startsWith('<!doctype')) {
              console.error("Received HTML instead of JSON");
              throw new Error("API returned HTML instead of JSON. The server might be down or misconfigured.");
            }
            
            // Try to parse JSON
            data = JSON.parse(responseText);
            console.log("Profile response:", data);
          } catch (parseError) {
            console.error("JSON parse error:", parseError);
            throw new Error(`Failed to parse profile data: ${parseError.message}`);
          }
          
          if (data && data.profile) {
            setProfile(data.profile);
            
            // Check for upcoming sessions
            checkUpcomingSessions(userId, data.profile.role);
          } else {
            console.log("No profile found, showing profile form");
            setProfile(null); // No profile found, trigger profile form
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
        console.log("Not authenticated or missing user data, skipping profile fetch");
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
      const userType = role === 'student' ? 'student_id' : 'teacher_id';
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
        throw new Error(`Failed to fetch bookings: ${response.status} ${response.statusText}`);
      }
      
      let bookings;
      try {
        const responseText = await response.text();
        console.log("Raw bookings response:", responseText);
        
        // Check for HTML response
        if (responseText.trim().toLowerCase().startsWith('<!doctype')) {
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
      
      const upcoming = bookings.find(booking => {
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
    if (!auth.isAuthenticated || !auth.user || !auth.user.profile || !auth.user.profile.sub) {
      const error = new Error("You must be signed in to save a profile");
      console.error(error);
      throw error;
    }

    try {
      console.log("Saving profile for user:", auth.user.profile.sub);
      
      const response = await fetch(
        `${API_BASE_URL}/profiles`,
        {
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
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Server error response:", errorText);
        throw new Error(`Failed to save profile: ${response.status} ${response.statusText}`);
      }

      let result;
      try {
        const responseText = await response.text();
        console.log("Raw save profile response:", responseText);
        
        // Check if response starts with HTML doctype
        if (responseText.trim().toLowerCase().startsWith('<!doctype')) {
          console.error("Received HTML instead of JSON in profile save");
          throw new Error("API returned HTML instead of JSON. The server might be down or misconfigured.");
        }
        
        // Try to parse JSON
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error("JSON parse error in profile save:", parseError);
        throw new Error(`Failed to parse profile save response: ${parseError.message}`);
      }
      console.log("Profile successfully created:", result);
      
      // Update the profile state
      setProfile(profileData); 
      
      // Set to dashboard after creating profile
      setActiveTab('dashboard');
      
      return result;
    } catch (error) {
      console.error("Error saving profile:", error);
      throw error; // Re-throw to allow the ProfileForm to handle it
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body">
                  <h1 className="landing-heading">Welcome to Vyoma 1:1</h1>
                  <p className="landing-text">
                    Connect with expert Sanskrit teachers for personalized 1:1 learning experiences.
                    Our platform helps students find teachers based on their learning needs,
                    schedule sessions, and attend virtual meetings - all in one place.
                  </p>
                  <div className="landing-features">
                    <div className="feature">
                      <FaSearch className="feature-icon" />
                      <h3>Find Teachers</h3>
                      <p>Search for teachers by subject or topic</p>
                    </div>
                    <div className="feature">
                      <FaCalendarAlt className="feature-icon" />
                      <h3>Schedule Sessions</h3>
                      <p>Book convenient time slots with your chosen teacher</p>
                    </div>
                    <div className="feature">
                      <FaVideo className="feature-icon" />
                      <h3>Virtual Learning</h3>
                      <p>Join video sessions, share notes, and learn interactively</p>
                    </div>
                  </div>
                  <div className="text-center">
                    <button className="btn btn-primary btn-lg" onClick={() => auth.signinRedirect()}>
                      Sign In to Get Started
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
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
                      {loadingProfile && auth.isAuthenticated ? "Loading your profile..." : "Authenticating..."}
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
                    {auth.error.message || "There was a problem with your authentication"}
                  </div>
                  <button className="btn btn-primary" onClick={() => auth.signinRedirect()}>
                    Try Signing In Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  if (profileError) {
    console.error("Profile error:", profileError);
    
    // Check if the error message indicates an HTML response
    const isServerDown = profileError.includes("HTML instead of JSON") || 
                          profileError.includes("Failed to parse profile data");
    
    return (
      <div className="app-layout">
        {renderHeader()}
        <div className="main-content">
          <div className="content-area">
            <div className="container">
              <div className="card">
                <div className="card-body text-center">
                  <h2 className="text-warning mb-4">
                    {isServerDown ? "API Server Error" : "Profile Error"}
                  </h2>
                  <div className="error-message mb-4">
                    {isServerDown ? (
                      <>
                        <p><strong>Our API server appears to be down or misconfigured.</strong></p>
                        <p>We're experiencing technical difficulties connecting to our servers. Please try again later.</p>
                        <p className="text-muted small">Technical details: {profileError}</p>
                      </>
                    ) : (
                      profileError
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
                      <p>You can continue by creating a new profile</p>
                      <div className="mt-4">
                        <ProfileForm
                          saveUserProfile={saveUserProfile}
                          profile={null}
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const renderFooter = () => (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <img 
              src="/vyoma/Vyoma_Logo_Blue_500x243.png" 
              alt="Vyoma 1:1" 
              height="30"
            />
            <span>1:1</span>
          </div>
          <div className="footer-links">
            <a href="#">Terms of Service</a>
            <a href="#">Privacy Policy</a>
            <a href="#">Contact Us</a>
          </div>
          <div className="footer-copyright">
            © {new Date().getFullYear()} Vyoma Learning, Inc. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );

  return (
    <>
      {renderContent()}
      {renderFooter()}
    </>
  );
}

export default App;
