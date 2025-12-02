import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, submissionAPI } from '../services/api';
import type { Course, Module, Submission } from '../types';
import './StudentMain.css';

const formatDate = (dateString?: string) => {
  if (!dateString) return 'TBD';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  } catch {
    return dateString;
  }
};

const StudentMain: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, Submission[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      
      if (!user) return;

      // Load enrolled courses
      const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
      setCourses(enrolledCourses);

      if (enrolledCourses.length > 0) {
        // Load modules for the first course (or you could show all)
        const courseModules = await courseAPI.getModules(enrolledCourses[0].id);
        setModules(courseModules.sort((a, b) => a.module_order - b.module_order));

        // Load submissions for all modules
        const submissionsMap: Record<number, Submission[]> = {};
        for (const module of courseModules) {
          try {
            const moduleSubmissions = await submissionAPI.getAll(undefined, module.id);
            submissionsMap[module.id] = moduleSubmissions.filter(s => s.user_id === user.id);
          } catch (error) {
            submissionsMap[module.id] = [];
          }
        }
        setSubmissions(submissionsMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (module: Module) => {
    const moduleSubmissions = submissions[module.id] || [];
    const hasSubmissions = moduleSubmissions.length > 0;
    
    if (!module.is_posted) {
      return { status: 'locked', label: 'Locked', icon: '🔒' };
    }
    
    if (hasSubmissions) {
      // Check if all questions have submissions
      // For now, if there are any submissions, consider it completed
      const totalScore = moduleSubmissions.reduce((sum, sub) => {
        return sum + (sub.grade?.score || 0);
      }, 0);
      const totalPossible = moduleSubmissions.reduce((sum, sub) => {
        return sum + (sub.grade?.total || 0);
      }, 0);
      
      return {
        status: 'completed',
        label: 'Completed',
        icon: '✓',
        grade: totalPossible > 0 ? `${totalScore}/${totalPossible}` : null
      };
    }
    
    return { status: 'active', label: 'Start Module', icon: module.module_order.toString() };
  };

  const handleModuleClick = (module: Module) => {
    const moduleStatus = getModuleStatus(module);
    if (moduleStatus.status === 'active' || moduleStatus.status === 'completed') {
      navigate(`/student/hw/${module.id}`);
    }
  };


  if (loading) {
    return (
      <div className="student-main">
        <Header />
        <div className="student-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  const currentCourse = courses[0]; // Use first course for now
  const upcomingModules = modules.filter(m => m.is_posted && !submissions[m.id]?.length).slice(0, 1);
  const upcomingAssignment = upcomingModules[0];

  return (
    <div className="student-main">
      <Header />
      
      <div className="student-content">
        <h2 className="term-title">Fall 25</h2>
        
        <div className="main-grid">
          {/* Left Column */}
          <div className="left-column">
            {/* Announcements Card - TODO: Connect to backend */}
            <div className="card announcements-card">
              <h3 className="card-title">Announcements</h3>
              <div className="announcements-list">
                <div className="announcement-item">
                  <div className="announcement-indicator"></div>
                  <div className="announcement-content">
                    <h4 className="announcement-title">No announcements yet</h4>
                    <p className="announcement-description">Check back later for updates</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="right-column">
            {/* Weekly Zoom Meeting Link Card */}
            {currentCourse?.zoom_link && (
              <div className="card zoom-card">
                <h3 className="card-title">Weekly Zoom Meeting Link</h3>
                <p className="zoom-schedule">Every Friday, Saturday (2:00 - 3:00 pm)</p>
                <button 
                  className="zoom-button"
                  onClick={() => window.open(currentCourse.zoom_link, '_blank')}
                >
                  Join Meeting
                  <span className="icon-arrow">→</span>
                </button>
              </div>
            )}

            {/* Upcoming Assignments Card */}
            <div className="card assignments-card">
              <h3 className="card-title">Upcoming Assignments</h3>
              {upcomingAssignment ? (
                <>
                  <p className="assignment-count">1 assignment to complete</p>
                  <div 
                    className="assignment-item clickable"
                    onClick={() => navigate(`/student/hw/${upcomingAssignment.id}`)}
                  >
                    <h4 className="assignment-name">{upcomingAssignment.module_name}</h4>
                    <p className="assignment-description">{upcomingAssignment.module_description || 'Description'}</p>
                    <div className="assignment-due">
                      <span className="icon-clock">🕐</span>
                      <span>Due: {upcomingAssignment.due_date ? formatDate(upcomingAssignment.due_date) : 'TBD'}</span>
                    </div>
                  </div>
                </>
              ) : (
                <p className="assignment-count">No upcoming assignments</p>
              )}
            </div>
          </div>
        </div>

        {/* Course Modules Section */}
        <div className="modules-section">
          <h2 className="section-title">Course Modules</h2>
          {modules.length === 0 ? (
            <div className="card">
              <p>No modules available yet.</p>
            </div>
          ) : (
            <div className="modules-list">
              {modules.map((module) => {
                const moduleStatus = getModuleStatus(module);
                return (
                  <div key={module.id} className="module-card">
                    <div className="module-status-icon">
                      {moduleStatus.status === 'completed' && (
                        <span className="status-checkmark">✓</span>
                      )}
                      {moduleStatus.status === 'active' && (
                        <div className="status-number">{moduleStatus.icon}</div>
                      )}
                      {moduleStatus.status === 'locked' && (
                        <span className="status-lock">🔒</span>
                      )}
                    </div>
                    <div className="module-info">
                      <h3 className="module-name">{module.module_name}</h3>
                      <p className="module-description">{module.module_description || 'Description'}</p>
                      <div className="module-due">
                        <span className="icon-clock">🕐</span>
                        <span>Due: {module.due_date ? formatDate(module.due_date) : 'TBD'}</span>
                      </div>
                    </div>
                    <div className="module-actions">
                      {moduleStatus.status === 'completed' && (
                        <>
                          {moduleStatus.grade && (
                            <span className="module-grade">Grade: {moduleStatus.grade}</span>
                          )}
                          <button className="btn-completed">Completed</button>
                          <button 
                            className="btn-review"
                            onClick={() => handleModuleClick(module)}
                          >
                            Review
                          </button>
                        </>
                      )}
                      {moduleStatus.status === 'active' && (
                        <button 
                          className="btn-start-module"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleModuleClick(module);
                          }}
                          type="button"
                        >
                          Start Module
                        </button>
                      )}
                      {moduleStatus.status === 'locked' && (
                        <button className="btn-locked" disabled>Locked</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Surveys Section */}
        <div className="surveys-section">
          <div className="card survey-card">
            <h3 className="card-title">Pre-Course Survey</h3>
            <button className="btn-survey">
              Open Survey
              <span className="icon-link">🔗</span>
            </button>
          </div>
          <div className="card survey-card">
            <h3 className="card-title">Post-Course Survey</h3>
            <button className="btn-survey disabled" disabled>
              Complete All Modules First
              <span className="icon-lock">🔒</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentMain;
