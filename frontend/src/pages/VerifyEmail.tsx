import React, { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authAPI } from '../services/api';
import './Login.css';

type Status = 'verifying' | 'success' | 'error';

const VerifyEmail: React.FC = () => {
  const [params] = useSearchParams();
  const token = params.get('token') || '';

  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const calledRef = useRef(false);

  useEffect(() => {
    if (calledRef.current) return;
    calledRef.current = true;

    if (!token) {
      setStatus('error');
      setMessage('No verification token provided.');
      return;
    }

    authAPI.verifyEmail(token)
      .then((res) => {
        setStatus('success');
        setMessage(res.message || 'Email verified. You can now log in.');
      })
      .catch((err) => {
        setStatus('error');
        setMessage(
          err.response?.data?.error ||
          err.response?.data?.detail ||
          'This verification link is invalid or has expired.'
        );
      });
  }, [token]);

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
        <div className="login-form">
          <h2>Verify your email</h2>

          {status === 'verifying' && (
            <p className="subtitle">Verifying your account...</p>
          )}

          {status === 'success' && (
            <div className="success-message">{message}</div>
          )}

          {status === 'error' && (
            <div className="error-message">{message}</div>
          )}

          <p className="auth-link-row">
            <Link to="/login" className="link-button">Go to login</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;
