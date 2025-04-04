/**
 * Application configuration
 */

// API base URL - change this to match your production or development environment
const API_BASE_URL = 'https://api.yoursanskritteacher.com';

// Payment configuration
const PAYMENT_CONFIG = {
  // Set to true to bypass payment processing during testing
  BYPASS_PAYMENT: true,
  
  // Payment-related settings
  DEFAULT_PRICE: 500, // Default price in INR
  CURRENCY: 'INR',
  
  // Razorpay configuration 
  RAZORPAY_OPTIONS: {
    name: "Sanskrit Teacher",
    description: "Sanskrit Scholar Session",
    theme: {
      color: "#1E88E5" // Vyoma blue
    }
  }
};

export { API_BASE_URL, PAYMENT_CONFIG };