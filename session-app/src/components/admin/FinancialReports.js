import React, { useState, useEffect } from 'react';
import { useAuth } from 'react-oidc-context';
import PaymentService from '../../services/PaymentService';
import { 
  FaCalendarAlt, 
  FaDownload, 
  FaFilter, 
  FaSync, 
  FaExclamationTriangle,
  FaChartLine
} from 'react-icons/fa';

const FinancialReports = ({ profile }) => {
  const auth = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [financialData, setFinancialData] = useState({
    summary: { total_amount: 0, payment_count: 0 },
    teacher_summary: {},
    payments: []
  });
  const [filters, setFilters] = useState({
    start_date: '',
    end_date: ''
  });
  
  useEffect(() => {
    fetchFinancialReports();
  }, []);
  
  const fetchFinancialReports = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Convert dates to ISO string format if provided
      const queryParams = {};
      if (filters.start_date) {
        queryParams.start_date = new Date(filters.start_date).toISOString();
      }
      if (filters.end_date) {
        queryParams.end_date = new Date(filters.end_date).toISOString();
      }
      
      const data = await PaymentService.getFinancialReports(queryParams, auth.user?.access_token);
      setFinancialData(data || {
        summary: { total_amount: 0, payment_count: 0 },
        teacher_summary: {},
        payments: []
      });
    } catch (err) {
      console.error('Error fetching financial reports:', err);
      setError('Failed to load financial reports. ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleFilterSubmit = (e) => {
    e.preventDefault();
    fetchFinancialReports();
  };
  
  const exportToCSV = () => {
    try {
      // Convert payment data to CSV format
      const headers = ['Payment ID', 'Teacher', 'Student', 'Amount', 'Date', 'Status'];
      const rows = financialData.payments.map(payment => [
        payment.payment_id,
        payment.teacher_id,
        payment.student_id,
        `₹${payment.amount}`,
        new Date(payment.created_at).toLocaleDateString(),
        payment.status
      ]);
      
      // Combine headers and rows
      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
      ].join('\\n');
      
      // Create a Blob and download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `financial_report_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting CSV:', err);
      alert('Failed to export data: ' + err.message);
    }
  };
  
  const formatCurrency = (amount) => {
    return `₹${parseFloat(amount).toFixed(2)}`;
  };
  
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };
  
  if (loading) {
    return (
      <div className="admin-loading">
        <FaSync className="spinner" />
        <p>Loading financial reports...</p>
      </div>
    );
  }
  
  return (
    <div className="financial-reports">
      <div className="admin-section-header">
        <h3><FaChartLine /> Financial Reports</h3>
        <p>View and analyze payment data across the platform</p>
      </div>
      
      {error && (
        <div className="alert alert-danger">
          <FaExclamationTriangle /> {error}
        </div>
      )}
      
      <div className="report-filters">
        <h4><FaFilter /> Filter Reports</h4>
        <form onSubmit={handleFilterSubmit} className="filter-form">
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start_date">
                <FaCalendarAlt /> Start Date
              </label>
              <input
                type="date"
                id="start_date"
                name="start_date"
                value={filters.start_date}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="end_date">
                <FaCalendarAlt /> End Date
              </label>
              <input
                type="date"
                id="end_date"
                name="end_date"
                value={filters.end_date}
                onChange={handleFilterChange}
              />
            </div>
            
            <div className="form-group form-actions-inline">
              <button type="submit" className="btn btn-primary">
                Apply Filters
              </button>
              <button 
                type="button" 
                className="btn btn-secondary"
                onClick={exportToCSV}
                disabled={!financialData.payments?.length}
              >
                <FaDownload /> Export CSV
              </button>
            </div>
          </div>
        </form>
      </div>
      
      <div className="summary-cards">
        <div className="summary-card">
          <h4>Total Revenue</h4>
          <div className="summary-value">
            {formatCurrency(financialData.summary?.total_amount || 0)}
          </div>
        </div>
        
        <div className="summary-card">
          <h4>Transaction Count</h4>
          <div className="summary-value">
            {financialData.summary?.payment_count || 0}
          </div>
        </div>
        
        <div className="summary-card">
          <h4>Average Transaction</h4>
          <div className="summary-value">
            {financialData.summary?.payment_count
              ? formatCurrency(financialData.summary.total_amount / financialData.summary.payment_count)
              : '₹0.00'
            }
          </div>
        </div>
        
        <div className="summary-card">
          <h4>Teachers Paid</h4>
          <div className="summary-value">
            {Object.keys(financialData.teacher_summary || {}).length}
          </div>
        </div>
      </div>
      
      {/* Teacher Summary Table */}
      <div className="teacher-summary-section">
        <h4>Teacher Earnings</h4>
        {Object.keys(financialData.teacher_summary || {}).length > 0 ? (
          <table className="teacher-summary-table">
            <thead>
              <tr>
                <th>Teacher ID</th>
                <th>Sessions</th>
                <th>Total Earnings</th>
                <th>Average per Session</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(financialData.teacher_summary || {}).map(([teacherId, data]) => (
                <tr key={teacherId}>
                  <td>{teacherId}</td>
                  <td>{data.count}</td>
                  <td>{formatCurrency(data.total)}</td>
                  <td>{formatCurrency(data.total / data.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No teacher earnings data available for the selected period.</p>
        )}
      </div>
      
      {/* Payments Table */}
      <div className="payments-section">
        <h4>Payment Transactions</h4>
        {financialData.payments?.length ? (
          <table className="payments-table">
            <thead>
              <tr>
                <th>Payment ID</th>
                <th>Date</th>
                <th>Student</th>
                <th>Teacher</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {financialData.payments.map(payment => (
                <tr key={payment.payment_id}>
                  <td>{payment.payment_id}</td>
                  <td>{formatDate(payment.created_at)}</td>
                  <td>{payment.student_id}</td>
                  <td>{payment.teacher_id}</td>
                  <td>{formatCurrency(payment.amount)}</td>
                  <td>
                    <span className={`status-badge ${payment.status}`}>
                      {payment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No payment transactions found for the selected period.</p>
        )}
      </div>
    </div>
  );
};

export default FinancialReports;