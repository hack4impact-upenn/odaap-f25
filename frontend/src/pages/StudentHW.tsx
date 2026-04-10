import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, submissionAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { moduleDisplayTitle, type Module, type Question, type Submission } from '../types';
import {
  parseFieldAssignmentResponse,
  serializeFieldAssignmentPayload,
  isYoutubeLikeUrl,
} from '../utils/fieldAssignment';
import './StudentHW.css';

const StudentHW: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const cameFromVideo = !!(location.state as any)?.fromVideo;
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [submissions, setSubmissions] = useState<Record<number, Submission>>({});
  const [responses, setResponses] = useState<Record<number, string>>({});
  const [responseTypes, setResponseTypes] = useState<Record<number, 'written' | 'audio' | 'link'>>({});
  const [audioRecordings, setAudioRecordings] = useState<Record<number, Blob | null>>({});
  const [isRecording, setIsRecording] = useState<Record<number, boolean>>({});
  const [recordingTime, setRecordingTime] = useState<Record<number, number>>({});
  const [mediaRecorders, setMediaRecorders] = useState<Record<number, MediaRecorder | null>>({});
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReviewMode, setIsReviewMode] = useState(false);
  /** Field assignment (question_type video): file + optional YouTube */
  const [fieldAssignmentFile, setFieldAssignmentFile] = useState<Record<number, File | null>>({});
  const [fieldAssignmentYoutube, setFieldAssignmentYoutube] = useState<Record<number, string>>({});
  const [fieldAssignmentSubmittedMeta, setFieldAssignmentSubmittedMeta] = useState<
    Record<number, { fileName: string; fileUrl: string; youtubeUrl: string }>
  >({});

  useEffect(() => {
    if (moduleId && user) {
      loadModuleData();
    }
  }, [moduleId, user]);

  // Cleanup: stop all recordings when component unmounts
  useEffect(() => {
    return () => {
      // Stop all active recordings on unmount
      Object.values(mediaRecorders).forEach(recorder => {
        if (recorder && recorder.state !== 'inactive') {
          recorder.stop();
          if ((recorder as any).intervalId) {
            clearInterval((recorder as any).intervalId);
          }
        }
      });
    };
  }, [mediaRecorders]);

  const loadModuleData = async () => {
    try {
      setLoading(true);
      setFieldAssignmentFile({});
      setFieldAssignmentYoutube({});
      setFieldAssignmentSubmittedMeta({});

      // Check module accessibility first (for students)
      if (user?.isStudent) {
        try {
          const accessibility = await moduleAPI.checkAccessibility(Number(moduleId));
          if (!accessibility.is_accessible) {
            alert('You must complete all previous modules before accessing this one.');
            navigate('/');
            return;
          }
        } catch (error: any) {
          // If accessibility check fails, try to load module anyway
          // The backend will reject if not accessible
          console.warn('Accessibility check failed:', error);
        }
      }
      
      // Load module
      try {
        const moduleData = await moduleAPI.getById(Number(moduleId));
        setModule(moduleData);

        // Always show the video page first if the module has a video link
        if (moduleData.youtube_link && !cameFromVideo) {
          navigate(`/student/module/${moduleId}/video`, { replace: true });
          return;
        }
      } catch (error: any) {
        console.error('Error loading module:', error);
        if (error.response?.status === 404) {
          alert('Module not found. Please check with your teacher.');
          navigate('/');
          return;
        } else if (error.response?.status === 403) {
          alert(error.response?.data?.error || 'You do not have access to this module.');
          navigate('/');
          return;
        }
        alert('Error loading module. Please try again.');
        navigate('/');
        return;
      }

      // Load questions (this will fail if module is not accessible)
      let sortedQuestions: Question[] = [];
      try {
        const questionsData = await moduleAPI.getQuestions(Number(moduleId));
        sortedQuestions = questionsData.sort((a, b) => a.question_order - b.question_order);
        setQuestions(sortedQuestions);
      } catch (error: any) {
        if (error.response?.status === 403) {
          alert(error.response?.data?.error || 'You must complete all previous modules before accessing this one.');
          navigate('/');
          return;
        }
        throw error; // Re-throw if it's a different error
      }

      // Load existing submissions
      let submissionsMap: Record<number, Submission> = {};
      if (user) {
        try {
          const submissionsData = await submissionAPI.getAll(undefined, Number(moduleId));
          const initialResponses: Record<number, string> = {};
          const initialTypes: Record<number, 'written' | 'audio' | 'link'> = {};
          
          submissionsData.forEach((sub: Submission) => {
            if (sub.user_id === user.id) {
              submissionsMap[sub.question_id] = sub;
              initialResponses[sub.question_id] = sub.submission_response;

              if (sub.submission_type === 'audio') {
                initialTypes[sub.question_id] = 'audio';
                if (sub.submission_response) {
                  setAudioRecordings(prev => ({ ...prev, [sub.question_id]: null }));
                }
              } else if (isUrl(sub.submission_response || '')) {
                initialTypes[sub.question_id] = 'link';
              } else {
                initialTypes[sub.question_id] = 'written';
              }
            }
          });
          
          setSubmissions(submissionsMap);
          setResponses(initialResponses);
          setResponseTypes(initialTypes);

          const faYoutube: Record<number, string> = {};
          const faMeta: Record<number, { fileName: string; fileUrl: string; youtubeUrl: string }> = {};
          sortedQuestions.forEach((q) => {
            if (q.question_type !== 'video') return;
            const sub = submissionsMap[q.id];
            if (!sub?.submission_response?.trim()) return;
            const p = parseFieldAssignmentResponse(sub.submission_response);
            if (p) {
              faYoutube[q.id] = p.youtubeUrl || '';
              faMeta[q.id] = {
                fileName: p.fileName || 'Uploaded file',
                fileUrl: p.fileUrl || '',
                youtubeUrl: p.youtubeUrl || '',
              };
            } else if (isUrl(sub.submission_response)) {
              const u = sub.submission_response.trim();
              faYoutube[q.id] = u;
              faMeta[q.id] = { fileName: '', fileUrl: '', youtubeUrl: u };
            } else {
              faMeta[q.id] = {
                fileName: 'Submitted file',
                fileUrl: sub.submission_response,
                youtubeUrl: '',
              };
            }
          });
          setFieldAssignmentYoutube(faYoutube);
          setFieldAssignmentSubmittedMeta(faMeta);
          setFieldAssignmentFile({});

          const allQuestionsSubmitted = sortedQuestions.length > 0 && 
            sortedQuestions.every(q => {
              const submission = submissionsMap[q.id];
              return submission && submission.submission_response && submission.submission_response.trim() !== '';
            });
          
          if (allQuestionsSubmitted) {
            setIsReviewMode(true);
          } else {
            setIsReviewMode(false);
          }
        } catch (error) {
          console.log('No existing submissions found');
          setIsReviewMode(false);
        }
      }

      sortedQuestions.forEach((q) => {
        if (q.question_type === 'multiple_choice' || q.question_type === 'video') return;
        if (submissionsMap[q.id]) return;
        setResponseTypes((prev) => {
          if (prev[q.id]) return prev;
          return { ...prev, [q.id]: 'written' };
        });
      });
    } catch (error) {
      console.error('Error loading module:', error);
      // Silently handle errors - module loading usually works
    } finally {
      setLoading(false);
    }
  };

  const handleResponseChange = (questionId: number, value: string) => {
    setResponses(prev => ({ ...prev, [questionId]: value }));
  };

  const handleResponseTypeChange = (questionId: number, type: 'written' | 'audio' | 'link') => {
    setResponseTypes(prev => ({ ...prev, [questionId]: type }));
    if (type !== 'audio' && isRecording[questionId]) {
      stopRecording(questionId);
    }
  };

  const isUrl = (text: string): boolean => {
    try {
      const url = new URL(text.trim());
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const startRecording = async (questionId: number) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        setAudioRecordings(prev => ({ ...prev, [questionId]: blob }));
        
        // Convert blob to base64 for storage
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result as string;
          setResponses(prev => ({ ...prev, [questionId]: base64Audio }));
        };
        reader.readAsDataURL(blob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorders(prev => ({ ...prev, [questionId]: recorder }));
      setIsRecording(prev => ({ ...prev, [questionId]: true }));
      setRecordingTime(prev => ({ ...prev, [questionId]: 0 }));

      // Start timer
      const interval = setInterval(() => {
        setRecordingTime(prev => {
          const newTime = (prev[questionId] || 0) + 1;
          return { ...prev, [questionId]: newTime };
        });
      }, 1000);

      // Store interval ID to clear later
      (recorder as any).intervalId = interval;
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not access microphone. Please check your permissions.');
    }
  };

  const stopRecording = (questionId: number) => {
    const recorder = mediaRecorders[questionId];
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
      setIsRecording(prev => ({ ...prev, [questionId]: false }));
      
      // Clear interval
      if ((recorder as any).intervalId) {
        clearInterval((recorder as any).intervalId);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const playAudio = (base64Audio: string) => {
    const audio = new Audio(base64Audio);
    audio.play();
  };

  const deleteRecording = (questionId: number) => {
    setAudioRecordings(prev => ({ ...prev, [questionId]: null }));
    setResponses(prev => ({ ...prev, [questionId]: '' }));
    setIsRecording(prev => ({ ...prev, [questionId]: false }));
    setRecordingTime(prev => ({ ...prev, [questionId]: 0 }));
    
    // Stop any ongoing recording
    const recorder = mediaRecorders[questionId];
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop();
    }
  };

  const handleSubmit = async () => {
    if (!user || !moduleId) return;
    
    // Prevent submission if already submitted
    if (isReviewMode) {
      alert('This assignment has already been submitted and cannot be resubmitted.');
      return;
    }

    try {
      setIsSubmitting(true);
      
      // Validate all responses before submitting
      const errors: string[] = [];
      
      questions.forEach((question, index) => {
        if (question.question_type === 'video') {
          const file = fieldAssignmentFile[question.id];
          const yt = (fieldAssignmentYoutube[question.id] || '').trim();
          const hasFile = !!file;
          const hasYt = yt.length > 0;
          if (!hasFile && !hasYt) {
            errors.push(
              `Question ${index + 1}: Upload a file or paste a YouTube link—use one or the other, not both.`
            );
          } else if (hasFile && hasYt) {
            errors.push(
              `Question ${index + 1}: Choose either a file upload or a YouTube link, not both.`
            );
          } else if (hasYt) {
            if (!isUrl(yt)) {
              errors.push(
                `Question ${index + 1}: YouTube link must be a valid URL (https://...)`
              );
            } else if (!isYoutubeLikeUrl(yt)) {
              errors.push(
                `Question ${index + 1}: Link must be a YouTube URL (youtube.com or youtu.be)`
              );
            }
          }
          return;
        }

        const response = responses[question.id];
        const responseType = question.question_type === 'multiple_choice' 
          ? 'multiple_choice' 
          : (responseTypes[question.id] || 'written');
        
        // For multiple choice, require a selection
        if (question.question_type === 'multiple_choice' && !response) {
          errors.push(`Question ${index + 1}: Please select an answer`);
          return;
        }

        if (responseType === 'link') {
          if (!response?.trim()) {
            errors.push(`Question ${index + 1}: Please provide a link`);
            return;
          }
          if (!isUrl(response.trim())) {
            errors.push(`Question ${index + 1}: Please provide a valid URL (starting with http:// or https://)`);
            return;
          }
        }

        if (responseType === 'written' && !response?.trim()) {
          errors.push(`Question ${index + 1}: Please provide a written response`);
          return;
        }

        // For audio, require a recording
        if (responseType === 'audio' && !response && !audioRecordings[question.id]) {
          errors.push(`Question ${index + 1}: Please record an audio response`);
          return;
        }
      });

      if (errors.length > 0) {
        alert(errors.join('\n'));
        throw new Error('Validation failed');
      }

      // Submit all responses
      const submitResults = await Promise.allSettled(
        questions.map(async (question, index) => {
          const validModuleId = moduleId ? Number(moduleId) : module?.id;
          if (validModuleId == null) {
            throw new Error(`Question ${index + 1}: Missing module; cannot submit.`);
          }

          if (question.question_type === 'video') {
            const file = fieldAssignmentFile[question.id];
            const yt = (fieldAssignmentYoutube[question.id] || '').trim();
            let payload: string;
            if (file) {
              const fileName = file.name;
              const fileUrl = `upload:${fileName}`;
              payload = serializeFieldAssignmentPayload({ fileName, fileUrl });
            } else if (yt) {
              payload = serializeFieldAssignmentPayload({ youtubeUrl: yt });
            } else {
              throw new Error(`Question ${index + 1}: Provide a file or a YouTube link.`);
            }
            if (submissions[question.id]) {
              throw new Error(
                `Question ${index + 1}: This question has already been submitted and cannot be resubmitted.`
              );
            }
            await submissionAPI.submit({
              question_id: question.id,
              module_id: validModuleId,
              submission_type: 'video',
              response: payload,
            });
            return { question: question.id, success: true };
          }

          const response = responses[question.id];
          const responseType = question.question_type === 'multiple_choice' 
            ? 'multiple_choice' 
            : (responseTypes[question.id] || 'written');
          
          // Skip if no response (shouldn't happen after validation, but just in case)
          if (!response && responseType !== 'audio' && responseType !== 'multiple_choice') {
            return { question: question.id, skipped: true };
          }

          // For audio, make sure we have the base64 data
          let finalResponse = response || '';
          if (responseType === 'audio') {
            // If we have a blob but no base64 yet, convert it
            if (audioRecordings[question.id] && !response) {
              const blob = audioRecordings[question.id];
              if (blob) {
                finalResponse = await new Promise<string>((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onerror = reject;
                  reader.onloadend = () => resolve(reader.result as string);
                  reader.readAsDataURL(blob);
                });
                setResponses(prev => ({ ...prev, [question.id]: finalResponse }));
              }
            }
            // If still no response, throw error
            if (!finalResponse) {
              throw new Error(`No audio recording found for Question ${index + 1}`);
            }
          }

          // Ensure we have a response for all question types
          if (!finalResponse && responseType !== 'audio') {
            throw new Error(`No response provided for Question ${index + 1}`);
          }

          const submissionData = {
            question_id: question.id,
            module_id: validModuleId,
            submission_type: responseType === 'link' ? 'written' : responseType,
            response: finalResponse,
          };

          try {
          // Check if submission already exists - if it does, don't allow resubmission
          if (submissions[question.id]) {
            throw new Error(`Question ${index + 1}: This question has already been submitted and cannot be resubmitted.`);
          }
          
          // Create new submission
          await submissionAPI.submit(submissionData);
          } catch (apiError: any) {
            // Re-throw with more context
            const errorMsg = apiError?.response?.data?.error || 
                           apiError?.response?.data?.detail || 
                           apiError?.message || 
                           'Unknown error';
            throw new Error(`Question ${index + 1}: ${errorMsg}`);
          }
          
          return { question: question.id, success: true };
        })
      );

      // Check for any failures
      const failures = submitResults
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result, index) => {
          const error = result.reason;
          return `Question ${index + 1}: ${error?.response?.data?.error || error?.response?.data?.detail || error?.message || 'Unknown error'}`;
        });

      if (failures.length > 0) {
        throw new Error(failures.join('\n'));
      }
      alert('Assignment submitted successfully!');
      
      // Reload data to show submissions
      await loadModuleData();
      setIsReviewMode(true);
    } catch (error: any) {
      console.error('Error submitting:', error);
      console.error('Error details:', error.response?.data);
      
      // Show more detailed error message
      let errorMessage = 'Error submitting assignment. Please try again.';
      if (error.response?.data) {
        if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (error.response.data.detail) {
          errorMessage = error.response.data.detail;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        } else if (error.response.data.non_field_errors) {
          errorMessage = error.response.data.non_field_errors.join(', ');
        } else {
          // Try to extract any field errors
          const fieldErrors = Object.entries(error.response.data)
            .map(([field, errors]: [string, any]) => `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join('\n');
          if (fieldErrors) {
            errorMessage = fieldErrors;
          }
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      alert(errorMessage);
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

  return (
    <div className="student-hw">
      <Header />
      
      <div className="hw-content">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          <span className="back-arrow">←</span>
          Back to Home
        </button>
        
        <div className="hw-header">
          <h2 className="module-name-header">{moduleDisplayTitle(module)}</h2>
          <span className="due-date">Due: {module.due_date ? formatDate(module.due_date) : 'TBD'}</span>
        </div>

        {isReviewMode && (
          <div className="review-notice">
            <p>You are viewing your submitted responses.</p>
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

                {/* Multiple Choice Questions */}
                {question.question_type === 'multiple_choice' && question.mcq_options && question.mcq_options.length > 0 ? (
                  <div className="mcq-options">
                    {question.mcq_options.map((option, optIndex) => (
                      <label key={optIndex} className="mcq-option">
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option}
                          checked={responses[question.id] === option}
                          onChange={(e) => handleResponseChange(question.id, e.target.value)}
                          disabled={isReviewMode && hasSubmission}
                        />
                        <span className="option-text">{option}</span>
                      </label>
                    ))}
                  </div>
                ) : question.question_type === 'video' ? (
                  <div className="field-assignment-hw">
                    <p className="field-assignment-intro">
                      Submit <strong>either</strong> an uploaded file <strong>or</strong> a YouTube link—pick one, not
                      both.
                    </p>
                    {!hasSubmission ? (
                      <>
                        <label className="field-assignment-file-label">
                          <input
                            type="file"
                            className="field-assignment-file-input"
                            accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,video/*,audio/*"
                            onChange={(e) => {
                              const f = e.target.files?.[0] || null;
                              setFieldAssignmentFile((prev) => ({ ...prev, [question.id]: f }));
                              if (f) {
                                setFieldAssignmentYoutube((prev) => ({ ...prev, [question.id]: '' }));
                              }
                            }}
                          />
                          <span className="field-assignment-file-btn">Choose file</span>
                        </label>
                        {fieldAssignmentFile[question.id] && (
                          <p className="field-assignment-file-name">
                            Selected: {fieldAssignmentFile[question.id]?.name}
                          </p>
                        )}
                        <p className="field-assignment-or">— or —</p>
                        <label className="field-assignment-youtube-label" htmlFor={`yt-${question.id}`}>
                          YouTube link
                        </label>
                        <input
                          id={`yt-${question.id}`}
                          type="url"
                          className="field-assignment-youtube-input"
                          placeholder="https://www.youtube.com/watch?v=..."
                          value={fieldAssignmentYoutube[question.id] || ''}
                          onChange={(e) => {
                            const v = e.target.value;
                            setFieldAssignmentYoutube((prev) => ({ ...prev, [question.id]: v }));
                            if (v.trim()) {
                              setFieldAssignmentFile((prev) => ({ ...prev, [question.id]: null }));
                            }
                          }}
                        />
                      </>
                    ) : (
                      <div className="field-assignment-review">
                        <p className="field-assignment-review-title">Submitted</p>
                        {fieldAssignmentSubmittedMeta[question.id]?.fileName ? (
                          <p className="field-assignment-review-line">
                            <strong>File:</strong> {fieldAssignmentSubmittedMeta[question.id].fileName}
                            {fieldAssignmentSubmittedMeta[question.id].fileUrl &&
                              isUrl(fieldAssignmentSubmittedMeta[question.id].fileUrl) && (
                                <>
                                  {' '}
                                  <a
                                    href={fieldAssignmentSubmittedMeta[question.id].fileUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                  >
                                    Open
                                  </a>
                                </>
                              )}
                          </p>
                        ) : null}
                        {(fieldAssignmentYoutube[question.id] ||
                          fieldAssignmentSubmittedMeta[question.id]?.youtubeUrl) && (
                          <p className="field-assignment-review-line">
                            <strong>YouTube:</strong>{' '}
                            <a
                              href={
                                (fieldAssignmentYoutube[question.id] ||
                                  fieldAssignmentSubmittedMeta[question.id]?.youtubeUrl) as string
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {fieldAssignmentYoutube[question.id] ||
                                fieldAssignmentSubmittedMeta[question.id]?.youtubeUrl}
                            </a>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    {(question.question_type === 'written' || 
                      question.question_type === 'audio') && (
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
                    )}

                    {(hasSubmission && submission.submission_type === 'audio') || 
                     (!hasSubmission && responseTypes[question.id] === 'audio') ? (
                      <div className="audio-recording">
                        {!audioRecordings[question.id] && !hasSubmission ? (
                          <>
                            {!isRecording[question.id] ? (
                              <button 
                                className="record-button" 
                                onClick={() => startRecording(question.id)}
                                disabled={isReviewMode && hasSubmission}
                              >
                                <span className="icon-mic">🎤</span>
                                Start Recording
                              </button>
                            ) : (
                              <div className="recording-controls">
                                <div className="recording-indicator">
                                  <span className="recording-dot"></span>
                                  <span className="recording-time">Recording: {formatTime(recordingTime[question.id] || 0)}</span>
                                </div>
                                <button 
                                  className="stop-button" 
                                  onClick={() => stopRecording(question.id)}
                                >
                                  Stop Recording
                                </button>
                              </div>
                            )}
                          </>
                        ) : (
                          <div className="audio-playback">
                            <p className="audio-status">
                              {hasSubmission 
                                ? `Audio submitted on ${new Date(submission.time_submitted).toLocaleDateString()}`
                                : 'Audio recorded'}
                            </p>
                            <div className="audio-controls">
                              {responses[question.id] && (
                                <button 
                                  className="play-button"
                                  onClick={() => playAudio(responses[question.id])}
                                >
                                  ▶️ Play Recording
                                </button>
                              )}
                              {!hasSubmission && (
                                <>
                                  <button 
                                    className="re-record-button"
                                    onClick={() => deleteRecording(question.id)}
                                  >
                                    🗑️ Delete & Re-record
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : responseTypes[question.id] === 'link' || (hasSubmission && isUrl(submission.submission_response)) ? (
                      <div className="link-input-section">
                        {isReviewMode && hasSubmission ? (
                          <div className="link-review-display">
                            <a href={responses[question.id]} target="_blank" rel="noopener noreferrer" className="submitted-link">
                              {responses[question.id]}
                            </a>
                          </div>
                        ) : (
                          <>
                            <p className="link-hint">Paste a YouTube or Google Drive link below (encouraged)</p>
                            <input
                              type="url"
                              className="link-input"
                              placeholder="https://www.youtube.com/watch?v=... or https://drive.google.com/..."
                              value={responses[question.id] || ''}
                              onChange={(e) => handleResponseChange(question.id, e.target.value)}
                              readOnly={isReviewMode && hasSubmission}
                            />
                            {responses[question.id] && isUrl(responses[question.id]) && (
                              <a href={responses[question.id]} target="_blank" rel="noopener noreferrer" className="link-preview">
                                Preview: {responses[question.id]}
                              </a>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <textarea
                        className="response-textarea"
                        placeholder="Type your response here ..."
                        value={responses[question.id] || ''}
                        onChange={(e) => handleResponseChange(question.id, e.target.value)}
                        rows={6}
                        readOnly={isReviewMode && hasSubmission}
                      />
                    )}
                  </>
                )}

                {/* Show correct answer for multiple choice in review mode */}
                {isReviewMode && hasSubmission && question.question_type === 'multiple_choice' && question.correct_answers && question.correct_answers.length > 0 && (
                  <div className="correct-answer">
                    <strong>Correct Answer{question.correct_answers.length > 1 ? 's' : ''}:</strong> {question.correct_answers.join(', ')}
                  </div>
                )}

                {/* Show grade if available */}
                {submission?.grade && (
                  <div className="submission-grade">
                    <div className="grade-score">
                      <strong>Grade:</strong> {submission.grade.score != null ? parseFloat(Number(submission.grade.score).toFixed(2)) : 0} / {submission.grade.total != null ? parseFloat(Number(submission.grade.total).toFixed(2)) : 0}
                    </div>
                    {submission.grade.teacher_comment && (
                      <div className="teacher-comment">
                        <strong>Teacher Feedback:</strong>
                        <p className="comment-text">{submission.grade.teacher_comment}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="submit-section">
          {!isReviewMode && (
            <button 
              onClick={handleSubmit} 
              className="submit-button"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Assignment'}
            </button>
          )}
          {isReviewMode && (
            <div className="submission-complete-notice">
              <p>✓ Assignment submitted. You cannot resubmit.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StudentHW;
