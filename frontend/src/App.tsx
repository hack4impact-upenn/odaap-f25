import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { CourseProvider } from './contexts/CourseContext';
import Login from './pages/Login';
import StudentMain from './pages/StudentMain';
import StudentHW from './pages/StudentHW';
import StudentModuleVideo from './pages/StudentModuleVideo';
import StudentFieldAssignment from './pages/StudentFieldAssignment';
import StudentResources from './pages/StudentResources';
import TeacherMain from './pages/TeacherMain';
import TeacherModules from './pages/TeacherModules';
import TeacherEditModule from './pages/TeacherEditModule';
import TeacherAnnouncements from './pages/TeacherAnnouncements';
import TeacherSettings from './pages/TeacherSettings';
import TeacherCourses from './pages/TeacherCourses';
import TeacherGrading from './pages/TeacherGrading';
import './App.css';

// Protected Route component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Route based on user role
const RoleBasedRoute: React.FC<{ 
  studentComponent: React.ReactNode;
  teacherComponent: React.ReactNode;
}> = ({ studentComponent, teacherComponent }) => {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{user.isStudent ? studentComponent : teacherComponent}</>;
};

function App() {
  return (
    <AuthProvider>
      <CourseProvider>
        <Router>
          <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <RoleBasedRoute
                  studentComponent={<StudentMain />}
                  teacherComponent={<TeacherMain />}
                />
              </ProtectedRoute>
            }
          />

          {/* Student Routes */}
          <Route
            path="/student/module/:moduleId/video"
            element={
              <ProtectedRoute>
                <StudentModuleVideo />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/hw/:moduleId"
            element={
              <ProtectedRoute>
                <StudentHW />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/field-assignment/:moduleId"
            element={
              <ProtectedRoute>
                <StudentFieldAssignment />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/resources"
            element={
              <ProtectedRoute>
                <StudentResources />
              </ProtectedRoute>
            }
          />

          {/* Teacher Routes */}
          <Route
            path="/teacher/modules"
            element={
              <ProtectedRoute>
                <TeacherModules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/modules/:moduleId/edit"
            element={
              <ProtectedRoute>
                <TeacherEditModule />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/announcements"
            element={
              <ProtectedRoute>
                <TeacherAnnouncements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/settings"
            element={
              <ProtectedRoute>
                <TeacherSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/courses"
            element={
              <ProtectedRoute>
                <TeacherCourses />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/grading"
            element={
              <ProtectedRoute>
                <TeacherGrading />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Router>
      </CourseProvider>
    </AuthProvider>
  );
}

export default App;
