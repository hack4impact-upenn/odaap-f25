import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI, moduleAPI, submissionAPI, questionAPI, authAPI } from '../services/api';
import { moduleDisplayTitle, type Module, type Submission, type User } from '../types';
import { equalModuleOverallPercent } from '../utils/grades';
import './TeacherMain.css';

const TeacherMain: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'announcements' | 'grading'>('overview');
  const { selectedCourse, loading: courseLoading } = useCourse();
  const [modules, setModules] = useState<Module[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [teachers, setTeachers] = useState<User[]>([]);
  const [moduleProgress, setModuleProgress] = useState<Record<number, number>>({});
  const [studentGrades, setStudentGrades] = useState<Record<number, { grade: number; overdue: number }>>({});
  const [loading, setLoading] = useState(true);
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [resetPasswordName, setResetPasswordName] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCourse) {
      loadData();
    } else if (!courseLoading) {
      setLoading(false);
    }
  }, [selectedCourse, courseLoading]);

  const loadData = async () => {
    if (!selectedCourse) return;
    
    try {
      setLoading(true);
      const courseModules = await moduleAPI.getAll(selectedCourse.id);
      setModules(courseModules.sort((a, b) => a.module_order - b.module_order));
      
      // Load students and teachers
      const courseStudents = await courseAPI.getStudents(selectedCourse.id);
      const courseTeachers = await courseAPI.getTeachers(selectedCourse.id);
      setStudents(courseStudents);
      setTeachers(courseTeachers);
      
      // Calculate module progress and student grades
      await calculateModuleProgress(courseModules, courseStudents);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateModuleProgress = async (courseModules: Module[], courseStudents: User[]) => {
    const progressMap: Record<number, number> = {};
    const gradesMap: Record<number, { grade: number; overdue: number }> = {};

    const postedModules = courseModules.filter(m => m.is_posted);

    // Fetch all questions and submissions for all posted modules in parallel
    const [allQuestions, allSubmissions] = await Promise.all([
      Promise.all(postedModules.map(m => questionAPI.getAll(m.id).catch(() => []))),
      Promise.all(postedModules.map(m => submissionAPI.getAll(undefined, m.id).catch(() => [] as Submission[]))),
    ]);

    // Build lookup maps
    const questionsByModule: Record<number, number> = {};
    const submissionsByModule: Record<number, Submission[]> = {};

    postedModules.forEach((module, i) => {
      questionsByModule[module.id] = allQuestions[i].length;
      submissionsByModule[module.id] = allSubmissions[i];
    });

    // Mark unposted modules as 0 progress
    courseModules.forEach(m => {
      if (!m.is_posted) progressMap[m.id] = 0;
    });

    // Calculate module completion progress
    for (const module of postedModules) {
      const totalQuestions = questionsByModule[module.id];
      if (totalQuestions === 0) {
        progressMap[module.id] = 0;
        continue;
      }

      let completedCount = 0;
      for (const student of courseStudents) {
        const studentSubs = submissionsByModule[module.id].filter(s => s.user_id === student.id);
        const uniqueQuestions = new Set(studentSubs.map(s => s.question_id));
        if (uniqueQuestions.size >= totalQuestions) completedCount++;
      }

      progressMap[module.id] = courseStudents.length > 0
        ? Math.round((completedCount / courseStudents.length) * 100)
        : 0;
    }

    // Calculate student grades and overdue counts
    for (const student of courseStudents) {
      let overdueCount = 0;
      const studentSubmsByModule: Record<number, Submission[]> = {};

      for (const module of postedModules) {
        const studentSubs = submissionsByModule[module.id].filter(s => s.user_id === student.id);
        studentSubmsByModule[module.id] = studentSubs;

        for (const sub of studentSubs) {
          if (sub.grade?.is_overdue) overdueCount++;
        }

        if (module.due_date) {
          const datePart = module.due_date.split('T')[0];
          const [year, month, day] = datePart.split('-').map(Number);
          const dueDate = new Date(year, month - 1, day);
          const now = new Date();
          now.setHours(0, 0, 0, 0);

          const totalQuestions = questionsByModule[module.id];
          const uniqueQuestions = new Set(studentSubs.map(s => s.question_id));

          if (dueDate < now && totalQuestions > 0 && uniqueQuestions.size < totalQuestions) {
            overdueCount += totalQuestions - uniqueQuestions.size;
          }
        }
      }

      const overallPct = equalModuleOverallPercent(courseModules, studentSubmsByModule);
      gradesMap[student.id] = { grade: overallPct ?? 0, overdue: overdueCount };
    }

    setModuleProgress(progressMap);
    setStudentGrades(gradesMap);
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !resetNewPassword.trim()) return;
    if (resetNewPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }
    try {
      setIsResettingPassword(true);
      await authAPI.resetUserPassword(resetPasswordUserId, resetNewPassword);
      alert(`Password reset successfully for ${resetPasswordName}`);
      setResetPasswordUserId(null);
      setResetNewPassword('');
      setResetPasswordName('');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Failed to reset password';
      alert(msg);
    } finally {
      setIsResettingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="teacher-main">
        <Header />
        <div className="teacher-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-main">
      <Header />
      
      <div className="teacher-content">
        {selectedCourse && (
          <h2 className="teacher-course-title">{selectedCourse.course_name}</h2>
        )}
        <nav className="teacher-nav">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={activeTab === 'modules' ? 'active' : ''}
            onClick={() => navigate('/teacher/modules')}
          >
            🎓 Modules
          </button>
          <button 
            className={activeTab === 'announcements' ? 'active' : ''}
            onClick={() => navigate('/teacher/announcements')}
          >
            📢 Announcements
          </button>
          <button 
            onClick={() => navigate('/teacher/grading')}
          >
            ✓ Grading
          </button>
          <button 
            onClick={() => navigate('/teacher/settings')}
          >
            ⚙️ Settings
          </button>
        </nav>

        {activeTab === 'overview' && (
          <div className="overview-content">
            {/* Module Completion Card */}
            <div className="card module-completion-card">
              <h2 className="card-title">Module Completion</h2>
              <div className="module-progress-list">
                {modules.map((module) => {
                  const progress = moduleProgress[module.id] || 0;
                  return (
                    <div key={module.id} className="module-progress-item">
                      <div className="module-progress-header">
                        <span className="module-name">{moduleDisplayTitle(module)}</span>
                        <span className="progress-percentage">{progress}%</span>
                      </div>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Students Card */}
            <div className="card students-card">
              <h2 className="card-title">Students</h2>
              <div className="students-list">
                {students.map((student) => {
                  const studentData = studentGrades[student.id] || { grade: 0, overdue: 0 };
                  return (
                    <div key={student.id} className="student-item">
                      <div className="student-info">
                        <h4 className="student-name">{student.first_name} {student.last_name}</h4>
                        <p className="student-email">
                          📧 {student.email}
                        </p>
                      </div>
                      <div className="student-stats">
                        <span className="grade">
                          Overall Grade: {studentData.grade}%{' '}
                          <span className="grade-weighting-note">(equal weight per module)</span>
                        </span>
                        <span className={`status ${studentData.overdue > 0 ? 'overdue' : 'no-overdue'}`}>
                          {studentData.overdue > 0 
                            ? `${studentData.overdue} Overdue Assignment${studentData.overdue !== 1 ? 's' : ''}`
                            : 'No Overdue Assignments'}
                        </span>
                      </div>
                      <button
                        className="reset-password-btn"
                        onClick={() => {
                          setResetPasswordUserId(student.id);
                          setResetPasswordName(`${student.first_name} ${student.last_name}`);
                          setResetNewPassword('');
                        }}
                        title="Reset password"
                      >
                        🔑 Reset Password
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Teachers Card */}
            <div className="card teachers-card">
              <h2 className="card-title">Teachers</h2>
              <div className="teachers-list">
                {teachers.map((teacher) => (
                  <div key={teacher.id} className="teacher-item">
                    <div className="teacher-info">
                      <h4 className="teacher-name">{teacher.first_name} {teacher.last_name}</h4>
                      <p className="teacher-email">📧 {teacher.email}</p>
                    </div>
                    <button
                      type="button"
                      className="reset-password-btn"
                      onClick={() => {
                        setResetPasswordUserId(teacher.id);
                        setResetPasswordName(`${teacher.first_name} ${teacher.last_name}`);
                        setResetNewPassword('');
                      }}
                      title={teacher.id === user?.id ? 'Set a new password for your account' : 'Reset password'}
                    >
                      🔑 Reset Password
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

      </div>

      {resetPasswordUserId && (
        <div className="reset-password-overlay" onClick={() => { setResetPasswordUserId(null); setResetNewPassword(''); }}>
          <div className="reset-password-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Reset Password</h3>
            <p className="reset-password-info">Set a new password for <strong>{resetPasswordName}</strong></p>
            <div className="reset-password-field">
              <label>New Password</label>
              <input
                type="text"
                value={resetNewPassword}
                onChange={(e) => setResetNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
              />
            </div>
            <div className="reset-password-actions">
              <button
                className="reset-password-submit"
                onClick={handleResetPassword}
                disabled={isResettingPassword || resetNewPassword.length < 6}
              >
                {isResettingPassword ? 'Resetting...' : 'Reset Password'}
              </button>
              <button
                className="reset-password-cancel"
                onClick={() => { setResetPasswordUserId(null); setResetNewPassword(''); }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherMain;
