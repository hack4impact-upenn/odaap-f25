import React, { useState } from 'react';
import Header from '../components/Header';
import './TeacherAnnouncements.css';

const TeacherAnnouncements: React.FC = () => {
  const [announcements, setAnnouncements] = useState([
    { id: 1, title: 'Announcement 1', content: 'Content here', date: 'Oct 10, 2025', posted: true },
    { id: 2, title: 'Announcement 2', content: 'Content here', date: 'Oct 11, 2025', posted: true },
  ]);

  const handleDelete = (id: number) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      setAnnouncements(prev => prev.filter(a => a.id !== id));
    }
  };

  const handleCreate = () => {
    // TODO: Open create announcement modal
    alert('Create announcement functionality coming soon');
  };

  return (
    <div className="teacher-announcements">
      <Header />
      
      <div className="announcements-content">
        <div className="announcements-header">
          <h1>Course Announcements</h1>
          <button className="create-button" onClick={handleCreate}>
            + Create Announcement
          </button>
        </div>

        <div className="announcements-list">
          {announcements.map((announcement) => (
            <div key={announcement.id} className="announcement-card">
              <div className="announcement-content">
                <h3>{announcement.title}</h3>
                <p>{announcement.content}</p>
                <span className="announcement-date">{announcement.date}</span>
                {announcement.posted && <span className="posted-badge">Posted</span>}
              </div>
              <button 
                className="delete-btn"
                onClick={() => handleDelete(announcement.id)}
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TeacherAnnouncements;

