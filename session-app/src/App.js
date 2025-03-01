import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import ProfileForm from "./components/ProfileForm";
import TeacherSearch from "./components/TeacherSearch";
import TeacherSchedule from "./components/TeacherSchedule";
import VirtualSession from "./components/VirtualSession";
import Bookings from "./components/Bookings";
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
  FaChalkboardTeacher,
} from "react-icons/fa"; // Import icons

function App() {
  const auth = useAuth();

  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('profile');
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
      <div className="header-logo">
        <img
          src="/logo.jpeg"
          alt="Expert Sessions Logo"
          className="header-logo-image"
        />
        <span className="header-title">Expert Sessions</span>
      </div>
      <nav className="header-nav">
        {!auth.isAuthenticated ? (
          <button className="header-link" onClick={() => auth.signinRedirect()}>
            <FaSignInAlt className="header-icon" /> Sign In
          </button>
        ) : (
          <>
            <button
              className={`header-link ${activeTab === 'profile' ? 'active' : ''}`}
              onClick={() => setActiveTab('profile')}
            >
              <FaUserCircle className="header-icon" /> {profile.name}
            </button>
            
            {profile?.role === "student" && (
              <button
                className={`header-link ${activeTab === 'search' ? 'active' : ''}`}
                onClick={() => setActiveTab('search')}
              >
                <FaSearch className="header-icon" /> Find Teachers
              </button>
            )}
            
            {profile?.role === "student" && (
              <button
                className={`header-link ${activeTab === 'bookings' ? 'active' : ''}`}
                onClick={() => setActiveTab('bookings')}
              >
                <FaBookOpen className="header-icon" /> My Classes
              </button>
            )}
            
            {profile?.role === "teacher" && (
              <button
                className={`header-link ${activeTab === 'schedule' ? 'active' : ''}`}
                onClick={() => setActiveTab('schedule')}
              >
                <FaCalendarAlt className="header-icon" /> My Schedule
              </button>
            )}
            
            {upcomingSession && (
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
        <div>
          {renderHeader()}
          <div className="container full-width">
            <VirtualSession 
              sessionId={activeSession} 
              onEndSession={() => setActiveSession(null)} 
            />
          </div>
        </div>
      );
    }

    // Normal content based on active tab
    return (
      <div>
        {renderHeader()}
        <div className="container">
          <div className="card">
            {(!profile || activeTab === 'profile') && (
              <ProfileForm
                saveUserProfile={saveUserProfile}
                profile={profile}
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
    );
  };

  useEffect(() => {
    const fetchUserProfile = async () => {
      if (auth.isAuthenticated) {
        try {
          const userId = auth.user.profile.sub; // Ensure this exists
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
          const data = await response.json();
          if (response.ok && data.profile) {
            setProfile(data.profile);
            
            // Check for upcoming sessions
            checkUpcomingSessions(userId, data.profile.role);
          } else {
            setProfile(null); // No profile found, trigger profile form
          }
        } catch (error) {
          console.error("Error fetching profile:", error);
        } finally {
          setLoadingProfile(false);
        }
      }
    };

    fetchUserProfile();
  }, [auth.isAuthenticated]);
  
  const checkUpcomingSessions = async (userId, role) => {
    try {
      // Fetch bookings for the user
      const userType = role === 'student' ? 'student_id' : 'teacher_id';
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
      
      if (response.ok) {
        const bookings = await response.json();
        
        // Check for upcoming sessions (within 15 minutes from now)
        const now = new Date();
        const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
        
        const upcoming = bookings.find(booking => {
          const startTime = new Date(booking.start_time);
          return startTime > now && startTime < fifteenMinutesFromNow;
        });
        
        if (upcoming) {
          setUpcomingSession(upcoming.session_id);
        }
      }
    } catch (error) {
      console.error("Error checking upcoming sessions:", error);
    }
  };

  const saveUserProfile = async (profileData) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/profiles`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${auth.user.access_token}`,
          },
          body: JSON.stringify({
            user_id: auth.user?.profile.sub,
            role: profileData.role,
            profile_data: profileData,
          }),
        }
      );

      const result = await response.json();
      if (response.ok) {
        console.log("Profile successfully created:", result);
        setProfile(profileData); // Update the profile state
        
        // Set appropriate initial tab based on role
        if (profileData.role === "student") {
          setActiveTab('search');
        } else if (profileData.role === "teacher") {
          setActiveTab('schedule');
        }
      } else {
        console.error("Error saving profile:", result);
      }
    } catch (error) {
      console.error("Error saving profile:", error);
    }
  };

  if (!auth.isAuthenticated) {
    return (
      <div>
        {renderHeader()}
        <div className="container">
          <div className="card">
            <h1 className="landing-heading">Welcome to Expert Sessions</h1>
            <p className="landing-text">
              Connect with expert teachers for personalized 1:1 learning experiences.
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
            <button className="button" onClick={() => auth.signinRedirect()}>
              Sign In to Get Started
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (auth.isLoading || loadingProfile) {
    return (
      <div className="container">
        <div className="card">
          <h2 className="heading">Loading...</h2>
        </div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="container">
        <div className="card">
          <h2 className="heading">Something went wrong!</h2>
          <p className="sub-heading">{auth.error.message}</p>
          <button className="button" onClick={() => auth.signinRedirect()}>
            Try Signing In Again
          </button>
        </div>
      </div>
    );
  }

  return renderContent();
}

export default App;
