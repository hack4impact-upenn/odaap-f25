import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, submissionAPI, moduleAPI, announcementAPI } from '../services/api';
import type { Course, Module, Submission, Announcement } from '../types';
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
  const [moduleQuestions, setModuleQuestions] = useState<Record<number, number>>({}); // module_id -> question_count
  const [moduleAccessibility, setModuleAccessibility] = useState<Record<number, { is_accessible: boolean; is_completed: boolean }>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
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
        const currentCourse = enrolledCourses[0];
        
        // Load modules for the first course (or you could show all)
        const courseModules = await courseAPI.getModules(currentCourse.id);
        const publishedModules = courseModules.filter(m => m.is_posted);
        setModules(publishedModules.sort((a, b) => a.module_order - b.module_order));
        
        // Load announcements for the course
        try {
          const announcementsData = await announcementAPI.getAll(currentCourse.id);
          setAnnouncements(announcementsData);
        } catch (error) {
          console.error('Error loading announcements:', error);
          setAnnouncements([]);
        }

        // Load submissions and question counts for all modules
        const submissionsMap: Record<number, Submission[]> = {};
        const questionsMap: Record<number, number> = {};
        
        const accessibilityMap: Record<number, { is_accessible: boolean; is_completed: boolean }> = {};
        
        for (const module of courseModules) {
          try {
            // Get submissions
            const moduleSubmissions = await submissionAPI.getAll(undefined, module.id);
            submissionsMap[module.id] = moduleSubmissions.filter(s => s.user_id === user.id);
            
            // Check module accessibility first (only for students)
            if (user.isStudent) {
              try {
                const accessibility = await moduleAPI.checkAccessibility(module.id);
                accessibilityMap[module.id] = {
                  is_accessible: accessibility.is_accessible,
                  is_completed: accessibility.is_completed
                };
                
                // Only get questions if module is accessible
                if (accessibility.is_accessible) {
                  try {
                    const questions = await moduleAPI.getQuestions(module.id);
                    questionsMap[module.id] = questions.length;
                  } catch (error) {
                    questionsMap[module.id] = 0;
                  }
                } else {
                  questionsMap[module.id] = 0;
                }
              } catch (error) {
                // If check fails, assume not accessible
                accessibilityMap[module.id] = {
                  is_accessible: false,
                  is_completed: false
                };
                questionsMap[module.id] = 0;
              }
            } else {
              // Teachers can always access
              accessibilityMap[module.id] = {
                is_accessible: true,
                is_completed: false
              };
              try {
                const questions = await moduleAPI.getQuestions(module.id);
                questionsMap[module.id] = questions.length;
              } catch (error) {
                questionsMap[module.id] = 0;
              }
            }
          } catch (error) {
            submissionsMap[module.id] = [];
            questionsMap[module.id] = 0;
            accessibilityMap[module.id] = {
              is_accessible: false,
              is_completed: false
            };
          }
        }
        setSubmissions(submissionsMap);
        setModuleQuestions(questionsMap);
        setModuleAccessibility(accessibilityMap);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getModuleStatus = (module: Module) => {
    const moduleSubmissions = submissions[module.id] || [];
    const questionCount = moduleQuestions[module.id] || 0;
    const submissionCount = moduleSubmissions.length;
    const allQuestionsSubmitted = questionCount > 0 && submissionCount >= questionCount;
    const accessibility = moduleAccessibility[module.id];
    
    // Check if module is accessible (sequential requirement)
    if (accessibility && !accessibility.is_accessible) {
      return { status: 'locked', label: 'Locked - Complete previous modules', icon: '🔒' };
    }
    
    if (!module.is_posted) {
      return { status: 'locked', label: 'Locked', icon: '🔒' };
    }
    
    if (allQuestionsSubmitted) {
      // All questions have submissions
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
        grade: totalPossible > 0 ? `${parseFloat(totalScore.toFixed(2))}/${parseFloat(totalPossible.toFixed(2))}` : null
      };
    }
    
    return { status: 'active', label: 'Start Module', icon: module.module_order.toString() };
  };

  const handleModuleClick = (module: Module) => {
    const moduleStatus = getModuleStatus(module);
    console.log('Module click:', { moduleId: module.id, moduleName: module.module_name, status: moduleStatus.status });
    
    if (moduleStatus.status === 'active' || moduleStatus.status === 'completed') {
      // If module has a YouTube video link, go to video page first
      if (module.youtube_link) {
        console.log('Navigating to video page:', `/student/module/${module.id}/video`);
        navigate(`/student/module/${module.id}/video`);
      } else {
        // Otherwise, go directly to homework/questions
        console.log('Navigating to homework page:', `/student/hw/${module.id}`);
        navigate(`/student/hw/${module.id}`);
      }
    } else {
      console.log('Module is locked, cannot navigate');
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
  
  // Get upcoming assignments: modules that are posted and not fully completed
  const upcomingModules = modules.filter(m => {
    if (!m.is_posted) return false;
    const moduleSubmissions = submissions[m.id] || [];
    const questionCount = moduleQuestions[m.id] || 0;
    const submissionCount = moduleSubmissions.length;
    return questionCount === 0 || submissionCount < questionCount;
  }).sort((a, b) => {
    // Sort by due date if available, then by module_order
    if (a.due_date && b.due_date) {
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    }
    return a.module_order - b.module_order;
  });
  
  const upcomingCount = upcomingModules.length;

  return (
    <div className="student-main">
      <Header />
      
      <div className="student-content">
        <h2 className="term-title">{currentCourse?.course_name || 'Course'}</h2>
        
        {/* Top Layer: Announcements (full width) */}
        <div className="announcements-section">
          <div className="card announcements-card">
            <h3 className="card-title">Announcements</h3>
            <div className="announcements-list">
              {announcements.length === 0 ? (
                <div className="announcement-item">
                  <div className="announcement-indicator"></div>
                  <div className="announcement-content">
                    <h4 className="announcement-title">No announcements yet</h4>
                    <p className="announcement-description">Check back later for updates</p>
                  </div>
                </div>
              ) : (
                announcements.map((announcement) => (
                  <div key={announcement.id} className="announcement-item">
                    <div className="announcement-indicator"></div>
                    <div className="announcement-content">
                      <h4 className="announcement-title">{announcement.title}</h4>
                      <p className="announcement-description">{announcement.content}</p>
                      <div className="announcement-meta">
                        <span className="announcement-teacher">By {announcement.created_by_name}</span>
                        <span className="announcement-date">
                          {formatDate(announcement.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom Layer: Zoom and Assignments side by side */}
        <div className="bottom-grid">
          {/* Weekly Zoom Meeting Link Card */}
          {currentCourse && (
            <div className="card zoom-card">
              <h3 className="card-title">Weekly Zoom Meeting Link</h3>
              <p className="zoom-schedule">Every Friday, Saturday (2:00 - 3:00 pm)</p>
              {currentCourse.zoom_link ? (
                <button 
                  className="zoom-button"
                  onClick={() => {
                    // Ensure the zoom link is a valid URL
                    let zoomUrl = currentCourse.zoom_link;
                    // If it doesn't start with http, add https://
                    if (zoomUrl && !zoomUrl.startsWith('http://') && !zoomUrl.startsWith('https://')) {
                      zoomUrl = 'https://' + zoomUrl;
                    }
                    if (zoomUrl) {
                      window.open(zoomUrl, '_blank', 'noopener,noreferrer');
                    }
                  }}
                >
                  Join Meeting
                  <span className="icon-arrow">→</span>
                </button>
              ) : (
                <p className="zoom-unavailable">Zoom link not set. Please contact your teacher.</p>
              )}
            </div>
          )}

          {/* Upcoming Assignments Card */}
          <div className="card assignments-card">
            <h3 className="card-title">Upcoming Assignments</h3>
            {upcomingCount > 0 ? (
              <>
                <p className="assignment-count">{upcomingCount} assignment{upcomingCount !== 1 ? 's' : ''} to complete</p>
                <div className="assignments-list">
                  {upcomingModules.slice(0, 3).map((module) => (
                    <div 
                      key={module.id}
                      className="assignment-item clickable"
                      onClick={() => {
                        // If module has a YouTube video link, go to video page first
                        if (module.youtube_link) {
                          navigate(`/student/module/${module.id}/video`);
                        } else {
                          // Otherwise, go directly to homework/questions
                          navigate(`/student/hw/${module.id}`);
                        }
                      }}
                    >
                      <h4 className="assignment-name">{module.module_name}</h4>
                      {module.module_description && (
                        <p className="assignment-description">{module.module_description}</p>
                      )}
                      <div className="assignment-due">
                        <span className="icon-clock">🕐</span>
                        <span>Due: {module.due_date ? formatDate(module.due_date) : 'TBD'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <p className="assignment-count">No upcoming assignments</p>
            )}
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
                      {module.module_description && (
                        <p className="module-description">{module.module_description}</p>
                      )}
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

        {/* Resources Link */}
        <div className="resources-nav-section">
          <div
            className="card resources-nav-card"
            onClick={() => navigate('/student/resources')}
          >
            <span className="resources-nav-icon">📚</span>
            <div>
              <h3 className="card-title">Resources</h3>
              <p className="resources-nav-description">View course materials, links, and helpful resources</p>
            </div>
            <span className="resources-nav-arrow">→</span>
          </div>
        </div>

        {/* CEU Links Section */}
        {currentCourse && (
          (currentCourse.ceu_credit_application_link || 
           currentCourse.ceu_act48_application_link || 
           currentCourse.ceu_program_evaluation_link) && (
            <div className="ceu-section">
              <div className="card ceu-consolidated-card">
                <h2 className="section-title">Continuing Education Credits</h2>
                <div className="ceu-links-list">
                  {currentCourse.ceu_credit_application_link && (
                    <div className="ceu-link-item">
                      <h4 className="ceu-link-title">Continuing Education Credit Application</h4>
                      <a
                        href={currentCourse.ceu_credit_application_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ceu-link-button"
                      >
                        Open Link
                        <span className="icon-link">🔗</span>
                      </a>
                    </div>
                  )}
                  {currentCourse.ceu_act48_application_link && (
                    <div className="ceu-link-item">
                      <h4 className="ceu-link-title">ACT 48 Application</h4>
                      <a
                        href={currentCourse.ceu_act48_application_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ceu-link-button"
                      >
                        Open Link
                        <span className="icon-link">🔗</span>
                      </a>
                    </div>
                  )}
                  {currentCourse.ceu_program_evaluation_link && (
                    <div className="ceu-link-item">
                      <h4 className="ceu-link-title">Program Evaluation</h4>
                      <a
                        href={currentCourse.ceu_program_evaluation_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ceu-link-button"
                      >
                        Open Link
                        <span className="icon-link">🔗</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
};

export default StudentMain;
