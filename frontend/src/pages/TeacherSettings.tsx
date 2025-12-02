import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { courseAPI } from '../services/api';
import type { Course } from '../types';
import './TeacherSettings.css';

const TeacherSettings: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [zoomLink, setZoomLink] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [studentCode, setStudentCode] = useState('DYC126');
  const [teacherCode, setTeacherCode] = useState('DYC126');

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
      const courseList = await courseAPI.getAll();
      setCourses(courseList);
      if (courseList.length > 0) {
        setSelectedCourse(courseList[0]);
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
    } catch (error) {
      console.error('Error updating zoom link:', error);
      alert('Error updating zoom link');
    }
  };

  return (
    <div className="teacher-settings">
      <Header />
      
      <div className="settings-content">
        <h1>Settings</h1>

        <div className="settings-section">
          <h2>Student Class Enrollment Code</h2>
          <div className="code-display">
            <span className="code-value">{studentCode}</span>
            <button 
              className="copy-button"
              onClick={() => handleCopyCode(studentCode, 'Student')}
            >
              Copy Code
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Teacher Class Enrollment Code</h2>
          <div className="code-display">
            <span className="code-value">{teacherCode}</span>
            <button 
              className="copy-button"
              onClick={() => handleCopyCode(teacherCode, 'Teacher')}
            >
              Copy Code
            </button>
          </div>
        </div>

        <div className="settings-section">
          <h2>Recurring Zoom Link</h2>
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
  );
};

export default TeacherSettings;

