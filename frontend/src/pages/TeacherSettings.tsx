import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI, authAPI, resourceAPI } from '../services/api';
import type { Resource, ResourceLink } from '../types';
import './TeacherSettings.css';

const TeacherSettings: React.FC = () => {
  const { selectedCourse, courses, setSelectedCourse, loadCourses } = useCourse();
  const [zoomLink, setZoomLink] = useState('');
  const [meetingSchedule, setMeetingSchedule] = useState('Every Friday, Saturday (2:00 - 3:00 pm)');
  const [ceuCreditAppLink, setCeuCreditAppLink] = useState('');
  const [ceuAct48Link, setCeuAct48Link] = useState('');
  const [ceuProgramEvalLink, setCeuProgramEvalLink] = useState('');
  const [showCreateCourse, setShowCreateCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDescription, setNewCourseDescription] = useState('');
  const [sourceCourseId, setSourceCourseId] = useState<number | null>(null);
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [showAddTeacher, setShowAddTeacher] = useState(false);
  const [teacherFirstName, setTeacherFirstName] = useState('');
  const [teacherLastName, setTeacherLastName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');
  const [teacherCourseIds, setTeacherCourseIds] = useState<number[]>([]);
  const [isInvitingTeacher, setIsInvitingTeacher] = useState(false);
  const [resources, setResources] = useState<Resource[]>([]);
  const [showAddResource, setShowAddResource] = useState(false);
  const [editingResourceId, setEditingResourceId] = useState<number | null>(null);
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceDescription, setResourceDescription] = useState('');
  const [resourceLinks, setResourceLinks] = useState<ResourceLink[]>([{ label: '', url: '' }]);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCourse) {
      setZoomLink(selectedCourse.zoom_link || '');
      setCeuCreditAppLink(selectedCourse.ceu_credit_application_link || '');
      setCeuAct48Link(selectedCourse.ceu_act48_application_link || '');
      setCeuProgramEvalLink(selectedCourse.ceu_program_evaluation_link || '');
      loadResources();
    }
  }, [selectedCourse]);

  const loadResources = async () => {
    if (!selectedCourse) return;
    try {
      const data = await resourceAPI.getAll(selectedCourse.id);
      setResources(data);
    } catch (error) {
      console.error('Error loading resources:', error);
    }
  };

  const handleCourseChange = (courseId: number) => {
    const course = courses.find(c => c.id === courseId);
    if (course) {
      setSelectedCourse(course);
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

  const handleInviteTeacher = async () => {
    if (!teacherEmail.trim() || !teacherPassword.trim() || !teacherFirstName.trim() || !teacherLastName.trim()) {
      alert('Please fill in all fields');
      return;
    }

    try {
      setIsInvitingTeacher(true);
      const result = await authAPI.inviteTeacher({
        email: teacherEmail.trim(),
        password: teacherPassword,
        first_name: teacherFirstName.trim(),
        last_name: teacherLastName.trim(),
        course_ids: teacherCourseIds,
      });

      const courseMsg = result.added_to_courses.length > 0
        ? ` Added to: ${result.added_to_courses.join(', ')}`
        : '';
      alert(`Teacher account created for ${result.user.first_name} ${result.user.last_name}!${courseMsg}`);

      setTeacherFirstName('');
      setTeacherLastName('');
      setTeacherEmail('');
      setTeacherPassword('');
      setTeacherCourseIds([]);
      setShowAddTeacher(false);
    } catch (error: any) {
      console.error('Error inviting teacher:', error);
      const errorMessage = error?.response?.data?.error ||
                          error?.response?.data?.detail ||
                          error?.message ||
                          'Error creating teacher account. Please try again.';
      alert(errorMessage);
    } finally {
      setIsInvitingTeacher(false);
    }
  };

  const toggleTeacherCourse = (courseId: number) => {
    setTeacherCourseIds(prev =>
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  const resetResourceForm = () => {
    setResourceTitle('');
    setResourceDescription('');
    setResourceLinks([{ label: '', url: '' }]);
    setShowAddResource(false);
    setEditingResourceId(null);
  };

  const handleAddResourceLink = () => {
    setResourceLinks(prev => [...prev, { label: '', url: '' }]);
  };

  const handleRemoveResourceLink = (index: number) => {
    setResourceLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleResourceLinkChange = (index: number, field: 'label' | 'url', value: string) => {
    setResourceLinks(prev => prev.map((link, i) => i === index ? { ...link, [field]: value } : link));
  };

  const handleSaveResource = async () => {
    if (!selectedCourse || !resourceTitle.trim()) {
      alert('Please enter a title');
      return;
    }

    const filteredLinks = resourceLinks.filter(l => l.label.trim() && l.url.trim());

    try {
      if (editingResourceId) {
        await resourceAPI.update(editingResourceId, {
          title: resourceTitle.trim(),
          description: resourceDescription.trim() || undefined,
          links: filteredLinks,
        });
      } else {
        await resourceAPI.create({
          course: selectedCourse.id,
          title: resourceTitle.trim(),
          description: resourceDescription.trim() || undefined,
          links: filteredLinks,
          order: resources.length,
        });
      }
      resetResourceForm();
      await loadResources();
    } catch (error: any) {
      console.error('Error saving resource:', error);
      const msg = error?.response?.data?.error || error?.message || 'Error saving resource';
      alert(msg);
    }
  };

  const handleEditResource = (resource: Resource) => {
    setEditingResourceId(resource.id);
    setResourceTitle(resource.title);
    setResourceDescription(resource.description || '');
    setResourceLinks(resource.links.length > 0 ? resource.links : [{ label: '', url: '' }]);
    setShowAddResource(true);
  };

  const handleDeleteResource = async (id: number) => {
    if (!confirm('Are you sure you want to delete this resource?')) return;
    try {
      await resourceAPI.delete(id);
      await loadResources();
    } catch (error: any) {
      console.error('Error deleting resource:', error);
      alert('Error deleting resource');
    }
  };

  const handleDeleteCourse = async () => {
    if (!selectedCourse) return;
    const confirmed = confirm(
      `Are you sure you want to permanently delete "${selectedCourse.course_name}" and ALL of its data (modules, questions, submissions, grades, resources, announcements)? This cannot be undone.`
    );
    if (!confirmed) return;

    const doubleConfirm = confirm(
      `This is your last chance. Type OK to confirm you want to delete "${selectedCourse.course_name}" forever.`
    );
    if (!doubleConfirm) return;

    try {
      await courseAPI.delete(selectedCourse.id);
      alert('Course deleted successfully.');
      await loadCourses();
      navigate('/');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to delete course';
      alert(msg);
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
          <div className="settings-card people-card">
            <h2>People</h2>

            <div className="people-subsection">
              <h3 className="people-subsection-title">Student Enrollment Code</h3>
              <p className="people-subsection-description">Share this code with students so they can enroll in this course.</p>
              {selectedCourse?.student_enrollment_code ? (
                <div className="enrollment-code-readonly">
                  <span className="enrollment-code-value">{selectedCourse.student_enrollment_code}</span>
                  <button
                    className="copy-code-button"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedCourse.student_enrollment_code || '');
                      alert('Enrollment code copied!');
                    }}
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <p className="no-code-message">No enrollment code yet. It will be generated automatically.</p>
              )}
            </div>

            <div className="people-divider" />

            <div className="people-subsection">
              <h3 className="people-subsection-title">Add Teacher</h3>
              <p className="people-subsection-description">Create a new teacher account and add them to your courses.</p>
              {!showAddTeacher ? (
                <button
                  className="add-teacher-toggle-button"
                  onClick={() => setShowAddTeacher(true)}
                >
                  + Add a Teacher
                </button>
              ) : (
                <div className="add-teacher-form">
                  <div className="add-teacher-form-row">
                    <div className="form-group">
                      <label>First Name *</label>
                      <input
                        type="text"
                        value={teacherFirstName}
                        onChange={(e) => setTeacherFirstName(e.target.value)}
                        placeholder="First name"
                      />
                    </div>
                    <div className="form-group">
                      <label>Last Name *</label>
                      <input
                        type="text"
                        value={teacherLastName}
                        onChange={(e) => setTeacherLastName(e.target.value)}
                        placeholder="Last name"
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Email *</label>
                    <input
                      type="email"
                      value={teacherEmail}
                      onChange={(e) => setTeacherEmail(e.target.value)}
                      placeholder="teacher@example.com"
                    />
                  </div>
                  <div className="form-group">
                    <label>Temporary Password *</label>
                    <input
                      type="text"
                      value={teacherPassword}
                      onChange={(e) => setTeacherPassword(e.target.value)}
                      placeholder="Set a temporary password"
                    />
                  </div>
                  {courses.length > 0 && (
                    <div className="form-group">
                      <label>Add to Courses (Optional)</label>
                      <div className="course-select-list">
                        {courses.map((course) => (
                          <button
                            key={course.id}
                            type="button"
                            className={`course-select-item ${teacherCourseIds.includes(course.id) ? 'selected' : ''}`}
                            onClick={() => toggleTeacherCourse(course.id)}
                          >
                            {course.course_name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="add-teacher-actions">
                    <button
                      className="add-teacher-submit-button"
                      onClick={handleInviteTeacher}
                      disabled={isInvitingTeacher || !teacherEmail.trim() || !teacherPassword.trim() || !teacherFirstName.trim() || !teacherLastName.trim()}
                    >
                      {isInvitingTeacher ? 'Creating...' : 'Create Teacher Account'}
                    </button>
                    <button
                      className="add-teacher-cancel-button"
                      onClick={() => {
                        setShowAddTeacher(false);
                        setTeacherFirstName('');
                        setTeacherLastName('');
                        setTeacherEmail('');
                        setTeacherPassword('');
                        setTeacherCourseIds([]);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

      <div className="settings-card zoom-card">
      <h2>🎥 Recurring Zoom Link</h2>
      <p className="zoom-description">
        Set up a recurring Zoom link for students to join class.
      </p>

      <div className="zoom-form">
        <div className="form-group">
          <label htmlFor="zoom-link">Zoom Meeting Link</label>
          <div className="zoom-link-row">
            <input
              id="zoom-link"
              type="text"
              value={zoomLink}
              onChange={(e) => setZoomLink(e.target.value)}
              placeholder="https://zoom.us/j/..."
            />
            <button className="update-zoom-button" onClick={handleUpdateZoom}>
              Update Zoom
            </button>
          </div>
        </div>
      </div>
  </div>
                

          <div className="settings-card resources-card">
            <h2>📚 Student Resources</h2>
            <p className="resources-description">Add resource sections visible to students. Each section can have a title, description, and links.</p>

            {resources.length > 0 && (
              <div className="resources-list">
                {resources.map((resource) => (
                  <div key={resource.id} className="resource-item">
                    <div className="resource-item-header">
                      <div>
                        <h4 className="resource-item-title">{resource.title}</h4>
                        {resource.description && (
                          <p className="resource-item-description">{resource.description}</p>
                        )}
                      </div>
                      <div className="resource-item-actions">
                        <button className="resource-edit-btn" onClick={() => handleEditResource(resource)}>✏️ Edit</button>
                        <button className="resource-delete-btn" onClick={() => handleDeleteResource(resource.id)}>🗑️ Delete</button>
                      </div>
                    </div>
                    {resource.links.length > 0 && (
                      <div className="resource-item-links">
                        {resource.links.map((link, i) => (
                          <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="resource-link-pill">
                            {link.label}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {!showAddResource ? (
              <button className="add-resource-button" onClick={() => { resetResourceForm(); setShowAddResource(true); }}>
                + Add Resource Section
              </button>
            ) : (
              <div className="resource-form">
                <div className="form-group">
                  <label>Title *</label>
                  <input
                    type="text"
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="e.g., Helpful Videos, Reading Materials"
                  />
                </div>
                <div className="form-group">
                  <label>Description (Optional)</label>
                  <textarea
                    value={resourceDescription}
                    onChange={(e) => setResourceDescription(e.target.value)}
                    placeholder="Brief description of these resources"
                    rows={2}
                  />
                </div>
                <div className="form-group">
                  <label>Links</label>
                  <div className="resource-links-editor">
                    {resourceLinks.map((link, index) => (
                      <div key={index} className="resource-link-row">
                        <input
                          type="text"
                          value={link.label}
                          onChange={(e) => handleResourceLinkChange(index, 'label', e.target.value)}
                          placeholder="Link label"
                          className="resource-link-label-input"
                        />
                        <input
                          type="text"
                          value={link.url}
                          onChange={(e) => handleResourceLinkChange(index, 'url', e.target.value)}
                          placeholder="https://..."
                          className="resource-link-url-input"
                        />
                        {resourceLinks.length > 1 && (
                          <button className="resource-link-remove" onClick={() => handleRemoveResourceLink(index)}>
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button className="resource-add-link-btn" onClick={handleAddResourceLink}>
                      + Add another link
                    </button>
                  </div>
                </div>
                <div className="resource-form-actions">
                  <button
                    className="resource-save-btn"
                    onClick={handleSaveResource}
                    disabled={!resourceTitle.trim()}
                  >
                    {editingResourceId ? 'Save Changes' : 'Add Resource'}
                  </button>
                  <button className="resource-cancel-btn" onClick={resetResourceForm}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="settings-card danger-card">
            <h2>Delete Course</h2>
            <p className="danger-description">
              Permanently delete this course and all associated data including modules, questions, submissions, grades, resources, and announcements. This action cannot be undone.
            </p>
            <button
              className="delete-course-button"
              onClick={handleDeleteCourse}
              disabled={!selectedCourse}
            >
              🗑️ Delete Course
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default TeacherSettings;
