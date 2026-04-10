import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { courseAPI, resourceAPI } from '../services/api';
import type { Course, Resource, ResourceLink } from '../types';
import './StudentResources.css';

function isPdfResourceLink(link: ResourceLink): boolean {
  if (link.kind === 'pdf') return true;
  try {
    const u = link.url.toLowerCase();
    return u.endsWith('.pdf') || u.includes('/resource_pdfs/');
  } catch {
    return false;
  }
}

function pdfDownloadFilename(link: ResourceLink): string {
  let name = link.label.trim() || 'document';
  if (!name.toLowerCase().endsWith('.pdf')) {
    name = `${name}.pdf`;
  }
  return name;
}

const StudentResources: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentCourse, setCurrentCourse] = useState<Course | null>(null);
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);
      if (!user) return;

      const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
      if (enrolledCourses.length > 0) {
        setCurrentCourse(enrolledCourses[0]);
        const resourcesData = await resourceAPI.getAll(enrolledCourses[0].id);
        setResources(resourcesData);
      }
    } catch (error) {
      console.error('Error loading resources:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="student-resources-page">
        <Header />
        <div className="student-resources-content">
          <div>Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="student-resources-page">
      <Header />

      <div className="student-resources-content">
        <button className="back-button" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </button>

        <h1 className="resources-page-title">
          {currentCourse?.course_name ? `${currentCourse.course_name} — Resources` : 'Resources'}
        </h1>

        {resources.length === 0 ? (
          <div className="no-resources-message">
            <p>No resources have been added yet. Check back later!</p>
          </div>
        ) : (
          <div className="resources-grid">
            {resources.map((resource) => (
              <div key={resource.id} className="resource-card">
                <h2 className="resource-card-title">{resource.title}</h2>
                {resource.description && (
                  <p className="resource-card-description">{resource.description}</p>
                )}
                {resource.links.length > 0 && (
                  <div className="resource-card-links">
                    {resource.links.map((link, i) => {
                      const isPdf = isPdfResourceLink(link);
                      return (
                        <a
                          key={i}
                          href={link.url}
                          className={`resource-card-link ${isPdf ? 'resource-card-link-pdf' : ''}`}
                          {...(isPdf
                            ? { download: pdfDownloadFilename(link) }
                            : { target: '_blank', rel: 'noopener noreferrer' })}
                        >
                          {link.label}
                          <span className="link-icon">{isPdf ? '📄' : '🔗'}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default StudentResources;
