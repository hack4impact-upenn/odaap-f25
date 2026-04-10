import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Header.css';

interface HeaderProps {
  title?: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="logo">
          <img src="/logo.png" alt="ODAAP" className="logo-image" />
          <span className="logo-text">ODAAP Classroom</span>
        </div>
      </div>
      
      {title && <h1 className="header-title">{title}</h1>}
      
      <div className="header-right">
        <div className="user-info">
          <span className="user-icon">👤</span>
          <span className="user-name">
            {user?.first_name} {user?.last_name} 
          </span>
        </div>
        <button onClick={handleLogout} className="logout-button">
          Logout
          <span className="icon-arrow">→</span>
        </button>
      </div>
    </header>
  );
};

export default Header;
