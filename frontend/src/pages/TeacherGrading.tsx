import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI, moduleAPI, submissionAPI } from '../services/api';
import type { Module, Question, Submission, User } from '../types';
import './TeacherGrading.css';

const TeacherGrading: React.FC = () => {
  const { selectedCourse, courses, setSelectedCourse } = useCourse();
  const [modules, setModules] = useState<Module[]>([]);
  const [selectedModule, setSelectedModule] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, Record<number, Submission>>>({});
  const [grades, setGrades] = useState<Record<number, Record<number, { score: number; total: number; teacher_comment?: string }>>>({});
  const [comments, setComments] = useState<Record<number, Record<number, string>>>({});
  const [expandedStudents, setExpandedStudents] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [savingStudentId, setSavingStudentId] = useState<number | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCourse) {
      loadModules();
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedModule) {
      loadGradingData();
    }
  }, [selectedModule]);

  const loadModules = async () => {
    if (!selectedCourse) return;
    try {
      const modulesData = await moduleAPI.getAll(selectedCourse.id);
      setModules(modulesData.sort((a, b) => a.module_order - b.module_order));
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const loadGradingData = async () => {
    if (!selectedModule || !selectedCourse) return;
    
    setLoading(true);
    try {
      // Load questions for the module
      const questionsData = await moduleAPI.getQuestions(selectedModule.id);
      const sortedQuestions = questionsData.sort((a, b) => a.question_order - b.question_order);
      setQuestions(sortedQuestions);

      // Load students for the course
      const studentsData = await courseAPI.getStudents(selectedCourse.id);
      setStudents(studentsData);

      // Load all submissions for this module
      const submissionsData = await submissionAPI.getAll(undefined, selectedModule.id);
      
      // Organize submissions by student_id -> question_id
      const submissionsMap: Record<number, Record<number, Submission>> = {};
      const gradesMap: Record<number, Record<number, { score: number; total: number }>> = {};
      
      studentsData.forEach(student => {
        submissionsMap[student.id] = {};
        gradesMap[student.id] = {};
      });

      const commentsMap: Record<number, Record<number, string>> = {};
      studentsData.forEach(student => {
        commentsMap[student.id] = {};
      });

      submissionsData.forEach(submission => {
        // Get user_id and question_id from submission
        const userId = submission.user_id;
        const questionId = submission.question_id;
        
        if (!userId || !questionId) {
          console.error('Submission missing user_id or question_id:', submission);
          return;
        }
        
        if (!submissionsMap[userId]) {
          submissionsMap[userId] = {};
        }
        submissionsMap[userId][questionId] = submission;
        
        // Initialize grade if submission has a grade
        if (submission.grade && userId && questionId) {
          if (!gradesMap[userId]) {
            gradesMap[userId] = {};
          }
          gradesMap[userId][questionId] = {
            score: submission.grade.score,
            total: submission.grade.total || 1
          };
          
          // Initialize comment if grade has a comment
          if (submission.grade.teacher_comment) {
            if (!commentsMap[userId]) {
              commentsMap[userId] = {};
            }
            commentsMap[userId][questionId] = submission.grade.teacher_comment;
          }
        }
      });

      setComments(commentsMap);

      setSubmissions(submissionsMap);
      setGrades(gradesMap);
    } catch (error) {
      console.error('Error loading grading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGradeChange = (studentId: number, questionId: number, score: number) => {
    // Allow decimal scores between 0 and 1 (since each question is worth 1 point)
    const clampedScore = Math.max(0, Math.min(1, score));
    
    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: {
          score: clampedScore,
          total: 1
        }
      }
    }));
  };

  const handleCommentChange = (studentId: number, questionId: number, comment: string) => {
    setComments(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: comment
      }
    }));
  };

  const toggleStudentExpansion = (studentId: number) => {
    setExpandedStudents(prev => {
      const newSet = new Set(prev);
      if (newSet.has(studentId)) {
        newSet.delete(studentId);
      } else {
        newSet.add(studentId);
      }
      return newSet;
    });
  };

  const handleSubmitAllGrades = async (studentId: number) => {
    const studentSubmissions = submissions[studentId] || {};
    const studentGrades = grades[studentId] || {};
    const studentComments = comments[studentId] || {};

    // Validate that all submissions have grades
    const missingGrades: number[] = [];
    questions.forEach((question, index) => {
      if (studentSubmissions[question.id] && !studentGrades[question.id]) {
        missingGrades.push(index + 1);
      }
    });

    if (missingGrades.length > 0) {
      alert(`Please enter grades for all questions before submitting. Missing grades for: Question ${missingGrades.join(', ')}`);
      return;
    }

    setSavingStudentId(studentId);
    try {
      // Save all grades for this student
      const gradePromises = questions
        .filter(question => studentSubmissions[question.id])
        .map(async (question) => {
          const submission = studentSubmissions[question.id];
          const grade = studentGrades[question.id];
          const comment = studentComments[question.id] || '';
          
          if (submission && grade) {
            return submissionAPI.gradeSubmission(submission.id, grade.score, 1, comment);
          }
          return null;
        });

      await Promise.all(gradePromises.filter(p => p !== null));
      alert('All grades submitted successfully!');
      // Reload to get updated data
      await loadGradingData();
    } catch (error: any) {
      console.error('Error saving grades:', error);
      const errorMessage = error?.response?.data?.error || 
                          error?.response?.data?.detail || 
                          error?.message || 
                          'Error saving grades. Please try again.';
      alert(errorMessage);
    } finally {
      setSavingStudentId(null);
    }
  };

  const getStudentTotalScore = (studentId: number): number => {
    let total = 0;
    questions.forEach(question => {
      const grade = grades[studentId]?.[question.id];
      if (grade) {
        total += grade.score;
      }
    });
    return total;
  };

  if (loading && !selectedModule) {
    return (
      <div className="teacher-grading">
        <Header />
        <div className="grading-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-grading">
      <Header />
      
      <div className="grading-content">
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
          <button className="active">
            ✓ Grading
          </button>
          <button onClick={() => navigate('/teacher/settings')}>
            ⚙️ Settings
          </button>
        </nav>

        <h1>Grading</h1>

        {selectedCourse && (
          <div className="grading-selectors">
            <div className="selector-group">
              <label htmlFor="module-select">Select Module:</label>
              <select
                id="module-select"
                className="module-select"
                value={selectedModule?.id || ''}
                onChange={(e) => {
                  const module = modules.find(m => m.id === Number(e.target.value));
                  setSelectedModule(module || null);
                }}
              >
                <option value="">-- Select a module --</option>
                {modules.map((module) => (
                  <option key={module.id} value={module.id}>
                    {module.module_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedModule && questions.length > 0 && (
          <div className="grading-container">
            <div className="grading-header">
              <h2>{selectedModule.module_name}</h2>
              <p className="module-info">
                {questions.length} question{questions.length !== 1 ? 's' : ''} • Total points: {questions.length}
              </p>
            </div>

            <div className="students-grading-list">
              {(() => {
                // Separate students into three groups
                const gradedStudents: typeof students = [];
                const toBeGradedStudents: typeof students = [];
                const studentsWithoutSubmissions: typeof students = [];

                students.forEach((student) => {
                  const studentSubmissions = submissions[student.id] || {};
                  const studentGrades = grades[student.id] || {};
                  const hasAnySubmission = Object.keys(studentSubmissions).length > 0;
                  
                  if (!hasAnySubmission) {
                    studentsWithoutSubmissions.push(student);
                  } else {
                    // Check if student has been graded (has at least one grade entered)
                    const hasGrade = questions.some(question => {
                      const submission = studentSubmissions[question.id];
                      return submission && studentGrades[question.id] && studentGrades[question.id].score !== undefined;
                    });
                    
                    if (hasGrade) {
                      gradedStudents.push(student);
                    } else {
                      toBeGradedStudents.push(student);
                    }
                  }
                });

                const renderStudentCard = (student: typeof students[0]) => {
                  const studentSubmissions = submissions[student.id] || {};
                  const studentGrades = grades[student.id] || {};
                  const totalScore = getStudentTotalScore(student.id);
                  const hasAnySubmission = Object.keys(studentSubmissions).length > 0;
                  const isExpanded = expandedStudents.has(student.id);

                  return (
                    <div key={student.id} className="student-grading-card">
                      <button
                        className="student-card-header-toggle"
                        onClick={() => toggleStudentExpansion(student.id)}
                      >
                        <div className="student-card-header-content">
                          <h3 className="student-name-header">
                            {student.first_name} {student.last_name}
                          </h3>
                          <div className="student-total-grade">
                            Total: <strong>{totalScore} / {questions.length}</strong>
                          </div>
                        </div>
                        <span className={`student-toggle-arrow ${isExpanded ? 'expanded' : ''}`}>
                          ▼
                        </span>
                      </button>

                      {isExpanded && (
                        <>
                          {!hasAnySubmission ? (
                            <div className="no-submission-message">
                              <p>No submissions yet</p>
                            </div>
                          ) : (
                            <>
                              <div className="questions-grading-list">
                                {questions.map((question, qIndex) => {
                                  const submission = studentSubmissions[question.id];
                                  const grade = studentGrades[question.id];
                                  const comment = comments[student.id]?.[question.id] || '';
                                  const hasSubmission = !!submission;

                                  return (
                                    <div key={question.id} className="question-grading-card">
                                      <div className="question-header-grading">
                                        <h4 className="question-number-grading">Question {qIndex + 1}</h4>
                                        <span className="question-points-grading">(0-1 point)</span>
                                      </div>
                                      <p className="question-text-grading">{question.question_text}</p>

                                      {/* Student Response Section */}
                                      <div className="student-response-section">
                                        <h5 className="response-label">Student Response:</h5>
                                        {hasSubmission ? (
                                          <div className="response-display">
                                            {/* Multiple Choice Response */}
                                            {question.question_type === 'multiple_choice' && question.mcq_options ? (
                                              <div className="mcq-response-display">
                                                {question.mcq_options.map((option, optIndex) => (
                                                  <div 
                                                    key={optIndex} 
                                                    className={`mcq-option-display ${submission.submission_response === option ? 'selected' : ''}`}
                                                  >
                                                    <span className="option-radio">{submission.submission_response === option ? '●' : '○'}</span>
                                                    <span className="option-text">{option}</span>
                                                    {submission.submission_response === option && (
                                                      <span className="selected-badge">Selected</span>
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            ) : submission.submission_type === 'audio' ? (
                                              /* Audio Response */
                                              <div className="audio-response-display">
                                                <p className="audio-submission-info">
                                                  Audio submission submitted on {new Date(submission.time_submitted).toLocaleDateString()}
                                                </p>
                                                {submission.submission_response && (
                                                  <button
                                                    className="play-audio-btn"
                                                    onClick={() => {
                                                      const audio = new Audio(submission.submission_response);
                                                      audio.play();
                                                    }}
                                                  >
                                                    ▶️ Play Audio
                                                  </button>
                                                )}
                                              </div>
                                            ) : (
                                              /* Written Response */
                                              <div className="written-response-display">
                                                <textarea
                                                  className="response-textarea-readonly"
                                                  value={submission.submission_response || ''}
                                                  readOnly
                                                  rows={6}
                                                />
                                              </div>
                                            )}
                                          </div>
                                        ) : (
                                          <div className="no-response-message">
                                            <p>No response submitted</p>
                                          </div>
                                        )}
                                      </div>

                                      {/* Grading Section */}
                                      {hasSubmission && (
                                        <div className="grading-section">
                                          <h5 className="grading-label">Grade & Feedback:</h5>
                                          <div className="grading-inputs">
                                            <div className="grade-input-wrapper">
                                              <label>Score:</label>
                                              <div className="grade-input-group-new">
                                                <input
                                                  type="number"
                                                  min="0"
                                                  max="1"
                                                  step="0.1"
                                                  value={grade?.score ?? ''}
                                                  onChange={(e) => handleGradeChange(student.id, question.id, parseFloat(e.target.value) || 0)}
                                                  placeholder="0.0"
                                                  className="grade-input-new"
                                                />
                                                <span className="grade-out-of-new">/ 1</span>
                                              </div>
                                            </div>
                                            <div className="comment-input-wrapper">
                                              <label>Teacher Comment:</label>
                                              <textarea
                                                value={comment}
                                                onChange={(e) => handleCommentChange(student.id, question.id, e.target.value)}
                                                placeholder="Add feedback for the student..."
                                                className="grade-comment-input-new"
                                                rows={4}
                                              />
                                            </div>
                                            {grade && (
                                              <div className="grade-status-indicator">
                                                <span className="saved-indicator-new">✓ Grade entered</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="submit-all-grades-section">
                                <button
                                  className="submit-all-grades-btn"
                                  onClick={() => handleSubmitAllGrades(student.id)}
                                  disabled={savingStudentId === student.id}
                                >
                                  {savingStudentId === student.id ? 'Submitting...' : 'Submit Grade'}
                                </button>
                                <p className="submit-all-hint">
                                  Submit module grade for {student.first_name} {student.last_name}
                                </p>
                              </div>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  );
                };

                return (
                  <>
                    {gradedStudents.length > 0 && (
                      <div className="submission-group">
                        <h3 className="submission-group-header">Graded ({gradedStudents.length})</h3>
                        {gradedStudents.map(renderStudentCard)}
                      </div>
                    )}
                    
                    {toBeGradedStudents.length > 0 && (
                      <div className="submission-group">
                        <h3 className="submission-group-header">To be Graded ({toBeGradedStudents.length})</h3>
                        {toBeGradedStudents.map(renderStudentCard)}
                      </div>
                    )}
                    
                    {studentsWithoutSubmissions.length > 0 && (
                      <div className="submission-group">
                        <h3 className="submission-group-header">No Submissions ({studentsWithoutSubmissions.length})</h3>
                        {studentsWithoutSubmissions.map(renderStudentCard)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {selectedModule && questions.length === 0 && (
          <div className="no-questions-message">
            <p>This module has no questions to grade.</p>
          </div>
        )}

        {!selectedModule && selectedCourse && (
          <div className="select-module-message">
            <p>Please select a module to begin grading.</p>
          </div>
        )}
      </div>

    </div>
  );
};

export default TeacherGrading;
