import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import "../styles.css";

const Bookings = ({ userId, userRole, onJoinSession, onUpcomingSession }) => {
  const auth = useAuth();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeBooking, setActiveBooking] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [userId, userRole]);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const userParam = userRole === "student" ? "student_id" : "teacher_id";
      
      const response = await axios.get(
        `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/bookings?${userParam}=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      // Sort by start time (most recent first)
      const sortedBookings = response.data.sort((a, b) => {
        return new Date(b.start_time) - new Date(a.start_time);
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
        `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/bookings/${bookingId}/session`,
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
        const booking = bookings.find(b => b.booking_id === bookingId);
        
        const createResponse = await axios.post(
          "https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/sessions",
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
          `https://15fvg1d1mg.execute-api.us-east-1.amazonaws.com/prod/profiles?user_id=${booking.teacher_id}`,
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

  return (
    <div className="bookings-container">
      <h2>{userRole === "student" ? "My Classes" : "My Teaching Schedule"}</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      {bookings.length > 0 ? (
        <div className="bookings-list">
          {bookings.map((booking) => {
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
          {userRole === "student" && (
            <p>
              <button 
                className="btn btn-secondary"
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