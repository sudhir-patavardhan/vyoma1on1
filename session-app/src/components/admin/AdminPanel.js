import React, { useState } from "react";
import { useAuth } from "react-oidc-context";
import PaymentSettings from "./PaymentSettings";
import FinancialReports from "./FinancialReports";
import "../../styles.css";
import { FaCreditCard, FaChartLine, FaCog, FaUserShield } from "react-icons/fa";

const AdminPanel = ({ profile }) => {
  const auth = useAuth();
  const [activeTab, setActiveTab] = useState("dashboard");

  // Check if user has admin role - using profile from App.js state
  // For development, we can also allow access to teachers temporarily
  const isAdmin = profile?.role === "admin" || profile?.role === "teacher";
  
  console.log("Profile from props:", profile);
  console.log("User role:", profile?.role);

  if (!isAdmin) {
    return (
      <div className="admin-restricted">
        <FaUserShield size={48} className="admin-icon" />
        <h2>Admin Access Required</h2>
        <p>You need administrator privileges to access this area.</p>
        <p>
          Please contact system administrator if you believe you should have
          access.
        </p>
      </div>
    );
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>
          <FaUserShield /> Admin Panel
        </h2>
        <p>Manage system settings and view financial reports</p>
      </div>

      <div className="admin-container">
        <div className="admin-sidebar">
          <div className="admin-nav">
            <button
              className={`admin-nav-item ${
                activeTab === "dashboard" ? "active" : ""
              }`}
              onClick={() => setActiveTab("dashboard")}
            >
              <FaChartLine /> Dashboard
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "payment-settings" ? "active" : ""
              }`}
              onClick={() => setActiveTab("payment-settings")}
            >
              <FaCreditCard /> Payment Settings
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "financial-reports" ? "active" : ""
              }`}
              onClick={() => setActiveTab("financial-reports")}
            >
              <FaChartLine /> Financial Reports
            </button>
            <button
              className={`admin-nav-item ${
                activeTab === "system-settings" ? "active" : ""
              }`}
              onClick={() => setActiveTab("system-settings")}
            >
              <FaCog /> System Settings
            </button>
          </div>
        </div>

        <div className="admin-content">
          {activeTab === "dashboard" && (
            <div className="admin-dashboard">
              <h3>Admin Dashboard</h3>
              <div className="admin-stats-grid">
                <div className="admin-stat-card">
                  <h4>Total Revenue</h4>
                  <div className="stat-value">₹0</div>
                  <p className="stat-description">Last 30 days</p>
                </div>
                <div className="admin-stat-card">
                  <h4>Active Teachers</h4>
                  <div className="stat-value">0</div>
                  <p className="stat-description">With payment enabled</p>
                </div>
                <div className="admin-stat-card">
                  <h4>Completed Sessions</h4>
                  <div className="stat-value">0</div>
                  <p className="stat-description">Last 30 days</p>
                </div>
                <div className="admin-stat-card">
                  <h4>Pending Payouts</h4>
                  <div className="stat-value">₹0</div>
                  <p className="stat-description">To teachers</p>
                </div>
              </div>

              <div className="admin-quick-actions">
                <h3>Quick Actions</h3>
                <div className="admin-actions-grid">
                  <button
                    className="admin-action-button"
                    onClick={() => setActiveTab("payment-settings")}
                  >
                    <FaCreditCard />
                    <span>Configure Payments</span>
                  </button>
                  <button
                    className="admin-action-button"
                    onClick={() => setActiveTab("financial-reports")}
                  >
                    <FaChartLine />
                    <span>View Reports</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "payment-settings" && <PaymentSettings profile={profile} />}

          {activeTab === "financial-reports" && <FinancialReports profile={profile} />}

          {activeTab === "system-settings" && (
            <div className="admin-system-settings">
              <h3>System Settings</h3>
              <p>
                System configuration options will be available here in a future
                update.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
