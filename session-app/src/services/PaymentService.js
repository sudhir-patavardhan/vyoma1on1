import axios from 'axios';
import { API_BASE_URL, PAYMENT_CONFIG } from '../config';

/**
 * Payment Service
 * 
 * This service handles all payment-related functionality for the Sessions platform,
 * including RazorPay integration, payment processing, and payment history.
 */
class PaymentService {
  /**
   * Initialize RazorPay checkout
   * 
   * @param {Object} paymentDetails - Payment details including amount, currency, etc.
   * @param {Object} user - User information
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to RazorPay order details
   */
  async initializePayment(paymentDetails, user, token) {
    try {
      // Check if payment bypass is enabled
      if (PAYMENT_CONFIG.BYPASS_PAYMENT) {
        console.log('PAYMENT BYPASS ENABLED: Skipping payment initialization');
        
        // Return mock payment data for testing
        return {
          order_id: `mock_order_${Date.now()}`,
          razorpay_key_id: 'mock_key_for_testing',
          amount: paymentDetails.amount || PAYMENT_CONFIG.DEFAULT_PRICE,
          currency: paymentDetails.currency || PAYMENT_CONFIG.CURRENCY,
          payment_status: 'bypassed',
          bypass_enabled: true
        };
      }
      
      // Normal payment flow
      const response = await axios.post(
        `${API_BASE_URL}/payments/initialize`,
        {
          amount: paymentDetails.amount,
          currency: paymentDetails.currency || 'INR',
          booking_id: paymentDetails.bookingId,
          availability_id: paymentDetails.availabilityId,
          student_id: user.profile.sub,
          teacher_id: paymentDetails.teacherId,
          topic: paymentDetails.topic
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error initializing payment:', error);
      throw error;
    }
  }

  /**
   * Verify and complete a payment after RazorPay checkout
   * 
   * @param {Object} paymentData - Payment data from RazorPay
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to payment verification details
   */
  async verifyPayment(paymentData, token) {
    try {
      // Check if payment bypass is enabled
      if (PAYMENT_CONFIG.BYPASS_PAYMENT) {
        console.log('PAYMENT BYPASS ENABLED: Skipping payment verification');
        
        // Return mock verification data for testing
        return {
          payment_id: paymentData.razorpay_payment_id || `mock_payment_${Date.now()}`,
          order_id: paymentData.razorpay_order_id || `mock_order_${Date.now()}`,
          signature: paymentData.razorpay_signature || 'mock_signature',
          verification_status: 'success',
          amount: paymentData.amount || PAYMENT_CONFIG.DEFAULT_PRICE,
          currency: paymentData.currency || PAYMENT_CONFIG.CURRENCY,
          student_id: paymentData.student_id,
          teacher_id: paymentData.teacher_id,
          availability_id: paymentData.availability_id,
          bypass_enabled: true
        };
      }
      
      // Normal verification flow
      const response = await axios.post(
        `${API_BASE_URL}/payments/verify`,
        paymentData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error verifying payment:', error);
      throw error;
    }
  }

  /**
   * Get payment history for a user (student or teacher)
   * 
   * @param {string} userId - User ID
   * @param {string} userRole - User role (student or teacher)
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to payment history
   */
  async getPaymentHistory(userId, userRole, token) {
    try {
      const userParam = userRole === 'student' ? 'student_id' : 'teacher_id';
      
      const response = await axios.get(
        `${API_BASE_URL}/payments?${userParam}=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching payment history:', error);
      throw error;
    }
  }

  /**
   * Get financial reports (admin only)
   * 
   * @param {Object} filters - Report filters (date range, etc.)
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to financial reports
   */
  async getFinancialReports(filters, token) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/financial-reports`,
        {
          params: filters,
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching financial reports:', error);
      throw error;
    }
  }

  /**
   * Save RazorPay configuration (admin only)
   * 
   * @param {Object} config - RazorPay configuration
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to configuration status
   */
  async saveRazorPayConfig(config, token) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/razorpay-config`,
        config,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error saving RazorPay configuration:', error);
      throw error;
    }
  }

  /**
   * Get RazorPay configuration (admin only)
   * 
   * @param {string} token - Authentication token
   * @returns {Promise} - Promise resolving to RazorPay configuration
   */
  async getRazorPayConfig(token) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/admin/razorpay-config`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error fetching RazorPay configuration:', error);
      throw error;
    }
  }
}

export default new PaymentService();