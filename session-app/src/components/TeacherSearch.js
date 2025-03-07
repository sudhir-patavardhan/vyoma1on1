import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL } from "../config";
import "../styles.css";

const TeacherSearch = () => {
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("both"); // "topic", "name", or "both"
  const [searchResults, setSearchResults] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);

  const handleSearch = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim()) {
      setError("Please enter a search term");
      return;
    }
    
    try {
      setLoading(true);
      setError("");
      
      console.log(`Searching for "${searchTerm}" with search type: ${searchType}`);
      
      // Search for teachers based on topic and/or name
      const response = await axios.get(
        `${API_BASE_URL}/search/teachers?topic=${encodeURIComponent(searchTerm)}&type=${searchType}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      setSearchResults(response.data || []);
      
      if (response.data.length === 0) {
        if (searchType === "topic") {
          setError("No teachers found for this topic");
        } else if (searchType === "name") {
          setError("No teachers found with this name");
        } else {
          setError("No teachers found matching your search");
        }
      }
    } catch (err) {
      console.error("Error searching for teachers:", err);
      setError("Failed to search for teachers. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const viewTeacherAvailability = async (teacherId) => {
    try {
      setLoading(true);
      setError("");
      
      // Find the teacher details
      const teacher = searchResults.find(t => t.user_id === teacherId);
      setSelectedTeacher(teacher);
      
      // Get teacher's availability
      const response = await axios.get(
        `${API_BASE_URL}/availability?teacher_id=${teacherId}`,
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
          },
        }
      );
      
      // Filter only available future slots
      const now = new Date();
      const availableSlots = response.data.filter(slot => {
        // Check if the slot is available
        if (slot.status !== 'available') return false;
        
        // Check if the slot is in the future
        const slotStartTime = new Date(slot.start_time);
        return slotStartTime > now;
      });
      
      // Sort slots by start time (nearest first)
      availableSlots.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      
      setAvailabilities(availableSlots);
      
      if (availableSlots.length === 0) {
        setError("This teacher has no available future time slots");
      }
    } catch (err) {
      console.error("Error fetching teacher availability:", err);
      setError("Failed to get teacher's availability. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const bookSession = async (availabilityId) => {
    try {
      setLoading(true);
      setError("");
      
      // Find the selected slot
      const selectedSlot = availabilities.find(slot => slot.availability_id === availabilityId);
      if (!selectedSlot) {
        throw new Error("Selected time slot not found");
      }
      
      // Create a booking with the topic from search
      await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          student_id: auth.user.profile.sub,
          availability_id: availabilityId,
          topic: searchTerm, // Using the searched topic for this booking
          teacher_id: selectedTeacher.user_id
        },
        {
          headers: {
            Authorization: `Bearer ${auth.user.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );
      
      // Remove the booked slot from the available slots
      setAvailabilities(availabilities.filter(slot => slot.availability_id !== availabilityId));
      
      // Show success message
      alert("Session booked successfully! Check 'My Classes' to view your booking.");
    } catch (err) {
      console.error("Error booking session:", err);
      setError("Failed to book the session. Please try again.");
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

  return (
    <div className="teacher-search">
      <h2>Find a Teacher</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <form className="search-form" onSubmit={handleSearch}>
        <div className="form-group">
          <label htmlFor="searchTerm">Search for Teachers</label>
          <input
            type="text"
            id="searchTerm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchType === "name" ? "e.g. John Smith, Jane Doe" : 
                         searchType === "topic" ? "e.g. Math, Science, Programming" : 
                         "Search by topic or teacher name"}
            required
          />
        </div>
        
        <div className="form-group">
          <label>Search by</label>
          <div className="search-type-selector">
            <div className="search-type-option">
              <input
                type="radio"
                id="search-type-both"
                name="search-type"
                checked={searchType === "both"}
                onChange={() => setSearchType("both")}
              />
              <label htmlFor="search-type-both">Both</label>
            </div>
            
            <div className="search-type-option">
              <input
                type="radio"
                id="search-type-topic"
                name="search-type"
                checked={searchType === "topic"}
                onChange={() => setSearchType("topic")}
              />
              <label htmlFor="search-type-topic">Topic</label>
            </div>
            
            <div className="search-type-option">
              <input
                type="radio"
                id="search-type-name"
                name="search-type"
                checked={searchType === "name"}
                onChange={() => setSearchType("name")}
              />
              <label htmlFor="search-type-name">Teacher Name</label>
            </div>
          </div>
        </div>
        
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "Searching..." : "Search"}
        </button>
      </form>
      
      {searchResults.length > 0 && !selectedTeacher && (
        <div className="search-results">
          <h3>Teachers Found</h3>
          
          <div className="teacher-list">
            {searchResults.map((teacher) => (
              <div key={teacher.user_id} className="teacher-card">
                <div className="teacher-card-header">
                  {teacher.photo_url && (
                    <img 
                      src={teacher.photo_url} 
                      alt={`${teacher.name}`} 
                      className="teacher-photo"
                    />
                  )}
                  <h4>{teacher.name}</h4>
                </div>
                
                <div className="teacher-card-body">
                  {teacher.bio && <p>{teacher.bio}</p>}
                  
                  <p><strong>Topics:</strong> {teacher.topics.join(", ")}</p>
                  
                  {teacher.years_of_experience && (
                    <p><strong>Experience:</strong> {teacher.years_of_experience} years</p>
                  )}
                </div>
                
                <div className="teacher-card-footer">
                  <button
                    className="btn btn-secondary"
                    onClick={() => viewTeacherAvailability(teacher.user_id)}
                  >
                    View Available Sessions
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {selectedTeacher && (
        <div className="teacher-details">
          <button 
            className="btn btn-back"
            onClick={() => {
              setSelectedTeacher(null);
              setAvailabilities([]);
            }}
          >
            &larr; Back to Teacher List
          </button>
          
          <h3>Schedule a Session with {selectedTeacher.name}</h3>
          <p className="search-subtitle">Choose from available time slots for a session on {searchTerm}.</p>
          
          {availabilities.length > 0 ? (
            <div className="availability-list">
              {availabilities.map((slot) => (
                <div key={slot.availability_id} className="slot-card">
                  <div className="slot-header">
                    <h4>Available Session with {selectedTeacher.name}</h4>
                  </div>
                  
                  <div className="slot-details">
                    <p><strong>Date:</strong> {formatDate(slot.start_time)}</p>
                    <p><strong>Time:</strong> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                    <p><strong>Topics:</strong> {selectedTeacher.topics.join(", ")}</p>
                  </div>
                  
                  <button
                    className="btn btn-primary"
                    onClick={() => bookSession(slot.availability_id)}
                    disabled={loading}
                  >
                    {loading ? "Booking..." : "Book This Session"}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="no-slots">No available time slots for this teacher</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherSearch;