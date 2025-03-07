import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";
import { FaCalendarAlt, FaPlus, FaTrash, FaCheck } from "react-icons/fa";

const TeacherCalendarSchedule = () => {
  const auth = useAuth();
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeDate, setActiveDate] = useState(new Date());
  const [weekDates, setWeekDates] = useState([]);
  const [timeSlots, setTimeSlots] = useState([]);
  const [selectedSlots, setSelectedSlots] = useState([]);

  // Initialize week dates and time slots
  useEffect(() => {
    generateWeekDates(activeDate);
    generateTimeSlots();
  }, [activeDate]);

  // Fetch teacher's availabilities
  const fetchAvailabilities = useCallback(async () => {
    if (!auth.isAuthenticated || weekDates.length === 0) return;
    
    try {
      setLoading(true);
      console.log('Fetching availability slots for teacher...');
      
      // Get start and end of week for filtering
      const weekStart = new Date(weekDates[0]);
      weekStart.setHours(0, 0, 0, 0);
      
      const weekEnd = new Date(weekDates[6]);
      weekEnd.setHours(23, 59, 59, 999);
      
      console.log(`Filtering slots between ${weekStart.toISOString()} and ${weekEnd.toISOString()}`);
      
      const response = await axios.get(
        `${API_BASE_URL}/availability?teacher_id=${auth.user.profile.sub}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      if (response.data && Array.isArray(response.data)) {
        console.log(`Received ${response.data.length} availability slots from API`);
        
        // Filter for slots in current week view
        const slotsInWeek = response.data.filter(slot => {
          if (!slot.start_time) return false;
          const slotStart = new Date(slot.start_time);
          return slotStart >= weekStart && slotStart <= weekEnd;
        });
        
        console.log(`Filtered to ${slotsInWeek.length} slots in current week view`);
        setAvailabilities(slotsInWeek);
      } else {
        console.warn('Unexpected response format:', response.data);
        setAvailabilities([]);
      }
    } catch (err) {
      console.error("Error fetching availabilities:", err);
      setError("Failed to load your schedule. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [auth.isAuthenticated, auth.user, weekDates, setAvailabilities, setLoading, setError]);

  // Fetch availabilities when activeDate or weekDates change
  useEffect(() => {
    if (weekDates.length > 0) {
      fetchAvailabilities();
    }
  }, [activeDate, weekDates, fetchAvailabilities]);

  // Generate array of dates for the current week view
  const generateWeekDates = (currentDate) => {
    const dates = [];
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
    
    // Calculate the start of the week (Sunday)
    const startDate = new Date(currentDate);
    startDate.setDate(currentDate.getDate() - dayOfWeek);
    
    // Generate dates for 7 days (Sunday through Saturday)
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      dates.push(date);
    }
    
    setWeekDates(dates);
  };

  // Generate time slots for the day (30-minute intervals from 6 AM to 9 PM)
  const generateTimeSlots = () => {
    const slots = [];
    const startHour = 6; // 6 AM
    const endHour = 21; // 9 PM
    
    for (let hour = startHour; hour < endHour; hour++) {
      // Add both :00 and :30 slots
      slots.push({ hour, minute: 0 });
      slots.push({ hour, minute: 30 });
    }
    
    setTimeSlots(slots);
  };

  // Format date for display
  const formatDate = (date) => {
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric'
    });
  };

  // Format day of week
  const formatDayOfWeek = (date) => {
    return date.toLocaleDateString('en-US', { 
      weekday: 'short'
    });
  };

  // Format time for display
  const formatTimeSlot = (slot) => {
    // Convert 24-hour format to 12-hour with AM/PM
    let hour = slot.hour;
    const suffix = hour >= 12 ? "PM" : "AM";
    hour = hour % 12 || 12; // Convert 0 to 12 for 12 AM
    return `${hour}:${slot.minute === 0 ? '00' : slot.minute} ${suffix}`;
  };

  // Navigate to previous week
  const goToPreviousWeek = () => {
    const newDate = new Date(activeDate);
    newDate.setDate(activeDate.getDate() - 7);
    setActiveDate(newDate);
    generateWeekDates(newDate);
  };

  // Navigate to next week
  const goToNextWeek = () => {
    const newDate = new Date(activeDate);
    newDate.setDate(activeDate.getDate() + 7);
    setActiveDate(newDate);
    generateWeekDates(newDate);
  };

  // Go to current week
  const goToCurrentWeek = () => {
    const today = new Date();
    setActiveDate(today);
    generateWeekDates(today);
  };

  // Check if a slot is already marked as available
  const isSlotAvailable = (date, timeSlot) => {
    // Create date object for this slot
    const slotDate = new Date(date);
    slotDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
    
    // Check if this slot exists in availabilities
    return availabilities.some(avail => {
      const availStart = new Date(avail.start_time);
      const availEnd = new Date(avail.end_time);
      
      // Check if slot start time matches availability start time
      return availStart.getTime() === slotDate.getTime();
    });
  };

  // Check if a slot is selected (for bulk operations)
  const isSlotSelected = (date, timeSlot) => {
    // Create a unique key for this slot
    const slotKey = `${date.toDateString()}-${timeSlot.hour}-${timeSlot.minute}`;
    return selectedSlots.includes(slotKey);
  };

  // Toggle selection status of a slot
  const toggleSlotSelection = (date, timeSlot) => {
    // Create a unique key for this slot
    const slotKey = `${date.toDateString()}-${timeSlot.hour}-${timeSlot.minute}`;
    
    // If already available, we don't allow selecting
    if (isSlotAvailable(date, timeSlot)) {
      return;
    }
    
    // Toggle selection
    setSelectedSlots(prevSelected => {
      if (prevSelected.includes(slotKey)) {
        return prevSelected.filter(key => key !== slotKey);
      } else {
        return [...prevSelected, slotKey];
      }
    });
  };

  // Delete an availability slot
  const deleteAvailability = async (date, timeSlot) => {
    try {
      // Find the availability ID for this slot
      const slotDate = new Date(date);
      slotDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
      
      const slotToDelete = availabilities.find(avail => {
        const availStart = new Date(avail.start_time);
        return availStart.getTime() === slotDate.getTime();
      });
      
      if (!slotToDelete) {
        console.error("Could not find availability to delete");
        return;
      }
      
      await axios.delete(
        `${API_BASE_URL}/availability/${slotToDelete.availability_id}`,
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

  // Save a single availability slot
  const saveAvailabilitySlot = async (date, timeSlot) => {
    try {
      // Create start and end times (30 minutes apart)
      const startDateTime = new Date(date);
      startDateTime.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
      
      const endDateTime = new Date(startDateTime);
      endDateTime.setMinutes(startDateTime.getMinutes() + 30);
      
      // Note: The API no longer requires topic or description
      // since availabilities are general and not topic-specific
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
      
      // Refresh availabilities
      fetchAvailabilities();
    } catch (err) {
      console.error("Error adding availability:", err);
      setError("Failed to add availability slot. Please try again.");
    }
  };

  // Save multiple slots at once
  const saveSelectedSlots = async () => {
    if (selectedSlots.length === 0) {
      setError("No slots selected");
      return;
    }
    
    try {
      setLoading(true);
      
      // Process each selected slot
      for (const slotKey of selectedSlots) {
        // Parse date and time from slot key
        const [dateStr, hour, minute] = slotKey.split('-');
        const date = new Date(dateStr);
        const timeSlot = { hour: parseInt(hour), minute: parseInt(minute) };
        
        // Create and save each slot
        await saveAvailabilitySlot(date, timeSlot);
      }
      
      // Clear selections after saving
      setSelectedSlots([]);
      setError("");
    } catch (err) {
      console.error("Error saving slots:", err);
      setError("There was a problem saving your availability slots.");
    } finally {
      setLoading(false);
    }
  };

  // Handle slot click - either toggle selection or immediately add/remove based on mode
  const handleSlotClick = (date, timeSlot) => {
    // Don't allow selecting dates in the past
    const now = new Date();
    const slotDate = new Date(date);
    slotDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
    
    if (slotDate < now) {
      return; // Can't modify slots in the past
    }
    
    // If slot is available, clicking will delete it
    if (isSlotAvailable(date, timeSlot)) {
      deleteAvailability(date, timeSlot);
    } else {
      // Otherwise, toggle selection for bulk operations
      toggleSlotSelection(date, timeSlot);
    }
  };

  if (loading && availabilities.length === 0) {
    return <div className="loading">Loading your schedule...</div>;
  }

  return (
    <div className="teacher-calendar">
      <h2>
        <FaCalendarAlt className="calendar-icon" /> 
        Your Teaching Schedule
      </h2>
      
      {error && <div className="alert alert-danger">{error}</div>}
      
      <div className="calendar-controls">
        <button onClick={goToPreviousWeek} className="btn btn-secondary">
          &laquo; Previous Week
        </button>
        <button onClick={goToCurrentWeek} className="btn btn-secondary">
          Current Week
        </button>
        <button onClick={goToNextWeek} className="btn btn-secondary">
          Next Week &raquo;
        </button>
      </div>
      
      <div className="calendar-actions">
        {selectedSlots.length > 0 && (
          <div className="bulk-action-panel">
            <span>{selectedSlots.length} time slots selected</span>
            <button 
              className="btn btn-primary"
              onClick={saveSelectedSlots}
            >
              <FaCheck /> Save Selected Slots
            </button>
            <button 
              className="btn btn-secondary"
              onClick={() => setSelectedSlots([])}
            >
              Clear Selection
            </button>
          </div>
        )}
      </div>
      
      <div className="availability-calendar">
        <div className="calendar-header">
          <div className="time-column-header"></div>
          {weekDates.map((date, index) => (
            <div 
              key={index} 
              className={`day-column-header ${date.toDateString() === new Date().toDateString() ? 'today' : ''}`}
            >
              <div className="day-name">{formatDayOfWeek(date)}</div>
              <div className="day-date">{formatDate(date)}</div>
            </div>
          ))}
        </div>
        
        <div className="calendar-body">
          {timeSlots.map((timeSlot, timeIndex) => (
            <div key={timeIndex} className="time-row">
              <div className="time-label">{formatTimeSlot(timeSlot)}</div>
              
              {weekDates.map((date, dateIndex) => {
                // Determine if this slot is in the past
                const slotDate = new Date(date);
                slotDate.setHours(timeSlot.hour, timeSlot.minute, 0, 0);
                const isPast = slotDate < new Date();
                
                // Determine slot status
                const isAvailable = isSlotAvailable(date, timeSlot);
                const isSelected = isSlotSelected(date, timeSlot);
                
                return (
                  <div 
                    key={dateIndex}
                    className={`
                      time-slot 
                      ${isPast ? 'past' : ''} 
                      ${isAvailable ? 'available' : ''} 
                      ${isSelected ? 'selected' : ''}
                    `}
                    onClick={() => !isPast && handleSlotClick(date, timeSlot)}
                    title={isPast ? "Cannot modify past slots" : (isAvailable ? "Click to remove availability" : "Click to mark as available")}
                  >
                    {isAvailable && (
                      <span className="slot-icon available">
                        <FaCheck size={12} />
                      </span>
                    )}
                    {isSelected && !isAvailable && (
                      <span className="slot-icon selected">
                        <FaPlus size={12} />
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      <div className="schedule-legend">
        <div className="legend-item">
          <div className="legend-color available"></div>
          <span>Available</span>
        </div>
        <div className="legend-item">
          <div className="legend-color selected"></div>
          <span>Selected</span>
        </div>
        <div className="legend-item">
          <div className="legend-color past"></div>
          <span>Past (Cannot modify)</span>
        </div>
      </div>
      
      <div className="schedule-instructions">
        <h3>How to Use:</h3>
        <ul>
          <li>Click on any time slot to mark it as available</li>
          <li>Click multiple slots to select them, then save them all at once</li>
          <li>Click on an available slot to remove it</li>
          <li>Each slot is 30 minutes long</li>
          <li>Students can book your available slots for any topics you teach</li>
          <li>Time slots are general availability and not tied to specific topics</li>
        </ul>
      </div>
    </div>
  );
};

export default TeacherCalendarSchedule;