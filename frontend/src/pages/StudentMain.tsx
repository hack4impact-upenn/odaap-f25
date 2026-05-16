import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, dashboardAPI } from '../services/api';
import {
  moduleDisplayTitle,
  type Course,
  type Module,
  type Submission,
  type Announcement,
} from '../types';
import { equalModuleOverallPercent } from '../utils/grades';
import './StudentMain.css';

const ANNOUNCEMENTS_PER_PAGE = 6;

/** Public asset (see `frontend/public/brand/`) — community photo used as dashboard header. */
const STUDENT_DASHBOARD_HERO = `${import.meta.env.BASE_URL}brand/student-dashboard-hero.png`;

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
  const [announcementPage, setAnnouncementPage] = useState(1);
  const [expandedAnnouncements, setExpandedAnnouncements] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user]);

  const announcementTotalPages = Math.max(
    1,
    Math.ceil(announcements.length / ANNOUNCEMENTS_PER_PAGE)
  );

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

  const loadData = async () => {
    try {
      setLoading(true);

      if (!user) return;

      // Load enrolled courses
      const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
      setCourses(enrolledCourses);

      if (enrolledCourses.length > 0) {
        const currentCourse = enrolledCourses[0];

        // Single API call for all dashboard data
        const dashboard = await dashboardAPI.getStudentDashboard(currentCourse.id);

        const allModules = dashboard.modules as Array<{
          id: number; module_name: string; custom_module_name?: string;
          module_description: string; module_order: number; is_posted: boolean;
          youtube_link: string; due_date: string | null; question_count: number;
          submissions: Submission[]; is_accessible: boolean; is_completed: boolean;
        }>;

        const publishedModules = allModules.filter(m => m.is_posted);
        setModules(publishedModules.sort((a, b) => a.module_order - b.module_order) as unknown as Module[]);
        setAnnouncements(dashboard.announcements);

        const submissionsMap: Record<number, Submission[]> = {};
        const questionsMap: Record<number, number> = {};
        const accessibilityMap: Record<number, { is_accessible: boolean; is_completed: boolean }> = {};

        for (const mod of allModules) {
          submissionsMap[mod.id] = mod.submissions;
          questionsMap[mod.id] = mod.question_count;
          accessibilityMap[mod.id] = {
            is_accessible: mod.is_accessible,
            is_completed: mod.is_completed,
          };
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
      <div className="student-main student-dashboard">
        <Header />
        <div className="student-content student-content--loading">
          <div className="student-dashboard-loading">Loading your dashboard…</div>
        </div>
      </div>
    );
  }

  const currentCourse = courses[0]; // Use first course for now
  const overallCourseGrade = equalModuleOverallPercent(modules, submissions);

  const allPostedModulesCompleted =
    modules.length === 0 ||
    modules.every((m) => getModuleStatus(m).status === 'completed');

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
    <div className="student-main student-dashboard">
      <Header />

      <section
        className="student-hero"
        aria-label="Open Door Abuse Prevention — classroom community"
      >
        <div
          className="student-hero__image"
          style={{ backgroundImage: `url(${STUDENT_DASHBOARD_HERO})` }}
          role="presentation"
        />
        <div className="student-hero__scrim" aria-hidden />
        <div className="student-hero__content">
          <p className="student-hero__eyebrow">ODAAP</p>
          <h1 className="student-hero__title">
            {currentCourse?.course_name || 'Your course'}
          </h1>
          
        </div>
      </section>

      <div className="student-content">
        {modules.length > 0 && (
          <p className="student-overall-grade" aria-live="polite">
            {overallCourseGrade !== null
              ? `Overall Grade: ${overallCourseGrade}%`
              : 'Overall Grade: N/A'}
          </p>
        )}

        <nav className="student-nav" aria-label="Course sections">
          <button type="button" className="active" aria-current="page">
            📋 Dashboard
          </button>
          <button type="button" onClick={() => navigate('/student/resources')}>
            📚 Resources
          </button>
        </nav>
        
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
                paginatedAnnouncements.map((announcement) => {
                  const isLong = announcement.content.length > 120;
                  const isExpanded = expandedAnnouncements.has(announcement.id);
                  return (
                    <div key={announcement.id} className="announcement-item">
                      <div className="announcement-indicator"></div>
                      <div className="announcement-content">
                        <h4 className="announcement-title">{announcement.title}</h4>
                        <p className={`announcement-description ${isLong && !isExpanded ? 'truncated' : ''}`}>
                          {announcement.content}
                        </p>
                        {isLong && (
                          <button
                            type="button"
                            className="read-more-btn"
                            onClick={() =>
                              setExpandedAnnouncements((prev) => {
                                const next = new Set(prev);
                                if (next.has(announcement.id)) {
                                  next.delete(announcement.id);
                                } else {
                                  next.add(announcement.id);
                                }
                                return next;
                              })
                            }
                          >
                            {isExpanded ? 'Show less' : 'Read more'}
                          </button>
                        )}
                        <div className="announcement-meta">
                          <span className="announcement-teacher">By {announcement.created_by_name}</span>
                          <span className="announcement-date">
                            {formatDate(announcement.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            {announcements.length > ANNOUNCEMENTS_PER_PAGE && (
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

        {/* Bottom Layer: Zoom and Assignments side by side */}
        <div className="bottom-grid">
          {/* Weekly Zoom Meeting Link Card */}
          {currentCourse && (
            <div className="card zoom-card">
              <h3 className="card-title">Weekly Zoom Meeting Link</h3>
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
                  {upcomingModules.map((module) => (
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
                      <h4 className="assignment-name">{moduleDisplayTitle(module)}</h4>
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
                      <h3 className="module-name">{moduleDisplayTitle(module)}</h3>
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
        {(currentCourse?.pre_course_survey_link || currentCourse?.post_course_survey_link) && (
        <div className="surveys-section">
          <div className="card survey-card">
            <h3 className="card-title">Pre-Course Survey</h3>
            {currentCourse?.pre_course_survey_link ? (
              <a
                className="btn-survey"
                href={currentCourse.pre_course_survey_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Survey
                <span className="icon-link">🔗</span>
              </a>
            ) : (
              <button type="button" className="btn-survey disabled" disabled>
                Not linked yet
                <span className="icon-lock">🔒</span>
              </button>
            )}
          </div>
          <div className="card survey-card">
            <h3 className="card-title">Post-Course Survey</h3>
            {!currentCourse?.post_course_survey_link ? (
              <button type="button" className="btn-survey disabled" disabled>
                Not linked yet
                <span className="icon-lock">🔒</span>
              </button>
            ) : !allPostedModulesCompleted ? (
              <button type="button" className="btn-survey disabled" disabled>
                Complete All Modules First
                <span className="icon-lock">🔒</span>
              </button>
            ) : (
              <a
                className="btn-survey"
                href={currentCourse.post_course_survey_link}
                target="_blank"
                rel="noopener noreferrer"
              >
                Open Survey
                <span className="icon-link">🔗</span>
              </a>
            )}
          </div>
        </div>
        )}

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
