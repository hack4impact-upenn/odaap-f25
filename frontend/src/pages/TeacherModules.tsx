import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, moduleAPI, questionAPI } from '../services/api';
import type { Module, Question } from '../types';
import './TeacherModules.css';

const TeacherModules: React.FC = () => {
  const [modules, setModules] = useState<Module[]>([]);
  const [moduleQuestions, setModuleQuestions] = useState<Record<number, Question[]>>({});
  const [expandedModules, setExpandedModules] = useState<Set<number>>(new Set());
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedCourse) {
      loadModules(selectedCourse);
    }
  }, [selectedCourse]);

  const loadData = async () => {
    try {
      if (user) {
        const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
        if (enrolledCourses.length > 0) {
          setSelectedCourse(enrolledCourses[0].id);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadModules = async (courseId: number) => {
    try {
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

  const handlePostModule = async (moduleId: number) => {
    try {
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
      
      await moduleAPI.update(moduleId, { ...module, is_posted: true });
      await loadModules(selectedCourse!);
    } catch (error) {
      console.error('Error posting module:', error);
      alert('Error posting module');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'TBD';
    try {
      const date = new Date(dateString);
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
          <button onClick={() => navigate('/')}>
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
                
                // Create a new module
                const newModule = await moduleAPI.create({
                  course: selectedCourse,
                  module_name: `Module ${modules.length + 1}`,
                  module_description: 'Description of the module',
                  module_order: modules.length + 1,
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

        {selectedCourse && (
          <div className="modules-list">
            {modules.map((module, index) => {
              const questions = moduleQuestions[module.id] || [];
              const isExpanded = expandedModules.has(module.id);
              
              // Check if this module can be posted (all previous modules must be posted)
              const canPost = index === 0 || modules.slice(0, index).every(m => m.is_posted);
              
              return (
                <div key={module.id} className="module-card">
                  <div className="module-header">
                    <div className="module-info">
                      <div className="module-title-row">
                        <span className="module-order-badge">#{index + 1}</span>
                        <h3 className="module-title">{module.module_name}</h3>
                      </div>
                      <p className="module-description">
                        {module.module_description || 'Description of the module'}
                      </p>
                      <div className="module-meta">
                        <span className="due-date">Due: {formatDate(module.due_date)}</span>
                        <button 
                          className="questions-toggle"
                          onClick={() => toggleModuleExpansion(module.id)}
                        >
                          Questions ({questions.length})
                          <span className={`toggle-arrow ${isExpanded ? 'expanded' : ''}`}>
                            {isExpanded ? '▲' : '▼'}
                          </span>
                        </button>
                      </div>
                    </div>
                    <div className="module-actions">
                      <button 
                        className="btn-edit"
                        onClick={() => navigate(`/teacher/modules/${module.id}/edit`)}
                        disabled={module.is_posted}
                        title={module.is_posted ? "Cannot edit posted modules" : ""}
                      >
                        ✏️ Edit
                      </button>
                      {module.is_posted ? (
                        <span className="posted-badge">Posted</span>
                      ) : (
                        <button 
                          className="btn-post"
                          onClick={() => handlePostModule(module.id)}
                          disabled={!canPost}
                          title={!canPost ? "You must post previous modules first" : ""}
                        >
                          Post to Students
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {isExpanded && questions.length > 0 && (
                    <div className="questions-list">
                      {questions.map((question, index) => (
                        <div key={question.id} className="question-item">
                          <span className="question-number">{index + 1}.</span>
                          <span className="question-text">{question.question_text}</span>
                          <span className="question-type">{getQuestionTypeIcon(question.question_type)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherModules;
