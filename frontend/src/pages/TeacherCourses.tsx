import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI } from '../services/api';
import type { Course } from '../types';
import './TeacherCourses.css';

const TeacherCourses: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { courses, selectedCourse, setSelectedCourse, loadCourses } = useCourse();

  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [sourceCourseId, setSourceCourseId] = useState<number | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);

  const handleOpenCourse = (course: Course) => {
    setSelectedCourse(course);
    navigate('/teacher/settings');
  };

  const handleCreateCourse = async () => {
    if (!user) return;

    if (!newCourseName.trim()) {
      alert('Please enter a course name');
      return;
    }

    try {
      setIsCreatingCourse(true);

      const courseData: any = {
        course_name: newCourseName.trim(),
        course_description: newCourseDescription.trim() || undefined,
        score_total: 0,
      };

      if (sourceCourseId) {
        courseData.source_course_id = sourceCourseId;
      }

      const newCourse = await courseAPI.create(courseData);

      alert(
        sourceCourseId
          ? 'Course created successfully! Modules and questions have been copied (without due dates and not posted).'
          : 'Course created successfully!'
      );

      setNewCourseName('');
      setNewCourseDescription('');
      setSourceCourseId(null);
      setShowCreateCourse(false);

      await loadCourses();
      setSelectedCourse(newCourse);
      navigate('/teacher/settings');
    } catch (error: any) {
      console.error('Error creating course:', error);
      const errorMessage =
        error?.response?.data?.error ||
        error?.response?.data?.detail ||
        error?.message ||
        'Error creating course. Please try again.';
      alert(errorMessage);
    } finally {
      setIsCreatingCourse(false);
    }
  };

  return (
    <div className="teacher-courses">
      <Header />

      <div className="courses-content">
        <nav className="teacher-nav">
          <button onClick={() => navigate('/')}>📊 Overview</button>
          <button onClick={() => navigate('/teacher/modules')}>🎓 Modules</button>
          <button onClick={() => navigate('/teacher/announcements')}>📢 Announcements</button>
          <button onClick={() => navigate('/teacher/grading')}>✓ Grading</button>
          <button onClick={() => navigate('/teacher/settings')}>⚙️ Settings</button>
        </nav>

        <div className="courses-header">
          <div>
            <h1>Your Courses</h1>
            <p className="courses-subtitle">
              Select a course to manage its modules, content, and settings.
            </p>
          </div>
          <button
            className="create-course-button"
            onClick={() => setShowCreateCourse((v) => !v)}
          >
            {showCreateCourse ? 'Cancel' : '+ Create New Course'}
          </button>
        </div>

        {showCreateCourse && (
          <div className="settings-card create-course-card">
            <h2>➕ Create New Course</h2>
            <p className="create-course-description">
              Create a new course to start adding modules and content. Optionally copy modules,
              questions, and resources from an existing course.
            </p>
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
                    onChange={(e) =>
                      setSourceCourseId(e.target.value ? Number(e.target.value) : null)
                    }
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
                      Modules, questions, and resources will be copied. Due dates will be removed
                      and modules will not be posted.
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

        {courses.length === 0 ? (
          <div className="courses-empty">
            <p>You don't have any courses yet.</p>
            <button
              className="create-course-button"
              onClick={() => setShowCreateCourse(true)}
            >
              + Create your first course
            </button>
          </div>
        ) : (
          <div className="courses-grid" role="list">
            {courses.map((course) => {
              const isCurrent = selectedCourse?.id === course.id;
              return (
                <button
                  key={course.id}
                  type="button"
                  role="listitem"
                  className={`course-card ${isCurrent ? 'is-current' : ''}`}
                  onClick={() => handleOpenCourse(course)}
                  aria-label={`Open ${course.course_name}`}
                >
                  {isCurrent && <span className="course-card-badge">Current</span>}
                  <h3 className="course-card-title">{course.course_name}</h3>
                  {course.course_description && (
                    <p className="course-card-description">{course.course_description}</p>
                  )}
                  <span className="course-card-cta">Open course →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherCourses;
