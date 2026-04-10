import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { moduleAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { moduleDisplayTitle, type Module } from '../types';
import './StudentModuleVideo.css';

const StudentModuleVideo: React.FC = () => {
  const { moduleId } = useParams<{ moduleId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [module, setModule] = useState<Module | null>(null);
  const [loading, setLoading] = useState(true);
  const [videoId, setVideoId] = useState<string | null>(null);

  useEffect(() => {
    if (moduleId && user) {
      loadModuleData();
    }
  }, [moduleId, user]);

  const loadModuleData = async () => {
    try {
      setLoading(true);
      
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
          console.warn('Accessibility check failed:', error);
        }
      }
      
      // Load module
      let moduleData;
      try {
        console.log('Attempting to load module with ID:', moduleId);
        moduleData = await moduleAPI.getById(Number(moduleId));
        console.log('Successfully loaded module:', moduleData);
        setModule(moduleData);

        // Extract YouTube video ID from URL
        if (moduleData.youtube_link) {
          const extractedId = extractYouTubeId(moduleData.youtube_link);
          console.log('YouTube link:', moduleData.youtube_link);
          console.log('Extracted video ID:', extractedId);
          setVideoId(extractedId);
          if (!extractedId) {
            console.warn('Failed to extract video ID from URL:', moduleData.youtube_link);
          }
        }
      } catch (error: any) {
        console.error('Error loading module:', error);
        console.error('Error details:', {
          status: error.response?.status,
          data: error.response?.data,
          message: error.message,
          moduleId: moduleId
        });
        if (error.response?.status === 404) {
          alert(`Module ${moduleId} not found. Please check with your teacher. The module may have been deleted or you may not have access.`);
          navigate('/');
          return;
        } else if (error.response?.status === 403) {
          alert(error.response?.data?.error || `You do not have access to module ${moduleId}.`);
          navigate('/');
          return;
        }
        alert(`Error loading module ${moduleId}. Please check the browser console for details.`);
        navigate('/');
        return;
      }
    } catch (error: any) {
      console.error('Error loading module:', error);
      if (error.response?.status === 403) {
        alert(error.response?.data?.error || 'You do not have access to this module.');
        navigate('/');
        return;
      }
      alert('Error loading module. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Extract YouTube video ID from various URL formats
  const extractYouTubeId = (url: string): string | null => {
    if (!url) return null;
    
    // Trim whitespace
    url = url.trim();
    
    // Handle different YouTube URL formats
    const patterns = [
      /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
      /^([a-zA-Z0-9_-]{11})$/,
      /[?&]v=([a-zA-Z0-9_-]{11})/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1] && match[1].length === 11) {
        return match[1];
      }
    }
    
    return null;
  };

  const handleNext = () => {
    navigate(`/student/hw/${moduleId}`, { state: { fromVideo: true } });
  };

  const handleSkip = () => {
    navigate(`/student/hw/${moduleId}`, { state: { fromVideo: true } });
  };

  // If no video link or video ID couldn't be extracted, redirect to questions
  // Only check after loading is complete and we have module data
  useEffect(() => {
    if (!loading && module) {
      if (!module.youtube_link) {
        navigate(`/student/hw/${moduleId}`, { replace: true, state: { fromVideo: true } });
      } else if (module.youtube_link && !videoId) {
        console.warn('Could not extract video ID from:', module.youtube_link);
        navigate(`/student/hw/${moduleId}`, { replace: true, state: { fromVideo: true } });
      }
    }
  }, [loading, module, videoId, moduleId, navigate]);

  if (loading) {
    return (
      <div className="student-module-video">
        <Header />
        <div className="video-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  if (!module) {
    return (
      <div className="student-module-video">
        <Header />
        <div className="video-content">
          <div>Module not found</div>
        </div>
      </div>
    );
  }

  // If no video link or video ID, show redirect message (useEffect will handle redirect)
  if (!module.youtube_link || !videoId) {
    return (
      <div className="student-module-video">
        <Header />
        <div className="video-content">
          <div>Redirecting to questions...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-module-video">
      <Header />
      
      <div className="video-content">
        <button 
          className="back-button"
          onClick={() => navigate('/')}
        >
          <span className="back-arrow">←</span>
          Back to Home
        </button>
        
        <div className="video-header">
          <h1>{moduleDisplayTitle(module)}</h1>
          {module.module_description && (
            <p className="module-description">{module.module_description}</p>
          )}
        </div>

        <div className="video-container">
          <div className="video-wrapper">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${videoId}?rel=0`}
              title="Module Introduction Video"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            ></iframe>
          </div>
        </div>

        <div className="video-actions">
          <button className="btn-next" onClick={handleNext}>
            Continue to Questions →
          </button>
        </div>
      </div>
    </div>
  );
};

export default StudentModuleVideo;
