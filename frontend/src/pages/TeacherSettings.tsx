import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI } from '../services/api';
import type { Course } from '../types';
import './TeacherSettings.css';

const TeacherSettings: React.FC = () => {
  const [_courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [zoomLink, setZoomLink] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('Every Friday, Saturday (2:00 - 3:00 pm)');
  const [studentCode, setStudentCode] = useState('DYC126');
  const [teacherCode, setTeacherCode] = useState('DYC126');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      setZoomLink(selectedCourse.zoom_link || '');
    }
  }, [selectedCourse]);

  const loadCourses = async () => {
    try {
      if (user) {
        const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
        setCourses(enrolledCourses);
        if (enrolledCourses.length > 0) {
          setSelectedCourse(enrolledCourses[0]);
          // Generate codes based on course ID (in real app, these would come from backend)
          setStudentCode(`STU${enrolledCourses[0].id.toString().padStart(3, '0')}`);
          setTeacherCode(`TCH${enrolledCourses[0].id.toString().padStart(3, '0')}`);
        }
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    }
  };

  const handleCopyCode = (code: string, type: string) => {
    navigator.clipboard.writeText(code);
    alert(`${type} code copied to clipboard!`);
  };

  const handleUpdateZoom = async () => {
    if (!selectedCourse) return;

    try {
      await courseAPI.updateZoomLink(selectedCourse.id, zoomLink);
      alert('Zoom link updated successfully!');
      // Reload courses to get updated data
      await loadCourses();
    } catch (error: any) {
      console.error('Error updating zoom link:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Error updating zoom link. Please try again.';
      alert(errorMessage);
    }
  };

  return (
    <div className="teacher-settings">
      <Header />
      
      <div className="settings-content">
        <nav className="teacher-nav">
          <button onClick={() => navigate('/')}>
            📊 Overview
          </button>
          <button onClick={() => navigate('/teacher/modules')}>
            🎓 Modules
          </button>
          <button onClick={() => navigate('/teacher/announcements')}>
            📢 Announcements
          </button>
          <button onClick={() => navigate('/')}>
            ✓ Grading
          </button>
          <button className="active">
            ⚙️ Settings
          </button>
        </nav>

        <h1>Settings</h1>

        <div className="settings-grid">
          <div className="settings-card student-code-card">
            <h2>Student Class Enrollment Code</h2>
            <div className="code-display">
              <input
                type="text"
                className="code-input"
                value={studentCode}
                readOnly
              />
              <button 
                className="copy-button"
                onClick={() => handleCopyCode(studentCode, 'Student')}
              >
                📋 Copy Code
              </button>
            </div>
          </div>

          <div className="settings-card teacher-code-card">
            <h2>Teacher Class Enrollment Code</h2>
            <div className="code-display">
              <input
                type="text"
                className="code-input"
                value={teacherCode}
                readOnly
              />
              <button 
                className="copy-button"
                onClick={() => handleCopyCode(teacherCode, 'Teacher')}
              >
                📋 Copy Code
              </button>
            </div>
          </div>

          <div className="settings-card zoom-card">
            <h2>🎥 Recurring Zoom Link</h2>
            <p className="zoom-description">Set up a zoom link for students to join the class.</p>
            <div className="zoom-form">
              <div className="form-group">
                <label>Zoom Meeting Link</label>
                <input
                  type="text"
                  value={zoomLink}
                  onChange={(e) => setZoomLink(e.target.value)}
                  placeholder="https://zoom.us/j/..."
                />
              </div>
              <div className="form-group">
                <label>Meeting Schedule</label>
                <input
                  type="text"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                  placeholder="Every Friday, Saturday (2:00 - 3:00 pm)"
                />
              </div>
              <button className="update-zoom-button" onClick={handleUpdateZoom}>
                Update Zoom
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSettings;
