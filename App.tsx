import React, { useEffect } from 'react';
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
import { auth, db } from './firebase';
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
  useEffect(() => {
    const registerForm = document.getElementById("registerForm");
    if (registerForm) {
      const handleSubmit = async (e: Event) => {
        e.preventDefault();

        const nameInput = document.getElementById("name") as HTMLInputElement;
        const emailInput = document.getElementById("email") as HTMLInputElement;
        const passwordInput = document.getElementById("password") as HTMLInputElement;

        if (nameInput && emailInput && passwordInput) {
          const name = nameInput.value;
          const email = emailInput.value;
          const password = passwordInput.value;

          try {
            // 1) Create user in Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            // 2) Store extra data in Firestore
            await setDoc(doc(db, "users", user.uid), {
              name: name,
              email: email,
              uid: user.uid,
              role: "student",
              createdAt: serverTimestamp()
            });

            alert("Registration Successful!");
          } catch (err: any) {
            alert("Error: " + err.message);
          }
        }
      };

      registerForm.addEventListener("submit", handleSubmit);
      
      return () => {
        registerForm.removeEventListener("submit", handleSubmit);
      };
    }
  }, []);

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