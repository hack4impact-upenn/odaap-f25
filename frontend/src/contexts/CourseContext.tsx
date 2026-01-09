import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { courseAPI } from '../services/api';
import { useAuth } from './AuthContext';
import type { Course } from '../types';

interface CourseContextType {
  selectedCourse: Course | null;
  courses: Course[];
  setSelectedCourse: (course: Course | null) => void;
  loadCourses: () => Promise<void>;
  loading: boolean;
}

const CourseContext = createContext<CourseContextType | undefined>(undefined);

export const CourseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [selectedCourse, setSelectedCourseState] = useState<Course | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const loadCourses = async () => {
    try {
      if (user) {
        const enrolledCourses = await courseAPI.getEnrolledCourses(user.id);
        setCourses(enrolledCourses);
        
        // If we have a selected course, try to keep it selected
        let courseToSelect: Course | null = null;
        if (selectedCourse) {
          const foundCourse = enrolledCourses.find(c => c.id === selectedCourse.id);
          if (foundCourse) {
            courseToSelect = foundCourse;
          }
        }
        
        // Otherwise, select the first course or restore from localStorage
        if (!courseToSelect && enrolledCourses.length > 0) {
          const savedCourseId = localStorage.getItem('selectedCourseId');
          if (savedCourseId) {
            const savedCourse = enrolledCourses.find(c => c.id === Number(savedCourseId));
            if (savedCourse) {
              courseToSelect = savedCourse;
            }
          }
          if (!courseToSelect) {
            courseToSelect = enrolledCourses[0];
          }
        }
        
        if (courseToSelect) {
          setSelectedCourseState(courseToSelect);
          localStorage.setItem('selectedCourseId', courseToSelect.id.toString());
        } else {
          setSelectedCourseState(null);
          localStorage.removeItem('selectedCourseId');
        }
      }
    } catch (error) {
      console.error('Error loading courses:', error);
    } finally {
      setLoading(false);
    }
  };

  const setSelectedCourse = (course: Course | null) => {
    setSelectedCourseState(course);
    if (course) {
      localStorage.setItem('selectedCourseId', course.id.toString());
    } else {
      localStorage.removeItem('selectedCourseId');
    }
  };

  useEffect(() => {
    if (user) {
      loadCourses();
    }
  }, [user]);

  const value = {
    selectedCourse,
    courses,
    setSelectedCourse,
    loadCourses,
    loading,
  };

  return <CourseContext.Provider value={value}>{children}</CourseContext.Provider>;
};

export const useCourse = () => {
  const context = useContext(CourseContext);
  if (context === undefined) {
    throw new Error('useCourse must be used within a CourseProvider');
  }
  return context;
};
