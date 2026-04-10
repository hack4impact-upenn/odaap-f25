import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useCourse } from '../contexts/CourseContext';
import { moduleAPI, questionAPI } from '../services/api';
import { moduleDisplayTitle, type Module, type Question } from '../types';
import './TeacherModules.css';

function multipleChoicePostErrors(questions: Question[]): string[] {
  const errors: string[] = [];
  for (const q of questions) {
    if (q.question_type !== 'multiple_choice') continue;
    const opts = (q.mcq_options ?? []).map((o) => String(o).trim()).filter(Boolean);
    if (opts.length === 0) {
      errors.push(
        `Multiple choice question #${q.question_order} has no answer choices.`
      );
      continue;
    }
    const correct = (q.correct_answers ?? []).map((c) => String(c).trim()).filter(Boolean);
    const matchesOption = correct.some((c) => opts.includes(c));
    if (!matchesOption) {
      errors.push(
        `Multiple choice question #${q.question_order} needs a correct answer selected (use Edit module).`
      );
    }
  }
  return errors;
}

const TeacherModules: React.FC = () => {
  const { selectedCourse, loading: courseLoading } = useCourse();
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleQuestions, setModuleQuestions] = useState<Record<number, Question[]>>({});
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [showPostConfirm, setShowPostConfirm] = useState(false);
  const [moduleToPost, setModuleToPost] = useState<Module | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [moduleToDelete, setModuleToDelete] = useState<Module | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (selectedCourse) {
      loadModules(selectedCourse.id);
    } else if (!courseLoading) {
      setLoading(false);
    }
  }, [selectedCourse, courseLoading]);

  const loadModules = async (courseId: number) => {
    try {
      setLoading(true);
      const courseModules = await moduleAPI.getAll(courseId);
      const sortedModules = courseModules.sort((a, b) => a.module_order - b.module_order);
      setModules(sortedModules);
      
      // Load questions for all modules
      const questionsMap: Record<number, Question[]> = {};
      for (const module of sortedModules) {
        try {
          const questions = await questionAPI.getAll(module.id);
          questionsMap[module.id] = questions.sort((a, b) => a.question_order - b.question_order);
        } catch (error) {
          questionsMap[module.id] = [];
        }
      }
      setModuleQuestions(questionsMap);
    } catch (error) {
      console.error('Error loading modules:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleModuleExpansion = (moduleId: number) => {
    setExpandedModules(prev => {
      const newSet = new Set(prev);
      if (newSet.has(moduleId)) {
        newSet.delete(moduleId);
      } else {
        newSet.add(moduleId);
      }
      return newSet;
    });
  };

  const handlePostClick = (moduleId: number) => {
    const module = modules.find(m => m.id === moduleId);
    if (!module) return;
    
    // Find the index of this module
    const moduleIndex = modules.findIndex(m => m.id === moduleId);
    
    // Check if all previous modules are posted
    const previousModules = modules.slice(0, moduleIndex);
    const allPreviousPosted = previousModules.every(m => m.is_posted);
    
    if (!allPreviousPosted && moduleIndex > 0) {
      alert('You must post all previous modules before posting this one. Students complete modules sequentially.');
      return;
    }

    const mcqErrors = multipleChoicePostErrors(moduleQuestions[moduleId] ?? []);
    if (mcqErrors.length > 0) {
      alert(
        'Fix multiple choice questions before posting:\n\n' + mcqErrors.join('\n')
      );
      return;
    }

    // Show confirmation modal
    setModuleToPost(module);
    setShowPostConfirm(true);
  };

  const handlePostConfirm = async () => {
    if (!moduleToPost) return;
    
    try {
      await moduleAPI.update(moduleToPost.id, { ...moduleToPost, is_posted: true });
      if (selectedCourse) {
        await loadModules(selectedCourse.id);
      }
      setShowPostConfirm(false);
      setModuleToPost(null);
    } catch (error: unknown) {
      console.error('Error posting module:', error);
      const ax = error as { response?: { data?: { detail?: unknown; error?: string } } };
      const d = ax.response?.data?.detail;
      const msg =
        Array.isArray(d) && d.length
          ? d.join('\n')
          : typeof d === 'string'
            ? d
            : ax.response?.data?.error;
      alert(msg ? String(msg) : 'Error posting module');
    }
  };

  const handlePostCancel = () => {
    setShowPostConfirm(false);
    setModuleToPost(null);
  };

  const handleDeleteClick = (moduleId: number) => {
    const mod = modules.find((m) => m.id === moduleId);
    if (!mod || mod.is_posted) return;
    setModuleToDelete(mod);
    setShowDeleteConfirm(true);
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setModuleToDelete(null);
  };

  const handleDeleteConfirm = async () => {
    if (!moduleToDelete || !selectedCourse) return;
    try {
      await moduleAPI.delete(moduleToDelete.id);
      setExpandedModules((prev) => {
        const next = new Set(prev);
        next.delete(moduleToDelete.id);
        return next;
      });
      await loadModules(selectedCourse.id);
      setShowDeleteConfirm(false);
      setModuleToDelete(null);
    } catch (error: unknown) {
      console.error('Error deleting module:', error);
      const ax = error as { response?: { data?: { detail?: unknown; error?: string } } };
      const d = ax.response?.data?.detail;
      const msg =
        typeof d === 'string'
          ? d
          : Array.isArray(d) && d.length
            ? d.join('\n')
            : ax.response?.data?.error;
      alert(msg ? String(msg) : 'Error deleting module');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    try {
      // Parse date as local date to avoid timezone issues
      // Extract just the date part (YYYY-MM-DD) from ISO string
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      // Create date in local timezone (month is 0-indexed in JS Date)
      const date = new Date(year, month - 1, day);
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  const getQuestionTypeIcon = (type: string) => {
    switch (type) {
      case 'multiple_choice':
        return 'MC';
      case 'written':
      case 'audio':
        return '📝';
      case 'video':
        return '🎥';
      default:
        return '📝';
    }
  };

  if (loading) {
    return (
      <div className="teacher-modules">
        <Header />
        <div className="modules-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="teacher-modules">
      <Header />
      
      <div className="modules-content">
        {selectedCourse && (
          <h2 className="teacher-course-title">{selectedCourse.course_name}</h2>
        )}
        <nav className="teacher-nav">
          <button onClick={() => navigate('/')}>
            📊 Overview
          </button>
          <button className="active">
            🎓 Modules
          </button>
          <button onClick={() => navigate('/teacher/announcements')}>
            📢 Announcements
          </button>
          <button onClick={() => navigate('/teacher/grading')}>
            ✓ Grading
          </button>
          <button onClick={() => navigate('/teacher/settings')}>
            ⚙️ Settings
          </button>
        </nav>

        <div className="modules-header">
          <h1>Course Modules</h1>
          <button 
            className="create-button"
            onClick={async () => {
              try {
                if (!selectedCourse) {
                  alert('Please select a course first');
                  return;
                }
                
                // Calculate the next module order (max existing order + 1)
                const maxOrder = modules.length > 0 
                  ? Math.max(...modules.map(m => m.module_order))
                  : 0;
                const nextOrder = maxOrder + 1;
                
                // Create a new module with automatically assigned order
                const newModule = await moduleAPI.create({
                  course: selectedCourse.id,
                  module_name: `Module ${nextOrder}`,
                  module_description: '',
                  module_order: nextOrder,
                  score_total: 100,
                  is_posted: false,
                } as any);
                
                // Navigate to edit page
                navigate(`/teacher/modules/${newModule.id}/edit`);
              } catch (error) {
                console.error('Error creating module:', error);
                alert('Error creating module');
              }
            }}
          >
            + Create Module
          </button>
        </div>

        {!selectedCourse && !courseLoading && (
          <div className="no-course-message">
            <p>Please select a course in Settings to view modules.</p>
          </div>
        )}

        {selectedCourse && modules.length === 0 && !loading && (
          <div className="no-modules-message">
            <p>No modules yet. Create your first module to get started!</p>
          </div>
        )}

        {selectedCourse && (
          <div className="modules-list">
            {modules.map((module, index) => {
              const questions = moduleQuestions[module.id] || [];
              const isExpanded = expandedModules.has(module.id);
              
              // Check if this module can be posted (all previous modules must be posted)
              const canPost = index === 0 || modules.slice(0, index).every(m => m.is_posted);
              
              return (
                <div
                  key={module.id}
                  className={`module-card ${module.is_posted ? 'module-card--posted' : 'module-card--draft'}`}
                >
                  <div className="module-top-row">
                    <h3 className="module-title">{moduleDisplayTitle(module)}</h3>
                    {module.is_posted && <span className="posted-badge">Posted</span>}
                  </div>

                  {/* Description (only if filled) */}
                  {module.module_description && (
                    <p className="module-description">{module.module_description}</p>
                  )}

                  {/* Meta row: due date · questions toggle */}
                  <div className="module-meta">
                    <span className="due-date">Due: {formatDate(module.due_date)}</span>
                    <span className="meta-separator">·</span>
                    <button
                      className="questions-toggle"
                      onClick={() => toggleModuleExpansion(module.id)}
                    >
                      {questions.length} question{questions.length !== 1 ? 's' : ''}
                      <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>
                        ▼
                      </span>
                    </button>
                  </div>

                  {/* Expanded questions */}
                  {isExpanded && questions.length > 0 && (
                    <div className="questions-list">
                      {questions.map((question, qIdx) => (
                        <div key={question.id} className="question-item">
                          <span className="question-number">{qIdx + 1}.</span>
                          <span className="question-text">{question.question_text}</span>
                          <span className="question-type">{getQuestionTypeIcon(question.question_type)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="module-actions">
                    {!module.is_posted ? (
                      <>
                        <button
                          className="btn-edit"
                          onClick={() => navigate(`/teacher/modules/${module.id}/edit`)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-post"
                          onClick={() => handlePostClick(module.id)}
                          disabled={!canPost}
                          title={!canPost ? 'You must post previous modules first' : ''}
                        >
                          Post to Students
                        </button>
                        <button
                          type="button"
                          className="btn-delete-module"
                          onClick={() => handleDeleteClick(module.id)}
                          title="Permanently delete this draft module"
                        >
                          🗑️ Delete module
                        </button>
                      </>
                    ) : (
                      <div className="module-posted-footer">
                        <span className="posted-module-hint">
                          Live for students — edit and delete are turned off while posted.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Post Confirmation Modal */}
      {showPostConfirm && moduleToPost && (
        <div className="modal-overlay" onClick={handlePostCancel}>
          <div className="modal-content post-confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Reminder</h2>
            <div className="post-confirm-message">
              <p className="warning-text">
                Once you post this module, you will not be able to edit it.
              </p>
              <p className="confirm-question">
                Are you sure you want to post <strong>&quot;{moduleDisplayTitle(moduleToPost)}&quot;</strong> to students?
              </p>
            </div>
            <div className="modal-actions">
              <button 
                type="button" 
                onClick={handlePostCancel}
                className="btn-cancel"
              >
                Cancel
              </button>
              <button 
                type="button" 
                onClick={handlePostConfirm}
                className="btn-confirm"
              >
                Post to Students
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && moduleToDelete && (
        <div className="modal-overlay" onClick={handleDeleteCancel}>
          <div className="modal-content post-confirm-modal delete-module-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Delete module?</h2>
            <div className="post-confirm-message">
              <p className="warning-text">
                This permanently removes <strong>&quot;{moduleDisplayTitle(moduleToDelete)}&quot;</strong> and all of its
                questions. This cannot be undone.
              </p>
            </div>
            <div className="modal-actions">
              <button type="button" onClick={handleDeleteCancel} className="btn-cancel">
                Cancel
              </button>
              <button type="button" onClick={handleDeleteConfirm} className="btn-confirm-delete">
                Delete module
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeacherModules;
