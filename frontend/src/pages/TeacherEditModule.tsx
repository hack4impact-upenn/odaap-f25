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
  });
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
      });

      const questionsData = await moduleAPI.getQuestions(Number(moduleId));
      setQuestions(questionsData.sort((a, b) => a.question_order - b.question_order));
    } catch (error) {
      console.error('Error loading module:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModuleChange = (field: string, value: any) => {
    setModuleData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddQuestion = async () => {
    // TODO: Open add question modal or navigate
    alert('Add question functionality coming soon');
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (window.confirm('Are you sure you want to delete this question?')) {
      try {
        await questionAPI.delete(questionId);
        loadModuleData();
      } catch (error) {
        console.error('Error deleting question:', error);
      }
    }
  };

  const handleUpdateModule = async () => {
    try {
      await moduleAPI.update(Number(moduleId), moduleData);
      alert('Module updated successfully!');
      navigate('/teacher/modules');
    } catch (error) {
      console.error('Error updating module:', error);
      alert('Error updating module');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!module) {
    return <div>Module not found</div>;
  }

  return (
    <div className="edit-module">
      <Header />
      
      <div className="edit-content">
        <div className="edit-header">
          <button onClick={() => navigate('/teacher/modules')} className="back-link">
            ← Back to Modules
          </button>
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
              />
            </div>

            <div className="form-group">
              <label>Module Description</label>
              <textarea
                value={moduleData.module_description}
                onChange={(e) => handleModuleChange('module_description', e.target.value)}
                placeholder="Write a description here"
                rows={4}
              />
            </div>

            <div className="form-group">
              <label>YouTube Link (for video at top)</label>
              <input
                type="text"
                value={moduleData.youtube_link}
                onChange={(e) => handleModuleChange('youtube_link', e.target.value)}
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div className="form-group">
              <label>Due Date</label>
              <input
                type="date"
                // TODO: Add due date field to module model
              />
            </div>
          </div>

          <div className="questions-section">
            <div className="questions-header">
              <h2>Questions</h2>
              <button className="add-question-btn" onClick={handleAddQuestion}>
                + Add Question
              </button>
            </div>

            {questions.map((question, index) => (
              <div key={question.id} className="question-edit-card">
                <div className="question-header">
                  <h3>Question {index + 1}</h3>
                  <button 
                    className="delete-question-btn"
                    onClick={() => handleDeleteQuestion(question.id)}
                  >
                    🗑️
                  </button>
                </div>

                <textarea
                  className="question-text-input"
                  value={question.question_text}
                  placeholder="Enter question text..."
                  rows={3}
                />

                <div className="response-type-group">
                  <label>Student Response Type</label>
                  <div className="radio-group">
                    <label>
                      <input type="radio" name={`type-${question.id}`} value="written" />
                      Written/Audio
                    </label>
                    <label>
                      <input type="radio" name={`type-${question.id}`} value="video" />
                      Field Assignment/File Attachment
                    </label>
                    <label>
                      <input 
                        type="radio" 
                        name={`type-${question.id}`} 
                        value="multiple_choice"
                        checked={question.question_type === 'multiple_choice'}
                      />
                      Multiple Choice
                    </label>
                  </div>
                </div>

                {question.question_type === 'multiple_choice' && question.mcq_options && (
                  <div className="mcq-options">
                    <button className="add-option-btn">+ Add Option</button>
                    {question.mcq_options.map((option, optIndex) => (
                      <div key={optIndex} className="option-item">
                        <input type="radio" name={`correct-${question.id}`} />
                        <input
                          type="text"
                          value={option}
                          placeholder={`Option ${optIndex + 1}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="update-section">
            <button onClick={handleUpdateModule} className="update-button">
              Update Module
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeacherEditModule;

