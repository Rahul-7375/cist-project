import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import FacultyDashboard from './pages/faculty/FacultyDashboard';
import StudentDashboard from './pages/student/StudentDashboard';
import AdminDashboard from './pages/admin/AdminDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import { UserRole } from './types';

// Protected Route Component
const ProtectedRoute = ({ children, allowedRoles }: React.PropsWithChildren<{ allowedRoles?: UserRole[] }>) => {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Redirect to appropriate dashboard if role doesn't match
    if (user.role === UserRole.FACULTY) return <Navigate to="/faculty" />;
    if (user.role === UserRole.STUDENT) return <Navigate to="/student" />;
    if (user.role === UserRole.ADMIN) return <Navigate to="/admin" />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/login" />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            
            {/* Faculty Routes */}
            <Route path="/faculty/*" element={
              <ProtectedRoute allowedRoles={[UserRole.FACULTY]}>
                <Layout title="Faculty Portal">
                  <FacultyDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Student Routes */}
            <Route path="/student/*" element={
              <ProtectedRoute allowedRoles={[UserRole.STUDENT]}>
                <Layout title="Student Portal">
                  <StudentDashboard />
                </Layout>
              </ProtectedRoute>
            } />

            {/* Admin Routes */}
            <Route path="/admin/*" element={
              <ProtectedRoute allowedRoles={[UserRole.ADMIN]}>
                <Layout title="Admin Portal">
                  <AdminDashboard />
                </Layout>
              </ProtectedRoute>
            } />
          </Routes>
        </HashRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;