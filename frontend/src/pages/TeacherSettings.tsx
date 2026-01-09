import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI } from '../services/api';
import type { Course } from '../types';
import './TeacherSettings.css';

const TeacherSettings: React.FC = () => {
  const { selectedCourse, courses, setSelectedCourse, loadCourses } = useCourse();
  const [zoomLink, setZoomLink] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('Every Friday, Saturday (2:00 - 3:00 pm)');
  const [ceuCreditAppLink, setCeuCreditAppLink] = useState('');
  const [ceuAct48Link, setCeuAct48Link] = useState('');
  const [ceuProgramEvalLink, setCeuProgramEvalLink] = useState('');
  const [enrollmentCode, setEnrollmentCode] = useState('');
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [sourceCourseId, setSourceCourseId] = useState<number | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCourse) {
      setZoomLink(selectedCourse.zoom_link || '');
      setCeuCreditAppLink(selectedCourse.ceu_credit_application_link || '');
      setCeuAct48Link(selectedCourse.ceu_act48_application_link || '');
      setCeuProgramEvalLink(selectedCourse.ceu_program_evaluation_link || '');
      setEnrollmentCode(selectedCourse.student_enrollment_code || '');
    }
  }, [selectedCourse]);

  const handleCourseChange = (courseId: number) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
    }
  };

  const handleUpdateEnrollmentCode = async () => {
    if (!selectedCourse) return;

    try {
      await courseAPI.update(selectedCourse.id, {
        ...selectedCourse,
        student_enrollment_code: enrollmentCode,
      });
      alert('Enrollment code updated successfully!');
      await loadCourses();
    } catch (error: any) {
      console.error('Error updating enrollment code:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Error updating enrollment code. Please try again.';
      alert(errorMessage);
    }
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

  const handleUpdateCEULinks = async () => {
    if (!selectedCourse) return;

    try {
      await courseAPI.updateCEULinks(selectedCourse.id, {
        ceu_credit_application_link: ceuCreditAppLink,
        ceu_act48_application_link: ceuAct48Link,
        ceu_program_evaluation_link: ceuProgramEvalLink,
      });
      alert('CEU links updated successfully!');
      // Reload courses to get updated data
      await loadCourses();
    } catch (error: any) {
      console.error('Error updating CEU links:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Error updating CEU links. Please try again.';
      alert(errorMessage);
    }
  };

  const handleCreateCourse = async () => {
    if (!user) return;
    
    if (!newCourseName.trim()) {
      alert('Please enter a course name');
      return;
    }

    try {
      setIsCreatingCourse(true);
      
      // Create the course with optional source course for copying
      const courseData: any = {
        course_name: newCourseName.trim(),
        course_description: newCourseDescription.trim() || undefined,
        score_total: 0,
      };
      
      // Add source_course_id if a source course is selected
      if (sourceCourseId) {
        courseData.source_course_id = sourceCourseId;
      }
      
      const newCourse = await courseAPI.create(courseData);

      alert(sourceCourseId 
        ? 'Course created successfully! Modules and questions have been copied (without due dates and not posted).' 
        : 'Course created successfully!');
      
      // Reset form
      setNewCourseName('');
      setNewCourseDescription('');
      setSourceCourseId(null);
      setShowCreateCourse(false);
      
      // Reload courses and select the new one
      await loadCourses();
      setSelectedCourse(newCourse);
    } catch (error: any) {
      console.error('Error creating course:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Error creating course. Please try again.';
      alert(errorMessage);
    } finally {
      setIsCreatingCourse(false);
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
          <button onClick={() => navigate('/teacher/grading')}>
            ✓ Grading
          </button>
          <button className="active">
            ⚙️ Settings
          </button>
        </nav>

        <h1>Settings</h1>

        <div className="course-selector-section">
          {courses.length > 0 ? (
            <>
              <label htmlFor="course-select">Select Course:</label>
              <select
                id="course-select"
                className="course-select"
                value={selectedCourse?.id || ''}
                onChange={(e) => handleCourseChange(Number(e.target.value))}
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.course_name}
                  </option>
                ))}
              </select>
            </>
          ) : (
            <p className="no-courses-message">No courses yet. Create your first course below.</p>
          )}
          <button 
            className="create-course-button"
            onClick={() => setShowCreateCourse(!showCreateCourse)}
          >
            {showCreateCourse ? 'Cancel' : '+ Create New Course'}
          </button>
        </div>

        {showCreateCourse && (
          <div className="settings-card create-course-card">
            <h2>➕ Create New Course</h2>
            <p className="create-course-description">Create a new course to start adding modules and content. Optionally copy modules and questions from an existing course.</p>
            <div className="create-course-form">
              <div className="form-group">
                <label>Course Name *</label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  placeholder="e.g., Fall 25, Spring 26"
                  className="course-name-input"
                />
              </div>
              <div className="form-group">
                <label>Course Description (Optional)</label>
                <textarea
                  value={newCourseDescription}
                  onChange={(e) => setNewCourseDescription(e.target.value)}
                  placeholder="Enter a description for this course"
                  rows={3}
                  className="course-description-input"
                />
              </div>
              {courses.length > 0 && (
                <div className="form-group">
                  <label>Copy from Existing Course (Optional)</label>
                  <select
                    value={sourceCourseId || ''}
                    onChange={(e) => setSourceCourseId(e.target.value ? Number(e.target.value) : null)}
                    className="source-course-select"
                  >
                    <option value="">-- Create empty course --</option>
                    {courses.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.course_name}
                      </option>
                    ))}
                  </select>
                  {sourceCourseId && (
                    <small className="copy-note">
                      Modules and questions will be copied. Due dates will be removed and modules will not be posted.
                    </small>
                  )}
                </div>
              )}
              <button 
                className="create-course-submit-button" 
                onClick={handleCreateCourse}
                disabled={isCreatingCourse || !newCourseName.trim()}
              >
                {isCreatingCourse ? 'Creating...' : 'Create Course'}
              </button>
            </div>
          </div>
        )}

        <div className="settings-grid">
          <div className="settings-card enrollment-code-card">
            <h2>🎓 Student Enrollment Code</h2>
            <p className="enrollment-description">Share this code with students so they can enroll in this course.</p>
            <div className="enrollment-form">
              <div className="form-group">
                <label>Enrollment Code</label>
                <div className="enrollment-code-display">
                  <input
                    type="text"
                    value={enrollmentCode}
                    onChange={(e) => setEnrollmentCode(e.target.value)}
                    placeholder="Enter enrollment code (e.g., FALL25)"
                    className="enrollment-code-input"
                  />
                  <button className="update-enrollment-button" onClick={handleUpdateEnrollmentCode}>
                    Update Code
                  </button>
                </div>
                {selectedCourse?.student_enrollment_code && (
                  <p className="current-code">Current code: <strong>{selectedCourse.student_enrollment_code}</strong></p>
                )}
              </div>
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

          <div className="settings-card ceu-card">
            <h2>📋 CEU Links</h2>
            <p className="ceu-description">Add links for Continuing Education Credit applications and evaluations. These will appear at the bottom of the student view.</p>
            <div className="ceu-form">
              <div className="form-group">
                <label>Continuing Education Credit Application</label>
                <input
                  type="text"
                  value={ceuCreditAppLink}
                  onChange={(e) => setCeuCreditAppLink(e.target.value)}
                  placeholder="https://www.surveymonkey.com/r/..."
                />
              </div>
              <div className="form-group">
                <label>ACT 48 Application</label>
                <input
                  type="text"
                  value={ceuAct48Link}
                  onChange={(e) => setCeuAct48Link(e.target.value)}
                  placeholder="https://www.surveymonkey.com/r/..."
                />
              </div>
              <div className="form-group">
                <label>Program Evaluation</label>
                <input
                  type="text"
                  value={ceuProgramEvalLink}
                  onChange={(e) => setCeuProgramEvalLink(e.target.value)}
                  placeholder="https://www.surveymonkey.com/r/..."
                />
              </div>
              <button className="update-ceu-button" onClick={handleUpdateCEULinks}>
                Update CEU Links
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherSettings;
