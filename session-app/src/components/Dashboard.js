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
      
      // Sort by date (most recent first)
      const sortedBookings = bookingsResponse.data.sort((a, b) => {
        return new Date(b.start_time) - new Date(a.start_time);
      });
      
      // Get only the most recent 3 bookings for the dashboard
      setRecentBookings(sortedBookings.slice(0, 3));
      
      // Calculate stats
      const now = new Date();
      const upcoming = sortedBookings.filter(booking => new Date(booking.start_time) > now);
      const completed = sortedBookings.filter(booking => new Date(booking.end_time) < now);
      
      setStats({
        totalBookings: sortedBookings.length,
        upcomingBookings: upcoming.length,
        completedSessions: completed.length,
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
        
        // Show only available slots and sort by date
        const availableSlots = availabilityResponse.data
          .filter(slot => slot.status === "available")
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
      } else {
        // Create a new session for this booking
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

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome, {profile.name || profile.user_id}!</h1>
        <p className="user-role">You are signed in as a {profile.role}</p>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {/* Stats Section */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon">
            <FaBookOpen />
          </div>
          <div className="stat-details">
            <h3>Total {profile.role === "teacher" ? "Classes" : "Bookings"}</h3>
            <p className="stat-value">{stats.totalBookings}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FaCalendarAlt />
          </div>
          <div className="stat-details">
            <h3>Upcoming</h3>
            <p className="stat-value">{stats.upcomingBookings}</p>
          </div>
        </div>
        
        <div className="stat-card">
          <div className="stat-icon">
            <FaVideo />
          </div>
          <div className="stat-details">
            <h3>Completed</h3>
            <p className="stat-value">{stats.completedSessions}</p>
          </div>
        </div>
      </div>
      
      {/* Quick Actions */}
      <div className="dashboard-actions">
        <h2>Quick Actions</h2>
        <div className="action-buttons">
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
          
          {upcomingSession && (
            <button 
              className="action-button primary"
              onClick={() => onJoinSession(upcomingSession)}
            >
              <FaVideo className="action-icon" />
              <span>Join Next Session</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Recent Bookings/Classes */}
      <div className="dashboard-recent">
        <div className="section-header">
          <h2>{profile.role === "student" ? "Your Recent Bookings" : "Your Upcoming Classes"}</h2>
          <button 
            className="btn-link"
            onClick={() => onTabChange(profile.role === "student" ? 'bookings' : 'schedule')}
          >
            View All
          </button>
        </div>
        
        {recentBookings.length > 0 ? (
          <div className="recent-bookings">
            {recentBookings.map((booking) => {
              const isJoinable = canJoinSession(booking.start_time, booking.end_time);
              const isPast = new Date(booking.end_time) < new Date();
              
              return (
                <div 
                  key={booking.booking_id} 
                  className={`booking-card ${isPast ? 'past' : isJoinable ? 'joinable' : ''}`}
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
                    
                    {!isJoinable && !isPast && (
                      <div className="session-countdown">
                        Session will be available 15 minutes before start time
                      </div>
                    )}
                    
                    {isPast && (
                      <div className="session-past">
                        This session has ended
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="no-bookings">
            <p>You don't have any bookings yet.</p>
            {profile.role === "student" && (
              <button 
                className="btn btn-secondary"
                onClick={() => onTabChange('search')}
              >
                Find Teachers
              </button>
            )}
            {profile.role === "teacher" && (
              <button 
                className="btn btn-secondary"
                onClick={() => onTabChange('schedule')}
              >
                Add Availability
              </button>
            )}
          </div>
        )}
      </div>
      
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
  );
};

export default Dashboard;