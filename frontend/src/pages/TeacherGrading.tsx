import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useCourse } from '../contexts/CourseContext';
import { courseAPI, moduleAPI, submissionAPI } from '../services/api';
import { moduleDisplayTitle, type Module, type Question, type Submission, type User } from '../types';
import { parseFieldAssignmentResponse } from '../utils/fieldAssignment';
import './TeacherGrading.css';

function mcqCorrectAnswersList(q: Question): string[] {
  return (q.correct_answers ?? []).map((c) => String(c).trim()).filter(Boolean);
}

function mcqOptionIsKeyedCorrect(option: string, question: Question): boolean {
  return mcqCorrectAnswersList(question).some((c) => c === (option || '').trim());
}

function isUrl(text: string): boolean {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const TeacherGrading: React.FC = () => {
  const { selectedCourse } = useCourse();
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
  /** Raw score field text so users can clear, type "0.", etc. Key: `${studentId}-${questionId}` */
  const [gradeInputStrings, setGradeInputStrings] = useState<Record<string, string>>({});
  const navigate = useNavigate();

  const gradeInputKey = (studentId: number, questionId: number) => `${studentId}-${questionId}`;

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
    setGradeInputStrings({});
    try {
      // Load questions for the module
      const questionsData = await moduleAPI.getQuestions(selectedModule.id);
      const sortedQuestions = [...questionsData].sort((a, b) => a.question_order - b.question_order);
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
        
        // Initialize grade if submission has a grade (includes MCQ autogrades)
        if (submission.grade && userId && questionId) {
          if (!gradesMap[userId]) {
            gradesMap[userId] = {};
          }
          const rawScore = submission.grade.score ?? 0;
          const rawTotal = submission.grade.total && submission.grade.total > 0 ? submission.grade.total : 1;
          const normalizedScore = rawTotal !== 1 ? rawScore / rawTotal : rawScore;
          gradesMap[userId][questionId] = {
            score: Math.round(Math.min(normalizedScore, 1) * 10) / 10,
            total: 1,
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
    const total = 1;
    const clampedScore = Math.max(0, Math.min(total, Number.isFinite(score) ? score : 0));

    setGrades(prev => ({
      ...prev,
      [studentId]: {
        ...prev[studentId],
        [questionId]: {
          score: clampedScore,
          total,
        },
      },
    }));
  };

  const handleGradeFieldChange = (studentId: number, questionId: number, raw: string) => {
    const key = gradeInputKey(studentId, questionId);
    setGradeInputStrings((prev) => ({ ...prev, [key]: raw }));

    const trimmed = raw.trim();
    if (trimmed === '' || trimmed === '.') {
      setGrades((prev) => {
        const studentGrades = { ...(prev[studentId] || {}) };
        delete studentGrades[questionId];
        return { ...prev, [studentId]: studentGrades };
      });
      return;
    }

    const num = parseFloat(raw);
    if (!Number.isNaN(num)) {
      handleGradeChange(studentId, questionId, num);
    }
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
            return submissionAPI.gradeSubmission(submission.id, Math.min(grade.score, 1), 1, comment);
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

  const getStudentGradeSummary = (studentId: number): { score: string; gradedCount: number } => {
    let total = 0;
    let gradedCount = 0;
    questions.forEach(question => {
      const grade = grades[studentId]?.[question.id];
      if (grade && grade.score !== undefined) {
        total += Math.min(grade.score, 1);
        gradedCount++;
      }
    });
    const scoreStr = Number.isInteger(total) ? String(total) : total.toFixed(1);
    return { score: scoreStr, gradedCount };
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
                    {moduleDisplayTitle(module)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {selectedModule && questions.length > 0 && (
          <div className="grading-container">
            <div className="grading-header">
              <h2>{moduleDisplayTitle(selectedModule)}</h2>
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
                  const { score: totalScore, gradedCount } = getStudentGradeSummary(student.id);
                  const hasAnySubmission = Object.keys(studentSubmissions).length > 0;
                  const isExpanded = expandedStudents.has(student.id);
                  const questionsWithSubmission = questions.filter((q) => studentSubmissions[q.id]);
                  const moduleFullyGraded =
                    questionsWithSubmission.length > 0 &&
                    questionsWithSubmission.every((q) => {
                      const g = studentGrades[q.id];
                      return g !== undefined && g.score !== undefined;
                    });

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
                          {moduleFullyGraded && (
                            <div className="student-total-grade">
                              Total: <strong>{totalScore} / {gradedCount}</strong>
                              {gradedCount < questions.length && (
                                <span className="graded-count-note">
                                  {' '}({gradedCount} of {questions.length} graded)
                                </span>
                              )}
                            </div>
                          )}
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
                                  const maxPoints = 1;
                                  const scoreKey = gradeInputKey(student.id, question.id);

                                  return (
                                    <div key={question.id} className="question-grading-card">
                                      <div className="question-header-grading">
                                        <h4 className="question-number-grading">Question {qIndex + 1}</h4>
                                        <span className="question-points-grading">
                                          (0–{maxPoints} point{maxPoints !== 1 ? 's' : ''})
                                        </span>
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
                                                {(() => {
                                                  const keyed = mcqCorrectAnswersList(question);
                                                  return (
                                                    <>
                                                      {question.mcq_options.map((option, optIndex) => {
                                                        const selected = submission.submission_response === option;
                                                        const keyedHere = mcqOptionIsKeyedCorrect(option, question);
                                                        const wrongPick =
                                                          selected && keyed.length > 0 && !keyedHere;
                                                        return (
                                                          <div
                                                            key={optIndex}
                                                            className={[
                                                              'mcq-option-display',
                                                              selected ? 'selected' : '',
                                                              keyedHere ? 'answer-key' : '',
                                                              wrongPick ? 'incorrect-selection' : '',
                                                            ]
                                                              .filter(Boolean)
                                                              .join(' ')}
                                                          >
                                                            <span className="option-radio">
                                                              {selected ? '●' : '○'}
                                                            </span>
                                                            <span className="option-text">{option}</span>
                                                            {selected && (
                                                              <span
                                                                className={[
                                                                  'selected-badge',
                                                                  keyed.length
                                                                    ? keyedHere
                                                                      ? 'selected-correct'
                                                                      : 'selected-wrong'
                                                                    : '',
                                                                ]
                                                                  .filter(Boolean)
                                                                  .join(' ')}
                                                              >
                                                                {keyed.length
                                                                  ? keyedHere
                                                                    ? 'Selected (correct)'
                                                                    : 'Selected (incorrect)'
                                                                  : 'Selected'}
                                                              </span>
                                                            )}
                                                            {keyedHere && !selected && (
                                                              <span className="answer-key-badge">Correct answer</span>
                                                            )}
                                                          </div>
                                                        );
                                                      })}
                                                      
                                                    </>
                                                  );
                                                })()}
                                              </div>
                                            ) : question.question_type === 'video' ? (
                                              <div className="field-assignment-response-display">
                                                {(() => {
                                                  const raw = submission.submission_response || '';
                                                  const p = parseFieldAssignmentResponse(raw);
                                                  if (
                                                    p &&
                                                    (p.fileName || p.fileUrl || p.youtubeUrl)
                                                  ) {
                                                    return (
                                                      <>
                                                        {(p.fileName || p.fileUrl) && (
                                                          <p className="field-assignment-grade-line">
                                                            <span className="link-response-label">📎 File:</span>{' '}
                                                            {p.fileName || 'Attachment'}
                                                            {p.fileUrl && isUrl(p.fileUrl) && (
                                                              <>
                                                                {' '}
                                                                <a
                                                                  href={p.fileUrl.trim()}
                                                                  target="_blank"
                                                                  rel="noopener noreferrer"
                                                                  className="link-response-url"
                                                                >
                                                                  Open
                                                                </a>
                                                              </>
                                                            )}
                                                            {p.fileUrl && !isUrl(p.fileUrl) && (
                                                              <span className="field-assignment-ref">
                                                                {' '}
                                                                ({p.fileUrl})
                                                              </span>
                                                            )}
                                                          </p>
                                                        )}
                                                        {p.youtubeUrl && (
                                                          <p className="field-assignment-grade-line">
                                                            <span className="link-response-label">▶ YouTube:</span>{' '}
                                                            <a
                                                              href={p.youtubeUrl.trim()}
                                                              target="_blank"
                                                              rel="noopener noreferrer"
                                                              className="link-response-url"
                                                            >
                                                              {p.youtubeUrl.trim()}
                                                            </a>
                                                          </p>
                                                        )}
                                                      </>
                                                    );
                                                  }
                                                  if (isUrl(raw)) {
                                                    return (
                                                      <div className="link-response-display">
                                                        <span className="link-response-label">🔗 Link:</span>
                                                        <a
                                                          href={raw.trim()}
                                                          target="_blank"
                                                          rel="noopener noreferrer"
                                                          className="link-response-url"
                                                        >
                                                          {raw.trim()}
                                                        </a>
                                                      </div>
                                                    );
                                                  }
                                                  return (
                                                    <div className="written-response-display">
                                                      <textarea
                                                        className="response-textarea-readonly"
                                                        value={raw}
                                                        readOnly
                                                        rows={4}
                                                      />
                                                    </div>
                                                  );
                                                })()}
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
                                            ) : isUrl(submission.submission_response || '') ? (
                                              <div className="link-response-display">
                                                <span className="link-response-label">🔗 Link submission:</span>
                                                <a
                                                  href={submission.submission_response.trim()}
                                                  target="_blank"
                                                  rel="noopener noreferrer"
                                                  className="link-response-url"
                                                >
                                                  {submission.submission_response.trim()}
                                                </a>
                                              </div>
                                            ) : (
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
                                                  type="text"
                                                  inputMode="decimal"
                                                  autoComplete="off"
                                                  value={
                                                    Object.prototype.hasOwnProperty.call(gradeInputStrings, scoreKey)
                                                      ? gradeInputStrings[scoreKey]
                                                      : grade !== undefined
                                                        ? String(grade.score)
                                                        : ''
                                                  }
                                                  onChange={(e) =>
                                                    handleGradeFieldChange(student.id, question.id, e.target.value)
                                                  }
                                                  onBlur={() => {
                                                    setGradeInputStrings((prev) => {
                                                      const next = { ...prev };
                                                      delete next[scoreKey];
                                                      return next;
                                                    });
                                                  }}
                                                  placeholder="0–1"
                                                  className="grade-input-new"
                                                />
                                                <span className="grade-out-of-new">/ {maxPoints}</span>
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
