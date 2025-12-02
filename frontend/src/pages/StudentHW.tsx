import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, questionAPI, submissionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import type { Module, Question, Submission } from '../types';
import './StudentHW.css';

const StudentHW: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, Submission>>({});
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [responseTypes, setResponseTypes] = useState<Record<number, 'written' | 'audio'>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);

  useEffect(() => {
    if (moduleId && user) {
      loadModuleData();
    }
  }, [moduleId, user]);

  const loadModuleData = async () => {
    try {
      setLoading(true);
      
      // Load module
      const moduleData = await moduleAPI.getById(Number(moduleId));
      setModule(moduleData);

      // Load questions
      const questionsData = await moduleAPI.getQuestions(Number(moduleId));
      const sortedQuestions = questionsData.sort((a, b) => a.question_order - b.question_order);
      setQuestions(sortedQuestions);

      // Load existing submissions
      if (user) {
        try {
          const submissionsData = await submissionAPI.getAll(undefined, Number(moduleId));
          const submissionsMap: Record<number, Submission> = {};
          const initialResponses: Record<number, string> = {};
          const initialTypes: Record<number, 'written' | 'audio'> = {};
          
          submissionsData.forEach((sub: Submission) => {
            if (sub.user_id === user.id) {
              submissionsMap[sub.question_id] = sub;
              initialResponses[sub.question_id] = sub.submission_response;
              initialTypes[sub.question_id] = sub.submission_type as 'written' | 'audio';
            }
          });
          
          setSubmissions(submissionsMap);
          setResponses(initialResponses);
          setResponseTypes(initialTypes);
          
          // If there are submissions, we're in review mode
          if (Object.keys(submissionsMap).length > 0) {
            setIsReviewMode(true);
          }
        } catch (error) {
          console.log('No existing submissions found');
        }
      }

      // Set default response types for questions without submissions
      sortedQuestions.forEach((q) => {
        if (!responseTypes[q.id]) {
          setResponseTypes(prev => ({
            ...prev,
            [q.id]: (q.question_type === 'audio' || q.question_type === 'video') ? 'audio' : 'written'
          }));
        }
      });
    } catch (error) {
      console.error('Error loading module:', error);
      alert('Error loading module. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId: number, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleResponseTypeChange = (questionId: number, type: 'written' | 'audio') => {
    setResponseTypes(prev => ({ ...prev, [questionId]: type }));
  };

  const handleSubmit = async () => {
    if (!user || !moduleId) return;

    try {
      setIsSubmitting(true);
      
      const submitPromises = questions.map(async (question) => {
        const response = responses[question.id];
        const responseType = responseTypes[question.id] || question.question_type;
        
        if (!response && responseType === 'written') {
          return; // Skip empty written responses
        }

        const submissionData = {
          question_id: question.id,
          module_id: Number(moduleId),
          submission_type: responseType,
          response: response || '', // For audio, this might be empty initially
        };

        // Check if submission already exists
        if (submissions[question.id]) {
          // Update existing submission
          await submissionAPI.update(submissions[question.id].id, submissionData);
        } else {
          // Create new submission
          await submissionAPI.submit(submissionData);
        }
      });

      await Promise.all(submitPromises);
      alert('Assignment submitted successfully!');
      
      // Reload data to show submissions
      await loadModuleData();
      setIsReviewMode(true);
    } catch (error: any) {
      console.error('Error submitting:', error);
      alert(error.response?.data?.error || 'Error submitting assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="student-hw">
        <Header />
        <div className="hw-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="student-hw">
        <Header />
        <div className="hw-content">
          <div>Module not found</div>
        </div>
      </div>
    );
  }

  // Format due date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
    } catch {
      return dateString;
    }
  };

  return (
    <div className="student-hw">
      <Header />
      
      <div className="hw-content">
        <div className="hw-header">
          <button 
            className="back-button"
            onClick={() => navigate('/')}
          >
            <span className="back-arrow">←</span>
            Back to Home
          </button>
          <h2 className="module-name-header">{module.module_name}</h2>
          <span className="due-date">Due: {module.due_date ? formatDate(module.due_date) : 'TBD'}</span>
        </div>

        {isReviewMode && (
          <div className="review-notice">
            <p>You are viewing your submitted responses. You can update them and resubmit.</p>
          </div>
        )}

        <div className="questions-container">
          {questions.map((question, index) => {
            const submission = submissions[question.id];
            const hasSubmission = !!submission;
            
            return (
              <div key={question.id} className={`question-card ${hasSubmission ? 'has-submission' : ''}`}>
                <h3 className="question-number">Question {index + 1}.</h3>
                <p className="question-text">{question.question_text}</p>

                {/* Response Type Selection */}
                <div className="response-type-selection">
                  <button
                    className={`response-type-btn ${responseTypes[question.id] === 'written' ? 'active' : ''}`}
                    onClick={() => handleResponseTypeChange(question.id, 'written')}
                    disabled={isReviewMode && hasSubmission}
                  >
                    <span className="icon-doc">✏️</span>
                    Written Response
                  </button>
                  <button
                    className={`response-type-btn ${responseTypes[question.id] === 'audio' ? 'active' : ''}`}
                    onClick={() => handleResponseTypeChange(question.id, 'audio')}
                    disabled={isReviewMode && hasSubmission}
                  >
                    <span className="icon-mic">🎤</span>
                    Audio Recording
                  </button>
                </div>

                {/* Response Input */}
                {responseTypes[question.id] === 'written' ? (
                  <textarea
                    className="response-textarea"
                    placeholder="Type your response here ..."
                    value={responses[question.id] || ''}
                    onChange={(e) => handleResponseChange(question.id, e.target.value)}
                    rows={6}
                    readOnly={isReviewMode && hasSubmission}
                  />
                ) : (
                  <div className="audio-recording">
                    <button className="record-button" disabled={isReviewMode && hasSubmission}>
                      <span className="icon-mic">🎤</span>
                      Start Recording
                    </button>
                    {hasSubmission && (
                      <p className="audio-note">Audio submission recorded on {new Date(submission.time_submitted).toLocaleDateString()}</p>
                    )}
                  </div>
                )}

                {/* Show grade if available */}
                {submission?.grade && (
                  <div className="submission-grade">
                    <strong>Grade:</strong> {submission.grade.score} / {submission.grade.total}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="submit-section">
          <button 
            onClick={handleSubmit} 
            className="submit-button"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Submitting...' : isReviewMode ? 'Update Submission' : 'Submit Assignment'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentHW;
