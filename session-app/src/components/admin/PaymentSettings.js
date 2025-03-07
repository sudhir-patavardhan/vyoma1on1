import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import PaymentService from '../../services/PaymentService';
import { FaKey, FaCheck, FaExclamationTriangle, FaSync } from 'react-icons/fa';

const PaymentSettings = () => {
  const auth = useAuth();
  const [razorpayConfig, setRazorpayConfig] = useState({
    key_id: '',
    key_secret: ''
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [testMode, setTestMode] = useState(true);
  
  useEffect(() => {
    const fetchRazorPayConfig = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const config = await PaymentService.getRazorPayConfig(auth.user?.access_token);
        
        if (config) {
          setRazorpayConfig({
            key_id: config.key_id || '',
            key_secret: ''  // Don't set the masked key_secret from response
          });
          
          // Determine if we're in test mode based on key_id prefix
          setTestMode(config.key_id?.startsWith('rzp_test_') || false);
        }
      } catch (err) {
        console.error('Error fetching RazorPay config:', err);
        setError('Failed to load RazorPay configuration. It may not be set up yet.');
      } finally {
        setLoading(false);
      }
    };
    
    if (auth.isAuthenticated && auth.user?.access_token) {
      fetchRazorPayConfig();
    }
  }, [auth.isAuthenticated, auth.user?.access_token]);
  
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setRazorpayConfig(prev => ({
      ...prev,
      [name]: value
    }));
    
    // If key_id is changed, check if it's a test key
    if (name === 'key_id') {
      setTestMode(value.startsWith('rzp_test_'));
    }
    
    // Clear success message when input changes
    if (success) {
      setSuccess(false);
    }
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);
      
      // Validate inputs
      if (!razorpayConfig.key_id.trim()) {
        throw new Error('API Key ID is required');
      }
      
      if (!razorpayConfig.key_secret.trim()) {
        throw new Error('API Key Secret is required');
      }
      
      // Submit to backend
      await PaymentService.saveRazorPayConfig(razorpayConfig, auth.user?.access_token);
      
      // Show success message
      setSuccess(true);
      
      // Clear secret field after successful save
      setRazorpayConfig(prev => ({
        ...prev,
        key_secret: ''
      }));
      
    } catch (err) {
      console.error('Error saving RazorPay config:', err);
      setError(err.message || 'Failed to save RazorPay configuration');
    } finally {
      setSaving(false);
    }
  };
  
  const handleTestConnection = async () => {
    try {
      setSaving(true);
      setError(null);
      
      // Test by making a simple API call to RazorPay
      alert('This would test the RazorPay connection by making a simple API call.');
      // In a real implementation, you'd make an API call to test the connection
      
    } catch (err) {
      setError('Connection test failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };
  
  if (loading) {
    return (
      <div className="admin-loading">
        <FaSync className="spinner" />
        <p>Loading payment configuration...</p>
      </div>
    );
  }
  
  return (
    <div className="payment-settings">
      <div className="admin-section-header">
        <h3>RazorPay Integration Settings</h3>
        <p>Configure your RazorPay API keys to enable payment processing</p>
        
        {testMode && (
          <div className="test-mode-badge">
            <FaExclamationTriangle /> Test Mode
          </div>
        )}
      </div>
      
      {error && (
        <div className="alert alert-danger">
          <FaExclamationTriangle /> {error}
        </div>
      )}
      
      {success && (
        <div className="alert alert-success">
          <FaCheck /> RazorPay configuration has been saved successfully
        </div>
      )}
      
      <form className="razorpay-config-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="key_id">
            <FaKey /> API Key ID
          </label>
          <input
            type="text"
            id="key_id"
            name="key_id"
            value={razorpayConfig.key_id}
            onChange={handleInputChange}
            placeholder="e.g. rzp_test_1234567890abcdef"
            required
          />
          <small className="form-text text-muted">
            Your RazorPay API Key ID (starts with 'rzp_test_' for test mode or 'rzp_live_' for production)
          </small>
        </div>
        
        <div className="form-group">
          <label htmlFor="key_secret">
            <FaKey /> API Key Secret
          </label>
          <input
            type="password"
            id="key_secret"
            name="key_secret"
            value={razorpayConfig.key_secret}
            onChange={handleInputChange}
            placeholder="Enter your RazorPay API Key Secret"
            required={!razorpayConfig.key_id.includes('•')}
          />
          <small className="form-text text-muted">
            Your RazorPay API Key Secret (keep this confidential)
          </small>
        </div>
        
        <div className="form-actions">
          <button 
            type="submit" 
            className="btn btn-primary" 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
          
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleTestConnection}
            disabled={saving || !razorpayConfig.key_id}
          >
            Test Connection
          </button>
        </div>
      </form>
      
      <div className="razorpay-info">
        <h4>Getting Your RazorPay API Keys</h4>
        <ol>
          <li>Log in to your <a href="https://dashboard.razorpay.com" target="_blank" rel="noopener noreferrer">RazorPay Dashboard</a></li>
          <li>Navigate to Settings &gt; API Keys</li>
          <li>Generate a new API key pair</li>
          <li>Copy the Key ID and Secret Key</li>
          <li>Paste them in the form above and click Save</li>
        </ol>
        <p><strong>Note:</strong> For testing, use Test Mode keys that start with 'rzp_test_'. For production, use Live Mode keys that start with 'rzp_live_'.</p>
      </div>
    </div>
  );
};

export default PaymentSettings;