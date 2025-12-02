import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, moduleAPI } from '../services/api';
import type { Course, Module } from '../types';
import './TeacherModules.css';

const TeacherModules: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
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
        setCourses(enrolledCourses);
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
      setModules(courseModules.sort((a, b) => a.module_order - b.module_order));
    } catch (error) {
      console.error('Error loading modules:', error);
    }
  };

  const handlePostModule = async (moduleId: number) => {
    try {
      const module = modules.find(m => m.id === moduleId);
      if (module) {
        await moduleAPI.update(moduleId, { ...module, is_posted: true });
        loadModules(selectedCourse!);
      }
    } catch (error) {
      console.error('Error posting module:', error);
    }
  };

  const handleDeleteModule = async (moduleId: number) => {
    if (window.confirm('Are you sure you want to delete this module?')) {
      try {
        await moduleAPI.delete(moduleId);
        loadModules(selectedCourse!);
      } catch (error) {
        console.error('Error deleting module:', error);
      }
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="teacher-modules">
      <Header />
      
      <div className="modules-content">
        <div className="modules-header">
          <h1>Course Modules</h1>
          <button 
            className="create-button"
            onClick={() => {
              // TODO: Open create module modal or navigate to create page
              alert('Create module functionality coming soon');
            }}
          >
            + Create Module
          </button>
        </div>

        {selectedCourse && (
          <div className="modules-list">
            {modules.map((module) => (
              <div key={module.id} className="module-card">
                <div className="module-header">
                  <div>
                    <h3>{module.module_name}</h3>
                    <p className="module-description">
                      {module.module_description || 'Description of the module'}
                    </p>
                    <div className="module-meta">
                      <span>Due: {new Date().toLocaleDateString()}</span>
                      <span>Questions: {0}</span>
                      {module.is_posted && <span className="posted-badge">Posted</span>}
                    </div>
                  </div>
                  <div className="module-actions">
                    {module.is_posted ? (
                      <button 
                        className="btn-edit"
                        onClick={() => navigate(`/teacher/modules/${module.id}/edit`)}
                      >
                        Edit
                      </button>
                    ) : (
                      <>
                        <button 
                          className="btn-post"
                          onClick={() => handlePostModule(module.id)}
                        >
                          Post to Students
                        </button>
                        <button 
                          className="btn-edit"
                          onClick={() => navigate(`/teacher/modules/${module.id}/edit`)}
                        >
                          Edit
                        </button>
                      </>
                    )}
                    <button 
                      className="btn-delete"
                      onClick={() => handleDeleteModule(module.id)}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TeacherModules;

