import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
    }),
  });
  const [error, setError] = useState<string>('');
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      if (isLogin) {
        await login(formData as LoginCredentials);
      } else {
        await register(formData as RegisterData);
      }
      navigate('/');
    } catch (err: any) {
      const errorMessage = err.response?.data?.error || 
                          err.response?.data?.detail || 
                          err.message || 
                          'An error occurred. Please try again.';
      setError(errorMessage);
      console.error('Auth error:', err.response?.data || err);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

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
          className={`tab ${isLogin ? 'active' : ''}`}
          onClick={() => setIsLogin(true)}
        >
          Login
        </button>
        <button
          className={`tab ${!isLogin ? 'active' : ''}`}
          onClick={() => setIsLogin(false)}
        >
          Register
        </button>
      </div>

      <div className="login-card">
        <form onSubmit={handleSubmit} className="login-form">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
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
            <div className="radio-group">
              <label className="radio-label">I am a:</label>
              <ul className="radio-list">
                <li>
                  <label>
                    <input
                      type="radio"
                      name="isStudent"
                      value="true"
                      checked={(formData as RegisterData).isStudent === true}
                      onChange={() => setFormData(prev => ({ ...prev, isStudent: true }))}
                    />
                    <span className="radio-custom"></span>
                    Student
                  </label>
                </li>
                <li>
                  <label>
                    <input
                      type="radio"
                      name="isStudent"
                      value="false"
                      checked={(formData as RegisterData).isStudent === false}
                      onChange={() => setFormData(prev => ({ ...prev, isStudent: false }))}
                    />
                    <span className="radio-custom"></span>
                    Teacher
                  </label>
                </li>
              </ul>
            </div>
          )}

          <button type="submit" className="submit-button">
            {isLogin ? 'Login' : 'Register'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;

