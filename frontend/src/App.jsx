import { BrowserRouter, Routes, Route, Outlet } from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import { ClassProvider } from './context/ClassContext'; // Import the new provider
import ProtectedRoute from './components/ProtectedRoute';



// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import TeacherRegisterPage from './pages/auth/TeacherRegisterPage';
import StudentRegisterPage from './pages/auth/StudentRegisterPage';
import TeacherOverview from './pages/teacher/TeacherOverview';
import CreateClass from './pages/teacher/CreateClass';
import ClassDetails from './pages/teacher/ClassDetails';
import CourseBuilder from './pages/teacher/CourseBuilder';
import LessonEditor from './pages/teacher/LessonEditor';
import QuizBuilder from './pages/teacher/QuizBuilder';






// Layouts
import TeacherLayout from './components/layouts/TeacherLayout';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* --- Public Routes --- */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register/teacher" element={<TeacherRegisterPage />} />
          <Route path="/register/student" element={<StudentRegisterPage />} />
          
          {/* Protected Teacher Dashboard */}
          <Route 
            path="/dashboard/teacher" 
            element={
              <ProtectedRoute allowedRole="teacher">
                <ClassProvider>
                   {/* Layout is now the PARENT. It stays mounted. */}
                   <TeacherLayout /> 
                </ClassProvider>
              </ProtectedRoute>
            } 
          >
          {/* These children will render inside the Layout's <Outlet /> */}
            <Route index element={<TeacherOverview />} />
            <Route path="students" element={<div>Students Page</div>} />
            <Route path="analytics" element={<div>Analytics Page</div>} />
            <Route path="classes/new" element={<CreateClass />} />
            <Route path="class/:id" element={<ClassDetails />} />
            <Route path="class/:classId/course/:id" element={<CourseBuilder />} />
            <Route path="class/:classId/lesson/:id" element={<LessonEditor />} />
            <Route path="class/:classId/quiz/:id" element={<QuizBuilder />} />
          </Route>

          {/* Student Dashboard */}
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

/**
 * Student Placeholder
 * (You can move this to its own file later)
 */
function StudentDashboardPlaceholder() {
  const { logout, user } = useAuth();
  return (
    <div className="landing-wrapper h-screen p-20 text-white student-theme">
      <h1 className="text-4xl mb-4 text-cyan-400 font-bold">Student Dashboard</h1>
      <p className="mb-8 text-slate-400">Welcome back, {user?.student_profile?.first_name || 'Learner'}</p>
      <button onClick={logout} className="btn-student">Logout</button>
    </div>
  );
}

export default App;