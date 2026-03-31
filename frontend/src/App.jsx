import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import TeacherRegisterPage from './pages/auth/TeacherRegisterPage';
import StudentRegisterPage from './pages/auth/StudentRegisterPage';
import ProtectedRoute from './components/ProtectedRoute';



function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/teacher" element={<TeacherRegisterPage />} />
          <Route path="/register/student" element={<StudentRegisterPage />} />
          
         {/* Protected Teacher Dashboard */}
          <Route path="/dashboard/teacher" element={
            <ProtectedRoute allowedRole="teacher">
              <TeacherDashboardPlaceholder />
            </ProtectedRoute>
          } />

          {/* Protected Student Dashboard */}
          <Route path="/dashboard/student" element={
            <ProtectedRoute allowedRole="student">
              <StudentDashboardPlaceholder />
            </ProtectedRoute>
          } />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  ); 
}

// Simple Dashboards with Logout for testing
function TeacherDashboardPlaceholder() {
  const { logout, user } = useAuth();
  return (
    <div className="landing-wrapper h-screen p-20 text-white">
      <h1 className="text-4xl mb-4">Teacher Dashboard</h1>
      <p className="mb-8 text-slate-400">Welcome, {user?.teacher_profile?.first_name || 'Educator'}</p>
      <button onClick={logout} className="btn-primary">Logout</button>
    </div>
  );
}

function StudentDashboardPlaceholder() {
  const { logout, user } = useAuth();
  return (
    <div className="landing-wrapper h-screen p-20 text-white">
      <h1 className="text-4xl mb-4 text-cyan-400">Student Dashboard</h1>
      <p className="mb-8 text-slate-400">Welcome, {user?.student_profile?.first_name || 'Learner'}</p>
      <button onClick={logout} className="btn-student">Logout</button>
    </div>
  );
}


export default App;