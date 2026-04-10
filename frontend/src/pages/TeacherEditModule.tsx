import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, questionAPI } from '../services/api';
import type { Module, Question } from '../types';
import './TeacherEditModule.css';

const TeacherEditModule: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [moduleData, setModuleData] = useState({
    module_name: '',
    module_description: '',
    youtube_link: '',
    module_order: 0,
    score_total: 0,
    is_posted: false,
    due_date: '',
  });
  const [editingQuestions, setEditingQuestions] = useState<Record<number, Partial<Question>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (moduleId) {
      loadModuleData();
    }
  }, [moduleId]);

  const loadModuleData = async () => {
    try {
      const moduleData = await moduleAPI.getById(Number(moduleId));
      setModule(moduleData);
      setModuleData({
        module_name: moduleData.module_name,
        module_description: moduleData.module_description || '',
        youtube_link: moduleData.youtube_link || '',
        module_order: moduleData.module_order,
        score_total: moduleData.score_total,
        is_posted: moduleData.is_posted,
        due_date: moduleData.due_date ? moduleData.due_date.split('T')[0] : '',
      });
      
      // If module is posted, show warning and prevent editing
      if (moduleData.is_posted) {
        alert('This module has been posted and cannot be edited. Students may have already started working on it.');
      }

      const questionsData = await moduleAPI.getQuestions(Number(moduleId));
      const sortedQuestions = questionsData.sort((a, b) => a.question_order - b.question_order);
      setQuestions(sortedQuestions);
      
      // Initialize editing state
      const editingState: Record<number, Partial<Question>> = {};
      sortedQuestions.forEach(q => {
        editingState[q.id] = {
          question_text: q.question_text,
          question_type: q.question_type,
          mcq_options: q.mcq_options || [],
          correct_answers: q.correct_answers || [],
          question_order: q.question_order,
          score_total: q.score_total,
        };
      });
      setEditingQuestions(editingState);
      
      // Set default response types for questions without submissions (skip multiple choice)
      sortedQuestions.forEach((q) => {
        if (!editingState[q.id]?.question_type && q.question_type !== 'multiple_choice') {
          editingState[q.id] = {
            ...editingState[q.id],
            question_type: (q.question_type === 'audio' || q.question_type === 'video') ? 'audio' : 'written'
          };
        }
      });
    } catch (error) {
      console.error('Error loading module:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveModuleData = async (silent: boolean = true) => {
    if (!moduleId || !module || moduleData.is_posted) {
      return;
    }
    
    try {
      // Prepare update data - only send fields that can be updated
      // Don't send module_order - it's automatically managed and shouldn't be changed
      const updateData: any = {
        module_name: moduleData.module_name,
        module_description: moduleData.module_description || '',
        youtube_link: moduleData.youtube_link || '',
        score_total: moduleData.score_total,
        is_posted: moduleData.is_posted, // Keep current posted status
        course: module.course_id, // Include course ID for serializer
      };
      
      // Handle due_date - convert to ISO string if provided, or set to null
      // Parse the date string (YYYY-MM-DD) as a local date
      if (moduleData.due_date) {
        const [year, month, day] = moduleData.due_date.split('-').map(Number);
        const localDate = new Date(year, month - 1, day);
        updateData.due_date = localDate.toISOString();
      } else {
        updateData.due_date = null as any;
      }
      
      await moduleAPI.update(Number(moduleId), updateData);
      if (!silent) {
        alert('Module updated successfully!');
      }
    } catch (error: any) {
      if (!silent) {
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.detail || 
                            (error.response?.data && JSON.stringify(error.response.data)) ||
                            error.message || 
                            'Error updating module';
        alert(`Error updating module: ${errorMessage}`);
      } else {
        // Silently fail for auto-save - don't interrupt user workflow
        console.error('Error auto-saving module:', error);
      }
    }
  };

  const handleModuleChange = (field: string, value: any) => {
    setModuleData(prev => ({ ...prev, [field]: value }));
    // Auto-save module data after a short delay (debounce)
    if (moduleId && !moduleData.is_posted) {
      clearTimeout((window as any).moduleSaveTimeout);
      (window as any).moduleSaveTimeout = setTimeout(() => {
        saveModuleData(true); // Silent auto-save
      }, 1500); // Save 1.5 seconds after user stops typing
    }
  };

  const saveQuestion = async (questionId: number, questionDataToSave: Partial<Question>, silent: boolean = true) => {
    if (moduleData.is_posted) {
      return; // Don't save if module is posted
    }
    
    const question = questions.find(q => q.id === questionId);
    
    if (!question) {
      console.warn(`Question ${questionId} not found`);
      return;
    }
    
    // Merge questionDataToSave with existing question data to ensure all required fields are present
    const mergedData: Partial<Question> = {
      question_text: questionDataToSave.question_text !== undefined ? questionDataToSave.question_text : question.question_text,
      question_type: questionDataToSave.question_type !== undefined ? questionDataToSave.question_type : question.question_type,
      mcq_options: questionDataToSave.mcq_options !== undefined ? questionDataToSave.mcq_options : (question.mcq_options || []),
      question_order: questionDataToSave.question_order !== undefined ? questionDataToSave.question_order : question.question_order,
      score_total: questionDataToSave.score_total !== undefined ? questionDataToSave.score_total : question.score_total,
      correct_answers: questionDataToSave.correct_answers !== undefined ? questionDataToSave.correct_answers : [],
    };
    
    // Ensure we have required fields
    if (!mergedData.question_text || !mergedData.question_type) {
      console.warn(`Question ${questionId} missing required fields:`, mergedData);
      return;
    }
    
    try {
      // Get correct answers from MCQ options if it's a multiple choice question
      let correctAnswers = mergedData.correct_answers || [];
      if (mergedData.question_type === 'multiple_choice' && mergedData.mcq_options) {
        // For MCQ, correct answers should be the selected options
        correctAnswers = mergedData.correct_answers || [];
      }
      
      await questionAPI.update(questionId, {
        question_text: mergedData.question_text,
        question_type: mergedData.question_type,
        mcq_options: mergedData.mcq_options || [],
        correct_answers: correctAnswers,
        question_order: mergedData.question_order!,
        score_total: mergedData.score_total!,
        // Don't send module_id - the question's module shouldn't change during update
      });
      
      if (!silent) {
        alert('Question updated successfully!');
      }
    } catch (error: any) {
      if (!silent) {
        const errorMessage = error.response?.data?.error || 
                            error.response?.data?.detail || 
                            error.message || 
                            'Error updating question';
        alert(`Error updating question: ${errorMessage}`);
      } else {
        // Silently fail for auto-save - don't interrupt user workflow
        console.error('Error auto-saving question:', error);
        console.error('Question data:', mergedData);
        console.error('Error details:', error.response?.data);
      }
    }
  };

  const handleQuestionChange = (questionId: number, field: string, value: any) => {
    setEditingQuestions(prev => {
      const updated = {
        ...prev,
        [questionId]: {
          ...prev[questionId],
          [field]: value,
        },
      };
      
      // Auto-save question data after a short delay (debounce)
      if (moduleId && !moduleData.is_posted) {
        const timeoutKey = `questionSaveTimeout_${questionId}`;
        clearTimeout((window as any)[timeoutKey]);
        
        (window as any)[timeoutKey] = setTimeout(() => {
          // Get latest state to ensure we have all fields
          setEditingQuestions(current => {
            const latestQuestionData = current[questionId];
            if (latestQuestionData && latestQuestionData.question_text) {
              saveQuestion(questionId, latestQuestionData, true); // Silent auto-save
            }
            return current; // Don't modify state, just read it
          });
        }, 1500); // Save 1.5 seconds after user stops typing
      }
      
      return updated;
    });
  };

  const handleAddQuestion = async () => {
    if (moduleData.is_posted) {
      alert('Cannot add questions to a posted module. Modules can only be edited before they are posted to students.');
      return;
    }
    if (!moduleId) {
      alert('Module ID is missing. Please refresh the page.');
      return;
    }
    
    try {
      // Auto-save module data before creating question
      await saveModuleData(true);
      
      // Calculate next question order
      const nextOrder = questions.length > 0 
        ? Math.max(...questions.map(q => q.question_order)) + 1 
        : 1;
      
      console.log('Creating question with order:', nextOrder);
      
      const newQuestion = await moduleAPI.createQuestion(Number(moduleId), {
        question_text: 'New Question',
        question_type: 'written',
        question_order: nextOrder,
        score_total: 10,
        mcq_options: [],
        correct_answers: [],
      });
      
      console.log('Question created:', newQuestion);
      
      // Reload to get the full question data and update the UI
      await loadModuleData();
      
      // Scroll to the new question after a brief delay
      setTimeout(() => {
        const questionElement = document.querySelector(`[data-question-id="${newQuestion.id}"]`);
        if (questionElement) {
          questionElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Highlight the new question briefly
          questionElement.classList.add('new-question-highlight');
          setTimeout(() => {
            questionElement.classList.remove('new-question-highlight');
          }, 2000);
        }
      }, 200);
    } catch (error: any) {
      console.error('Error adding question:', error);
      const errorMessage = error.response?.data?.error || 
                          error.response?.data?.detail || 
                          error.message || 
                          'Error adding question. Please try again.';
      alert(errorMessage);
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (moduleData.is_posted) {
      alert('Cannot delete questions from a posted module. Modules can only be edited before they are posted to students.');
      return;
    }
    
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await questionAPI.delete(questionId);
        await loadModuleData();
      } catch (error: any) {
        console.error('Error deleting question:', error);
        alert(error.response?.data?.error || 'Error deleting question. Make sure the module is not posted.');
      }
    }
  };

  const handleAddMcqOption = (questionId: number) => {
    const question = editingQuestions[questionId];
    const currentOptions = question.mcq_options || [];
    handleQuestionChange(questionId, 'mcq_options', [...currentOptions, '']);
  };

  const handleMcqOptionChange = (questionId: number, index: number, value: string) => {
    const question = editingQuestions[questionId];
    const options = [...(question.mcq_options || [])];
    options[index] = value;
    handleQuestionChange(questionId, 'mcq_options', options);
  };

  const handleRemoveMcqOption = (questionId: number, index: number) => {
    const question = editingQuestions[questionId];
    const options = [...(question.mcq_options || [])];
    options.splice(index, 1);
    handleQuestionChange(questionId, 'mcq_options', options);
  };


  const handleUpdateModule = async () => {
    if (moduleData.is_posted) {
      alert('Cannot update a posted module. Modules can only be edited before they are posted to students.');
      return;
    }
    
    if (!module) {
      alert('Module data not loaded. Please refresh the page.');
      return;
    }
    
    // Use the shared saveModuleData function with notification
    await saveModuleData(false); // Show success/error message
    // Reload the module data to reflect changes
    await loadModuleData();
  };


  if (loading) {
    return (
      <div className="edit-module">
        <Header />
        <div className="edit-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="edit-module">
        <Header />
        <div className="edit-content">
          <div>Module not found</div>
        </div>
      </div>
    );
  }

  return (
    <div className="edit-module">
      <Header />
      
      <div className="edit-content">
        <div className="edit-header">
          <button onClick={() => navigate('/teacher/modules')} className="back-link">
            ← Back to Modules
          </button>
          <h2 className="edit-title">Edit Module</h2>
          {moduleData.is_posted && (
            <div className="posted-warning" style={{ 
              padding: '12px', 
              background: '#fff3cd', 
              border: '1px solid #ffc107', 
              borderRadius: '8px', 
              marginTop: '12px',
              color: '#856404'
            }}>
              This module has been posted to students and cannot be edited. Students may have already started working on it.
            </div>
          )}
        </div>

        <div className="edit-form">
          <div className="form-section">
            <h2>Module Information</h2>
            
            <div className="form-group">
              <label>Module Title</label>
              <input
                type="text"
                value={moduleData.module_name}
                onChange={(e) => handleModuleChange('module_name', e.target.value)}
                placeholder="Module 2"
                disabled={moduleData.is_posted}
              />
            </div>

            <div className="form-group">
              <label>Module Description</label>
              <textarea
                value={moduleData.module_description}
                onChange={(e) => handleModuleChange('module_description', e.target.value)}
                placeholder="Write a description here"
                rows={4}
                disabled={moduleData.is_posted}
              />
            </div>

            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                value={moduleData.due_date}
                onChange={(e) => handleModuleChange('due_date', e.target.value)}
                disabled={moduleData.is_posted}
              />
            </div>

            <div className="form-group">
              <label>YouTube Introduction Video Link</label>
              <input
                type="text"
                value={moduleData.youtube_link}
                onChange={(e) => handleModuleChange('youtube_link', e.target.value)}
                placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                disabled={moduleData.is_posted}
              />
              <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                Students will see this video before starting the module questions. Paste any YouTube URL format.
              </small>
            </div>
          </div>

          <div className="questions-section">
            <div className="questions-header">
              <h2>Questions</h2>
              <button 
                className="add-question-btn" 
                onClick={handleAddQuestion}
                disabled={moduleData.is_posted}
                title={moduleData.is_posted ? "Cannot add questions to posted modules" : ""}
              >
                + Add Question
              </button>
            </div>

            {questions.map((question, index) => {
              const editingQuestion = editingQuestions[question.id] || {};
              
              return (
                <div key={question.id} className="question-edit-card" data-question-id={question.id}>
                  <button
                    type="button"
                    className="delete-question-btn"
                    onClick={() => handleDeleteQuestion(question.id)}
                    disabled={moduleData.is_posted}
                    title={moduleData.is_posted ? "Cannot remove questions from posted modules" : "Remove question"}
                    aria-label="Remove question"
                  >
                    <svg
                      className="delete-question-icon"
                      viewBox="0 0 24 24"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                      aria-hidden
                    >
                      <path
                        d="M6 6l12 12M18 6L6 18"
                        stroke="currentColor"
                        strokeWidth={2.75}
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  <div className="question-header">
                    <div className="question-number-circle">{index + 1}</div>
                  </div>

                  <div className="form-group">
                    <label>Question</label>
                    <textarea
                      className="question-text-input"
                      value={editingQuestion.question_text || ''}
                      onChange={(e) => handleQuestionChange(question.id, 'question_text', e.target.value)}
                      placeholder="Enter question text..."
                      rows={3}
                    />
                  </div>

                  <div className="form-group">
                    <label>Student Response Type</label>
                    <div className="radio-group">
                      <label>
                        <input 
                          type="radio" 
                          name={`type-${question.id}`} 
                          value="written"
                          checked={editingQuestion.question_type === 'written' || editingQuestion.question_type === 'audio'}
                          onChange={() => handleQuestionChange(question.id, 'question_type', 'written')}
                        />
                        ✏️ Written/Audio
                      </label>
                      <label>
                        <input 
                          type="radio" 
                          name={`type-${question.id}`} 
                          value="video"
                          checked={editingQuestion.question_type === 'video'}
                          onChange={() => handleQuestionChange(question.id, 'question_type', 'video')}
                        />
                        📁 Field Assignment / file or YouTube
                      </label>
                      {editingQuestion.question_type === 'video' && (
                        <p className="field-assignment-type-hint">
                          Students submit either an uploaded file or a YouTube link (one or the other), not written or
                          audio.
                        </p>
                      )}
                      <label>
                        <input 
                          type="radio" 
                          name={`type-${question.id}`} 
                          value="multiple_choice"
                          checked={editingQuestion.question_type === 'multiple_choice'}
                          onChange={() => handleQuestionChange(question.id, 'question_type', 'multiple_choice')}
                        />
                        • MC Multiple Choice
                      </label>
                    </div>
                  </div>

                  {editingQuestion.question_type === 'multiple_choice' && (
                    <div className="mcq-options-section">
                      <div className="mcq-options-intro">
                        <span className="mcq-options-title">Multiple choice options</span>
                        
                      </div>
                      <div
                        className="mcq-options-grid"
                        role="group"
                        aria-label="Multiple choice answers and correct answer"
                      >
                        <span className="mcq-col-head mcq-col-head-correct">Correct</span>
                        <span className="mcq-col-head mcq-col-head-text">Answer choice</span>
                        <span className="mcq-col-head mcq-col-head-remove" aria-hidden />
                        {(editingQuestion.mcq_options || []).map((option, optIndex) => {
                          const currentCorrectAnswers = editingQuestion.correct_answers || [];
                          const isCorrect = option && currentCorrectAnswers.includes(option);

                          return (
                            <React.Fragment key={optIndex}>
                              <div className="mcq-correct-cell">
                                <input
                                  type="radio"
                                  name={`correct-${question.id}`}
                                  checked={!!isCorrect}
                                  title="Mark this choice as the correct answer for grading"
                                  aria-label={`Mark answer choice ${optIndex + 1} as the correct answer`}
                                  onChange={() => {
                                    const correctAnswers = option ? [option] : [];
                                    handleQuestionChange(question.id, 'correct_answers', correctAnswers);
                                  }}
                                />
                              </div>
                              <div className="mcq-text-cell">
                                <input
                                  type="text"
                                  value={option}
                                  onChange={(e) => {
                                    const newValue = e.target.value;
                                    handleMcqOptionChange(question.id, optIndex, newValue);
                                    if (isCorrect && newValue) {
                                      handleQuestionChange(question.id, 'correct_answers', [newValue]);
                                    }
                                  }}
                                  placeholder={`Option ${optIndex + 1}`}
                                  aria-label={`Text for answer choice ${optIndex + 1}`}
                                />
                              </div>
                              <div className="mcq-remove-cell">
                                <button
                                  type="button"
                                  className="remove-option-btn"
                                  onClick={() => {
                                    if (isCorrect) {
                                      handleQuestionChange(question.id, 'correct_answers', []);
                                    }
                                    handleRemoveMcqOption(question.id, optIndex);
                                  }}
                                  aria-label={`Remove option ${optIndex + 1}`}
                                >
                                  ×
                                </button>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        className="add-option-btn"
                        onClick={() => handleAddMcqOption(question.id)}
                      >
                        + Add Option
                      </button>
                    </div>
                  )}

                </div>
              );
            })}
          </div>

          <div className="update-section">
            <button 
              onClick={handleUpdateModule} 
              className="update-button"
              disabled={moduleData.is_posted}
            >
              Update Module
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherEditModule;
