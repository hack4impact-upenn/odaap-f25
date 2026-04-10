import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { useCourse } from '../contexts/CourseContext';
import { dashboardAPI, authAPI } from '../services/api';
import { moduleDisplayTitle, type Module, type User } from '../types';
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
      const dashboard = await dashboardAPI.getTeacherDashboard(selectedCourse.id);

      const courseModules = dashboard.modules as Array<Module & { progress: number }>;
      setModules(courseModules.sort((a: Module, b: Module) => a.module_order - b.module_order));

      setStudents(dashboard.students);
      setTeachers(dashboard.teachers);

      const progressMap: Record<number, number> = {};
      for (const m of courseModules) {
        progressMap[m.id] = (m as any).progress ?? 0;
      }
      setModuleProgress(progressMap);

      const gradesMap: Record<number, { grade: number; overdue: number }> = {};
      for (const s of dashboard.students) {
        gradesMap[s.id] = { grade: (s as any).grade ?? 0, overdue: (s as any).overdue ?? 0 };
      }
      setStudentGrades(gradesMap);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
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
