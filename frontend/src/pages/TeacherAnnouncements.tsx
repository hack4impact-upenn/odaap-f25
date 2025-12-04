import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, announcementAPI } from '../services/api';
import type { Course, Announcement } from '../types';
import './TeacherAnnouncements.css';

const TeacherAnnouncements: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [_courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCourse) {
      loadAnnouncements();
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      if (user) {
        const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
        setCourses(enrolledCourses);
        if (enrolledCourses.length > 0) {
          setSelectedCourse(enrolledCourses[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnnouncements = async () => {
    if (!selectedCourse) return;
    try {
      const announcementsData = await announcementAPI.getAll(selectedCourse);
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const handleDelete = async (id: number) => {
    if (window.confirm('Are you sure you want to delete this announcement?')) {
      try {
        await announcementAPI.delete(id);
        await loadAnnouncements();
      } catch (error) {
        console.error('Error deleting announcement:', error);
        alert('Error deleting announcement');
      }
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourse || !newAnnouncement.title.trim() || !newAnnouncement.content.trim()) {
      alert('Please fill in both title and content');
      return;
    }

    try {
      await announcementAPI.create({
        course: selectedCourse,
        title: newAnnouncement.title,
        content: newAnnouncement.content,
        is_posted: true,
      });
      setShowCreateModal(false);
      setNewAnnouncement({ title: '', content: '' });
      await loadAnnouncements();
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Error creating announcement');
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="teacher-announcements">
      <Header />
      
      <div className="announcements-content">
        <nav className="teacher-nav">
          <button onClick={() => navigate('/')}>
            📊 Overview
          </button>
          <button onClick={() => navigate('/teacher/modules')}>
            🎓 Modules
          </button>
          <button className="active">
            📢 Announcements
          </button>
          <button onClick={() => navigate('/')}>
            ✓ Grading
          </button>
          <button onClick={() => navigate('/teacher/settings')}>
            ⚙️ Settings
          </button>
        </nav>

        <div className="announcements-header">
          <h1>Course Announcements</h1>
          <button className="create-button" onClick={() => setShowCreateModal(true)}>
            + Create Announcement
          </button>
        </div>

        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Create Announcement</h2>
              <form onSubmit={handleCreate}>
                <div className="form-field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={newAnnouncement.title}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Announcement title"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Content</label>
                  <textarea
                    value={newAnnouncement.content}
                    onChange={(e) => setNewAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Announcement content"
                    rows={6}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit">Create</button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="announcements-list">
          {loading ? (
            <div>Loading...</div>
          ) : announcements.length === 0 ? (
            <div className="no-announcements">
              <p>No announcements yet. Create one to get started!</p>
            </div>
          ) : (
            announcements.map((announcement) => (
              <div key={announcement.id} className="announcement-card">
                <div className="announcement-content">
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                  <span className="announcement-date">{formatDate(announcement.created_at)}</span>
                  {announcement.is_posted && <span className="posted-badge">Posted</span>}
                </div>
                <button 
                  className="delete-btn"
                  onClick={() => handleDelete(announcement.id)}
                >
                  🗑️
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default TeacherAnnouncements;
