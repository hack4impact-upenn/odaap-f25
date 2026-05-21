import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await authAPI.requestPasswordReset(email);
      setSubmitted(true);
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Could not send reset email. Please try again.';
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="logo">
          <img src="/logo.png" alt="ODAAP" className="logo-image" />
          <span className="logo-text" style={{ fontSize: '35px', fontWeight: 600, color: '#4a148c' }}>
            ODAAP Classroom
          </span>
        </div>
      </div>

      <div className="login-card">
        <form onSubmit={handleSubmit} className="login-form">
          <h2>Forgot your password?</h2>
          <p className="subtitle">
            Enter your email and we'll send you a link to reset it.
          </p>

          {error && <div className="error-message">{error}</div>}

          {submitted ? (
            <div className="success-message">
              If an account exists for <strong>{email}</strong>, a password reset link is on its way.
              The link expires in 1 hour.
            </div>
          ) : (
            <>
              <div className="form-field">
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <button type="submit" className="submit-button" disabled={submitting}>
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
            </>
          )}

          <p className="auth-link-row">
            <Link to="/login" className="link-button">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ForgotPassword;
