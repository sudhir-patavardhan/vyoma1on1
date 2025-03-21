import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";

const TeacherSchedule = () => {
  const auth = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSlot, setNewSlot] = useState({
    date: "",
    startTime: "",
    endTime: "",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    fetchAvailabilities();
  }, []);

  const fetchAvailabilities = async () => {
    if (!auth.isAuthenticated) return;
    
    try {
      setLoading(true);
      const response = await axios.get(
        `${API_BASE_URL}/availability?teacher_id=${auth.user.profile.sub}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        setAvailabilities(response.data);
      }
    } catch (err) {
      console.error("Error fetching availabilities:", err);
      setError("Failed to load your schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewSlot({
      ...newSlot,
      [name]: value,
    });
  };

  const addAvailability = async (e) => {
    e.preventDefault();
    
    // Basic validation
    if (!newSlot.date || !newSlot.startTime || !newSlot.endTime) {
      setError("Please fill in all required fields");
      return;
    }
    
    try {
      const startDateTime = new Date(`${newSlot.date}T${newSlot.startTime}`);
      const endDateTime = new Date(`${newSlot.date}T${newSlot.endTime}`);
      
      // Validate time range
      if (endDateTime <= startDateTime) {
        setError("End time must be after start time");
        return;
      }
      
      // Validate slot is in the future
      if (startDateTime <= new Date()) {
        setError("Availability slots must be set for future dates");
        return;
      }
      
      const slotData = {
        teacher_id: auth.user.profile.sub,
        start_time: startDateTime.toISOString(),
        end_time: endDateTime.toISOString(),
        status: "available"
      };
      
      await axios.post(
        `${API_BASE_URL}/availability`,
        slotData,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // Reset form and refresh availabilities
      setNewSlot({
        date: "",
        startTime: "",
        endTime: "",
      });
      setError("");
      fetchAvailabilities();
    } catch (err) {
      console.error("Error adding availability:", err);
      setError("Failed to add availability slot. Please try again.");
    }
  };

  const deleteAvailability = async (availabilityId) => {
    try {
      await axios.delete(
        `${API_BASE_URL}/availability/${availabilityId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      // Refresh availabilities after deletion
      fetchAvailabilities();
    } catch (err) {
      console.error("Error deleting availability:", err);
      setError("Failed to delete the availability slot. Please try again.");
    }
  };

  // Format date for display
  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleDateString();
  };

  // Format time for display
  const formatTime = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  if (loading) {
    return <div className="loading">Loading your schedule...</div>;
  }

  return (
    <div className="teacher-schedule">
      <h2>Your Teaching Schedule</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form className="availability-form" onSubmit={addAvailability}>
        <h3>Add New Availability Slot</h3>
        <p className="form-subtitle">For a more visual way to manage your availability, try the calendar view</p>
        
        <div className="form-group">
          <label htmlFor="date">Date:</label>
          <input
            type="date"
            id="date"
            name="date"
            value={newSlot.date}
            onChange={handleInputChange}
            required
          />
        </div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="startTime">Start Time:</label>
            <input
              type="time"
              id="startTime"
              name="startTime"
              value={newSlot.startTime}
              onChange={handleInputChange}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="endTime">End Time:</label>
            <input
              type="time"
              id="endTime"
              name="endTime"
              value={newSlot.endTime}
              onChange={handleInputChange}
              required
            />
          </div>
        </div>
        
        
        <button type="submit" className="btn btn-primary">Add Slot</button>
      </form>
      
      <div className="availability-list">
        <h3>Your Availability Slots</h3>
        
        {availabilities.length === 0 ? (
          <p>You haven't added any availability slots yet.</p>
        ) : (
          <div className="slots-container">
            {availabilities.map((slot) => (
              <div key={slot.availability_id} className={`slot-card ${slot.status}`}>
                <div className="slot-header">
                  <h4>Available Slot</h4>
                  <span className={`status-badge ${slot.status}`}>{slot.status}</span>
                </div>
                
                <div className="slot-details">
                  <p><strong>Date:</strong> {formatDate(slot.start_time)}</p>
                  <p><strong>Time:</strong> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                </div>
                
                {slot.status === "available" && (
                  <button
                    className="btn btn-delete"
                    onClick={() => deleteAvailability(slot.availability_id)}
                  >
                    Cancel Slot
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherSchedule;