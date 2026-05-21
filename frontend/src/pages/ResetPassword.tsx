import React, { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

const ResetPassword: React.FC = () => {
  const [params] = useSearchParams();
  const uid = params.get('uid') || '';
  const token = params.get('token') || '';
  const navigate = useNavigate();

  const linkInvalid = useMemo(() => !uid || !token, [uid, token]);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await authAPI.confirmPasswordReset(uid, token, password);
      setDone(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err: any) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.detail ||
        err.message ||
        'Could not reset password. The link may be invalid or expired.';
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
          <h2>Set a new password</h2>
          <p className="subtitle">Choose a new password for your ODAAP account.</p>

          {linkInvalid && (
            <div className="error-message">
              This link is missing required information. Please request a new password reset email.
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          {done ? (
            <div className="success-message">
              Password reset successfully. Redirecting to login...
            </div>
          ) : (
            !linkInvalid && (
              <>
                <div className="form-field">
                  <label htmlFor="password">New password</label>
                  <input
                    type="password"
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="confirm">Confirm password</label>
                  <input
                    type="password"
                    id="confirm"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <button type="submit" className="submit-button" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Reset password'}
                </button>
              </>
            )
          )}

          <p className="auth-link-row">
            <Link to="/login" className="link-button">Back to login</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;
