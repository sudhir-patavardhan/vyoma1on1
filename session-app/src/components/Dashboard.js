import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import { 
  FaCalendarAlt, 
  FaSearch, 
  FaVideo, 
  FaChalkboardTeacher, 
  FaBookOpen,
  FaUserEdit,
  FaGraduationCap
} from "react-icons/fa";
import "../styles.css";

const Dashboard = ({ profile, onTabChange, onJoinSession, upcomingSession }) => {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentBookings, setRecentBookings] = useState([]);
  const [availabilitySlots, setAvailabilitySlots] = useState([]);
  const [showCompletedSessions, setShowCompletedSessions] = useState(false);
  const [completedBookings, setCompletedBookings] = useState([]);
  const [stats, setStats] = useState({
    totalBookings: 0,
    upcomingBookings: 0,
    completedSessions: 0,
  });

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch bookings
      const userParam = profile.role === "student" ? "student_id" : "teacher_id";
      const bookingsResponse = await axios.get(
        `${API_BASE_URL}/bookings?${userParam}=${profile.user_id}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      const now = new Date();
      
      // Filter out past bookings and sort by date (closest upcoming first)
      const upcomingBookings = bookingsResponse.data
        .filter(booking => new Date(booking.start_time) > now && booking.status !== 'cancelled')
        .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      // Get the current and upcoming bookings for the dashboard
      setRecentBookings(upcomingBookings.slice(0, 3));
      
      // Calculate stats
      const completedBookings = bookingsResponse.data.filter(booking => 
        new Date(booking.end_time) < now || booking.status === 'cancelled'
      );
      
      setStats({
        totalBookings: bookingsResponse.data.length,
        upcomingBookings: upcomingBookings.length,
        completedSessions: completedBookings.length,
      });
      
      // For teachers, also fetch availability slots
      if (profile.role === "teacher") {
        const availabilityResponse = await axios.get(
          `${API_BASE_URL}/availability?teacher_id=${profile.user_id}`,
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
            },
          }
        );
        
        // Show only available slots and sort by date (future only)
        const availableSlots = availabilityResponse.data
          .filter(slot => slot.status === "available" && new Date(slot.start_time) > now)
          .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
        
        setAvailabilitySlots(availableSlots.slice(0, 3));
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
      setError("Failed to load dashboard data. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString();
  };

  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };
  
  const canJoinSession = (startTime, endTime) => {
    const now = new Date();
    const sessionStart = new Date(startTime);
    const sessionEnd = new Date(endTime);
    
    // Allow joining 15 minutes before start time until end time
    const bufferTime = new Date(sessionStart);
    bufferTime.setMinutes(bufferTime.getMinutes() - 15);
    
    return now >= bufferTime && now <= sessionEnd;
  };
  
  const joinSession = async (bookingId) => {
    try {
      // First check if a session already exists for this booking
      const response = await axios.get(
        `${API_BASE_URL}/bookings/${bookingId}/session`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      let sessionId;
      
      // If session exists, use it
      if (response.data && response.data.session_id) {
        sessionId = response.data.session_id;
      } else if (response.data && response.data.booking_id && response.data.session_exists === false) {
        // Valid booking but no session - create one
        const booking = recentBookings.find(b => b.booking_id === bookingId);
        
        console.log("Creating new session for booking:", bookingId);
        const createResponse = await axios.post(
          `${API_BASE_URL}/sessions`,
          {
            booking_id: bookingId,
            teacher_id: booking.teacher_id,
            student_id: booking.student_id,
            topic: booking.topic,
          },
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        sessionId = createResponse.data.session_id;
      } else {
        // Unexpected response - create a session to be safe
        console.warn("Unexpected response when checking for session, creating new one", response.data);
        const booking = recentBookings.find(b => b.booking_id === bookingId);
        
        const createResponse = await axios.post(
          `${API_BASE_URL}/sessions`,
          {
            booking_id: bookingId,
            teacher_id: booking.teacher_id,
            student_id: booking.student_id,
            topic: booking.topic,
          },
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
              "Content-Type": "application/json",
            },
          }
        );
        
        sessionId = createResponse.data.session_id;
      }
      
      // Update the parent component with the session ID
      if (onJoinSession) {
        onJoinSession(sessionId);
      }
    } catch (err) {
      console.error("Error joining session:", err);
      setError("Failed to join the session. Please try again.");
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard data...</div>;
  }

  useEffect(() => {
    if (showCompletedSessions) {
      fetchCompletedSessions();
    }
  }, [showCompletedSessions, auth.user, profile]);
  
  // Fetch completed sessions
  const fetchCompletedSessions = async () => {
    try {
      const userParam = profile.role === "student" ? "student_id" : "teacher_id";
      const response = await axios.get(
        `${API_BASE_URL}/bookings?${userParam}=${profile.user_id}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      const now = new Date();
      const completed = response.data
        .filter(booking => new Date(booking.end_time) < now || booking.status === 'cancelled')
        .sort((a, b) => new Date(b.start_time) - new Date(a.start_time))
        .slice(0, 5);
      
      setCompletedBookings(completed);
    } catch (err) {
      console.error("Error fetching completed sessions:", err);
    }
  };
  
  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <h1>Welcome, {profile.name || profile.user_id}!</h1>
        <p className="user-role">You are signed in as a {profile.role}</p>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="dashboard-content">
        <div className="dashboard-main">
          {/* Upcoming Sessions Section - Primary Focus */}
          <div className="dashboard-bookings">
            <div className="section-header">
              <h2>{profile.role === "student" ? "Your Upcoming Sessions" : "Your Upcoming Classes"}</h2>
              <button 
                className="btn-link"
                onClick={() => onTabChange(profile.role === "student" ? 'bookings' : 'schedule')}
              >
                View All
              </button>
            </div>
            
            {recentBookings.length > 0 ? (
              <>
                <div className="recent-bookings">
                  {recentBookings.map((booking) => {
                    const isJoinable = canJoinSession(booking.start_time, booking.end_time);
                    
                    return (
                      <div 
                        key={booking.booking_id} 
                        className={`booking-card ${isJoinable ? 'joinable' : 'upcoming'}`}
                      >
                        <div className="booking-header">
                          <h3>{booking.topic}</h3>
                          <span className={`status-badge ${booking.status}`}>{booking.status}</span>
                        </div>
                        
                        <div className="booking-details">
                          <p>
                            <strong>Date:</strong> {formatDate(booking.start_time)}
                          </p>
                          <p>
                            <strong>Time:</strong> {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                          </p>
                          
                          {profile.role === "student" && (
                            <p>
                              <strong>Teacher:</strong> {booking.teacher_name || "Your Teacher"}
                            </p>
                          )}
                          
                          {profile.role === "teacher" && (
                            <p>
                              <strong>Student:</strong> {booking.student_name || "Student"}
                            </p>
                          )}
                        </div>
                        
                        <div className="booking-actions">
                          {isJoinable && (
                            <button 
                              className="btn btn-primary"
                              onClick={() => joinSession(booking.booking_id)}
                            >
                              Join Session
                            </button>
                          )}
                          
                          {!isJoinable && (
                            <div className="session-countdown">
                              Session will be available 15 minutes before start time
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Completed Sessions Toggle Button */}
                {stats.completedSessions > 0 && (
                  <div className="completed-sessions-toggle">
                    <button 
                      className="btn btn-secondary"
                      onClick={() => setShowCompletedSessions(!showCompletedSessions)}
                    >
                      {showCompletedSessions ? 
                        <><span role="img" aria-label="hide">🔼</span> Hide Completed Sessions</> : 
                        <><span role="img" aria-label="view">🔽</span> View Completed Sessions ({stats.completedSessions})</>}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="no-bookings">
                <p>You don't have any upcoming sessions.</p>
                {profile.role === "student" && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => onTabChange('search')}
                  >
                    Find Teachers
                  </button>
                )}
                {profile.role === "teacher" && (
                  <button 
                    className="btn btn-primary"
                    onClick={() => onTabChange('schedule')}
                  >
                    Add Availability
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Completed Sessions - Only shown when toggled */}
          {showCompletedSessions && stats.completedSessions > 0 && (
            <div className="dashboard-completed-sessions">
              <div className="section-header">
                <h2>Completed Sessions</h2>
              </div>
              <div className="recent-bookings">
                {completedBookings.map((booking) => (
                  <div 
                    key={booking.booking_id} 
                    className={`booking-card ${booking.status === 'cancelled' ? 'cancelled' : 'past'}`}
                  >
                    <div className="booking-header">
                      <h3>{booking.topic}</h3>
                      <span className={`status-badge ${booking.status}`}>{booking.status}</span>
                    </div>
                    
                    <div className="booking-details">
                      <p>
                        <strong>Date:</strong> {formatDate(booking.start_time)}
                      </p>
                      <p>
                        <strong>Time:</strong> {formatTime(booking.start_time)} - {formatTime(booking.end_time)}
                      </p>
                      
                      {profile.role === "student" && (
                        <p>
                          <strong>Teacher:</strong> {booking.teacher_name || "Your Teacher"}
                        </p>
                      )}
                      
                      {profile.role === "teacher" && (
                        <p>
                          <strong>Student:</strong> {booking.student_name || "Student"}
                        </p>
                      )}
                    </div>
                    
                    <div className="booking-actions">
                      <div className="session-past">
                        {booking.status === 'cancelled' ? 'This session was cancelled' : 'This session has ended'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* For Teachers - Availability Slots */}
          {profile.role === "teacher" && (
            <div className="dashboard-availability">
              <div className="section-header">
                <h2>Your Available Time Slots</h2>
                <button 
                  className="btn-link"
                  onClick={() => onTabChange('schedule')}
                >
                  Manage
                </button>
              </div>
              
              {availabilitySlots.length > 0 ? (
                <div className="slots-container">
                  {availabilitySlots.map((slot) => (
                    <div key={slot.availability_id} className="slot-card available">
                      <div className="slot-header">
                        <h4>{slot.topic}</h4>
                        <span className="status-badge available">Available</span>
                      </div>
                      
                      <div className="slot-details">
                        <p><strong>Date:</strong> {formatDate(slot.start_time)}</p>
                        <p><strong>Time:</strong> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                        {slot.description && <p><strong>Description:</strong> {slot.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="no-slots">
                  <p>You don't have any available time slots.</p>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => onTabChange('schedule')}
                  >
                    Add Availability
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        
        <div className="dashboard-sidebar">
          {/* Next Action Card - Most Important */}
          {upcomingSession && (
            <div className="next-action-card">
              <h3>Ready to Start</h3>
              <p>You have a session that's ready to join!</p>
              <button 
                className="btn btn-primary full-width"
                onClick={() => onJoinSession(upcomingSession)}
              >
                <FaVideo className="btn-icon" />
                Join Your Session Now
              </button>
            </div>
          )}
          
          {/* Stats Section */}
          <div className="sidebar-card">
            <h3>Your Stats</h3>
            <div className="dashboard-stats">
              <div className="stat-item">
                <div className="stat-icon">
                  <FaBookOpen />
                </div>
                <div className="stat-details">
                  <p className="stat-label">Total {profile.role === "teacher" ? "Classes" : "Bookings"}</p>
                  <p className="stat-value">{stats.totalBookings}</p>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">
                  <FaCalendarAlt />
                </div>
                <div className="stat-details">
                  <p className="stat-label">Upcoming</p>
                  <p className="stat-value">{stats.upcomingBookings}</p>
                </div>
              </div>
              
              <div className="stat-item">
                <div className="stat-icon">
                  <FaVideo />
                </div>
                <div className="stat-details">
                  <p className="stat-label">Completed</p>
                  <p className="stat-value">{stats.completedSessions}</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="sidebar-card">
            <h3>Quick Actions</h3>
            <div className="sidebar-actions">
              <button 
                className="action-button"
                onClick={() => onTabChange('profile')}
              >
                <FaUserEdit className="action-icon" />
                <span>Edit Profile</span>
              </button>
              
              {profile.role === "student" && (
                <button 
                  className="action-button"
                  onClick={() => onTabChange('search')}
                >
                  <FaSearch className="action-icon" />
                  <span>Find Teachers</span>
                </button>
              )}
              
              {profile.role === "student" && (
                <button 
                  className="action-button"
                  onClick={() => onTabChange('bookings')}
                >
                  <FaBookOpen className="action-icon" />
                  <span>View All Classes</span>
                </button>
              )}
              
              {profile.role === "teacher" && (
                <button 
                  className="action-button"
                  onClick={() => onTabChange('schedule')}
                >
                  <FaChalkboardTeacher className="action-icon" />
                  <span>Manage Schedule</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;