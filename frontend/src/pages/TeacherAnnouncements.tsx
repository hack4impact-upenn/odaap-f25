import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { announcementAPI } from '../services/api';
import type { Announcement } from '../types';
import './TeacherAnnouncements.css';

const ANNOUNCEMENTS_PER_PAGE = 6;

const TeacherAnnouncements: React.FC = () => {
  const { user } = useAuth();
  const { selectedCourse, loading: courseLoading } = useCourse();
  const navigate = useNavigate();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [newAnnouncement, setNewAnnouncement] = useState({ title: '', content: '' });
  const [editAnnouncement, setEditAnnouncement] = useState({ title: '', content: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (selectedCourse) {
      loadAnnouncements();
    } else if (!courseLoading) {
      setLoading(false);
    }
  }, [selectedCourse, courseLoading]);

  const announcementTotalPages = Math.max(
    1,
    Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE)
  );

  useEffect(() => {
    setAnnouncementPage(1);
  }, [selectedCourse?.id]);

  useEffect(() => {
    const tp = Math.max(1, Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE));
    setAnnouncementPage((p) => Math.min(p, tp));
  }, [announcements]);

  const paginatedAnnouncements =
    announcements.length === 0
      ? []
      : announcements.slice(
          (announcementPage - 1) * ANNOUNCEMENTS_PER_PAGE,
          announcementPage * ANNOUNCEMENTS_PER_PAGE
        );

  const loadAnnouncements = async () => {
    if (!selectedCourse) return;
    try {
      setLoading(true);
      const announcementsData = await announcementAPI.getAll(selectedCourse.id);
      setAnnouncements(announcementsData);
    } catch (error) {
      console.error('Error loading announcements:', error);
    } finally {
      setLoading(false);
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
        course: selectedCourse.id,
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

  const handleEdit = (announcement: Announcement) => {
    setEditingAnnouncement(announcement);
    setEditAnnouncement({ title: announcement.title, content: announcement.content });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAnnouncement || !selectedCourse || !editAnnouncement.title.trim() || !editAnnouncement.content.trim()) {
      alert('Please fill in both title and content');
      return;
    }

    try {
      await announcementAPI.update(editingAnnouncement.id, {
        course: selectedCourse.id,
        title: editAnnouncement.title,
        content: editAnnouncement.content,
        is_posted: editingAnnouncement.is_posted,
      });
      setShowEditModal(false);
      setEditingAnnouncement(null);
      setEditAnnouncement({ title: '', content: '' });
      await loadAnnouncements();
    } catch (error: any) {
      console.error('Error updating announcement:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.detail || 
                          'Error updating announcement';
      alert(errorMessage);
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
        {selectedCourse && (
          <h2 className="teacher-course-title">{selectedCourse.course_name}</h2>
        )}
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
          <button onClick={() => navigate('/teacher/grading')}>
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

        {showEditModal && editingAnnouncement && (
          <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h2>Edit Announcement</h2>
              <form onSubmit={handleUpdate}>
                <div className="form-field">
                  <label>Title</label>
                  <input
                    type="text"
                    value={editAnnouncement.title}
                    onChange={(e) => setEditAnnouncement(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="Announcement title"
                    required
                  />
                </div>
                <div className="form-field">
                  <label>Content</label>
                  <textarea
                    value={editAnnouncement.content}
                    onChange={(e) => setEditAnnouncement(prev => ({ ...prev, content: e.target.value }))}
                    placeholder="Announcement content"
                    rows={6}
                    required
                  />
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={() => {
                    setShowEditModal(false);
                    setEditingAnnouncement(null);
                    setEditAnnouncement({ title: '', content: '' });
                  }}>
                    Cancel
                  </button>
                  <button type="submit">Update</button>
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
            paginatedAnnouncements.map((announcement) => (
              <div key={announcement.id} className="announcement-card">
                <div className="announcement-content">
                  <h3>{announcement.title}</h3>
                  <p>{announcement.content}</p>
                  <span className="announcement-date">{formatDate(announcement.created_at)}</span>
                  {announcement.is_posted && <span className="posted-badge">Posted</span>}
                </div>
                <div className="announcement-actions">
                  <button 
                    className="edit-btn"
                    onClick={() => handleEdit(announcement)}
                    title="Edit announcement"
                  >
                    ✏️
                  </button>
                  <button 
                    className="delete-btn"
                    onClick={() => handleDelete(announcement.id)}
                    title="Delete announcement"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
        {!loading && announcements.length > ANNOUNCEMENTS_PER_PAGE && (
          <div className="announcements-pagination" role="navigation" aria-label="Announcements pages">
            <button
              type="button"
              className="announcements-page-btn"
              disabled={announcementPage <= 1}
              onClick={() => setAnnouncementPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </button>
            <span className="announcements-page-info">
              Page {announcementPage} of {announcementTotalPages}
              <span className="announcements-page-range">
                {' '}
                ({(announcementPage - 1) * ANNOUNCEMENTS_PER_PAGE + 1}–
                {Math.min(announcementPage * ANNOUNCEMENTS_PER_PAGE, announcements.length)} of{' '}
                {announcements.length})
              </span>
            </span>
            <button
              type="button"
              className="announcements-page-btn"
              disabled={announcementPage >= announcementTotalPages}
              onClick={() =>
                setAnnouncementPage((p) => Math.min(announcementTotalPages, p + 1))
              }
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherAnnouncements;
