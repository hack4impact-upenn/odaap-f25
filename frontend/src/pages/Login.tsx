import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authAPI } from '../services/api';
import type { LoginCredentials, RegisterData } from '../types';
import './Login.css';

const Login: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState<LoginCredentials | RegisterData>({
    email: '',
    password: '',
    ...(isLogin ? {} : {
      first_name: '',
      last_name: '',
      isStudent: true,
      enrollment_code: '',
    }),
  });
  const [error, setError] = useState<string>('');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string>('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const isEmailUnverifiedError = (err: any): boolean => {
    const data = err?.response?.data;
    if (!data) return false;
    if (data.code === 'email_unverified') return true;
    if (typeof data.detail === 'object' && data.detail?.code === 'email_unverified') return true;
    const haystack = JSON.stringify(data).toLowerCase();
    return haystack.includes('verify your email');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setResendNotice('');

    try {
      if (isLogin) {
        await login(formData as LoginCredentials);
        navigate('/');
      } else {
        const result = await register(formData as RegisterData);
        if (result.needs_verification) {
          setPendingVerificationEmail(result.email || formData.email);
        } else {
          navigate('/');
        }
      }
    } catch (err: any) {
      if (isLogin && isEmailUnverifiedError(err)) {
        // Login attempt against an unverified account — show the "check your email" screen.
        setPendingVerificationEmail(formData.email);
      } else if (isLogin && err.response?.status === 400) {
        setError('password and username incorrect');
      } else {
        const data = err.response?.data;
        const errorMessage =
          (typeof data?.detail === 'object' ? data.detail.detail : data?.detail) ||
          data?.error ||
          data?.non_field_errors?.[0] ||
          err.message ||
          'An error occurred. Please try again.';
        setError(errorMessage);
      }
      console.error('Auth error:', err.response?.data || err);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerificationEmail) return;
    setResendNotice('');
    try {
      await authAPI.resendVerification(pendingVerificationEmail);
      setResendNotice('Verification email re-sent. Please check your inbox.');
    } catch (err: any) {
      setResendNotice('Could not resend right now. Please try again in a minute.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleTabSwitch = (loginMode: boolean) => {
    setIsLogin(loginMode);
    if (loginMode) {
      setFormData({
        email: '',
        password: '',
      });
    } else {
      setFormData({
        email: '',
        password: '',
        first_name: '',
        last_name: '',
        isStudent: true,
        enrollment_code: '',
      } as RegisterData);
    }
    setError('');
  };

  if (pendingVerificationEmail) {
    return (
      <div className="login-container">
        <div className="login-header">
          <div className="logo">
            <img src="/logo.png" alt="ODAAP" className="logo-image" />
            <span className="logo-text" style={{ fontSize: '35px', fontWeight: '600', color: '#4a148c' }}>ODAAP Classroom</span>
          </div>
        </div>

        <div className="login-card">
          <div className="login-form">
            <h2>Check your email</h2>
            <p className="subtitle">
              We sent a verification link to <strong>{pendingVerificationEmail}</strong>.
              Click the link to activate your account, then log in.
            </p>

            {resendNotice && <div className="success-message">{resendNotice}</div>}

            <button
              type="button"
              className="submit-button"
              onClick={handleResendVerification}
            >
              Resend verification email
            </button>

            <p className="auth-link-row">
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setPendingVerificationEmail(null);
                  setResendNotice('');
                  setError('');
                  handleTabSwitch(true);
                }}
              >
                Back to login
              </button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-header">
        <div className="logo">
          <img src="/logo.png" alt="ODAAP" className="logo-image" />
          <span className="logo-text" style={{ fontSize: '35px', fontWeight: '600', color: '#4a148c' }}>ODAAP Classroom</span>
        </div>
      </div>

      <div className="login-tabs">
        <button
          type="button"
          className={`tab ${isLogin ? 'active' : ''}`}
          onClick={() => handleTabSwitch(true)}
        >
          Login
        </button>
        <button
          type="button"
          className={`tab ${!isLogin ? 'active' : ''}`}
          onClick={() => handleTabSwitch(false)}
        >
          Register
        </button>
      </div>

      <div className="login-card">
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isLogin ? 'Welcome Back' : 'Create Student Account'}</h2>
          <p className="subtitle">{isLogin ? 'Login to your account.' : 'Sign up to get started.'}</p>

          {error && <div className="error-message">{error}</div>}

          {!isLogin && (
            <>
              <div className="form-field">
                <label htmlFor="first_name">First Name</label>
                <input
                  type="text"
                  id="first_name"
                  name="first_name"
                  value={(formData as RegisterData).first_name || ''}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="last_name">Last Name</label>
                <input
                  type="text"
                  id="last_name"
                  name="last_name"
                  value={(formData as RegisterData).last_name || ''}
                  onChange={handleChange}
                  required
                />
              </div>
            </>
          )}

          <div className="form-field">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
            />
          </div>

          {!isLogin && (
            <div className="form-field">
              <label htmlFor="enrollment_code">Enrollment Code *</label>
              <input
                type="text"
                id="enrollment_code"
                name="enrollment_code"
                value={(formData as RegisterData).enrollment_code || ''}
                onChange={handleChange}
                placeholder="Enter course enrollment code"
                required
              />
            </div>
          )}

          <button type="submit" className="submit-button">
            {isLogin ? 'Login' : 'Register'}
          </button>

          {isLogin && (
            <p className="auth-link-row">
              <Link to="/forgot-password" className="link-button">Forgot your password?</Link>
            </p>
          )}
        </form>
      </div>
    </div>
  );
};

export default Login;
