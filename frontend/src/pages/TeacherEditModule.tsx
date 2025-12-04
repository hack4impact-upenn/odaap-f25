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

  const handleModuleChange = (field: string, value: any) => {
    setModuleData(prev => ({ ...prev, [field]: value }));
  };

  const handleQuestionChange = (questionId: number, field: string, value: any) => {
    setEditingQuestions(prev => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        [field]: value,
      },
    }));
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

  const handleUpdateQuestion = async (questionId: number) => {
    if (moduleData.is_posted) {
      alert('Cannot update questions in a posted module. Modules can only be edited before they are posted to students.');
      return;
    }
    
    try {
      const questionData = editingQuestions[questionId];
      const question = questions.find(q => q.id === questionId);
      
      if (!question) return;
      
      // Get correct answers from MCQ options if it's a multiple choice question
      let correctAnswers = questionData.correct_answers || [];
      if (questionData.question_type === 'multiple_choice' && questionData.mcq_options) {
        // For MCQ, correct answers should be the selected options
        correctAnswers = questionData.correct_answers || [];
      }
      
      await questionAPI.update(questionId, {
        question_text: questionData.question_text,
        question_type: questionData.question_type,
        mcq_options: questionData.mcq_options || [],
        correct_answers: correctAnswers,
        question_order: questionData.question_order,
        score_total: questionData.score_total,
        module_id: question.module_id,
      });
      
      alert('Question updated successfully!');
      await loadModuleData();
    } catch (error: any) {
      console.error('Error updating question:', error);
      alert(error.response?.data?.error || 'Error updating question');
    }
  };

  const handleUpdateModule = async () => {
    if (moduleData.is_posted) {
      alert('Cannot update a posted module. Modules can only be edited before they are posted to students.');
      return;
    }
    
    try {
      const updateData: Partial<Module> = {
        ...moduleData,
        due_date: moduleData.due_date ? new Date(moduleData.due_date).toISOString() : undefined,
      };
      await moduleAPI.update(Number(moduleId), updateData);
      alert('Module updated successfully!');
      navigate('/teacher/modules');
    } catch (error) {
      console.error('Error updating module:', error);
      alert('Error updating module');
    }
  };

  const handlePostModule = async () => {
    try {
      await moduleAPI.update(Number(moduleId), { ...moduleData, is_posted: true });
      alert('Module posted successfully!');
      navigate('/teacher/modules');
    } catch (error) {
      console.error('Error posting module:', error);
      alert('Error posting module');
    }
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
              ⚠️ This module has been posted to students and cannot be edited. Students may have already started working on it.
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
              <label>Module Order</label>
              <input
                type="number"
                min="1"
                value={moduleData.module_order}
                onChange={(e) => handleModuleChange('module_order', parseInt(e.target.value) || 1)}
                placeholder="1"
                disabled={moduleData.is_posted}
              />
              <small style={{ color: '#666', fontSize: '12px', display: 'block', marginTop: '4px' }}>
                Lower numbers appear first. This determines the sequence students see modules.
              </small>
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
                  <div className="question-header">
                    <div className="question-number-circle">{index + 1}</div>
                    <button 
                      className="delete-question-btn"
                      onClick={() => handleDeleteQuestion(question.id)}
                      disabled={moduleData.is_posted}
                      title={moduleData.is_posted ? "Cannot delete questions from posted modules" : ""}
                    >
                      🗑️
                    </button>
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
                        📁 Field Assignment/File Attachment
                      </label>
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
                      <label>Multiple Choice Options</label>
                      {(editingQuestion.mcq_options || []).map((option, optIndex) => {
                        const currentCorrectAnswers = editingQuestion.correct_answers || [];
                        const isCorrect = option && currentCorrectAnswers.includes(option);
                        
                        return (
                          <div key={optIndex} className="option-item">
                            <input 
                              type="radio" 
                              name={`correct-${question.id}`}
                              checked={!!isCorrect}
                              onChange={() => {
                                // Set this option as the only correct answer
                                const correctAnswers = option ? [option] : [];
                                handleQuestionChange(question.id, 'correct_answers', correctAnswers);
                              }}
                            />
                            <input
                              type="text"
                              value={option}
                              onChange={(e) => {
                                const newValue = e.target.value;
                                handleMcqOptionChange(question.id, optIndex, newValue);
                                // If this was the correct answer, update it
                                if (isCorrect && newValue) {
                                  handleQuestionChange(question.id, 'correct_answers', [newValue]);
                                }
                              }}
                              placeholder={`Option ${optIndex + 1}`}
                            />
                            <button 
                              className="remove-option-btn"
                              onClick={() => {
                                // If removing the correct answer, clear it
                                if (isCorrect) {
                                  handleQuestionChange(question.id, 'correct_answers', []);
                                }
                                handleRemoveMcqOption(question.id, optIndex);
                              }}
                            >
                              ×
                            </button>
                          </div>
                        );
                      })}
                      <button 
                        className="add-option-btn" 
                        onClick={() => handleAddMcqOption(question.id)}
                      >
                        + Add Option
                      </button>
                    </div>
                  )}

                  <button 
                    className="update-question-btn"
                    onClick={() => handleUpdateQuestion(question.id)}
                    disabled={moduleData.is_posted}
                    title={moduleData.is_posted ? "Cannot update questions in posted modules" : ""}
                  >
                    Update Question
                  </button>
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
            {!moduleData.is_posted && (
              <button onClick={handlePostModule} className="post-button">
                Post
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherEditModule;
