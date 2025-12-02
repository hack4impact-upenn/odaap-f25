import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, moduleAPI } from '../services/api';
import type { Course, Module } from '../types';
import './TeacherMain.css';

const TeacherMain: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'overview' | 'modules' | 'announcements' | 'grading'>('overview');
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      if (user) {
        const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
        setCourses(enrolledCourses);
        
        if (enrolledCourses.length > 0) {
          const courseModules = await moduleAPI.getAll(enrolledCourses[0].id);
          setModules(courseModules);
        }
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateModuleProgress = (module: Module) => {
    // TODO: Calculate based on student submissions
    // For now, return mock data
    if (module.is_posted) {
      return Math.floor(Math.random() * 100);
    }
    return 0;
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="teacher-main">
      <Header />
      
      <div className="teacher-content">
        <nav className="teacher-nav">
          <button 
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button 
            className={activeTab === 'modules' ? 'active' : ''}
            onClick={() => setActiveTab('modules')}
          >
            Modules
          </button>
          <button 
            className={activeTab === 'announcements' ? 'active' : ''}
            onClick={() => setActiveTab('announcements')}
          >
            Announcements
          </button>
          <button 
            className={activeTab === 'grading' ? 'active' : ''}
            onClick={() => setActiveTab('grading')}
          >
            Grading
          </button>
        </nav>

        {activeTab === 'overview' && (
          <div className="overview-content">
            <h2 className="section-title">Module Completion</h2>
            
            {/* Module Progress Cards */}
            <div className="module-progress-grid">
              {modules.map((module) => {
                const progress = calculateModuleProgress(module);
                return (
                  <div key={module.id} className="progress-card">
                    <h3>{module.module_name}</h3>
                    <div className="progress-bar-container">
                      <div 
                        className="progress-bar" 
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <span className="progress-text">{progress}% complete</span>
                  </div>
                );
              })}
            </div>

            {/* Students Section */}
            <div className="students-section">
              <h2 className="section-title">Students</h2>
              <div className="students-list">
                {/* TODO: Fetch actual students from API */}
                <div className="student-item">
                  <div className="student-info">
                    <h4>John Doe</h4>
                    <p>john@gmail.com</p>
                  </div>
                  <div className="student-stats">
                    <span className="grade">Overall Grade: 98</span>
                    <span className="status">No Overdue Assignments</span>
                  </div>
                </div>
                {/* Add more student items */}
              </div>
            </div>

            {/* Teachers Section */}
            <div className="teachers-section">
              <h2 className="section-title">Teachers</h2>
              <div className="teachers-list">
                {/* TODO: Fetch actual teachers from API */}
                <div className="teacher-item">
                  <h4>John Doe</h4>
                  <p>johndon@gmail.com</p>
                </div>
                {/* Add more teacher items */}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'modules' && (
          <div className="modules-tab-content">
            <button 
              className="create-button"
              onClick={() => navigate('/teacher/modules')}
            >
              + Create Module
            </button>
            {/* Modules list will be in TeacherModules component */}
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="announcements-tab-content">
            <button className="create-button">+ Create Announcement</button>
            {/* Announcements will be in TeacherAnnouncements component */}
          </div>
        )}

        {activeTab === 'grading' && (
          <div className="grading-tab-content">
            <h2>Grading</h2>
            {/* Grading interface */}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherMain;

