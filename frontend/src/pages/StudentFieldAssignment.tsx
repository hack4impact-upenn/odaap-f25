import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI, submissionAPI } from '../services/api';
import type { Module, Question } from '../types';
import { serializeFieldAssignmentPayload, isYoutubeLikeUrl } from '../utils/fieldAssignment';
import './StudentFieldAssignment.css';

const isUrl = (text: string): boolean => {
  try {
    const url = new URL(text.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const StudentFieldAssignment: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const [module, setModule] = useState<Module | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [youtubeUrl, setYoutubeUrl] = useState('');
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

      const questions = await moduleAPI.getQuestions(Number(moduleId));
      const fieldQuestion = questions.find((q) => q.question_type === 'video');
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
    const f = e.target.files?.[0] || null;
    setFile(f);
    if (f) setYoutubeUrl('');
  };

  const handleYoutubeChange = (v: string) => {
    setYoutubeUrl(v);
    if (v.trim()) setFile(null);
  };

  const handleSubmit = async () => {
    if (!question) return;

    const yt = youtubeUrl.trim();
    const hasFile = !!file;
    const hasYt = yt.length > 0;

    if (!hasFile && !hasYt) {
      alert('Upload a file or paste a YouTube link—use one or the other, not both.');
      return;
    }
    if (hasFile && hasYt) {
      alert('Choose either a file upload or a YouTube link, not both.');
      return;
    }
    if (hasYt) {
      if (!isUrl(yt)) {
        alert('YouTube link must be a valid URL (https://...)');
        return;
      }
      if (!isYoutubeLikeUrl(yt)) {
        alert('Link must be a YouTube URL (youtube.com or youtu.be)');
        return;
      }
    }

    try {
      const payload = hasFile
        ? serializeFieldAssignmentPayload({
            fileName: file!.name,
            fileUrl: `upload:${file!.name}`,
          })
        : serializeFieldAssignmentPayload({ youtubeUrl: yt });

      await submissionAPI.submit({
        question_id: question.id,
        module_id: Number(moduleId),
        submission_type: 'video',
        response: payload,
      });

      alert('Field assignment submitted successfully!');
      navigate('/');
    } catch (error) {
      console.error('Error submitting:', error);
      alert('Error submitting assignment. Please try again.');
    }
  };

  const formatDue = (dateString?: string) => {
    if (!dateString) return 'TBD';
    try {
      const datePart = dateString.split('T')[0];
      const [year, month, day] = datePart.split('-').map(Number);
      return new Date(year, month - 1, day).toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
    } catch {
      return dateString;
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
        <button type="button" onClick={() => navigate('/')} className="back-button">
          <span className="back-arrow">←</span>
          Back to Home
        </button>

        <div className="field-header">
          <span className="due-date">Due: {formatDue(module.due_date)}</span>
        </div>

        <h1 className="assignment-title">Field Assignment</h1>

        <div className="prompt-section">
          <h3 className="prompt-label">Prompt</h3>
          <p className="prompt-text">{question.question_text}</p>
        </div>

        <div className="file-upload-section">
          <p className="field-assignment-page-hint">
            Submit either an uploaded file or a YouTube link.
          </p>
          <label className="file-upload-label">
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,image/*,video/*,audio/*"
              onChange={handleFileChange}
              className="file-input"
            />
            <div className="file-upload-button">Choose file</div>
          </label>
          {file && <p className="file-name">Selected: {file.name}</p>}

          <p className="field-assignment-or-page">— or —</p>

          <label className="field-assignment-youtube-label-page" htmlFor="field-yt">
            YouTube Link
          </label>
          <input
            id="field-yt"
            type="url"
            className="field-assignment-youtube-input-page"
            placeholder="https://www.youtube.com/watch?v=..."
            value={youtubeUrl}
            onChange={(e) => handleYoutubeChange(e.target.value)}
          />
        </div>

        <div className="submit-section">
          <button type="button" onClick={handleSubmit} className="submit-button">
            Submit Assignment
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentFieldAssignment;
