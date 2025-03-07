import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";

const Bookings = ({ userId, userRole, onJoinSession, onUpcomingSession }) => {
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBooking, setActiveBooking] = useState(null);
  const [cancellingBooking, setCancellingBooking] = useState(null);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, [userId, userRole]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const userParam = userRole === "student" ? "student_id" : "teacher_id";
      
      const response = await axios.get(
        `${API_BASE_URL}/bookings?${userParam}=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      // Sort by start time (upcoming first, then most recent first)
      const sortedBookings = response.data.sort((a, b) => {
        const aDate = new Date(a.start_time);
        const bDate = new Date(b.start_time);
        const now = new Date();
        
        // If both dates are in the future, sort by nearest first
        if (aDate > now && bDate > now) {
          return aDate - bDate;
        }
        
        // If both are in the past, sort most recent first
        if (aDate <= now && bDate <= now) {
          return bDate - aDate;
        }
        
        // Future dates come before past dates
        return aDate > now ? -1 : 1;
      });
      
      setBookings(sortedBookings);
      
      // Check for upcoming sessions and notify parent component
      checkUpcomingSessions(sortedBookings);
    } catch (err) {
      console.error("Error fetching bookings:", err);
      setError("Failed to load your bookings. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  
  // Function to cancel a booking
  const cancelBooking = async (bookingId) => {
    try {
      // Ask for confirmation before cancelling
      if (!window.confirm("Are you sure you want to cancel this booking? This action cannot be undone.")) {
        return;
      }
      
      setCancellingBooking(bookingId);
      
      // Call API to cancel the booking
      await axios.put(
        `${API_BASE_URL}/bookings/${bookingId}`,
        {
          status: "cancelled"
        },
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          }
        }
      );
      
      // Update the local state
      setBookings(prevBookings => 
        prevBookings.map(booking => 
          booking.booking_id === bookingId 
            ? {...booking, status: "cancelled"} 
            : booking
        )
      );
      
      // Show success message
      setError(""); // Clear any existing errors
      // You could add a success message state here if desired
      
    } catch (err) {
      console.error("Error cancelling booking:", err);
      setError("Failed to cancel the booking. Please try again.");
    } finally {
      setCancellingBooking(null);
    }
  };
  
  const checkUpcomingSessions = (bookingsList) => {
    // Check for upcoming sessions (within 15 minutes from now)
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);
    
    const upcoming = bookingsList.find(booking => {
      const startTime = new Date(booking.start_time);
      return startTime > now && startTime < fifteenMinutesFromNow;
    });
    
    if (upcoming && upcoming.session_id && onUpcomingSession) {
      onUpcomingSession(upcoming.session_id);
    }
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
        const booking = bookings.find(b => b.booking_id === bookingId);
        
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
        const booking = bookings.find(b => b.booking_id === bookingId);
        
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
  
  const getTeacherInfo = async (bookingId) => {
    try {
      // Find the booking
      const booking = bookings.find(b => b.booking_id === bookingId);
      
      if (booking) {
        setActiveBooking(bookingId);
        
        // Fetch teacher profile
        const profileResponse = await axios.get(
          `${API_BASE_URL}/profiles?user_id=${booking.teacher_id}`,
          {
            headers: {
              Authorization: `Bearer ${auth.user.access_token}`,
            },
          }
        );
        
        if (profileResponse.data && profileResponse.data.profile) {
          // Add teacher info to booking
          const updatedBookings = bookings.map(b => {
            if (b.booking_id === bookingId) {
              return {
                ...b,
                teacherInfo: profileResponse.data.profile
              };
            }
            return b;
          });
          
          setBookings(updatedBookings);
        }
      }
    } catch (err) {
      console.error("Error fetching teacher info:", err);
    } finally {
      setActiveBooking(null);
    }
  };

  if (loading) {
    return <div className="loading">Loading your bookings...</div>;
  }

  // Function to categorize bookings into swimlanes
  const categorizeBookings = () => {
    const now = new Date();
    
    // Current sessions (live, joinable)
    const current = bookings.filter(booking => 
      canJoinSession(booking.start_time, booking.end_time) && 
      booking.status !== 'cancelled'
    );
    
    // Upcoming sessions (in the future, not yet joinable)
    const upcoming = bookings.filter(booking => {
      const startTime = new Date(booking.start_time);
      const joinableTime = new Date(startTime);
      joinableTime.setMinutes(joinableTime.getMinutes() - 15);
      
      return joinableTime > now && booking.status !== 'cancelled';
    });
    
    // Sort upcoming sessions by date (earliest first)
    upcoming.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
    
    // Completed or cancelled sessions
    const completed = bookings.filter(booking => {
      const endTime = new Date(booking.end_time);
      
      // For teachers, hide unbooked availability slots that have ended
      if (userRole === "teacher" && booking.status === "available" && endTime < now) {
        return false;
      }
      
      return endTime < now || booking.status === 'cancelled';
    });
    
    // Sort completed sessions by date (most recent first)
    completed.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
    
    return { current, upcoming, completed };
  };
  
  const { current, upcoming, completed } = categorizeBookings();

  return (
    <div className="bookings-container">
      <h2>{userRole === "student" ? "My Classes" : "My Teaching Schedule"}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {bookings.length > 0 ? (
        <>
          {/* Current Sessions Swimlane - Always shown first when available */}
          {current.length > 0 && (
            <div className="swimlane">
              <h3 className="swimlane-title">Current Sessions</h3>
              <div className="bookings-list">
                {current.map((booking) => (
                  <div 
                    key={booking.booking_id} 
                    className="booking-card joinable"
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
                      
                      {userRole === "student" && (
                        <p>
                          <strong>Teacher:</strong> {booking.teacherInfo ? booking.teacherInfo.name : (
                            <button 
                              className="link-button"
                              onClick={() => getTeacherInfo(booking.booking_id)}
                              disabled={activeBooking === booking.booking_id}
                            >
                              {activeBooking === booking.booking_id ? "Loading..." : "Show teacher info"}
                            </button>
                          )}
                        </p>
                      )}
                      
                      {userRole === "teacher" && (
                        <p>
                          <strong>Student:</strong> {booking.student_name || "Student"}
                        </p>
                      )}
                    </div>
                    
                    <div className="booking-actions">
                      <button 
                        className="btn btn-primary"
                        onClick={() => joinSession(booking.booking_id)}
                      >
                        <span role="img" aria-label="video">🎥</span> Join Session
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Upcoming Sessions Swimlane - Always shown */}
          {upcoming.length > 0 && (
            <div className="swimlane">
              <h3 className="swimlane-title">Upcoming Sessions</h3>
              <div className="bookings-list">
                {upcoming.map((booking) => (
                  <div 
                    key={booking.booking_id} 
                    className="booking-card upcoming"
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
                      
                      {userRole === "student" && (
                        <p>
                          <strong>Teacher:</strong> {booking.teacherInfo ? booking.teacherInfo.name : (
                            <button 
                              className="link-button"
                              onClick={() => getTeacherInfo(booking.booking_id)}
                              disabled={activeBooking === booking.booking_id}
                            >
                              {activeBooking === booking.booking_id ? "Loading..." : "Show teacher info"}
                            </button>
                          )}
                        </p>
                      )}
                      
                      {userRole === "teacher" && (
                        <p>
                          <strong>Student:</strong> {booking.student_name || "Student"}
                        </p>
                      )}
                    </div>
                    
                    <div className="booking-actions">
                      <div className="session-countdown">
                        Session will be available 15 minutes before start time
                      </div>
                      
                      <button 
                        className="btn btn-danger"
                        onClick={() => cancelBooking(booking.booking_id)}
                        disabled={cancellingBooking === booking.booking_id}
                      >
                        <span role="img" aria-label="cancel">❌</span> {cancellingBooking === booking.booking_id ? "Cancelling..." : "Cancel Session"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {/* Toggle Button for Completed Sessions */}
          {completed.length > 0 && (
            <div className="completed-sessions-toggle">
              <button 
                className="btn btn-secondary"
                onClick={() => setShowCompleted(!showCompleted)}
              >
                {showCompleted ? 
                  <><span role="img" aria-label="hide">🔼</span> Hide Completed Sessions</> : 
                  <><span role="img" aria-label="view">🔽</span> View Completed Sessions ({completed.length})</>}
              </button>
            </div>
          )}
          
          {/* Completed Sessions Swimlane - Only shown when toggled */}
          {showCompleted && completed.length > 0 && (
            <div className="swimlane">
              <h3 className="swimlane-title">Completed Sessions</h3>
              <div className="bookings-list">
                {completed.map((booking) => (
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
                      
                      {userRole === "student" && (
                        <p>
                          <strong>Teacher:</strong> {booking.teacherInfo ? booking.teacherInfo.name : (
                            <button 
                              className="link-button"
                              onClick={() => getTeacherInfo(booking.booking_id)}
                              disabled={activeBooking === booking.booking_id}
                            >
                              {activeBooking === booking.booking_id ? "Loading..." : "Show teacher info"}
                            </button>
                          )}
                        </p>
                      )}
                      
                      {userRole === "teacher" && (
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
        </>
      ) : (
        <div className="no-bookings">
          <p>You don't have any bookings yet.</p>
          {userRole === "student" && (
            <p>
              <button 
                className="btn btn-primary"
                onClick={() => window.location.href = "#search"}
              >
                Find Teachers
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default Bookings;