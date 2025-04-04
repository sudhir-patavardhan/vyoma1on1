import React, { useState, useEffect } from "react";
import { useAuth } from "react-oidc-context";
import axios from "axios";
import { API_BASE_URL, PAYMENT_CONFIG } from "../config";
import "../styles.css";
import "../enhanced-styles.css"; // Import enhanced styles
import { FaGraduationCap, FaLock, FaCalendarAlt, FaInfo } from "react-icons/fa";
import PaymentService from "../services/PaymentService";

const TeacherSearch = () => {
  const auth = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchType, setSearchType] = useState("both"); // "topic", "name", or "both"
  const [searchResults, setSearchResults] = useState([]);
  const [availabilities, setAvailabilities] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [paymentProcessing, setPaymentProcessing] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  // Load Razorpay script
  useEffect(() => {
    const loadRazorpayScript = () => {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => {
        setRazorpayLoaded(true);
        console.log('Razorpay script loaded successfully');
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
      };
      document.body.appendChild(script);
    };

    loadRazorpayScript();
    
    return () => {
      // Clean up script when component unmounts
      const script = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
      if (script) {
        document.body.removeChild(script);
      }
    };
  }, []);

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

  const handlePayment = async (availabilityId) => {
    try {
      setPaymentProcessing(true);
      setError("");
      
      // Find the selected slot
      const selectedSlot = availabilities.find(slot => slot.availability_id === availabilityId);
      if (!selectedSlot) {
        throw new Error("Selected time slot not found");
      }

      // Initialize payment
      const paymentDetails = {
        amount: selectedSlot.price || PAYMENT_CONFIG.DEFAULT_PRICE,
        currency: selectedSlot.currency || PAYMENT_CONFIG.CURRENCY,
        availabilityId: availabilityId,
        teacherId: selectedTeacher.user_id,
        topic: searchTerm
      };

      // Call payment service to handle payment flow
      const orderData = await PaymentService.initializePayment(
        paymentDetails,
        auth.user,
        auth.user.access_token
      );

      if (!orderData || !orderData.order_id) {
        throw new Error("Failed to initialize payment");
      }

      // Check if payment is bypassed
      if (PAYMENT_CONFIG.BYPASS_PAYMENT || orderData.bypass_enabled) {
        console.log('PAYMENT BYPASS ENABLED: Skipping Razorpay checkout and proceeding directly to booking');
        
        // Create mock payment response for the completeBooking function
        const mockPaymentResponse = {
          razorpay_payment_id: `mock_payment_${Date.now()}`,
          razorpay_order_id: orderData.order_id,
          razorpay_signature: 'mock_signature_for_testing'
        };
        
        // Directly proceed to booking completion
        completeBooking(availabilityId, mockPaymentResponse);
        
        // Show a notice that payment was bypassed 
        setError('TESTING MODE: Payment was bypassed. Your session was booked without actual payment processing.');
        
        return; // Exit early
      }
      
      // For normal payment flow (when bypass is disabled), verify Razorpay is loaded
      if (!razorpayLoaded) {
        throw new Error("Payment gateway is still loading. Please try again in a moment.");
      }

      // Configure RazorPay options
      const options = {
        key: orderData.razorpay_key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: PAYMENT_CONFIG.RAZORPAY_OPTIONS.name,
        description: `Scholar Session with Dr. ${selectedTeacher.name} on ${searchTerm}`,
        order_id: orderData.order_id,
        handler: function(response) {
          // This function is called when payment is successful
          completeBooking(availabilityId, response);
        },
        prefill: {
          name: auth.user.profile.name,
          email: auth.user.profile.email,
          contact: auth.user.profile.phone_number || ""
        },
        notes: {
          student_id: auth.user.profile.sub,
          teacher_id: selectedTeacher.user_id,
          availability_id: availabilityId,
          topic: searchTerm
        },
        theme: {
          color: PAYMENT_CONFIG.RAZORPAY_OPTIONS.theme.color
        },
        modal: {
          ondismiss: function() {
            setPaymentProcessing(false);
          }
        }
      };

      // Open RazorPay checkout
      const razorpay = new window.Razorpay(options);
      razorpay.open();
      
    } catch (err) {
      console.error("Error processing payment:", err);
      setError(err.message || "Failed to process payment. Please try again.");
      setPaymentProcessing(false);
    }
  };

  const completeBooking = async (availabilityId, paymentResponse) => {
    try {
      setLoading(true);
      
      // Verify payment with backend
      await PaymentService.verifyPayment({
        razorpay_payment_id: paymentResponse.razorpay_payment_id,
        razorpay_order_id: paymentResponse.razorpay_order_id,
        razorpay_signature: paymentResponse.razorpay_signature,
        availability_id: availabilityId,
        student_id: auth.user.profile.sub,
        teacher_id: selectedTeacher.user_id
      }, auth.user.access_token);
      
      // Create a booking with the topic from search
      await axios.post(
        `${API_BASE_URL}/bookings`,
        {
          student_id: auth.user.profile.sub,
          availability_id: availabilityId,
          topic: searchTerm, // Using the searched topic for this booking
          teacher_id: selectedTeacher.user_id,
          payment_id: paymentResponse.razorpay_payment_id
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
      console.error("Error completing booking:", err);
      setError("Payment was processed but booking failed. Please contact support.");
    } finally {
      setLoading(false);
      setPaymentProcessing(false);
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

  const [selectedCategory, setSelectedCategory] = useState("");
  const sanskritCategories = [
    { id: "vedic", name: "Vedic Literature", subcategories: ["Rigveda", "Samaveda", "Yajurveda", "Atharvaveda", "Upanishads", "Vedangas"] },
    { id: "grammar", name: "Sanskrit Grammar", subcategories: ["Ashtadhyayi", "Dhatupatha", "Sandhi", "Samasa", "Vibhakti"] },
    { id: "literature", name: "Classical Literature", subcategories: ["Kavya", "Nataka", "Ramayana", "Mahabharata", "Puranas"] },
    { id: "philosophy", name: "Philosophy", subcategories: ["Vedanta", "Samkhya", "Yoga", "Nyaya", "Vaisheshika", "Mimamsa"] },
    { id: "scientific", name: "Scientific Texts", subcategories: ["Ayurveda", "Jyotisha", "Ganita", "Vastu Shastra"] },
    { id: "religious", name: "Religious Texts", subcategories: ["Agamas", "Dharma Shastras", "Tantras"] },
    { id: "modern", name: "Modern Sanskrit", subcategories: ["Conversational", "Contemporary Literature", "Academic Sanskrit"] }
  ];

  return (
    <div className="teacher-search-container">
      <div className="sanskrit-search-hero">
        <h2>Find Your Perfect Sanskrit Teacher</h2>
        <p>Connect with experts specializing in your areas of interest</p>
        
        {/* Payment bypass indicator */}
        {PAYMENT_CONFIG.BYPASS_PAYMENT && (
          <div className="bypass-notice">
            <FaInfo className="bypass-icon" />
            <span>Testing Mode: Payments are currently bypassed for testing</span>
          </div>
        )}
      </div>
      
      {error && <div className={`error-message ${error.includes('TESTING MODE') ? 'info-message' : ''}`}>{error}</div>}
      
      <div className="search-tools">
        <div className="category-explorer">
          <h3>Browse by Category</h3>
          <div className="category-buttons">
            {sanskritCategories.map(category => (
              <button 
                key={category.id}
                className={`category-button ${selectedCategory === category.id ? 'active' : ''}`}
                onClick={() => {
                  setSelectedCategory(category.id);
                  setSearchType("topic");
                  setSearchTerm(category.name);
                }}
              >
                {category.name}
              </button>
            ))}
          </div>
          
          {selectedCategory && (
            <div className="subcategory-chips">
              {sanskritCategories.find(cat => cat.id === selectedCategory)?.subcategories.map(sub => (
                <button 
                  key={sub} 
                  className="subcategory-chip"
                  onClick={() => {
                    setSearchTerm(sub);
                    handleSearch({ preventDefault: () => {} });
                  }}
                >
                  {sub}
                </button>
              ))}
            </div>
          )}
        </div>
        
        <div className="text-search-section">
          <form className="search-form" onSubmit={handleSearch}>
            <div className="search-input-group">
              <input
                type="text"
                id="searchTerm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by topic (e.g., Vedanta) or teacher name"
                required
              />
              <button type="submit" className="btn btn-primary search-btn" disabled={loading}>
                {loading ? "Searching..." : "Search"}
              </button>
            </div>
            
            <div className="search-options">
              <div className="search-type-selector">
                <div className="search-type-option">
                  <input
                    type="radio"
                    id="search-type-both"
                    name="search-type"
                    checked={searchType === "both"}
                    onChange={() => setSearchType("both")}
                  />
                  <label htmlFor="search-type-both">All</label>
                </div>
                
                <div className="search-type-option">
                  <input
                    type="radio"
                    id="search-type-topic"
                    name="search-type"
                    checked={searchType === "topic"}
                    onChange={() => setSearchType("topic")}
                  />
                  <label htmlFor="search-type-topic">Topics Only</label>
                </div>
                
                <div className="search-type-option">
                  <input
                    type="radio"
                    id="search-type-name"
                    name="search-type"
                    checked={searchType === "name"}
                    onChange={() => setSearchType("name")}
                  />
                  <label htmlFor="search-type-name">Teachers Only</label>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
      
      <div className="popular-searches">
        <h4>Popular Searches:</h4>
        <div className="popular-search-tags">
          {["Vedanta Philosophy", "Spoken Sanskrit", "Panini's Grammar", "Bhagavad Gita", "Ramayana", "Ayurveda"].map(tag => (
            <button 
              key={tag} 
              className="popular-tag"
              onClick={() => {
                setSearchTerm(tag);
                setSearchType("topic");
                handleSearch({ preventDefault: () => {} });
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
      
      {searchResults.length > 0 && !selectedTeacher && (
        <div className="search-results">
          <h3>Teachers Found</h3>
          
          <div className="teacher-list">
            {searchResults.map((teacher) => (
              <div key={teacher.user_id} className="teacher-card sanskrit-scholar">
                <div className="scholar-badge">
                  <FaGraduationCap className="scholar-icon" />
                  <span>Sanskrit Scholar</span>
                </div>
                <div className="teacher-card-header">
                  {teacher.photo_url ? (
                    <img 
                      src={teacher.photo_url} 
                      alt={`${teacher.name}`} 
                      className="teacher-photo"
                    />
                  ) : (
                    <div className="teacher-photo-placeholder">
                      {teacher.name.charAt(0)}
                    </div>
                  )}
                  <div className="teacher-info">
                    <h4>{teacher.name}{teacher.qualification?.includes("PhD") ? ", PhD" : ""}</h4>
                    <div className="teacher-credentials">
                      <span className="credential-pill">Verified</span>
                      {teacher.years_of_experience && (
                        <span className="credential-pill">{teacher.years_of_experience}+ Years Experience</span>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="teacher-expertise">
                  <h5>Areas of Expertise</h5>
                  <div className="expertise-tags">
                    {teacher.topics.map((topic, index) => (
                      <span key={index} className="expertise-tag">{topic}</span>
                    ))}
                  </div>
                </div>
                
                <div className="teacher-card-body">
                  {teacher.bio && (
                    <div className="teacher-bio">
                      <p>{teacher.bio.length > 150 ? `${teacher.bio.substring(0, 150)}...` : teacher.bio}</p>
                      {teacher.bio.length > 150 && (
                        <button className="bio-expand-btn" onClick={() => viewTeacherAvailability(teacher.user_id)}>
                          Read more
                        </button>
                      )}
                    </div>
                  )}
                  
                  <div className="teacher-credentials-detail">
                    <div className="credential-item">
                      <span className="credential-label">Background:</span>
                      <span className="credential-value">
                        {teacher.qualification || "Sanskrit Scholar"}
                        {teacher.university ? ` from ${teacher.university}` : ''}
                      </span>
                    </div>
                    
                    {teacher.associations && (
                      <div className="credential-item">
                        <span className="credential-label">Affiliated with:</span>
                        <span className="credential-value">{teacher.associations}</span>
                      </div>
                    )}
                    
                    <div className="session-rate">
                      <span className="rate-label">Session Rate:</span>
                      <span className="scholar-price">Scholar Session Rate</span>
                    </div>
                  </div>
                </div>
                
                <div className="teacher-actions">
                  <button
                    className="btn btn-primary view-slots-btn"
                    onClick={() => viewTeacherAvailability(teacher.user_id)}
                  >
                    <FaCalendarAlt className="btn-icon" />
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
                <div key={slot.availability_id} className="slot-card scholar">
                  <div className="scholar-tag">PhD Scholar Session</div>
                  <div className="slot-header">
                    <h4>Scholar Session with Dr. {selectedTeacher.name}</h4>
                    <div className="session-quality">
                      <span className="quality-badge">Exclusive</span>
                    </div>
                  </div>
                  
                  <div className="slot-details">
                    <p><strong>Date:</strong> {formatDate(slot.start_time)}</p>
                    <p><strong>Time:</strong> {formatTime(slot.start_time)} - {formatTime(slot.end_time)}</p>
                    <p><strong>Specialization:</strong> {selectedTeacher.topics.join(", ")}</p>
                    <p><strong>Duration:</strong> 60 minutes</p>
                    <p><strong>Instructor:</strong> Dr. {selectedTeacher.name}, PhD Sanskrit Scholar</p>
                    <p className="session-benefits">
                      <strong>Session includes:</strong> Personalized instruction, curated learning materials, recording access
                    </p>
                  </div>
                  
                  <div className="scholar-price-display">
                    <div className="price-amount">
                      <span className="scholar-label">Scholar Session</span>
                    </div>
                    <span className="price-period">Exclusive Instruction</span>
                  </div>
                  
                  <button
                    className="btn btn-primary scholar-btn"
                    onClick={() => handlePayment(slot.availability_id)}
                    disabled={loading || paymentProcessing}
                  >
                    {paymentProcessing ? "Processing Payment..." : 
                     loading ? "Reserving..." : "Reserve Scholar Session"}
                  </button>
                  <p className="secure-payment-note">
                    <FaLock style={{fontSize: '0.8rem', marginRight: '5px'}} /> Secure international payment
                  </p>
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