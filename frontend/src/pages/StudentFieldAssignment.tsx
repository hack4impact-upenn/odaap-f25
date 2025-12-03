import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, questionAPI, submissionAPI } from '../services/api';
import type { Module, Question } from '../types';
import './StudentFieldAssignment.css';

const StudentFieldAssignment: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [file, setFile] = useState<File | null>(null);
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

      // Get field assignment question (video type)
      const questions = await moduleAPI.getQuestions(Number(moduleId));
      const fieldQuestion = questions.find(q => q.question_type === 'video');
      if (fieldQuestion) {
        setQuestion(fieldQuestion);
      }
    } catch (error) {
      console.error('Error loading module:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleSubmit = async () => {
    if (!file || !question) {
      alert('Please select a video file');
      return;
    }

    try {
      // TODO: Upload file to S3 and get URL
      // For now, we'll use a placeholder
      const fileUrl = `s3://bucket/${file.name}`;

      await submissionAPI.submit({
        question_id: question.id,
        module_id: Number(moduleId),
        submission_type: 'video',
        response: fileUrl,
      });

      alert('Field assignment submitted successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Error submitting assignment. Please try again.');
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!module || !question) {
    return <div>Field assignment not found</div>;
  }

  return (
    <div className="field-assignment">
      <Header />
      
      <div className="field-content">
        <div className="field-header">
          <button onClick={() => navigate('/')} className="back-button">
            ← Back to Home
          </button>
          <span className="due-date">Due: {new Date().toLocaleDateString()}</span>
        </div>

        <h1 className="assignment-title">Field Assignment</h1>

        <div className="prompt-section">
          <h3 className="prompt-label">Prompt</h3>
          <p className="prompt-text">{question.question_text}</p>
        </div>

        <div className="file-upload-section">
          <label className="file-upload-label">
            <input
              type="file"
              accept="video/mp4,video/*"
              onChange={handleFileChange}
              className="file-input"
            />
            <div className="file-upload-button">
              Attach Video (mp4)
            </div>
          </label>
          {file && (
            <p className="file-name">Selected: {file.name}</p>
          )}
        </div>

        <div className="submit-section">
          <button onClick={handleSubmit} className="submit-button">
            Submit Assignment
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentFieldAssignment;

